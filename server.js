'use strict';

// The Node server for the Econt shipper (Render, or `node server.js` locally).
// Serves the web app from public/ and hands every /api/* request to relay.js:
// the same handler the Cloudflare Worker (worker.js) runs. Holds NO secrets and
// NO database: the browser sends the user's Econt login with each request, the
// relay passes it on to Econt. Parsing and office matching run in the browser.
//
// Environment: PORT, and optionally ECONT_BASE_PRODUCTION / ECONT_BASE_DEMO to
// point the relay at another Econt host (the tests use a mock).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { Readable } = require('stream');
const relay = require('./relay');

const ROOT = __dirname;
const PORT = process.env.PORT || 5005;
const RELAY_CFG = relay.configFromEnv(process.env);

// ---------- /api/*: node req/res <-> the shared Fetch-API handler ----------
function toWebRequest(req) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else if (v != null) headers.set(k, v);
  }
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') { init.body = Readable.toWeb(req); init.duplex = 'half'; }
  return new Request('http://localhost' + req.url, init);
}
// The relay's replies are small JSON, except the office list it passes through
// from Econt (~4 MB, marked Cache-Control: no-store). Small replies are sent with a
// Content-Length as before; the pass-through is streamed, gzipped when the browser
// takes it.
async function sendWebResponse(req, res, response) {
  const headers = {};
  response.headers.forEach((v, k) => { headers[k] = v; });
  // The request body was not read to its end (too large / unreadable): close the connection.
  if (response.status === 400 || response.status === 413) headers.connection = 'close';
  if (!response.body) { res.writeHead(response.status, headers); return res.end(); }
  const stream = Readable.fromWeb(response.body);
  if (response.headers.get('cache-control') !== 'no-store') {
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const body = Buffer.concat(chunks);
    headers['content-length'] = body.length;
    res.writeHead(response.status, headers);
    return res.end(body);
  }
  const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gzip) { headers['content-encoding'] = 'gzip'; headers.vary = 'Accept-Encoding'; }
  res.writeHead(response.status, headers);
  await new Promise((resolve) => {
    const out = gzip ? zlib.createGzip() : null;
    // Econt cut the list mid-body: cut ours too, so the browser sees a failed load.
    stream.on('error', () => { if (out) out.destroy(); res.destroy(); resolve(); });
    res.on('close', () => { stream.destroy(); resolve(); });
    if (out) stream.pipe(out).pipe(res); else stream.pipe(res);
  });
}
async function handleApi(req, res) {
  const response = await relay.handle(toWebRequest(req), RELAY_CFG);
  await sendWebResponse(req, res, response);
}

// ---------- static ----------
// Static files change only on deploy: keep each file's bytes, ETag and gzip in
// memory, keyed by path and re-read only when its mtime/size changes.
const STATIC_CACHE = new Map();
function staticEntry(full, ext, cb) {
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return cb(err || new Error('not a file'));
    const hit = STATIC_CACHE.get(full);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return cb(null, hit);
    fs.readFile(full, (err2, data) => {
      if (err2) return cb(err2);
      const type = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.js' ? 'text/javascript; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.webmanifest' ? 'application/manifest+json'
        : ext === '.woff2' ? 'font/woff2'
        : ext === '.txt' ? 'text/plain; charset=utf-8'
        : 'application/octet-stream';
      const compressible = /^(text\/|application\/manifest)/.test(type);
      const entry = {
        mtimeMs: st.mtimeMs, size: st.size, data, type,
        etag: '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 22) + '"',
        gz: compressible ? zlib.gzipSync(data) : null,
      };
      STATIC_CACHE.set(full, entry);
      cb(null, entry);
    });
  });
}
function serveStatic(req, res, url) {
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  // public/_headers is Cloudflare's header config, not a page (Cloudflare never serves it either).
  if (path.basename(file) === '_headers') { res.writeHead(404); return res.end('Not found'); }
  const full = path.join(ROOT, 'public', path.normalize(file).replace(/^([/\\])+/, ''));
  if (!full.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  const ext = path.extname(full).toLowerCase();
  staticEntry(full, ext, (err, f) => { try {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    // Content-hash ETag + no-cache: the browser must revalidate every load, so a
    // new deploy is picked up immediately (no stale app.js), but unchanged files
    // still return a cheap 304 instead of re-downloading.
    // Fonts never change under the same file name: let the browser keep them.
    const cache = ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, { ETag: f.etag, 'Cache-Control': cache }); return res.end(); }
    // Gzip text assets (~70% smaller) when the client accepts it (compressed once, above).
    const wantsGzip = !!f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const body = wantsGzip ? f.gz : f.data;
    // Safe hardening headers (do not restrict script/style/connect, so OCR and inline styles keep working).
    const headers = {
      'Content-Type': f.type,
      'Content-Length': body.length,
      'Cache-Control': cache,
      'ETag': f.etag,
      'Vary': 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    };
    if (wantsGzip) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(body);
  } catch (e) { failRequest(res, e); } });
}

// Last-resort error reply. Never throws: the request may already be half-sent
// or the client gone.
function failRequest(res, e) {
  const status = (e && e.httpStatus) || 500;
  if (status >= 500) console.error(e);
  try {
    if (res.headersSent) return res.destroy();
    sendJson(res, status, { ok: false, error: status === 413 ? 'Request too large' : status === 400 ? 'Bad request' : ((e && e.message) || 'Server error') },
      status < 500 ? { Connection: 'close' } : null);
  } catch { try { res.destroy(); } catch {} }
}

async function handleRequest(req, res) {
  // A malformed request-target ("//a:b", "http://a:b/") makes new URL() throw:
  // answer 400 instead of letting it reject the handler and take the process down.
  let url;
  try { url = new URL(req.url || '/', 'http://localhost'); }
  catch { return failRequest(res, Object.assign(new Error('Bad request target'), { httpStatus: 400 })); }
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res);
    return serveStatic(req, res, url);
  } catch (e) {
    failRequest(res, e);
  }
}

// The handler's promise always has a catch: one bad request must never become
// an unhandled rejection, which would end the whole process (and every other
// user's in-flight create with it).
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((e) => failRequest(res, e));
});

server.listen(PORT, () => {
  console.log(`\n  Econt shipper running:  http://localhost:${PORT}\n`);
});
