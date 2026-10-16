'use strict';

// The relay and the static files over plain HTTP, on either runtime (no browser):
// every /api route against the Econt mock, including Econt's faults, and the
// security/cache headers of the static files (server.js on Node, public/_headers
// on Cloudflare).
//
//   APP_URL=... MOCK_URL=... node tests/e2e/api.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { APP, MOCK, suite, mock } = require('./lib');
const T = require('../../public/core/track.js');

const { ok, finish } = suite('api');
const ROOT = path.join(__dirname, '..', '..');
const CREDS = { mode: 'production', username: 'u', password: 'pw' };
const DEMO = { mode: 'demo', username: 'u', password: 'pw' };
const BAD = { mode: 'production', username: 'u', password: 'wrong' };
const SENDER = { name: 'Иван', phone: '0878916695', officeCode: '1111' };
const DEFAULTS = { shipmentType: 'pack', packCount: 1, weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: true, currency: 'EUR' } };
const OVR = (o) => Object.assign({ recipientName: 'Мария Петрова', phone: '0888123456', officeCode: '2222', cod: { enabled: true, amount: 45, currency: 'EUR' }, reviewMode: 'none' }, o || {});

// Like the app (public/app.js api()): every JSON body carries client: 2. An old tab's
// request is sent with client: null.
async function post(route, body, opts) {
  if (body && typeof body === 'object' && !('client' in body)) body = Object.assign({ client: 2 }, body);
  const r = await fetch(APP + route, Object.assign({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body || {}) }, opts || {}));
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, headers: r.headers, text, json };
}
const get = (p, headers) => fetch(APP + p, { headers: headers || {} });
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const CSP = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

(async () => {
  await mock.reset();

  // ---------- static files ----------
  { const r = await get('/');
    const body = Buffer.from(await r.arrayBuffer());
    ok('GET / is the app', r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && sha(body) === sha(fs.readFileSync(path.join(ROOT, 'public/index.html'))), r.status + ' ' + r.headers.get('content-type'));
    ok('GET / security headers', r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('referrer-policy') === 'no-referrer' && r.headers.get('content-security-policy') === CSP, [...r.headers].map((h) => h.join(': ')).join(' | '));
    ok('GET / revalidates on every load', r.headers.get('cache-control') === 'no-cache', r.headers.get('cache-control'));
    const etag = r.headers.get('etag');
    const r304 = await get('/', { 'If-None-Match': etag });
    ok('GET / with its ETag answers 304', !!etag && r304.status === 304, etag + ' -> ' + r304.status);
  }
  for (const f of ['app.js', 'core/parser.js', 'core/match.js', 'core/track.js']) {
    const r = await get('/' + f);
    const body = Buffer.from(await r.arrayBuffer());
    ok(`GET /${f}: same bytes as public/${f}, no-cache, nosniff`, r.status === 200 && /javascript/.test(r.headers.get('content-type')) && r.headers.get('cache-control') === 'no-cache'
      && r.headers.get('x-content-type-options') === 'nosniff' && sha(body) === sha(fs.readFileSync(path.join(ROOT, 'public', f))), r.status + ' ' + r.headers.get('content-type') + ' ' + r.headers.get('cache-control'));
  }
  { const r = await get('/fonts/geist-400-700-latin.woff2');
    ok('fonts are kept a year (immutable)', r.status === 200 && r.headers.get('cache-control') === 'public, max-age=31536000, immutable' && /font\/woff2/.test(r.headers.get('content-type')), r.headers.get('cache-control') + ' ' + r.headers.get('content-type'));
    await r.arrayBuffer();
    const m = await get('/manifest.webmanifest'); await m.arrayBuffer();
    ok('manifest revalidates', m.status === 200 && m.headers.get('cache-control') === 'no-cache', m.headers.get('cache-control'));
    const h = await get('/_headers'); await h.arrayBuffer();
    ok('_headers is not served', h.status === 404, String(h.status));
    const n = await get('/nope.html'); await n.arrayBuffer();
    ok('unknown file is 404', n.status === 404, String(n.status));
  }

  // ---------- relay basics ----------
  { const r = await get('/api/test'); await r.text();
    ok('GET /api/* is 405', r.status === 405);
    const p = await post('/api/ping', {});
    ok('ping', p.status === 200 && p.json && p.json.ok === true && /application\/json/.test(p.headers.get('content-type')), p.text);
    const u = await post('/api/nope', {});
    ok('unknown endpoint is 404', u.status === 404 && u.json.error === 'Unknown endpoint', u.text);
    const bad = await post('/api/test', '{bad');
    ok('bad JSON is 400', bad.status === 400 && bad.json && bad.json.ok === false, bad.status + ' ' + bad.text);
    for (const route of ['/api/parse', '/api/parse-batch', '/api/offices', '/api/offices/status', '/api/offices/refresh', '/api/warm']) {
      const a = await post(route, { creds: CREDS, text: 'Мария 0888123456' });
      const e = await post(route, { lang: 'en' });
      if (!ok('retired ' + route + ' says reload', a.json && a.json.code === 'app_updated' && a.json.error === 'Приложението е обновено. Презаредете страницата.' && e.json.error === 'The app was updated. Reload the page.', a.text)) break;
    }
  }

  // ---------- login check ----------
  { let r = await post('/api/test', { creds: CREDS });
    ok('test: good login', r.json && r.json.ok === true && r.json.mode === 'production', r.text);
    // A tab open from before the update (its body has no client: 2) read the office
    // count from this reply ("Налични са , офиса." without it): told to reload.
    const sOld = await mock.state();
    r = await post('/api/test', { creds: CREDS, client: null });
    const r2 = await post('/api/test', JSON.stringify({ creds: CREDS, lang: 'en' }));
    ok('test: a page from before the update is told to reload', r.json.ok === false && r.json.code === 'app_updated' && r.json.error === 'Приложението е обновено. Презаредете страницата.'
      && r2.json.code === 'app_updated' && r2.json.error === 'The app was updated. Reload the page.' && (await mock.state()).profiles === sOld.profiles, r.text + ' ' + r2.text);
    r = await post('/api/test', { creds: BAD });
    ok('test: wrong password (Econt 500 + message) = bad_login', r.json.ok === false && r.json.code === 'bad_login' && /^Грешен потребител или парола за Еконт/.test(r.json.error), r.text);
    r = await post('/api/test', { creds: BAD, lang: 'en' });
    ok('test: wrong password in English', r.json.error.startsWith('Wrong Econt username or password.'), r.text);
    r = await post('/api/test', { creds: { mode: 'production', username: 'u' } });
    ok('test: missing password', r.json.ok === false && r.json.error === 'Липсват данни за вход в Еконт.', r.text);
    await mock.control({ faults: { profile: { mode: 'down' } } });
    r = await post('/api/test', { creds: CREDS });
    ok('test: Econt unreachable = network', r.json.ok === false && r.json.code === 'network' && r.json.error === 'Няма връзка с Еконт в момента. Опитайте пак след малко.', r.text);
    await mock.control({ faults: { profile: { mode: '502' } } });
    r = await post('/api/test', { creds: CREDS });
    ok('test: Econt 502 page is an error, not a wrong password and not OK', r.json.ok === false && !r.json.code && r.json.status === 502, r.text);
    await mock.control({ faults: { profile: { mode: 'auth' } } });
    r = await post('/api/test', { creds: CREDS });
    ok('test: Econt says access denied = bad_login', r.json.code === 'bad_login', r.text);
    const s0 = await mock.state();
    r = await post('/api/test', { creds: DEMO });
    const s1 = await mock.state();
    ok('test: demo mode asks the demo host', r.json.ok === true && r.json.mode === 'demo' && s1.profiles === s0.profiles + 1, r.text);
  }

  // ---------- payouts ----------
  { const r = await post('/api/payouts', { creds: CREDS });
    const o = r.json.options || [];
    ok('payouts: agreements, duplicates dropped', r.json.ok && o.length === 2 && o[0].num === 'CD12345' && o[0].iban === 'BG80BNBG96611020345678' && o[0].currency === 'EUR' && o[1].method === 'office' && o[1].express === true
      && Object.keys(o[0]).join(',') === 'num,method,iban,bic,currency,officeCode,express,payDays,payWeekdays', r.text);
    const b = await post('/api/payouts', { creds: BAD });
    ok('payouts: wrong password', b.json.ok === false && b.json.code === 'bad_login', b.text);
  }

  // ---------- price and create ----------
  { const s0 = await mock.state();
    let r = await post('/api/preview', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR() });
    const s1 = await mock.state();
    ok('preview: price with its currency', r.json.ok && r.json.mode === 'calculate' && r.json.totalPrice === 6.4 && r.json.totalPriceCurrency === 'EUR' && r.json.response.label.totalPriceCurrency === 'EUR', r.text.slice(0, 200));
    ok('preview: a calculate, never a create', s1.previews === s0.previews + 1 && s1.creates === s0.creates && s1.lastLabel.op === 'calculate');
    ok('preview: label built by econt.buildLabel', r.json.label && r.json.label.receiverOfficeCode === '2222' && r.json.label.senderOfficeCode === '1111' && r.json.label.receiverClient.phones[0] === '0888123456', JSON.stringify(r.json.label).slice(0, 200));
    r = await post('/api/preview', { creds: CREDS, sender: { name: 'Иван' }, defaults: DEFAULTS, overrides: OVR() });
    ok('preview: sender phone missing', r.json.ok === false && r.json.error === 'Липсват име и телефон на подателя. Довърши настройката.', r.text);
    r = await post('/api/preview', { creds: CREDS, lang: 'en', sender: { name: 'Иван', phone: '0878916695' }, defaults: DEFAULTS, overrides: OVR() });
    ok('preview: drop-off office missing (English)', r.json.ok === false && r.json.error === 'Your drop-off office is not set. Open Settings and choose your office.', r.text);
    await mock.control({ faults: { calculate: { mode: 'lost' } } });
    r = await post('/api/preview', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR() });
    ok('preview: a lost reply is an error, never "unclear"', r.json.ok === false && !r.json.unsure, r.text);

    const c0 = (await mock.state()).creates;
    r = await post('/api/create', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR() });
    const st = await mock.state();
    const lab = st.createdLabels[st.createdLabels.length - 1];
    ok('create: a waybill', r.json.ok && r.json.mode === 'create' && /^\d{13}$/.test(r.json.response.label.shipmentNumber) && st.creates === c0 + 1 && lab.phone === '0888123456' && lab.officeCode === '2222', r.text.slice(0, 160));
    ok('create: COD on the label', lab.label.services && lab.label.services.cdAmount === 45 && lab.label.services.cdCurrency === 'EUR', JSON.stringify(lab.label.services));
    ok('create: no review flag when none asked', !r.json.reviewIgnored, r.text.slice(0, 80));
    r = await post('/api/create', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR({ officeCode: '3390', reviewMode: 'review', payAfterAccept: true }) });
    ok('create to a parcel locker with review: reviewIgnored + Econt\'s words', r.json.ok && r.json.reviewIgnored === true && r.json.reviewIgnoredMessage === 'Услугата преглед не се предлага при доставка до Еконтомат.', JSON.stringify({ ri: r.json.reviewIgnored, m: r.json.reviewIgnoredMessage, l: r.json.label && r.json.label.payAfterAccept }));
    r = await post('/api/create', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR({ officeCode: '2290' }) });
    ok('create to a sorting hub: Econt\'s nested message, a clear "no"', r.json.ok === false && r.json.error === 'Невалиден обслужващ офис' && r.json.status === 400 && !r.json.unsure, r.text.slice(0, 200));
    r = await post('/api/create', { creds: BAD, sender: SENDER, defaults: DEFAULTS, overrides: OVR() });
    ok('create with a wrong password: bad_login, not unclear', r.json.ok === false && r.json.code === 'bad_login' && !r.json.unsure, r.text.slice(0, 200));

    // Faults where a waybill may or may not exist: always "unclear".
    for (const [mode, made] of [['lost', 1], ['502after', 1], ['cut', 1], ['502', 0], ['down', 0]]) {
      const a = (await mock.state()).creates;
      await mock.control({ faults: { create: { mode } } });
      r = await post('/api/create', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR({ phone: '0888000' + (100 + made) }) });
      const b = (await mock.state()).creates;
      ok(`create, Econt fault "${mode}": unsure flag (waybill made: ${made ? 'yes' : 'no'})`, r.json.ok === false && r.json.unsure === true && b === a + made, r.text.slice(0, 160));
    }
    await mock.control({ faults: { create: { mode: 'slow', ms: 1500 } } });
    const t0 = Date.now();
    r = await post('/api/create', { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVR() });
    ok('create, slow Econt (1.5 s): waits and succeeds', r.json.ok === true && Date.now() - t0 >= 1400, (Date.now() - t0) + ' ms');
  }

  // ---------- tracking ----------
  // The relay hands Econt's reply over unread; the browser reads it with
  // public/core/track.js into what /api/track used to answer.
  { const nums = ['1051602900001', '1051602900002', '1051602900003', '9999000000001'];
    let r = await post('/api/track', { creds: CREDS, shipmentNumbers: nums });
    ok('track: Econt\'s reply passed through as JSON, never cached', r.status === 200 && r.json && Array.isArray(r.json.shipmentStatuses) && r.json.shipmentStatuses.length === 4
      && /application\/json/.test(r.headers.get('content-type')) && r.headers.get('cache-control') === 'no-store', r.status + ' ' + r.text.slice(0, 120));
    ok('track: Econt asked for an uncompressed reply', (await mock.state()).trackAcceptEncoding === 'identity', (await mock.state()).trackAcceptEncoding);
    let read = T.trackReply(r.json, 'bg');
    const p = read.parcels || [];
    ok('track: one entry per number', read.ok && p.length === 4 && p[0].number === nums[0], JSON.stringify(read).slice(0, 120));
    ok('track: statuses and money', p[0].status === 'Доставена' && p[0].statusEn === 'Delivered' && p[0].cdCollected === 45 && p[0].cdCurrency === 'EUR' && p[2].status === 'Върната' && p[1].deliveryAttempts === 0, JSON.stringify(p[0]).slice(0, 200));
    const ev0 = p[0].events;
    ok('track: events in the client\'s shape', ev0.length === 4 && ev0.every((e) => Object.keys(e).join(',') === 'time,office,text,type,isReceipt,officeCode'), JSON.stringify(ev0[0]));
    ok('track: event texts (details, hub, delivered)', ev0[0].text === 'Приета в офис София Павлово' && ev0[0].office === 'София Павлово' && ev0[1].office === 'Пловдив' && ev0[1].text === 'Преминава през логистичен център'
      && ev0[3].type === 'client' && ev0[3].isReceipt === true && ev0[3].text === 'Доставена на получателя', JSON.stringify(ev0));
    ok('track: a return is told apart', p[2].events[3].type === 'return' && p[2].events[3].text === 'Отказана от получателя' && p[2].storageOffice === 'Варна Чайка', JSON.stringify(p[2].events[3]));
    ok('track: unknown number carries Econt\'s error', p[3].error === 'Пратка 9999000000001 не е намерена', JSON.stringify(p[3]).slice(0, 160));
    r = await post('/api/track', { creds: CREDS, lang: 'en', shipmentNumbers: nums.slice(0, 1) });
    const e = T.trackReply(r.json, 'en').parcels[0].events;
    ok('track: English event texts', e[1].office === 'Plovdiv' && e[1].text === 'Passing through a hub' && e[0].text === 'Accepted at Sofia Pavlovo' && e[2].office === 'Plovdiv Center' && e[2].text === 'Ready for pick-up at the office', JSON.stringify(e));
    // An Econt-sized reply (about 15 KB a parcel) goes through whole.
    await mock.control({ heavyTracking: true });
    r = await post('/api/track', { creds: CREDS, shipmentNumbers: nums.slice(0, 3) });
    await mock.control({ heavyTracking: false });
    read = T.trackReply(r.json, 'bg');
    ok('track: Econt-sized reply passed through whole', r.text.length > 40000 && r.json.shipmentStatuses[0].status.trackingEvents.length === 12 && read.parcels.length === 3 && read.parcels[0].events.length === 12, r.text.length + ' bytes');
    const t0 = (await mock.state()).tracks;
    r = await post('/api/track', { creds: CREDS, shipmentNumbers: [{ x: 1 }, null] });
    ok('track: nothing to ask, Econt not called', r.json.ok && r.json.parcels.length === 0 && (await mock.state()).tracks === t0, r.text);
    // Errors still come back as { ok: false }.
    r = await post('/api/track', { creds: BAD, shipmentNumbers: nums.slice(0, 1) });
    ok('track: wrong password = bad_login', r.json.ok === false && r.json.code === 'bad_login', r.text.slice(0, 160));
    await mock.control({ faults: { track: { mode: '502' } } });
    r = await post('/api/track', { creds: CREDS, shipmentNumbers: nums.slice(0, 1) });
    ok('track: Econt 502 page = an error with its status', r.json.ok === false && r.json.status === 502, r.text.slice(0, 160));
    await mock.control({ faults: { track: { mode: 'down' } } });
    r = await post('/api/track', { creds: CREDS, shipmentNumbers: nums.slice(0, 1) });
    ok('track: Econt unreachable = an error', r.json.ok === false && /Cannot reach Econt/.test(r.json.error), r.text.slice(0, 160));
    // Econt cuts its reply mid-body: the browser must never get it as complete.
    await mock.control({ faults: { track: { mode: 'cut' } } });
    let cutOk = false, cutInfo = '';
    try { const c = await fetch(APP + '/api/track', { method: 'POST', body: JSON.stringify({ creds: CREDS, client: 2, shipmentNumbers: nums }) }); const t = await c.text(); try { JSON.parse(t); cutInfo = 'parsed?! ' + t.length; } catch { cutOk = true; cutInfo = 'truncated body ' + t.length; } } catch (err) { cutOk = true; cutInfo = 'connection cut: ' + err.message; }
    ok('track: a cut reply never reaches the browser as complete', cutOk, cutInfo);
    // A page from before the update expects the parcels already read: told to reload.
    const t1 = (await mock.state()).tracks;
    r = await post('/api/track', { creds: CREDS, client: null, shipmentNumbers: nums.slice(0, 1) });
    ok('track: a page from before the update is told to reload', r.json.ok === false && r.json.code === 'app_updated' && (await mock.state()).tracks === t1, r.text);
    await mock.control({ clearFaults: true });
  }

  // ---------- the office list, passed through ----------
  { const viaRelay = await fetch(APP + '/api/offices/list', { method: 'POST', body: JSON.stringify({ creds: CREDS }), headers: { 'Accept-Encoding': 'identity' } });
    const relayBytes = Buffer.from(await viaRelay.arrayBuffer());
    const direct = await fetch(MOCK + '/prod/services/Nomenclatures/NomenclaturesService.getOffices.json', { method: 'POST', body: JSON.stringify({ countryCode: 'BGR', showCargoReceptions: false, showLC: false }), headers: { Authorization: 'Basic ' + Buffer.from('u:pw').toString('base64'), 'Accept-Encoding': 'identity' } });
    const directBytes = Buffer.from(await direct.arrayBuffer());
    ok('offices/list: Econt\'s body byte for byte', viaRelay.status === 200 && relayBytes.length > 1000 && sha(relayBytes) === sha(directBytes), relayBytes.length + ' vs ' + directBytes.length);
    ok('offices/list: JSON, never cached', /application\/json/.test(viaRelay.headers.get('content-type')) && viaRelay.headers.get('cache-control') === 'no-store', viaRelay.headers.get('content-type') + ' ' + viaRelay.headers.get('cache-control'));
    ok('offices/list: Econt asked for an uncompressed list', (await mock.state()).officesAcceptEncoding === 'identity');
    // The browser takes gzip: whoever compresses it, the JSON is the same.
    const gz = await new Promise((resolve, reject) => {
      const u = new URL(APP + '/api/offices/list');
      const req = require('http').request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Accept-Encoding': 'gzip', 'Content-Type': 'application/json' } }, (res) => {
        const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ enc: res.headers['content-encoding'] || '', body: Buffer.concat(chunks) })); res.on('error', reject);
      });
      req.on('error', reject); req.end(JSON.stringify({ creds: CREDS }));
    });
    const plain = gz.enc === 'gzip' ? zlib.gunzipSync(gz.body) : gz.body;
    ok('offices/list with gzip accepted: same list', sha(plain) === sha(directBytes), 'encoding=' + (gz.enc || 'none') + ' bytes=' + gz.body.length);
    const d0 = (await mock.state()).offices.demo;
    const demo = await post('/api/offices/list', { creds: DEMO });
    ok('offices/list: demo mode, demo host', demo.json && demo.json.offices.length === 12 && (await mock.state()).offices.demo === d0 + 1, String(demo.json && demo.json.offices && demo.json.offices.length));
    let r = await post('/api/offices/list', { creds: BAD });
    ok('offices/list: wrong password is an error reply', r.json.ok === false && r.json.code === 'bad_login', r.text.slice(0, 160));
    r = await post('/api/offices/list', {});
    ok('offices/list: missing login', r.json.ok === false && r.json.error === 'Липсват данни за вход в Еконт.', r.text);
    await mock.control({ faults: { offices: { mode: '502' } } });
    r = await post('/api/offices/list', { creds: CREDS });
    ok('offices/list: Econt 502 page is an error reply', r.json.ok === false && r.json.error === 'Econt HTTP 502', r.text.slice(0, 160));
    await mock.control({ faults: { offices: { mode: 'cut' } } });
    let cutOk = false, cutInfo = '';
    try { const c = await fetch(APP + '/api/offices/list', { method: 'POST', body: JSON.stringify({ creds: CREDS }) }); const t = await c.text(); try { JSON.parse(t); cutInfo = 'parsed?! ' + t.length; } catch { cutOk = true; cutInfo = 'truncated body ' + t.length; } } catch (e) { cutOk = true; cutInfo = 'connection cut: ' + e.message; }
    ok('offices/list: a cut list never reaches the browser as complete', cutOk, cutInfo);
    await mock.control({ clearFaults: true, bigOffices: true });
    const big = await fetch(APP + '/api/offices/list', { method: 'POST', body: JSON.stringify({ creds: CREDS }), headers: { 'Accept-Encoding': 'identity' } });
    const bigBytes = Buffer.from(await big.arrayBuffer());
    let bigN = 0; try { bigN = JSON.parse(bigBytes).offices.length; } catch {}
    ok('offices/list: the full-size list (1000 offices) passes through', bigN === 1000 && bigBytes.length > 3e6, (bigBytes.length / 1e6).toFixed(1) + ' MB, ' + bigN + ' offices');
    await mock.control({ bigOffices: false });
  }

  // ---------- request size cap (last: a cut request can upset wrangler dev's proxy for the next one) ----------
  { const huge = JSON.stringify({ creds: CREDS, pad: 'x'.repeat(1.2e6) });
    const r = await post('/api/test', huge);
    ok('a body over 1 MB is refused with 413', r.status === 413 && r.json && r.json.error === 'Request too large', r.status + ' ' + r.text.slice(0, 80));
    await fetch(APP + '/api/ping', { method: 'POST' }).then((x) => x.text()).catch(() => {});
    const after = await post('/api/ping', {});
    ok('the relay answers normally afterwards', after.status === 200 && after.json.ok === true, after.status + ' ' + after.text);
  }
  finish();
})().catch((e) => finish(e));
