'use strict';

// Stateless proxy for the Econt shipper. Holds NO secrets and NO database:
// the browser sends the user's Econt credentials (decrypted from their PIN) with
// each request, and this server simply relays to Econt and ranks offices.

const http = require('http');
const fs = require('fs');
const path = require('path');
const econt = require('./econt');
const { parseMessage, matchOffices } = require('./parser');

const ROOT = __dirname;
const PORT = process.env.PORT || 5005;

// In-memory office nomenclature cache, keyed by environment. The office list is
// the same for every valid user of a given mode, so this is shared safely.
const officeCache = { demo: null, production: null };

async function loadOffices(creds, force) {
  const key = creds.mode === 'production' ? 'production' : 'demo';
  if (!force && officeCache[key] && officeCache[key].offices.length) {
    return officeCache[key].offices;
  }
  const data = await econt.getOffices(creds, 'BGR');
  const offices = data.offices || [];
  officeCache[key] = { offices, at: Date.now() };
  return offices;
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
    const parsed = parseMessage(body.text || '');
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
      return sendJson(res, 200, { ok: true, count: offices.length });
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
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
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
