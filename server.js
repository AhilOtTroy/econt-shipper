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
const { parseMessage, matchOffices, splitBatch, stripNoise, findWaybill, stripMoney, countPhones, namedParcelCount, phoneIndexOf, isCommonFirstName } = require('./parser');

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

// ---------- credentials Econt has accepted ----------
// The office list is shared and served from cache without asking Econt, so a
// request carrying made-up credentials would still get the full matching work.
// Expensive routes (parse-batch) first check that Econt has really accepted
// these credentials. Only a SHA-256 of mode+username+password is kept in memory,
// never the password itself. Only calls that always need a real login mark the
// credentials (the client-profile call behind login test/payouts, and a real
// create; offices, price and tracking may answer without one), and /api/warm runs
// the check in the background when the app opens, so a real user normally never
// waits on it.
const credSeen = new Map(); // hash -> { ok: true | false | null, at: ms }
const CRED_OK_TTL_MS = 12 * 3600 * 1000;
const CRED_BAD_TTL_MS = 60 * 1000;
const CRED_UNKNOWN_TTL_MS = 60 * 1000; // Econt could not tell: don't ask again for a minute
const CRED_MAX = 5000;
const VERIFY_WAIT_MS = 5000;
const VERIFY_TIMEOUT_MS = 15000;      // the profile call itself gives up after this
const credTtl = (ok) => (ok === true ? CRED_OK_TTL_MS : ok === false ? CRED_BAD_TTL_MS : CRED_UNKNOWN_TTL_MS);
const credInflight = new Map(); // hash -> { p: Promise, slow: boolean }
function credKey(c) {
  return crypto.createHash('sha256').update([c.mode, String(c.username), String(c.password)].join('\0')).digest('hex');
}
function rememberCreds(c, ok) {
  const k = credKey(c);
  credSeen.delete(k);
  credSeen.set(k, { ok, at: Date.now() });
  while (credSeen.size > CRED_MAX) credSeen.delete(credSeen.keys().next().value);
}
// true = Econt accepted them, false = Econt rejected them as a wrong login,
// null = could not tell (Econt unreachable, profile service missing). A real user
// is never locked out on null; the batch caps below still bound the work.
// One profile call per login at a time: concurrent pastes share it.
function verifyCreds(c) {
  const k = credKey(c);
  const hit = credSeen.get(k);
  if (hit && Date.now() - hit.at < credTtl(hit.ok)) return Promise.resolve(hit.ok);
  const f = credInflight.get(k);
  if (f) return f.p;
  const p = (async () => {
    try {
      await econt.getClientProfiles(c, { timeoutMs: VERIFY_TIMEOUT_MS });
      rememberCreds(c, true);
      return true;
    } catch (e) {
      if (isAuthFail(e)) { rememberCreds(c, false); return false; }
      rememberCreds(c, null);
      return null;
    } finally { credInflight.delete(k); }
  })();
  credInflight.set(k, { p, slow: false });
  return p;
}
// verifyCreds with a bounded wait. When a check for this login has already made one
// request wait the full time, later requests don't wait on it again ("could not tell").
async function verifyCredsBounded(c, waitMs) {
  const p = verifyCreds(c);
  const f = credInflight.get(credKey(c));
  if (f && f.slow) return null;
  const TIMEOUT = {};
  const v = await within(p, waitMs, TIMEOUT);
  if (v !== TIMEOUT) return v;
  if (f) f.slow = true;
  return null;
}

// ---------- office matching for batch input ----------
// Bounds for /api/parse-batch so one request cannot hold the single event loop
// for long: a size cap, a row cap, a yield between rows and a wall-clock budget
// after which the remaining rows simply get no office (the UI shows them as
// "office missing", never a wrong office).
const BATCH_MAX_TEXT = 80000;    // characters (100 parcels with chat noise fit easily)
const BATCH_MAX_ROWS = 100;
const BATCH_BUDGET_MS = 10000;   // this request's own matching time
const BATCH_WALL_MS = 30000;     // wall clock, including waiting for other batches
const PARSE_MAX_TEXT = 20000;    // characters of a single /api/parse message
const CHUNK_PARSE_MAX = 8000;    // characters of one batch row handed to the parser
const QUERY_MAX = 400;           // characters of a location phrase handed to the matcher
const SEARCH_MAX = 200;          // characters of an office-search query
const yieldLoop = () => new Promise((r) => setImmediate(r));
// One batch row at a time across ALL requests, each in its own event-loop turn, so
// many concurrent batches add waiting time to each other, never event-loop delay.
let rowChain = Promise.resolve();
function rowTurn() {
  const p = rowChain.then(yieldLoop);
  rowChain = p;
  return p;
}
// A very long row (pasted junk) is parsed only around its phone number.
function parseWindow(chunk) {
  if (chunk.length <= CHUNK_PARSE_MAX) return chunk;
  const at = phoneIndexOf(chunk);
  const from = Math.max(0, Math.min(at < 0 ? 0 : at - 3000, chunk.length - CHUNK_PARSE_MAX));
  return chunk.slice(from, from + CHUNK_PARSE_MAX);
}
// Resolve with `fallback` if `p` has not settled within `ms`.
function within(p, ms, fallback) {
  let t;
  return Promise.race([p, new Promise((r) => { t = setTimeout(r, ms, fallback); })]).finally(() => clearTimeout(t));
}

// Keep a long location phrase to its two ends (cut on spaces): the office words
// sit next to the name/phone, and the matcher's cost grows with query length.
function capQuery(s, max) {
  s = String(s || '');
  if (s.length <= max) return s;
  const half = Math.floor(max / 2);
  const head = s.slice(0, half), tail = s.slice(-half);
  return head.slice(0, Math.max(head.lastIndexOf(' '), 0)) + ' ' + tail.slice(tail.indexOf(' ') + 1);
}

const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
// A text field from the request body: a string, a number, or nothing (an object or
// array, e.g. {"toString": 1}, is never turned into text; String() could throw on it).
const textField = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

// Per office list (the cache entry's array): a 3-letter-prefix index over every
// word of each office's name and address, and the offices grouped by city and
// by postcode. Built once per list, on first batch use.
//
// matchOffices only scores an office when a query token equals one of its
// words, or one starts with the other (both 4+ letters), or the postcode
// matches. All three imply a shared 3-letter prefix, so the offices found
// through the index are a superset of the ones that can score, and running
// matchOffices on that subset (in the original order) returns exactly what it
// returns on the whole list, at a fraction of the cost.
const OFFICE_INDEX = new WeakMap();
const CITY_PREFIX = new Set(['гр', 'град', 'с', 'село']);
function officeWords(o) {
  const out = [];
  const add = (v, depth) => {
    if (v == null || depth > 3) return;
    if (typeof v === 'string' || typeof v === 'number') { for (const w of words(v)) out.push(w); return; }
    if (typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v)) add(v[k], depth + 1);
  };
  add(o && o.name, 0); add(o && o.nameEn, 0); add(o && o.address, 0);
  return out;
}
function officeIndex(offices) {
  let ix = OFFICE_INDEX.get(offices);
  if (ix) return ix;
  ix = { byPrefix: new Map(), byCity: new Map(), byPost: new Map(), byCode: new Map(), cityOf: [] };
  const push = (map, k, i) => { const a = map.get(k); if (a) { if (a[a.length - 1] !== i) a.push(i); } else map.set(k, [i]); };
  offices.forEach((o, i) => {
    for (const w of officeWords(o)) if (w.length >= 3) push(ix.byPrefix, w.slice(0, 3), i);
    const city = (o && o.address && o.address.city) || {};
    const cw = words(city.name);
    while (cw.length > 1 && CITY_PREFIX.has(cw[0])) cw.shift();
    const cname = cw.join(' ');
    if (cname.length >= 3) push(ix.byCity, cname, i);
    ix.cityOf[i] = cname;
    if (o && o.code != null) ix.byCode.set(String(o.code), i);
    if (/^\d{4}$/.test(String(city.postCode || ''))) push(ix.byPost, String(city.postCode), i);
  });
  OFFICE_INDEX.set(offices, ix);
  return ix;
}
function fastMatchOffices(q, offices) {
  const ix = officeIndex(offices);
  const keys = new Set();
  for (const w of words(q)) if (w.length >= 3) keys.add(w.slice(0, 3));
  const pc = (String(q).match(/\b\d{4}\b/) || [])[0];
  if (pc) keys.add(pc.slice(0, 3));
  const hit = new Set();
  for (const k of keys) for (const i of (ix.byPrefix.get(k) || [])) hit.add(i);
  if (!hit.size) return [];
  if (hit.size > offices.length / 2) return matchOffices(q, offices);
  return matchOffices(q, [...hit].sort((a, b) => a - b).map((i) => offices[i]));
}

// Words in the text after a phone that never name an office: money, review,
// filler. Kept out of the after-phone office guess below.
const TAIL_NOISE = new Set([
  'лв', 'лева', 'лев', 'евро', 'eur', 'euro', 'bgn', 'lv', 'leva', 'наложен', 'наложена', 'наложения', 'платеж', 'платёж', 'нп',
  'сума', 'сумата', 'общо', 'цена', 'преглед', 'тест', 'без', 'със', 'моля', 'благодаря', 'мерси', 'офис', 'офиса', 'еконт',
  'econt', 'office', 'град', 'гр', 'до', 'за', 'на', 'от', 'във', 'ще', 'да', 'не', 'или',
]);
// A row whose parsed location matched nothing. The usual real case is a listing
// header before the name and phone, with the office written AFTER the phone
// ("Яке М\nМария Иванова 0899111222\nВарна Чайка"). So look only at the text after
// the phone, with the recipient's name taken out, and accept a match only when
// that text names the office's city (or postcode) AND another word that singles
// out one office there. Never the whole chunk: Econt addresses are full of
// streets named after people, so a first name alone would pick some office.
function afterPhoneOfficeGuess(chunk, parsed, offices) {
  const at = parsed.phoneRaw ? chunk.indexOf(parsed.phoneRaw) : -1;
  if (at < 0) return [];
  const nameWords = new Set(words(parsed.recipientName));
  const toks = words(stripMoney(capQuery(chunk.slice(at + parsed.phoneRaw.length), QUERY_MAX))).filter((w) => !nameWords.has(w));
  if (!toks.length) return [];
  const ix = officeIndex(offices);
  const joined = ' ' + toks.join(' ') + ' ';
  let city = null;
  for (const name of ix.byCity.keys()) if (joined.includes(' ' + name + ' ') && (!city || name.length > city.length)) city = name;
  const post = city ? null : toks.find((w) => /^\d{4}$/.test(w) && ix.byPost.has(w));
  if (!city && !post) return [];
  const pool = (city ? ix.byCity.get(city) : ix.byPost.get(post)).map((i) => offices[i]);
  const cityWords = new Set(city ? city.split(' ') : []);
  const rest = toks.filter((w) => !cityWords.has(w) && !TAIL_NOISE.has(w) && !/^\d+$/.test(w));
  if (!rest.length) return [];
  const cands = matchOffices(rest.join(' '), pool);
  if (!cands.length) return [];
  if (cands.length > 1 && cands[1].score === cands[0].score) return []; // ambiguous: let the user pick
  return cands;
}

// A batch row is shipped to candidates[0] without anyone looking at it, so only a
// confident match may be returned: not a tie between offices, not a match on the
// city name (or postcode) alone in a city with several offices ("Варна 30 лв"), and
// not one made only by a first name ("…звънете на Васил" vs "бул. Васил Левски").
function confidentMatch(q, cands, offices, source) {
  if (!cands.length) return false;
  if (cands.length > 1 && cands[1].score === cands[0].score) return false;
  const ix = officeIndex(offices);
  const i = ix.byCode.get(String(cands[0].code));
  if (i == null) return true;
  const top = offices[i];
  const city = (top.address && top.address.city) || {};
  const cityWords = new Set(words(city.name));
  const pc = String(city.postCode || '');
  // A first name counts only when it is in the office's own name ("София Надежда"),
  // not just in its street ("бул. Васил Левски").
  const inName = (w) => matchOffices(w, [{ code: top.code, name: top.name }]).length > 0;
  const hits = new Set(words(stripMoney(q)).filter((w) => !cityWords.has(w) && w !== pc && matchOffices(w, [top]).length && (!isCommonFirstName(w) || inName(w))));
  if (!hits.size) return (ix.byCity.get(ix.cityOf[i]) || []).length <= 1; // city only: fine if the town has just this office
  // Some other word points at this office. It must sit in a location clause: one
  // that also names the town, the postcode or an office/address word ("Еконт Варна
  // Чайка", "офис Чайка", "9000 Чайка"), or holds nothing but such words ("Пловдив,
  // Тракия"). Not a product or chatter clause ("Варна, книга Христо Ботев …",
  // "2 бр. Христо Ботев", "тениска Левски размер М").
  // (clauses from the original text: the parsed location phrase has lost its commas)
  for (const clause of stripMoney(source || q).split(/[,;.!?\n()]|\s[-–—]\s/)) {
    const cw = words(clause);
    if (!cw.some((w) => hits.has(w))) continue;
    if (cw.some((w) => cityWords.has(w) || w === pc || LOC_WORDS.has(w))) return true;
    if (cw.every((w) => hits.has(w) || LOC_WORDS.has(w) || /^\d+$/.test(w))) return true;
  }
  return false;
}
const LOC_WORDS = new Set(['еконт', 'econt', 'офис', 'офиса', 'office', 'кв', 'квартал', 'жк', 'ж', 'к', 'ул', 'улица', 'бул',
  'булевард', 'гр', 'град', 'район', 'апс', 'aps', 'автомат', 'еконтомат', 'до', 'на', 'в', 'във', 'при', 'срещу', 'с', 'село']);

// ---------- Econt response helpers ----------
// What Econt's ShipmentTrackingEvent.destinationType means, for events that
// carry no destinationDetails text.
const EVENT_TYPE_TEXT = {
  client: ['Доставена на получателя', 'Delivered to the recipient'],
  courier: ['При куриер', 'With a courier'],
  courier_direction: ['Пътува към направлението', 'On the way'],
  office: ['В офис', 'At an office'],
  first_try: ['Първи опит за доставка', 'First delivery attempt'],
  second_try: ['Втори опит за доставка', 'Second delivery attempt'],
  instruction: ['Изпълнено указание', 'Instruction carried out'],
  redirect: ['Пренасочена', 'Redirected'],
  return: ['Връща се към подателя', 'Being returned to the sender'],
  destroy: ['Унищожена', 'Destroyed'],
  failed_delivery: ['Неуспешна доставка', 'Delivery failed'],
  in_pickup_courier: ['Взета от куриер', 'Picked up by a courier'],
  in_pickup_office: ['Приета в офис', 'Accepted at an office'],
  in_delivery_courier: ['При куриер за доставка', 'Out for delivery'],
  in_delivery_office: ['Пристигнала в офиса за получаване', 'Ready for pick-up at the office'],
  arrival_departure_from_hub: ['Преминава през логистичен център', 'Passing through a hub'],
  is_returning_to_sender: ['Връща се към подателя', 'Being returned to the sender'],
  returned_to_sender: ['Върната на подателя', 'Returned to the sender'],
};
// Econt's tracking event: { isReceipt, destinationType, destinationDetails,
// destinationDetailsEn, officeName, officeNameEn, cityName, cityNameEn,
// countryCode, officeCode, time }. Keeps the { time, office, text } shape the
// client renders, and adds the raw type so returns/failed deliveries can be told apart.
function mapTrackingEvent(ev, lang) {
  ev = ev || {};
  const en = lang === 'en';
  const pick = (bg, eng) => (en ? (eng || bg) : (bg || eng)) || '';
  const office = pick(ev.officeName, ev.officeNameEn) || pick(ev.cityName, ev.cityNameEn) || null;
  const type = ev.destinationType || null;
  const typeText = type ? (EVENT_TYPE_TEXT[type] ? EVENT_TYPE_TEXT[type][en ? 1 : 0] : String(type).replace(/_/g, ' ')) : '';
  let text = pick(ev.destinationDetails, ev.destinationDetailsEn)
    || pick(ev.destinationDescription, ev.destinationDescriptionEn) || ev.description || typeText;
  if (office && text && String(text).trim() === String(office).trim()) text = typeText !== text ? typeText : '';
  return {
    time: ev.time || ev.eventTime || ev.date || null,
    office,
    text: text || '',
    type,
    isReceipt: !!ev.isReceipt,
    officeCode: ev.officeCode || null,
  };
}

// createLabel/calculate reply → extra top-level fields for the client.
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
    extra.reviewIgnoredMessage = [...new Set(notes.filter(Boolean))].join(' — ') || null;
  }
  return extra;
}

// ---------- http helpers ----------
function sendJson(res, status, obj, headers) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length }, headers || {}));
  res.end(body);
}

function readBody(req, limit) {
  const max = limit || 1e6;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, done = false;
    const fail = (e) => { if (done) return; done = true; chunks.length = 0; reject(e); };
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > max) { const e = new Error('Request body too large'); e.httpStatus = 413; return fail(e); }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      let v;
      try { v = JSON.parse(raw); } catch (e) { e.httpStatus = 400; return reject(e); }
      resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    });
    req.on('error', (e) => fail(Object.assign(e, { httpStatus: 400 }))); // client-side stream failure
    // 'close' before 'end' = the client hung up mid-body: settle instead of hanging.
    req.on('close', () => fail(Object.assign(new Error('Request aborted'), { httpStatus: 400 })));
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
    const msg = msgs.length ? [...new Set(msgs)].join(' — ') : ('Econt HTTP ' + e.status);
    const out = { ok: false, error: msg, status: e.status, body: b };
    if (isAuthFail(e)) out.code = 'bad_login';
    return out;
  }
  return { ok: false, error: e.message };
}

// Friendly (user-facing) messages, in the UI's language — the client sends body.lang.
const FRIENDLY = {
  missing_creds: { bg: 'Липсват данни за вход в Еконт.', en: 'Missing Econt credentials.' },
  sender_missing: { bg: 'Липсват име/телефон на подателя — довършете настройката.', en: 'Sender name/phone missing — finish setup.' },
  bad_login: { bg: 'Грешен потребител или парола за Еконт. Използвайте същите данни, с които влизате в e-econt.com (главните и малките букви имат значение).', en: 'Wrong Econt username or password. Use the same details you sign in to e-econt.com with (case-sensitive).' },
  econt_down: { bg: 'Няма връзка с Еконт в момента. Опитайте пак след малко.', en: 'Cannot reach Econt right now. Try again in a moment.' },
  office_missing: { bg: 'Не е избран офис за подаване — отворете Настройки и изберете офис.', en: 'Your sender drop-off office is not set — open Settings and choose your office.' },
  batch_too_long: { bg: 'Текстът е твърде дълъг за едно поставяне. Поставете пратките на части.', en: 'That text is too long for one paste. Paste the parcels in parts.' },
  batch_too_many: { bg: 'Твърде много пратки в едно поставяне ({n}). Най-много {max} наведнъж — поставете ги на части.', en: 'Too many parcels in one paste ({n}). At most {max} at a time — paste them in parts.' },
  parse_too_long: { bg: 'Текстът е твърде дълъг. Поставете само съобщението с данните за пратката.', en: 'That text is too long. Paste just the message with the parcel details.' },
  multi_parcel: { bg: 'В текста има {n} пратки. Запишете телефоните като 0888 123 456, за да се отворят като списък, или ги поставете една по една.', en: 'This text holds {n} parcels. Write the phones as 0888 123 456 to open them as a list, or paste them one at a time.' },
  batch_slow: { bg: 'офисът не е разпознат за част от редовете — изберете го ръчно.', en: 'the office was not recognised for some rows — pick it by hand.' },
};
const fr = (body, key, params) => FRIENDLY[key][body && body.lang === 'en' ? 'en' : 'bg']
  .replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? String(params[k]) : m));

function getCreds(body) {
  const c = body.creds || {};
  if (!c.username || !c.password) { const e = new Error(fr(body, 'missing_creds')); e.friendly = true; throw e; }
  return { mode: c.mode === 'production' ? 'production' : 'demo', username: c.username, password: c.password };
}

// ---------- routes ----------
async function handleApi(req, res, url) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
  const body = await readBody(req);

  // Wake-up calls. Render spins the server down when idle; the client pings while
  // the PIN is typed so the cold start overlaps something the user does anyway.
  if (url.pathname === '/api/ping') return sendJson(res, 200, { ok: true });
  // Warm also fills the office cache and checks the login with Econt in the
  // background (not awaited: instant reply), so a later batch paste is not delayed.
  if (url.pathname === '/api/warm') {
    try { const c = getCreds(body); loadOffices(c).catch(() => {}); verifyCreds(c).catch(() => {}); } catch {}
    return sendJson(res, 200, { ok: true });
  }

  // Validate Econt credentials (setup wizard + settings). Uses the client-profile
  // call because it always requires a valid login; the office list is public on
  // some Econt hosts and was also served from cache, so it could say "OK" for a
  // wrong password. Office count is best-effort and never masks a login failure.
  if (url.pathname === '/api/test') {
    try {
      const creds = getCreds(body);
      try { await econt.getClientProfiles(creds); rememberCreds(creds, true); }
      catch (e) {
        if (isAuthFail(e)) return sendJson(res, 200, { ok: false, code: 'bad_login', error: fr(body, 'bad_login') });
        if (e.kind === 'network') return sendJson(res, 200, { ok: false, code: 'network', error: fr(body, 'econt_down') });
        // Only if the profile service itself is missing do we fall back to an office
        // call; anything else is reported, never turned into a false "OK".
        if (!(e.kind === 'http' && (e.status === 404 || e.status === 405))) throw e;
        await econt.getOffices(creds, 'BGR');
      }
      let officeCount = 0;
      try { officeCount = (await loadOffices(creds)).length; } catch {}
      return sendJson(res, 200, { ok: true, mode: creds.mode, officeCount });
    } catch (e) {
      if (isAuthFail(e)) return sendJson(res, 200, { ok: false, code: 'bad_login', error: fr(body, 'bad_login') });
      return sendJson(res, 200, e.friendly ? { ok: false, error: e.message } : errorPayload(e));
    }
  }

  if (url.pathname === '/api/parse') {
    const raw = textField(body.text);
    if (raw.length > PARSE_MAX_TEXT) return sendJson(res, 200, { ok: false, code: 'text_too_long', error: fr(body, 'parse_too_long') });
    const text = stripNoise(raw);
    // Several parcels that reached the single editor (the browser counts phones with
    // its own pattern and can miss "0888/123456"): never show just the first one and
    // silently drop the rest.
    const parcels = namedParcelCount(text);
    if (parcels >= 2) return sendJson(res, 200, { ok: false, code: 'multi_parcel', count: parcels, error: fr(body, 'multi_parcel', { n: parcels }) });
    const parsed = parseMessage(text);
    let candidates = [];
    if (parsed.deliveryType === 'office') {
      try {
        const creds = getCreds(body);
        const offices = await loadOffices(creds);
        if (parsed.locationText) candidates = matchOffices(capQuery(parsed.locationText, QUERY_MAX), offices);
        // The location phrase matched nothing (e.g. chatter before the name): try the
        // text after the phone, with the same guards as a batch row.
        if (!candidates.length && offices.length) candidates = afterPhoneOfficeGuess(text, parsed, offices);
      } catch (e) {
        return sendJson(res, 200, { ok: true, parsed, candidates: [], officesError: errorPayload(e).error });
      }
    }
    return sendJson(res, 200, { ok: true, parsed, candidates });
  }

  // Batch input: several parcels in one paste. Splits per phone number, parses
  // each chunk, detects existing waybill numbers (those rows are for tracking,
  // not creation), and matches offices from the parsed location phrase. When
  // that phrase is a listing header rather than a location, only the text after
  // the phone is tried, and only with a named city (afterPhoneOfficeGuess). A row
  // with no confident match gets NO candidates, so the UI shows "office missing"
  // instead of preselecting a guess that a batch run would ship to.
  if (url.pathname === '/api/parse-batch') {
    const text = textField(body.text);
    if (text.length > BATCH_MAX_TEXT) return sendJson(res, 200, { ok: false, code: 'batch_too_big', error: fr(body, 'batch_too_long') });
    // Cheap pre-check before the splitter runs on a paste with thousands of numbers.
    const phones = countPhones(text);
    if (phones > BATCH_MAX_ROWS * 3) return sendJson(res, 200, { ok: false, code: 'batch_too_big', error: fr(body, 'batch_too_many', { n: phones, max: BATCH_MAX_ROWS }) });
    const chunks = splitBatch(text);
    if (chunks.length > BATCH_MAX_ROWS) {
      return sendJson(res, 200, { ok: false, code: 'batch_too_big', error: fr(body, 'batch_too_many', { n: chunks.length, max: BATCH_MAX_ROWS }) });
    }
    let offices = null, officesError = null;
    try {
      const creds = getCreds(body);
      // Match offices only for credentials Econt accepts (or when Econt cannot be
      // asked right now): the shared cache must not do free work for made-up logins.
      // Bounded wait: if Econt hangs, carry on as "could not tell" (the check
      // keeps running in the background and is remembered when it finishes).
      const verdict = await verifyCredsBounded(creds, VERIFY_WAIT_MS);
      if (verdict === false) officesError = fr(body, 'bad_login');
      else offices = await loadOffices(creds);
    } catch (e) { officesError = e.friendly ? e.message : errorPayload(e).error; }
    const started = Date.now();
    let spent = 0, skipped = false;
    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      await rowTurn();                     // one row at a time across all requests
      if (req.socket && req.socket.destroyed) return; // client gave up: stop working
      const t0 = Date.now();
      const chunk = chunks[i];
      const parsed = parseMessage(parseWindow(chunk));
      const trackNum = findWaybill(chunk);
      const row = { chunk, parsed, candidates: [], trackNum };
      if (offices && offices.length && parsed.deliveryType === 'office') {
        if (spent > BATCH_BUDGET_MS || t0 - started > BATCH_WALL_MS) skipped = true;
        else {
          const q = capQuery(parsed.locationText || '', QUERY_MAX);
          let cands = q ? fastMatchOffices(q, offices) : [];
          if (cands.length) {
            // A tie or a city-only match is not shipped to: the row shows "office
            // missing" and the user picks; the tied offices go back as suggestions.
            if (confidentMatch(q, cands, offices, chunk)) row.candidates = cands;
            else { row.ambiguous = true; row.suggestions = cands; }
          } else row.candidates = afterPhoneOfficeGuess(chunk, parsed, offices);
        }
      }
      spent += Date.now() - t0;
      rows.push(row);
    }
    if (skipped && !officesError) officesError = fr(body, 'batch_slow');
    return sendJson(res, 200, { ok: true, rows, officesError });
  }

  if (url.pathname === '/api/offices') {
    try {
      const creds = getCreds(body);
      const offices = await loadOffices(creds);
      return sendJson(res, 200, { ok: true, candidates: matchOffices(capQuery(textField(body.q), SEARCH_MAX), offices, 12) });
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
      const nums = (Array.isArray(body.shipmentNumbers) ? body.shipmentNumbers : []).filter((n) => typeof n === 'string' || typeof n === 'number').map(String).filter(Boolean);
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
          events: evRaw.map((ev) => mapTrackingEvent(ev, body.lang)),
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
      rememberCreds(creds, true);
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
      if (!sender.name || !sender.phone) return sendJson(res, 200, { ok: false, error: fr(body, 'sender_missing') });
      if (!sender.officeCode && !sender.address) return sendJson(res, 200, { ok: false, error: fr(body, 'office_missing') });
      const mode = url.pathname === '/api/create' ? 'create' : 'calculate';
      const label = econt.buildLabel(sender, body.defaults || {}, body.overrides || {});
      const resp = await econt.createLabel(creds, label, mode);
      // From here on a waybill may exist: nothing below may turn this into an error.
      let extra = {};
      try { if (mode === 'create') rememberCreds(creds, true); extra = decorateLabelReply(resp); } catch (e) { console.error(e); }
      // Extra top-level fields: totalPrice/totalPriceCurrency (the real price
      // currency) and reviewIgnored/reviewIgnoredMessage when Econt dropped преглед/тест.
      return sendJson(res, 200, Object.assign({ ok: true, mode, label, response: resp }, extra));
    } catch (e) {
      if (e.friendly) return sendJson(res, 200, { ok: false, error: e.message });
      const out = errorPayload(e);
      // A create that did not end in a clear Econt answer (connection or body lost,
      // any non-HTTP failure, gateway 502/503/504 without an Econt error body) may
      // still have produced a waybill. Flag it so the client treats it as
      // "unclear", never as a free retry.
      if (url.pathname === '/api/create' && (e.kind !== 'http'
        || ([502, 503, 504].includes(e.status) && !flattenEcontError(e.body || {}, []).length))) out.unsure = true;
      return sendJson(res, 200, out);
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Unknown endpoint' });
}

// ---------- static ----------
function serveStatic(req, res, url) {
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(ROOT, 'public', path.normalize(file).replace(/^([/\\])+/, ''));
  if (!full.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => { try {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(full).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.webmanifest' ? 'application/manifest+json'
      : ext === '.woff2' ? 'font/woff2'
      : ext === '.txt' ? 'text/plain; charset=utf-8'
      : 'application/octet-stream';
    // Content-hash ETag + no-cache: the browser must revalidate every load, so a
    // new deploy is picked up immediately (no stale app.js), but unchanged files
    // still return a cheap 304 instead of re-downloading.
    const etag = '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 22) + '"';
    // Fonts never change under the same file name: let the browser keep them.
    const cache = ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': cache }); return res.end(); }
    // Gzip text assets (~70% smaller) when the client accepts it.
    const compressible = /^(text\/|application\/manifest)/.test(type);
    const wantsGzip = compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const body = wantsGzip ? zlib.gzipSync(data) : data;
    // Safe hardening headers (do not restrict script/style/connect, so OCR and inline styles keep working).
    const headers = {
      'Content-Type': type,
      'Content-Length': body.length,
      'Cache-Control': cache,
      'ETag': etag,
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
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
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
