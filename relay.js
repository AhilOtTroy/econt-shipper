'use strict';

// The thin relay between the browser and Econt. One handler, written against the
// Web Fetch API (Request in, Response out), so the very same code serves the
// Cloudflare Worker (worker.js) and the Node server (server.js).
//
// Holds NO secrets and NO database: the browser sends the user's Econt login
// (decrypted from their PIN) with each request, and the relay passes it on.
// Parsing messages and matching offices happen in the browser (public/core/), so
// every route here does little more than one fetch: well under the Workers Free
// plan's 10 ms of CPU per request. The office list (~4 MB) and the tracking
// statuses (~15 KB per parcel) are passed through as a stream, never parsed here.

const econt = require('./econt');
// Econt's nested error messages, flattened (shared with the browser's tracking reader).
const { flattenEcontError } = require('./public/core/track.js');

const BODY_LIMIT = 1e6; // bytes of a request body

// Friendly (user-facing) messages, in the UI's language (the client sends body.lang).
const FRIENDLY = {
  missing_creds: { bg: 'Липсват данни за вход в Еконт.', en: 'Missing Econt credentials.' },
  sender_missing: { bg: 'Липсват име и телефон на подателя. Довърши настройката.', en: 'Sender name or phone is missing. Finish setup.' },
  bad_login: { bg: 'Грешен потребител или парола за Еконт. Използвайте същите данни, с които влизате в e-econt.com (главните и малките букви имат значение).', en: 'Wrong Econt username or password. Use the same details you sign in to e-econt.com with (case-sensitive).' },
  econt_down: { bg: 'Няма връзка с Еконт в момента. Опитайте пак след малко.', en: 'Cannot reach Econt right now. Try again in a moment.' },
  office_missing: { bg: 'Не е избран офис за подаване. Отвори Настройки и избери офис.', en: 'Your drop-off office is not set. Open Settings and choose your office.' },
  app_updated: { bg: 'Приложението е обновено. Презаредете страницата.', en: 'The app was updated. Reload the page.' },
};
const fr = (body, key, params) => FRIENDLY[key][body && body.lang === 'en' ? 'en' : 'bg']
  .replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? String(params[k]) : m));

// Routes the browser no longer calls (it parses, matches and keeps the office list
// itself). A page still open from before the update gets a "reload" message.
const RETIRED = new Set(['/api/parse', '/api/parse-batch', '/api/offices', '/api/offices/status', '/api/offices/refresh', '/api/warm']);

// The base URLs come from the environment: ECONT_BASE_PRODUCTION / ECONT_BASE_DEMO
// (process.env on Node, the Worker's env bindings on Cloudflare). Unset = Econt's own.
function configFromEnv(env) {
  env = env || {};
  return { bases: { production: env.ECONT_BASE_PRODUCTION || undefined, demo: env.ECONT_BASE_DEMO || undefined } };
}

// ---------- Econt response helpers ----------
// createLabel/calculate reply -> extra top-level fields for the client.
// - Econt's label is a ShipmentStatus: the price currency is `currency`. The
//   client reads `totalPriceCurrency`, so fill it in (only when missing).
// - payAfterAcceptIgnored (Econt's info message, e.g. for parcel lockers/APS,
//   where преглед/тест is not offered) means the waybill carries NO review/test.
function decorateLabelReply(resp) {
  const extra = {};
  const st = resp && typeof resp === 'object' ? (resp.label && typeof resp.label === 'object' ? resp.label : resp) : null;
  if (st) {
    if (st.totalPriceCurrency == null && st.currency) st.totalPriceCurrency = st.currency;
    if (st.totalPrice != null) extra.totalPrice = st.totalPrice;
    if (st.totalPriceCurrency) extra.totalPriceCurrency = st.totalPriceCurrency;
  }
  const notes = [];
  for (const src of [resp, st]) {
    if (!src || typeof src !== 'object') continue;
    for (const k of ['payAfterAcceptIgnored', 'payAfterTestIgnored']) {
      const v = src[k];
      if (v === true || (typeof v === 'string' && v.trim())) notes.push(typeof v === 'string' ? v.trim() : '');
    }
  }
  if (notes.length) {
    extra.reviewIgnored = true;
    extra.reviewIgnoredMessage = [...new Set(notes.filter(Boolean))].join('; ') || null;
  }
  return extra;
}

// Econt does NOT reliably use 401 for a wrong login: it often answers 400/500
// with "Невалидно потребителско име и/или парола" in the body. Detect both.
// A 403 with a non-JSON body is a proxy/firewall page, not a password problem.
const AUTH_MSG_RE = /потребителско име|парол|password|unauthori[sz]ed|credential|authenticat/i;
function isAuthFail(e) {
  if (!e || e.kind !== 'http') return false;
  if (e.status === 401) return true;
  if (e.status === 403 && e.body && e.body.raw) return false;
  if (e.status === 403) return true;
  return AUTH_MSG_RE.test(flattenEcontError(e.body || {}, []).join(' '));
}

function errorPayload(e) {
  if (e.kind === 'http') {
    const b = e.body || {};
    const msgs = flattenEcontError(b, []);
    const msg = msgs.length ? [...new Set(msgs)].join('; ') : ('Econt HTTP ' + e.status);
    const out = { ok: false, error: msg, status: e.status, body: b };
    if (isAuthFail(e)) out.code = 'bad_login';
    return out;
  }
  return { ok: false, error: e.message };
}

function getCreds(body) {
  const c = body.creds || {};
  if (!c.username || !c.password) { const e = new Error(fr(body, 'missing_creds')); e.friendly = true; throw e; }
  return { mode: c.mode === 'production' ? 'production' : 'demo', username: c.username, password: c.password };
}
const failed = (e) => json(200, e.friendly ? { ok: false, error: e.message } : errorPayload(e));

// ---------- http helpers ----------
const JSON_TYPE = 'application/json; charset=utf-8';
function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': JSON_TYPE } });
}
const httpError = (status, msg) => Object.assign(new Error(msg), { httpStatus: status });

// The request body as a JSON object ({} for an empty body or a non-object), read
// with a size cap. Too large = 413, unreadable or not JSON = 400.
async function readJson(request, limit) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > limit) throw httpError(413, 'Request body too large');
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    let step;
    try { step = await reader.read(); } catch (e) { throw httpError(400, 'Request aborted'); } // client hung up mid-body
    if (step.done) break;
    size += step.value.byteLength;
    if (size > limit) { reader.cancel().catch(() => {}); throw httpError(413, 'Request body too large'); }
    chunks.push(step.value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  const raw = new TextDecoder().decode(all);
  if (!raw) return {};
  let v;
  try { v = JSON.parse(raw); } catch (e) { throw httpError(400, 'Bad JSON'); }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

// Last-resort error reply.
function failResponse(e) {
  const status = (e && e.httpStatus) || 500;
  if (status >= 500) console.error(e);
  return json(status, { ok: false, error: status === 413 ? 'Request too large' : status === 400 ? 'Bad request' : ((e && e.message) || 'Server error') });
}

// ---------- routes ----------
const ROUTES = {
  // Wake-up call. Render spins the Node server down when idle; the client pings
  // while the PIN is typed so the cold start overlaps something the user does anyway.
  '/api/ping': async () => json(200, { ok: true }),

  // Validate Econt credentials (setup wizard + settings). Uses the client-profile
  // call because it always requires a valid login; the office list is public on
  // some Econt hosts, so it could say "OK" for a wrong password. The browser counts
  // the offices itself (from its own copy of the list).
  // A page from before the update (no `client: 2` in the body) would show "Налични
  // са , офиса." for the office count this reply no longer has: it is told to reload.
  '/api/test': async (body, opts) => {
    if (!(Number(body.client) >= 2)) return json(200, { ok: false, code: 'app_updated', error: fr(body, 'app_updated') });
    try {
      const creds = getCreds(body);
      try { await econt.getClientProfiles(creds, opts); }
      catch (e) {
        if (isAuthFail(e)) return json(200, { ok: false, code: 'bad_login', error: fr(body, 'bad_login') });
        if (e.kind === 'network') return json(200, { ok: false, code: 'network', error: fr(body, 'econt_down') });
        // Only if the profile service itself is missing do we fall back to an office
        // call; anything else is reported, never turned into a false "OK". Only the
        // status is looked at: the list itself is not read here.
        if (!(e.kind === 'http' && (e.status === 404 || e.status === 405))) throw e;
        const res = await econt.getOfficesRaw(creds, 'BGR', opts);
        if (res.body) res.body.cancel().catch(() => {});
      }
      return json(200, { ok: true, mode: creds.mode });
    } catch (e) {
      if (isAuthFail(e)) return json(200, { ok: false, code: 'bad_login', error: fr(body, 'bad_login') });
      return failed(e);
    }
  },

  // The whole office list, exactly as Econt sends it, streamed through without
  // being parsed (that is ~4 MB of JSON: parsing it alone would take more CPU than
  // a Workers Free request may use). The browser trims and keeps it for 6 hours.
  // An Econt error comes back as the usual { ok: false, error } instead.
  '/api/offices/list': async (body, opts) => {
    try {
      const creds = getCreds(body);
      const res = await econt.getOfficesRaw(creds, 'BGR', opts);
      return new Response(res.body, { status: 200, headers: { 'Content-Type': JSON_TYPE, 'Cache-Control': 'no-store' } });
    } catch (e) { return failed(e); }
  },

  // Econt's tracking statuses, exactly as Econt sends them, streamed through
  // without being parsed (about 15 KB per parcel: parsing and mapping a batch took
  // a freshly started Worker over its CPU limit). The browser reads them
  // (public/core/track.js). An Econt error comes back as the usual { ok: false }.
  // A page from before the update expects the parcels already read: told to reload.
  '/api/track': async (body, opts) => {
    if (!(Number(body.client) >= 2)) return json(200, { ok: false, code: 'app_updated', error: fr(body, 'app_updated') });
    try {
      const creds = getCreds(body);
      const nums = (Array.isArray(body.shipmentNumbers) ? body.shipmentNumbers : []).filter((n) => typeof n === 'string' || typeof n === 'number').map(String).filter(Boolean);
      if (!nums.length) return json(200, { ok: true, parcels: [] });
      const res = await econt.getShipmentStatusesRaw(creds, nums, opts);
      return new Response(res.body, { status: 200, headers: { 'Content-Type': JSON_TYPE, 'Cache-Control': 'no-store' } });
    } catch (e) { return failed(e); }
  },

  // COD payout agreements registered on the user's Econt account. The IBAN lives
  // with Econt (signed agreement): we only ever let the user pick one by number.
  '/api/payouts': async (body, opts) => {
    try {
      const creds = getCreds(body);
      const r = await econt.getClientProfiles(creds, opts);
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
      return json(200, { ok: true, options });
    } catch (e) { return failed(e); }
  },

  '/api/preview': (body, opts) => labelRoute(body, opts, 'calculate'),
  '/api/create': (body, opts) => labelRoute(body, opts, 'create'),
};

async function labelRoute(body, opts, mode) {
  try {
    const creds = getCreds(body);
    const sender = body.sender || {};
    if (!sender.name || !sender.phone) return json(200, { ok: false, error: fr(body, 'sender_missing') });
    if (!sender.officeCode && !sender.address) return json(200, { ok: false, error: fr(body, 'office_missing') });
    const label = econt.buildLabel(sender, body.defaults || {}, body.overrides || {});
    const resp = await econt.createLabel(creds, label, mode, opts);
    // From here on a waybill may exist: nothing below may turn this into an error.
    let extra = {};
    try { extra = decorateLabelReply(resp); } catch (e) { console.error(e); }
    // Extra top-level fields: totalPrice/totalPriceCurrency (the real price
    // currency) and reviewIgnored/reviewIgnoredMessage when Econt dropped преглед/тест.
    return json(200, Object.assign({ ok: true, mode, label, response: resp }, extra));
  } catch (e) {
    if (e.friendly) return json(200, { ok: false, error: e.message });
    const out = errorPayload(e);
    // A create that did not end in a clear Econt answer (connection or body lost,
    // any non-HTTP failure, gateway 502/503/504 without an Econt error body) may
    // still have produced a waybill. Flag it so the client treats it as
    // "unclear", never as a free retry.
    if (mode === 'create' && (e.kind !== 'http'
      || ([502, 503, 504].includes(e.status) && !flattenEcontError(e.body || {}, []).length))) out.unsure = true;
    return json(200, out);
  }
}

// The one entry point: an /api/* Request in, a Response out. Never throws.
async function handle(request, cfg) {
  try {
    const opts = { bases: (cfg && cfg.bases) || undefined };
    const url = new URL(request.url);
    if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
    const body = await readJson(request, BODY_LIMIT);
    const route = ROUTES[url.pathname];
    if (route) return await route(body, opts);
    if (RETIRED.has(url.pathname)) return json(200, { ok: false, code: 'app_updated', error: fr(body, 'app_updated') });
    return json(404, { ok: false, error: 'Unknown endpoint' });
  } catch (e) {
    return failResponse(e);
  }
}

module.exports = { handle, configFromEnv, FRIENDLY, RETIRED, decorateLabelReply, errorPayload, isAuthFail, flattenEcontError };
