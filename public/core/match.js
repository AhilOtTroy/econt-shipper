// Office matching and the "read this paste" steps that used to run on the server
// (/api/parse, /api/parse-batch, /api/offices). They run in the browser now, so the
// Cloudflare Worker never spends CPU on them; Node loads the same file for tests.
//
// Browser: a plain <script> after core/parser.js, sets window.EcontMatch.
// Node:    require('./public/core/match.js').
//
// parseSingle and parseBatch return exactly what the old routes answered (the
// golden tests in tests/parser-golden.js hold them to that), so the app around
// them behaves as before. Where the server reached for Econt, they take an
// async loadOffices() (and verify() for the login check) from the caller.
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module && module.exports) module.exports = factory(require('./parser.js'));
  else root.EcontMatch = factory(root.EcontParser);
}(typeof self !== 'undefined' ? self : this, function (P) {
'use strict';

const { parseMessage, matchOffices, splitBatch, stripNoise, findWaybill, stripMoney, countPhones, namedParcelCount, phoneIndexOf, isCommonFirstName } = P;

// Size limits, as the server had them: a paste that is too big is refused with a
// message, a very long row is parsed around its phone, a long location phrase is
// cut to its two ends.
const LIMITS = {
  BATCH_MAX_TEXT: 80000,    // characters (100 parcels with chat noise fit easily)
  BATCH_MAX_ROWS: 100,
  // Matching time for one paste; later rows get no office. On the server this was
  // 10 s of server time (and 30 s of wall clock). It runs on the seller's device
  // now: only the time spent working counts (a page the phone or a hidden tab put
  // to sleep mid-read loses nothing), each row counts at most ROW_MAX_MS (a pause
  // inside a row is not work), and a phone gets the time a server needed many times over.
  BATCH_BUDGET_MS: 60000,
  ROW_MAX_MS: 1000,
  PARSE_MAX_TEXT: 20000,    // characters of a single message
  CHUNK_PARSE_MAX: 8000,    // characters of one batch row handed to the parser
  QUERY_MAX: 400,           // characters of a location phrase handed to the matcher
  SEARCH_MAX: 200,          // characters of an office-search query
};
const { BATCH_MAX_TEXT, BATCH_MAX_ROWS, BATCH_BUDGET_MS, ROW_MAX_MS, PARSE_MAX_TEXT, CHUNK_PARSE_MAX, QUERY_MAX, SEARCH_MAX } = LIMITS;

// The messages these steps can give, in the app's two languages (the same words
// the server used to send).
const MESSAGES = {
  bg: {
    missing_creds: 'Липсват данни за вход в Еконт.',
    bad_login: 'Грешен потребител или парола за Еконт. Използвайте същите данни, с които влизате в e-econt.com (главните и малките букви имат значение).',
    batch_too_long: 'Текстът е твърде дълъг за едно поставяне. Поставете пратките на части.',
    batch_too_many: 'Твърде много пратки в едно поставяне ({n}). Най-много {max} наведнъж. Постави ги на части.',
    parse_too_long: 'Текстът е твърде дълъг. Поставете само съобщението с данните за пратката.',
    multi_parcel: 'В текста има {n} пратки. Запишете телефоните като 0888 123 456, за да се отворят като списък, или ги поставете една по една.',
    batch_slow: 'офисът не е разпознат за част от редовете. Избери го ръчно.',
  },
  en: {
    missing_creds: 'Missing Econt credentials.',
    bad_login: 'Wrong Econt username or password. Use the same details you sign in to e-econt.com with (case-sensitive).',
    batch_too_long: 'That text is too long for one paste. Paste the parcels in parts.',
    batch_too_many: 'Too many parcels in one paste ({n}). At most {max} at a time. Paste them in parts.',
    parse_too_long: 'That text is too long. Paste just the message with the parcel details.',
    multi_parcel: 'This text holds {n} parcels. Write the phones as 0888 123 456 to open them as a list, or paste them one at a time.',
    batch_slow: 'the office was not recognised for some rows. Pick it by hand.',
  },
};
function message(lang, key, params) {
  return MESSAGES[lang === 'en' ? 'en' : 'bg'][key]
    .replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? String(params[k]) : m));
}

// Econt's office objects are large (working hours, phones, coordinates, ~4 MB
// for the whole list). Keep only what matching and the office labels read:
// parser.js officeHaystack/isCustomerOffice and matchOffices' result shape.
function trimOffice(o) {
  const a = (o && o.address) || {}, c = a.city || {};
  return {
    code: o && o.code, name: o && o.name, nameEn: o && o.nameEn,
    address: { fullAddress: a.fullAddress, quarter: a.quarter, street: a.street, city: { name: c.name, postCode: c.postCode } },
  };
}

// A very long row (pasted junk) is parsed only around its phone number.
function parseWindow(chunk) {
  if (chunk.length <= CHUNK_PARSE_MAX) return chunk;
  const at = phoneIndexOf(chunk);
  const from = Math.max(0, Math.min(at < 0 ? 0 : at - 3000, chunk.length - CHUNK_PARSE_MAX));
  return chunk.slice(from, from + CHUNK_PARSE_MAX);
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
// A text field: a string, a number, or nothing (an object or array is never turned
// into text; String() could throw on it).
const textField = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

// Per office list (the array): a 3-letter-prefix index over every word of each
// office's name and address, and the offices grouped by city and by postcode.
// Built once per list, on first use.
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

// ---------- the old routes ----------

// The office search box (what /api/offices answered): up to 12 offices.
function searchOffices(q, offices) {
  return matchOffices(capQuery(textField(q), SEARCH_MAX), offices, 12);
}

// An error from opts.loadOffices: its message is shown as the office error. One
// marked `transient` (the app's own server could not be reached) fails the whole
// read instead, as the old route itself would have failed.
const errText = (e) => String((e && e.message) || e || '');

// One message, read for the single-parcel editor (the old /api/parse).
// opts: { lang, loadOffices: async () => offices }
async function parseSingle(rawText, opts) {
  opts = opts || {};
  const lang = opts.lang;
  const raw = textField(rawText);
  if (raw.length > PARSE_MAX_TEXT) return { ok: false, code: 'text_too_long', error: message(lang, 'parse_too_long') };
  const text = stripNoise(raw);
  // Several parcels that reached the single editor (the browser counts phones with
  // its own pattern and can miss "0888/123456"): never show just the first one and
  // silently drop the rest.
  const parcels = namedParcelCount(text);
  if (parcels >= 2) return { ok: false, code: 'multi_parcel', count: parcels, error: message(lang, 'multi_parcel', { n: parcels }) };
  const parsed = parseMessage(text);
  let candidates = [];
  if (parsed.deliveryType === 'office') {
    try {
      const offices = await opts.loadOffices();
      if (parsed.locationText) candidates = matchOffices(capQuery(parsed.locationText, QUERY_MAX), offices);
      // The location phrase matched nothing (e.g. chatter before the name): try the
      // text after the phone, with the same guards as a batch row.
      if (!candidates.length && offices.length) candidates = afterPhoneOfficeGuess(text, parsed, offices);
    } catch (e) {
      if (e && e.transient) return { ok: false, error: errText(e), transient: true, stale: !!e.stale };
      return { ok: true, parsed, candidates: [], officesError: errText(e) };
    }
  }
  return { ok: true, parsed, candidates };
}

// Several parcels in one paste (the old /api/parse-batch). Splits per phone number,
// parses each chunk, detects existing waybill numbers (those rows are for tracking,
// not creation), and matches offices from the parsed location phrase. When that
// phrase is a listing header rather than a location, only the text after the phone
// is tried, and only with a named city (afterPhoneOfficeGuess). A row with no
// confident match gets NO candidates, so the UI shows "office missing" instead of
// preselecting a guess that a batch run would ship to.
// opts: { lang, loadOffices, verify: async () => true | false | null (null = could
//   not tell), yieldRow: async () => {} between rows, alive: () => bool, now }
async function parseBatch(rawText, opts) {
  opts = opts || {};
  const lang = opts.lang;
  const now = opts.now || Date.now;
  const text = textField(rawText);
  if (text.length > BATCH_MAX_TEXT) return { ok: false, code: 'batch_too_big', error: message(lang, 'batch_too_long') };
  // Cheap pre-check before the splitter runs on a paste with thousands of numbers.
  const phones = countPhones(text);
  if (phones > BATCH_MAX_ROWS * 3) return { ok: false, code: 'batch_too_big', error: message(lang, 'batch_too_many', { n: phones, max: BATCH_MAX_ROWS }) };
  const chunks = splitBatch(text);
  if (chunks.length > BATCH_MAX_ROWS) {
    return { ok: false, code: 'batch_too_big', error: message(lang, 'batch_too_many', { n: chunks.length, max: BATCH_MAX_ROWS }) };
  }
  let offices = null, officesError = null;
  try {
    // A login Econt has rejected gets no office matching (it would only lead to
    // creates that fail): the rows say so instead.
    const verdict = opts.verify ? await opts.verify() : null;
    if (verdict === false) officesError = message(lang, 'bad_login');
    else offices = await opts.loadOffices();
  } catch (e) {
    if (e && e.transient) return { ok: false, error: errText(e), transient: true, stale: !!e.stale };
    officesError = errText(e);
  }
  let spent = 0, skipped = false;
  const rows = [];
  for (let i = 0; i < chunks.length; i++) {
    if (opts.yieldRow) await opts.yieldRow();
    if (opts.alive && !opts.alive()) return { ok: false, stale: true, error: '' }; // superseded: stop working
    const t0 = now();
    const chunk = chunks[i];
    const parsed = parseMessage(parseWindow(chunk));
    const trackNum = findWaybill(chunk);
    const row = { chunk, parsed, candidates: [], trackNum };
    if (offices && offices.length && parsed.deliveryType === 'office') {
      if (spent > BATCH_BUDGET_MS) skipped = true;
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
    // (the time between rows, where the page yields or sleeps, never counts)
    spent += Math.min(Math.max(now() - t0, 0), ROW_MAX_MS);
    rows.push(row);
  }
  if (skipped && !officesError) officesError = message(lang, 'batch_slow');
  return { ok: true, rows, officesError };
}

return {
  LIMITS, MESSAGES, message, trimOffice, capQuery, parseWindow, textField, words,
  officeIndex, fastMatchOffices, afterPhoneOfficeGuess, confidentMatch, searchOffices,
  parseSingle, parseBatch,
};
}));
