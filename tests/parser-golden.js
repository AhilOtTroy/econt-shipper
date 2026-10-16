'use strict';

// Golden test: the parser and the office matching that moved into the browser
// (public/core/parser.js, public/core/match.js) must give exactly the outputs the
// old server gave. tests/golden/*.json were captured from commit 724526c by
// tests/capture-golden.js; any drift fails here, loudly, with the first difference.
//
//   node tests/parser-golden.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'public/core/parser.js'));
const M = require(path.join(ROOT, 'public/core/match.js'));
const { productionOffices, demoOffices } = require('./fixtures/offices');
const { edgeCases } = require('./golden/edge-cases');
const G = (f) => require(path.join(__dirname, 'golden', f));

const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
const json = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

// First difference between two JSON values, as "path: expected vs got".
function diff(a, b, at) {
  at = at || '$';
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return at + ': expected ' + JSON.stringify(a) + ' got ' + JSON.stringify(b);
  if (Array.isArray(a) !== Array.isArray(b)) return at + ': array vs object';
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const d = diff(a[k], b[k], at + (Array.isArray(a) ? '[' + k + ']' : '.' + k)); if (d) return d; }
  return null;
}

function group(name, items, fn) {
  let pass = 0, firstFail = null;
  for (const it of items) {
    const d = fn(it);
    if (!d) pass++;
    else if (!firstFail) firstFail = d;
  }
  ok(name + ' (' + pass + '/' + items.length + ')', pass === items.length, firstFail || '');
}

async function groupAsync(name, items, fn) {
  let pass = 0, firstFail = null;
  for (const it of items) {
    const d = await fn(it);
    if (!d) pass++;
    else if (!firstFail) firstFail = d;
  }
  ok(name + ' (' + pass + '/' + items.length + ')', pass === items.length, firstFail || '');
}

(async () => {
  const PROD = productionOffices().map(M.trimOffice);
  const DEMO = demoOffices().map(M.trimOffice);
  // The office list the browser keeps comes back from localStorage as JSON.
  const PROD_JSON = json(PROD);

  // 1. Parser functions.
  const parser = G('parser.json');
  group('parser: parseMessage', parser, (g) => diff(g.parseMessage, json(P.parseMessage(g.text))) && g.text.slice(0, 60) + ' -> ' + diff(g.parseMessage, json(P.parseMessage(g.text))));
  group('parser: parseMessage(stripNoise)', parser, (g) => diff(g.parseClean, json(P.parseMessage(P.stripNoise(g.text)))));
  group('parser: stripNoise', parser, (g) => diff(g.stripNoise, P.stripNoise(g.text)));
  group('parser: splitBatch', parser, (g) => diff(g.splitBatch, json(P.splitBatch(g.text))));
  group('parser: splitBatch rows parsed', parser, (g) => diff(g.splitParsed, json(P.splitBatch(g.text).map((c) => P.parseMessage(c)))));
  group('parser: namedParcelCount/countPhones/findWaybill/phoneIndexOf', parser, (g) => diff(
    [g.namedParcelCount, g.countPhones, g.findWaybill, g.phoneIndexOf],
    [P.namedParcelCount(g.text), P.countPhones(g.text), P.findWaybill(g.text), P.phoneIndexOf(g.text)]));
  const kinds = parser.reduce((a, g) => { a[g.kind] = (a[g.kind] || 0) + 1; return a; }, {});
  ok('golden set has 300+ messages', parser.length >= 300, JSON.stringify(kinds));

  // 2. The old /api/parse, now parseSingle in the browser.
  const load = (list) => async () => list;
  await groupAsync('parseSingle == old /api/parse', G('server-parse.json'), async (g) => {
    const got = json(await M.parseSingle(g.text, { lang: g.lang, loadOffices: load(PROD) }));
    const d = diff(g.response, got);
    return d && g.text.slice(0, 60) + ' -> ' + d;
  });
  // Same answers when the office list was read back from localStorage (JSON).
  await groupAsync('parseSingle == old /api/parse (list from JSON)', G('server-parse.json').filter((g, i) => i % 4 === 0), async (g) => diff(g.response, json(await M.parseSingle(g.text, { lang: g.lang, loadOffices: load(PROD_JSON) }))));

  // 3. The old /api/parse-batch, now parseBatch in the browser.
  await groupAsync('parseBatch == old /api/parse-batch', G('server-batch.json'), async (g) => {
    const got = json(await M.parseBatch(g.text, { lang: g.lang, loadOffices: load(PROD), verify: async () => true }));
    const d = diff(g.response, got);
    return d && g.text.slice(0, 60) + ' -> ' + d;
  });
  await groupAsync('parseBatch == old /api/parse-batch (list from JSON, row yields)', G('server-batch.json').filter((g, i) => i % 4 === 1), async (g) => diff(g.response, json(await M.parseBatch(g.text, {
    lang: g.lang, loadOffices: load(PROD_JSON), verify: async () => null, yieldRow: () => new Promise((r) => setImmediate(r)),
  }))));

  // 4. The old office search.
  group('searchOffices == old /api/offices', G('server-offices.json'), (g) => diff(g.response, json({ ok: true, candidates: M.searchOffices(g.q, PROD) })));

  // 5. Edge cases: limits, wrong/missing login, failing office list, demo list.
  const golden = new Map(G('server-edge.json').map((e) => [e.name, e.response]));
  await groupAsync('edge cases == old server', edgeCases(), async (c) => {
    const msg = (k) => M.message(c.lang, k);
    const loadOffices = async () => {
      if (c.creds === 'missing') throw new Error(msg('missing_creds'));
      if (c.fault === 'offices502') throw new Error('Econt HTTP 502');
      return c.creds === 'demo' ? DEMO : PROD;
    };
    const verify = async () => (c.creds === 'bad' ? false : c.creds === 'missing' ? null : true);
    const got = json(c.route === 'batch'
      ? await M.parseBatch(c.text, { lang: c.lang, loadOffices, verify })
      : await M.parseSingle(c.text, { lang: c.lang, loadOffices }));
    const d = diff(golden.get(c.name), got);
    return d && c.name + ' -> ' + d;
  });

  // 6. Behaviour the golden files cannot show.
  // A transient failure (the app's server not reachable) fails the read as the old
  // route did, instead of opening the editor with an office error.
  const transient = Object.assign(new Error('Сървърът се събужда.'), { transient: true });
  const t1 = await M.parseSingle('Мария Петрова 0888123456 Пловдив офис Център', { lang: 'bg', loadOffices: async () => { throw transient; } });
  ok('transient office failure fails the single read', t1.ok === false && t1.transient === true && t1.error === transient.message, JSON.stringify(t1));
  const t2 = await M.parseBatch('Петър Колев 0888777666 Варна офис Чайка\n\nАна Димитрова 0899555444 Пловдив офис Център', { lang: 'bg', loadOffices: async () => { throw transient; } });
  ok('transient office failure fails the batch read', t2.ok === false && t2.transient === true, JSON.stringify(t2));
  const t3 = await M.parseSingle('Моля на адрес гр. София, ж.к. Люлин 5, бл. 512, ап. 45. Николай Георгиев 0898 765 432', { lang: 'bg', loadOffices: async () => { throw new Error('should not load'); } });
  ok('door delivery never loads offices', t3.ok === true && t3.parsed.deliveryType === 'door', JSON.stringify(t3).slice(0, 120));
  // A superseded batch stops between rows.
  let calls = 0;
  const t4 = await M.parseBatch(Array.from({ length: 10 }, (_, i) => 'Клиент ' + i + ' 0888' + String(100000 + i).slice(-6) + ' Варна Чайка').join('\n'), { lang: 'bg', loadOffices: load(PROD), alive: () => ++calls < 4 });
  ok('superseded batch stops early', t4.ok === false && t4.stale === true && calls === 4, JSON.stringify(t4) + ' calls=' + calls);
  // The time budget: rows after it get no office and the paste says so.
  let clock = 0;
  const t5 = await M.parseBatch(Array.from({ length: 5 }, (_, i) => 'Клиент ' + i + ' 0888' + String(100000 + i).slice(-6) + ' Варна Чайка').join('\n'), {
    lang: 'en', loadOffices: load(PROD), now: () => (clock += 6000),
  });
  ok('budget exceeded: later rows get no office + message', t5.ok && t5.officesError === M.MESSAGES.en.batch_slow && t5.rows[0].candidates.length > 0 && t5.rows[4].candidates.length === 0, t5.officesError);
  // Root parser.js is the same module.
  ok('root parser.js re-exports public/core/parser.js', require(path.join(ROOT, 'parser.js')) === P);
  // The relay's messages for a wrong/missing login are word for word the browser's.
  try {
    const relay = require(path.join(ROOT, 'relay.js'));
    ok('login messages in step with relay.js', ['bg', 'en'].every((l) => relay.FRIENDLY.bad_login[l] === M.MESSAGES[l].bad_login && relay.FRIENDLY.missing_creds[l] === M.MESSAGES[l].missing_creds));
  } catch (e) { ok('login messages in step with relay.js', false, e.message); }
  // No dashes in user-facing messages.
  const dashy = Object.values(M.MESSAGES).flatMap((d) => Object.values(d)).filter((s) => /[–—]/.test(s));
  ok('no em/en dashes in core messages', !dashy.length, dashy.join(' | '));

  console.log(results.join('\n'));
  const fail = results.filter((r) => r.startsWith('FAIL')).length;
  console.log('RESULT suite=parser-golden runtime=node pass=' + (results.length - fail) + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e); process.exit(1); });
