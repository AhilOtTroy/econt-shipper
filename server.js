'use strict';

// Stateless proxy for the Econt shipper. Holds NO secrets and NO database:
// the browser sends the user's Econt credentials (decrypted from their PIN) with
// each request, and this server simply relays to Econt and ranks offices.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const econt = require('./econt');
const { parseMessage, matchOffices, splitBatch, stripNoise } = require('./parser');

const ROOT = __dirname;
const PORT = process.env.PORT || 5005;

// In-memory office nomenclature cache, keyed by environment. The office list is
// the same for every valid user of a given mode, so this is shared safely.
// Refreshed automatically every OFFICE_TTL_MS so newly opened offices appear
// without anyone pressing "refresh"; a stale list is served if Econt is down.
const officeCache = { demo: null, production: null };
const OFFICE_TTL_MS = 6 * 3600 * 1000;

async function loadOffices(creds, force) {
  const key = creds.mode === 'production' ? 'production' : 'demo';
  const c = officeCache[key];
  const fresh = c && c.offices.length && (Date.now() - c.at) < OFFICE_TTL_MS;
  if (!force && fresh) return c.offices;
  try {
    const data = await econt.getOffices(creds, 'BGR');
    const offices = data.offices || [];
    officeCache[key] = { offices, at: Date.now(), prevCount: c ? c.offices.length : 0 };
    return offices;
  } catch (e) {
    if (c && c.offices.length) return c.offices; // stale beats broken
    throw e;
  }
}
function officeStatus(key) {
  const c = officeCache[key];
  if (!c) return null;
  return { count: c.offices.length, ageMinutes: Math.round((Date.now() - c.at) / 60000), added: c.prevCount ? c.offices.length - c.prevCount : 0 };
}

// ---------- http helpers ----------
function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 1e6) req.destroy(); chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Econt nests its real validation message inside innerErrors with blank parents.
// Walk the tree and collect every non-empty message into one readable string.
function flattenEcontError(node, acc) {
  if (!node) return acc;
  const arr = Array.isArray(node) ? node : [node];
  for (const n of arr) {
    if (n && typeof n.message === 'string' && n.message.trim()) acc.push(n.message.trim());
    if (n && n.innerErrors) flattenEcontError(n.innerErrors, acc);
    if (n && n.errors) flattenEcontError(n.errors, acc);
  }
  return acc;
}

function errorPayload(e) {
  if (e.kind === 'http') {
    const b = e.body || {};
    const msgs = flattenEcontError(b, []);
    const msg = msgs.length ? [...new Set(msgs)].join(' — ') : ('Econt HTTP ' + e.status);
    return { ok: false, error: msg, status: e.status, body: b };
  }
  return { ok: false, error: e.message };
}

function getCreds(body) {
  const c = body.creds || {};
  if (!c.username || !c.password) { const e = new Error('Missing Econt credentials'); e.friendly = true; throw e; }
  return { mode: c.mode === 'production' ? 'production' : 'demo', username: c.username, password: c.password };
}

// ---------- routes ----------
async function handleApi(req, res, url) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const body = await readBody(req);

  // Validate Econt credentials (used by the setup wizard) — returns office count.
  if (url.pathname === '/api/test') {
    try {
      const creds = getCreds(body);
      const offices = await loadOffices(creds, true);
      return sendJson(res, 200, { ok: true, mode: creds.mode, officeCount: offices.length });
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  if (url.pathname === '/api/parse') {
    const parsed = parseMessage(stripNoise(body.text || ''));
    let candidates = [];
    if (parsed.deliveryType === 'office' && parsed.locationText) {
      try {
        const creds = getCreds(body);
        candidates = matchOffices(parsed.locationText, await loadOffices(creds));
      } catch (e) {
        return sendJson(res, 200, { ok: true, parsed, candidates: [], officesError: errorPayload(e).error });
      }
    }
    return sendJson(res, 200, { ok: true, parsed, candidates });
  }

  // Batch input: several parcels in one paste. Splits per phone number, parses
  // each chunk, detects existing waybill numbers (those rows are for tracking,
  // not creation), and matches offices — falling back to the whole chunk when
  // the pre-phone text is a listing header rather than a location.
  if (url.pathname === '/api/parse-batch') {
    const chunks = splitBatch(body.text || '');
    let offices = null, officesError = null;
    try { offices = await loadOffices(getCreds(body)); }
    catch (e) { officesError = errorPayload(e).error; }
    const rows = chunks.map((chunk) => {
      const parsed = parseMessage(chunk);
      const trackNum = (chunk.match(/\b\d{12,14}\b/) || [null])[0];
      let candidates = [];
      if (offices && parsed.deliveryType === 'office') {
        if (parsed.locationText) candidates = matchOffices(parsed.locationText, offices);
        if (!candidates.length) candidates = matchOffices(chunk.replace(/\b\d{6,}\b/g, ' '), offices);
      }
      return { chunk, parsed, candidates, trackNum };
    });
    return sendJson(res, 200, { ok: true, rows, officesError });
  }

  if (url.pathname === '/api/offices') {
    try {
      const creds = getCreds(body);
      const offices = await loadOffices(creds);
      return sendJson(res, 200, { ok: true, candidates: matchOffices(body.q || '', offices, 12) });
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  if (url.pathname === '/api/offices/refresh') {
    try {
      const creds = getCreds(body);
      const offices = await loadOffices(creds, true);
      const st = officeStatus(creds.mode === 'production' ? 'production' : 'demo');
      return sendJson(res, 200, { ok: true, count: offices.length, added: (st && st.added) || 0 });
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  // Live nomenclature status: how many active offices we track and how old the list is.
  if (url.pathname === '/api/offices/status') {
    try {
      const creds = getCreds(body);
      await loadOffices(creds); // fills or auto-renews the cache (TTL)
      const st = officeStatus(creds.mode === 'production' ? 'production' : 'demo');
      return sendJson(res, 200, Object.assign({ ok: true }, st));
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  if (url.pathname === '/api/track') {
    try {
      const creds = getCreds(body);
      const nums = (body.shipmentNumbers || []).filter(Boolean);
      if (!nums.length) return sendJson(res, 200, { ok: true, parcels: [] });
      const r = await econt.getShipmentStatuses(creds, nums);
      const parcels = (r.shipmentStatuses || []).map((e) => {
        const s = e.status || {};
        const evRaw = s.trackingEvents || [];
        return {
          number: s.shipmentNumber,
          error: e.error ? (flattenEcontError(e.error, []).join(' ') || null) : null,
          sender: (s.senderClient && s.senderClient.name) || null,
          senderOffice: s.senderOfficeCode || null,
          recipient: (s.receiverClient && s.receiverClient.name) || null,
          recipientPhone: (s.receiverClient && s.receiverClient.phones && s.receiverClient.phones[0]) || null,
          office: s.receiverOfficeCode || null,
          receiverAddress: (s.receiverAddress && s.receiverAddress.fullAddress) || null,
          storageOffice: s.storageOfficeName || null,
          type: s.shipmentType, packCount: s.packCount, weight: s.weight, description: s.shipmentDescription,
          status: s.shortDeliveryStatus || s.shortDeliveryStatusEn || null,
          statusEn: s.shortDeliveryStatusEn || null,
          deliveryAttempts: s.deliveryAttemptCount,
          createdTime: s.createdTime, sendTime: s.sendTime, deliveryTime: s.deliveryTime,
          expectedDeliveryDate: s.expectedDeliveryDate,
          cdCollected: s.cdCollectedAmount, cdCurrency: s.cdCollectedCurrency,
          totalPrice: s.totalPrice, currency: s.currency,
          routingCode: s.routingCode || null, returnURL: s.returnShipmentURL || null, pdfURL: s.pdfURL,
          events: evRaw.map((ev) => ({
            time: ev.time || ev.eventTime || ev.date || null,
            office: ev.officeName || ev.officeNameEn || null,
            text: ev.destinationDescription || ev.destinationDescriptionEn || ev.description || ev.officeName || '',
          })),
        };
      });
      return sendJson(res, 200, { ok: true, parcels });
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  // COD payout agreements registered on the user's Econt account. The IBAN lives
  // with Econt (signed agreement) — we only ever let the user pick one by number.
  if (url.pathname === '/api/payouts') {
    try {
      const creds = getCreds(body);
      const r = await econt.getClientProfiles(creds);
      const seen = new Set(), options = [];
      for (const p of (r.profiles || [])) {
        for (const a of (p.cdPayOptions || [])) {
          if (!a || !a.num || seen.has(a.num)) continue;
          seen.add(a.num);
          options.push({
            num: a.num,
            method: a.method || '',
            iban: a.IBAN || null,
            bic: a.BIC || null,
            currency: a.bankCurrency || null,
            officeCode: a.officeCode || null,
            express: !!a.express,
            payDays: a.payDays || [],
            payWeekdays: a.payWeekdays || [],
          });
        }
      }
      return sendJson(res, 200, { ok: true, options });
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  if (url.pathname === '/api/preview' || url.pathname === '/api/create') {
    try {
      const creds = getCreds(body);
      const sender = body.sender || {};
      if (!sender.name || !sender.phone) return sendJson(res, 200, { ok: false, error: 'Sender name/phone missing — finish setup.' });
      if (!sender.officeCode && !sender.address) return sendJson(res, 200, { ok: false, error: 'Your sender drop-off office is not set — open Settings and choose your office.' });
      const mode = url.pathname === '/api/create' ? 'create' : 'calculate';
      const label = econt.buildLabel(sender, body.defaults || {}, body.overrides || {});
      const resp = await econt.createLabel(creds, label, mode);
      return sendJson(res, 200, { ok: true, mode, label, response: resp });
    } catch (e) { return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e)); }
  }

  return sendJson(res, 404, { ok: false, error: 'Unknown endpoint' });
}

// ---------- static ----------
function serveStatic(req, res, url) {
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(ROOT, 'public', path.normalize(file).replace(/^([/\\])+/, ''));
  if (!full.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(full).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.webmanifest' ? 'application/manifest+json'
      : 'application/octet-stream';
    // Content-hash ETag + no-cache: the browser must revalidate every load, so a
    // new deploy is picked up immediately (no stale app.js), but unchanged files
    // still return a cheap 304 instead of re-downloading.
    const etag = '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 22) + '"';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); return res.end(); }
    // Gzip text assets (~70% smaller) when the client accepts it.
    const compressible = /^(text\/|application\/manifest)/.test(type);
    const wantsGzip = compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const body = wantsGzip ? zlib.gzipSync(data) : data;
    // Safe hardening headers (do not restrict script/style/connect, so OCR and inline styles keep working).
    const headers = {
      'Content-Type': type,
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'ETag': etag,
      'Vary': 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    };
    if (wantsGzip) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Econt shipper running:  http://localhost:${PORT}\n`);
});
