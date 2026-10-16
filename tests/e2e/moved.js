'use strict';

// Checks for the logic that moved from the server into the browser: reading
// messages and matching offices (public/core/parser.js + match.js) and the office
// list the browser keeps (6 h in localStorage per mode, a stale copy when Econt
// is down, count and age in Settings, refresh).
//
// 1. The golden answers of the old server (tests/golden, captured from 724526c)
//    must come out of the scripts as the browser loads them from this runtime,
//    with the office list fetched through this runtime's relay and trimmed in
//    the browser.
// 2. The app around them: no server call to read a message, the size limits and
//    multi-parcel switch answered in the browser, the office cache, Settings.
//
//   APP_URL=... MOCK_URL=... NODE_PATH=$(npm root -g) node tests/e2e/moved.js

const path = require('path');
const { execFileSync } = require('child_process');
const { suite, mock, launch, account, fresh, parse } = require('./lib');
const { edgeCases } = require('../golden/edge-cases');

const { ok, finish } = suite('moved');
const G = (f) => require(path.join(__dirname, '..', 'golden', f));
const TRIMMED_KEYS = 'address,code,name,nameEn|city,fullAddress,quarter,street|name,postCode';

// /api/* requests the page makes while fn runs.
async function apiCalls(p, fn) {
  const seen = [];
  const on = (req) => { const u = new URL(req.url()); if (u.pathname.startsWith('/api/')) seen.push(u.pathname); };
  p.on('request', on);
  try { await fn(); } finally { p.off('request', on); }
  return seen;
}

(async () => {
  await mock.reset();
  const b = await launch();

  // ---------- 1. golden parity in the browser ----------
  { const p = await fresh(b, { cod: false });
    // The office list arrives through the relay; check what the browser kept.
    await p.waitForFunction(() => !!localStorage.getItem('econt_offices_production'), null, { timeout: 10000 });
    const kept = await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('econt_offices_production'));
      const o = s.offices[0];
      return { n: s.offices.length, at: s.at, keys: [Object.keys(o).sort(), Object.keys(o.address).filter((k) => k !== 'city').concat('city').sort(), Object.keys(o.address.city).sort()].map((a) => a.join(',')).join('|') };
    });
    ok('office list kept in localStorage, trimmed to the 8 fields', kept.n === 35 && kept.keys === TRIMMED_KEYS && Date.now() - kept.at < 60000, JSON.stringify(kept));
    const st = await mock.state();
    ok('relay asked Econt for the list once, uncompressed', st.offices.production === 1 && st.officesAcceptEncoding === 'identity', JSON.stringify({ n: st.offices, ae: st.officesAcceptEncoding }));

    const res = await p.evaluate(async ([gp, gb, go, edges, ge]) => {
      // Key-order-proof comparison of two JSON values.
      const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((a, kk) => { a[kk] = x[kk]; return a; }, {}) : x));
      const json = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
      const prod = await loadOffices(creds());
      const demo = await loadOffices({ mode: 'demo', username: 'u', password: 'pw' });
      const out = {};
      const run = async (name, items, fn) => {
        let pass = 0, first = '';
        for (const it of items) { const r = await fn(it); if (r === true) pass++; else if (!first) first = r; }
        out[name] = { pass, n: items.length, first };
      };
      await run('parse', gp, async (g) => canon(json(await EcontMatch.parseSingle(g.text, { lang: g.lang, loadOffices: async () => prod }))) === canon(g.response) || g.text.slice(0, 70));
      await run('batch', gb, async (g) => canon(json(await EcontMatch.parseBatch(g.text, { lang: g.lang, loadOffices: async () => prod, verify: async () => true }))) === canon(g.response) || g.text.slice(0, 70));
      await run('search', go, async (g) => canon(json({ ok: true, candidates: EcontMatch.searchOffices(g.q, prod) })) === canon(g.response) || g.q);
      const golden = new Map(ge.map((e) => [e.name, e.response]));
      await run('edge', edges, async (c) => {
        const msg = (k) => EcontMatch.message(c.lang, k);
        const lo = async () => {
          if (c.creds === 'missing') throw new Error(msg('missing_creds'));
          if (c.fault === 'offices502') throw new Error('Econt HTTP 502');
          return c.creds === 'demo' ? demo : prod;
        };
        const verify = async () => (c.creds === 'bad' ? false : c.creds === 'missing' ? null : true);
        const got = json(c.route === 'batch' ? await EcontMatch.parseBatch(c.text, { lang: c.lang, loadOffices: lo, verify }) : await EcontMatch.parseSingle(c.text, { lang: c.lang, loadOffices: lo }));
        return canon(got) === canon(golden.get(c.name)) || c.name;
      });
      out.listSizes = [prod.length, demo.length];
      return out;
    }, [G('server-parse.json'), G('server-batch.json'), G('server-offices.json'), edgeCases(), G('server-edge.json')]);
    for (const k of ['parse', 'batch', 'search', 'edge']) {
      const r = res[k];
      ok(`browser ${k} == old server (${r.pass}/${r.n})`, r.pass === r.n && r.n > 0, r.first);
    }
    ok('demo and production lists kept apart', res.listSizes[0] === 35 && res.listSizes[1] === 12 && await p.evaluate(() => JSON.parse(localStorage.getItem('econt_offices_demo')).offices.length === 12), JSON.stringify(res.listSizes));
    ok('no page errors (golden)', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 2. the app around it ----------
  await mock.reset();
  { const p = await fresh(b, { cod: false });
    await p.waitForFunction(() => !!localStorage.getItem('econt_offices_production'), null, { timeout: 10000 });
    await p.waitForTimeout(300);   // the background login check
    // Reading a message makes no server call at all once the list is kept.
    let calls = await apiCalls(p, async () => {
      await parse(p, 'Мария Петрова 0888123456 Пловдив офис Тракия');
      await p.waitForSelector('#preview:not(.hide)');
    });
    ok('single message read in the browser: no /api/parse', !calls.some((c) => /parse|offices/.test(c)), calls.join(','));
    ok('office matched locally', (await p.inputValue('#pOffice')) === '2223', await p.inputValue('#pOffice'));
    calls = await apiCalls(p, async () => {
      await p.click('#clearBtn');
      await parse(p, 'Петър Колев 0888777666 Варна офис Чайка 10 лв\n\nАна Димитрова 0899555444 Бургас Сарафово 20 лв\n\nГеорги Иванов 0899111222 Пловдив 15 лв');
      await p.waitForSelector('#batch:not(.hide)');
    });
    ok('batch read in the browser: no /api/parse-batch', !calls.some((c) => /parse|offices/.test(c)), calls.join(','));
    const rows = await p.$$eval('.brow', (els) => els.map((e) => [e.querySelector('select[data-f="office"]') ? e.querySelector('select[data-f="office"]').value : '', e.querySelector('[data-status]').textContent]));
    ok('batch rows: confident matches picked, a city-only row asks', rows.length === 3 && rows[0][0] === '3333' && rows[1][0] === '4442' && rows[2][0] === '' && /избери|офис/.test(rows[2][1]), JSON.stringify(rows));
    const st1 = await mock.state();
    ok('office list fetched once for all of that', st1.offices.production === 1, JSON.stringify(st1.offices));

    // Size limits and the multi-parcel switch, answered in the browser.
    await p.click('#clearBtn');
    await parse(p, 'Мария Петрова 0888123456 Пловдив Център ' + 'х'.repeat(20000));
    await p.waitForFunction(() => $('parseErr').textContent.length > 0);
    ok('text_too_long message', (await p.textContent('#parseErr')) === 'Текстът е твърде дълъг. Поставете само съобщението с данните за пратката.', await p.textContent('#parseErr'));
    await parse(p, 'Мария Петрова 0888123456 Пловдив Център\nГеорги Иванов 0899111222 Варна Чайка\n' + 'x'.repeat(80000));
    await p.waitForFunction(() => /дълъг/.test($('parseErr').textContent));
    ok('batch_too_big (too long) message', (await p.textContent('#parseErr')) === 'Текстът е твърде дълъг за едно поставяне. Поставете пратките на части.', await p.textContent('#parseErr'));
    await parse(p, Array.from({ length: 105 }, (_, i) => 'Клиент ' + i + ' 0888' + String(100000 + i).slice(-6) + ' Варна Чайка').join('\n'));
    await p.waitForFunction(() => /много/.test($('parseErr').textContent), null, { timeout: 15000 });
    ok('batch_too_big (too many) message', (await p.textContent('#parseErr')) === 'Твърде много пратки в едно поставяне (105). Най-много 100 наведнъж. Постави ги на части.', await p.textContent('#parseErr'));
    await p.click('#langEn'); await p.waitForTimeout(100);
    await parse(p, 'Maria 0888123456 Plovdiv ' + 'x'.repeat(20000));
    await p.waitForFunction(() => /too long/.test($('parseErr').textContent));
    ok('text_too_long message in English', (await p.textContent('#parseErr')) === 'That text is too long. Paste just the message with the parcel details.', await p.textContent('#parseErr'));
    await p.click('#langBg'); await p.waitForTimeout(100);
    // Two parcels whose phones the page's own count misses (0888/123456): the
    // reader finds both and the app opens them as a list.
    await parse(p, 'Петър Колев 0888/777666 Варна офис Чайка\n\nАна Димитрова 0899/555444 Пловдив офис Център');
    const multi = await p.waitForSelector('#batch:not(.hide)', { timeout: 6000 }).then(() => true, () => false);
    ok('multi_parcel opens the batch list', multi && (await p.$$('.brow')).length === 2, await p.textContent('#parseErr'));
    // A 100-row paste stays within the limits and is matched in the browser.
    const t0 = Date.now();
    await p.click('#clearBtn');
    await parse(p, Array.from({ length: 100 }, (_, i) => 'Клиент ' + i + ' 0888' + String(100000 + i).slice(-6) + ' Варна Чайка 10 лв').join('\n'));
    await p.waitForSelector('#batch:not(.hide)', { timeout: 20000 });
    ok('100-row batch read in the browser', (await p.$$('.brow')).length === 100, (Date.now() - t0) + ' ms');
    ok('no page errors (app)', p.errs.length === 0, p.errs.join(' | '));

    // Settings: count and age of the kept list, refresh with new offices.
    await p.click('#clearBtn');
    await p.click('#settingsBtn');
    await p.waitForFunction(() => /активни офиса/.test($('officeStatus').textContent), null, { timeout: 8000 });
    ok('settings: office count and age', (await p.textContent('#officeStatus')) === '35 активни офиса, списъкът е обновен току-що.', await p.textContent('#officeStatus'));
    await mock.control({ extraOffices: [
      { code: '7771', name: 'Самоков Център', nameEn: 'Samokov Center', isAPS: false, address: { city: { name: 'Самоков', nameEn: 'Samokov', postCode: '2000' }, fullAddress: 'Самоков, ул. Македония 1', quarter: '', street: 'ул. Македония', num: '1' } },
      { code: '7772', name: 'Банско', nameEn: 'Bansko', isAPS: false, address: { city: { name: 'Банско', nameEn: 'Bansko', postCode: '2770' }, fullAddress: 'Банско, ул. Пирин 2', quarter: '', street: 'ул. Пирин', num: '2' } },
    ] });
    await p.click('#refreshOfficesBtn');
    await p.waitForFunction(() => /Заредени/.test($('officeStatus').textContent), null, { timeout: 8000 });
    ok('refresh: new count and new offices', (await p.textContent('#officeStatus')) === 'Заредени са 37 офиса. Нови офиси: 2.', await p.textContent('#officeStatus'));
    ok('refresh asked Econt again', (await mock.state()).offices.production === 2);
    await p.fill('#cfgSenderSearch', 'Самоков'); await p.click('#cfgSenderSearchBtn');
    await p.waitForFunction(() => !$('cfgSenderOfficeSel').classList.contains('hide') && $('cfgSenderOfficeSel').options.length && $('cfgSenderOfficeSel').options[0].value !== '', null, { timeout: 5000 });
    ok('settings office search finds the new office', (await p.inputValue('#cfgSenderOfficeSel')) === '7771', await p.inputValue('#cfgSenderOfficeSel'));
    // Login check: Econt's answer plus the office count from the kept list.
    await p.click('#cfgTestBtn');
    await p.waitForFunction(() => /Входът работи|Грешен/.test($('cfgTestMsg').textContent), null, { timeout: 8000 });
    ok('login check shows the office count', (await p.textContent('#cfgTestMsg')) === 'Входът работи. Налични са 37 офиса.', await p.textContent('#cfgTestMsg'));
    await p.context().close(); }

  // ---------- 3. the 6 h life of the kept list ----------
  await mock.reset();
  { const p = await fresh(b, { cod: false });
    await p.waitForFunction(() => !!localStorage.getItem('econt_offices_production'), null, { timeout: 10000 });
    // Read one message the way the Read button does; resolves when the editor is filled.
    const read = (text) => p.evaluate(async (t) => { show('app'); $('msg').value = t; const filled = await doParse(); return { filled, office: $('pOffice').value, first: $('pOffice').options[0] ? $('pOffice').options[0].textContent : '' }; }, text);
    // A reload within 6 h: the kept copy, no new download.
    await p.reload(); await p.waitForFunction(() => typeof enterApp === 'function');
    await p.evaluate(async (cfg) => { SESSION.password = 'pw'; SESSION.pin = '1234'; CONFIG = cfg; enterApp(); }, account({ cod: false }));
    let r = await read('Мария Петрова 0888123456 Варна офис Чайка');
    ok('reload within 6 h uses the kept list', (await mock.state()).offices.production === 1 && r.office === '3333', JSON.stringify(r));
    // Older than 6 h: a new download on the next use.
    const age = (h) => p.evaluate((hrs) => { const s = JSON.parse(localStorage.getItem('econt_offices_production')); s.at = Date.now() - hrs * 3600e3; localStorage.setItem('econt_offices_production', JSON.stringify(s)); OFFICES.production = null; }, h);
    await age(6.1);
    r = await read('Мария Петрова 0888123456 Бургас Лазур');
    ok('older than 6 h: downloaded again', (await mock.state()).offices.production === 2 && r.office === '4441', JSON.stringify(r) + ' ' + JSON.stringify((await mock.state()).offices));
    // Econt down and the copy old: the stale copy is used, nothing breaks.
    await age(30);
    await mock.control({ faults: { offices: { mode: '502', n: 99 } } });
    r = await read('Мария Петрова 0888123456 Хасково Орфей');
    ok('Econt down: the stale copy still matches', r.filled && r.office === '6664', JSON.stringify(r));
    await p.click('#settingsBtn');
    await p.waitForFunction(() => /активни офиса/.test($('officeStatus').textContent), null, { timeout: 8000 });
    ok('settings shows the stale copy\'s age', (await p.textContent('#officeStatus')) === '35 активни офиса, списъкът е обновен преди 30 ч.', await p.textContent('#officeStatus'));
    // Refresh while Econt is down: the kept copy stays, the count is still shown.
    await p.click('#refreshOfficesBtn');
    await p.waitForFunction(() => /Заредени|Econt/.test($('officeStatus').textContent), null, { timeout: 8000 });
    ok('refresh while Econt is down keeps the copy', (await p.textContent('#officeStatus')).startsWith('Заредени са 35 офиса'), await p.textContent('#officeStatus'));
    // No copy at all and Econt down: the editor opens with the office error.
    await p.evaluate(() => { localStorage.removeItem('econt_offices_production'); OFFICES.production = null; });
    r = await read('Мария Петрова 0888123456 Кърджали Възрожденци');
    ok('no copy + Econt down: office error in the editor', r.filled && r.office === '' && /502/.test(r.first), JSON.stringify(r));
    // Econt cuts the list mid-body (the relay passes it through as it streams in):
    // a plain failure, no "server waking up" retries; the old copy is used at once.
    await mock.control({ clearFaults: true });
    r = await read('Мария Петрова 0888123456 Варна офис Чайка');
    await age(7);
    await mock.control({ faults: { offices: { mode: 'cut', n: 99 } } });
    let t0 = Date.now();
    r = await read('Мария Петрова 0888123456 Бургас Сарафово');
    ok('Econt cuts the list: the kept copy at once', r.filled && r.office === '4442' && Date.now() - t0 < 4000, (Date.now() - t0) + ' ms ' + JSON.stringify(r));
    await p.evaluate(() => { localStorage.removeItem('econt_offices_production'); OFFICES.production = null; });
    t0 = Date.now();
    r = await read('Мария Петрова 0888123456 Бургас Сарафово');
    ok('Econt cuts the list, no copy: says so, no retries', r.filled && r.office === '' && r.first === 'Списъкът с офиси не се зареди: Еконт прекъсна списъка с офиси. Опитай пак след малко.' && Date.now() - t0 < 4000, (Date.now() - t0) + ' ms ' + JSON.stringify(r));
    await mock.control({ clearFaults: true });
    ok('no page errors (cache)', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 4. wrong password: batch rows say so, no office matching ----------
  await mock.reset();
  { const p = await fresh(b, { cod: false, password: 'wrong' });
    await parse(p, 'Петър Колев 0888777666 Варна офис Чайка 10 лв\n\nАна Димитрова 0899555444 Пловдив офис Център 20 лв');
    await p.waitForSelector('#batch:not(.hide)', { timeout: 10000 });
    ok('wrong login: batch says so', (await p.textContent('#batchErr')).includes('Грешен потребител или парола'), await p.textContent('#batchErr'));
    await p.context().close(); }

  // ---------- 5. Еконтомат: Econt drops the review, the app says so ----------
  await mock.reset();
  { const p = await fresh(b, { cod: false, defaults: { reviewMode: 'review' } });
    await parse(p, 'Мария Петрова 0888123456 Еконтомат Варна Гранд Мол'); await p.waitForSelector('#preview:not(.hide)');
    ok('locker office matched', (await p.inputValue('#pOffice')) === '3390', await p.inputValue('#pOffice'));
    await p.waitForTimeout(1200);
    await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)', { timeout: 8000 });
    const st = await mock.state();
    const last = st.createdLabels[st.createdLabels.length - 1];
    const parcel = await p.evaluate(() => loadParcels()[0]);
    ok('review asked for, dropped by Econt, parcel saved without it', last && last.label.payAfterAccept === true && parcel.reviewMode === 'none', JSON.stringify({ asked: last && last.label.payAfterAccept, saved: parcel.reviewMode }));
    ok('customer reply promises no review', !/преглед/i.test(await p.textContent('#replyText')), await p.textContent('#replyText'));
    ok('no page errors (locker)', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 6. tracking many parcels: 10 per relay call, all or nothing ----------
  await mock.reset();
  { const p = await fresh(b, { cod: false });
    await p.evaluate(() => saveParcels(Array.from({ length: 95 }, (_, i) => ({ number: String(1051602800000 + i), recipient: 'Клиент ' + i, createdAt: Date.now() - i * 60000, mode: 'production' }))));
    const t0 = (await mock.state()).tracks;
    await p.click('#navParcels');
    await p.waitForFunction(() => loadParcels().every((x) => x.snapAt), null, { timeout: 15000 }).catch(() => {});
    const st = await mock.state();
    const snaps = await p.evaluate(() => loadParcels().filter((x) => x.snapAt).length);
    // (an Econt reply is about 15 KB per parcel; 10 keep a fresh Worker's relay call
    // well inside Cloudflare's free CPU limit, see tests/cpu-profile.js)
    ok('95 parcels tracked in 10 relay calls of at most 10', st.tracks === t0 + 10 && snaps === 95 && st.lastTrack.length <= 10, JSON.stringify({ calls: st.tracks - t0, snaps, last: st.lastTrack.length }));
    ok('every card rendered', (await p.$$('.parcel')).length === 95);
    // One part failing fails the refresh as a whole, with Econt's words.
    await mock.control({ faults: { track: { mode: '502', n: 1 } } });
    await p.click('#refreshParcelsBtn');
    await p.waitForFunction(() => $('parcelsUpdated').dataset.failed === '1', null, { timeout: 10000 }).catch(() => {});
    ok('a failed part fails the refresh', /Econt HTTP 502/.test(await p.textContent('#parcelsUpdated')), await p.textContent('#parcelsUpdated'));
    // Econt cuts a reply mid-body (the relay passes it through as it streams in):
    // the refresh fails at once with that reason, no "server waking up" retries.
    await mock.control({ faults: { track: { mode: 'cut', n: 99 } } });
    await p.evaluate(() => { delete $('parcelsUpdated').dataset.failed; $('parcelsUpdated').textContent = ''; });
    const tc = Date.now();
    await p.click('#refreshParcelsBtn');
    await p.waitForFunction(() => $('parcelsUpdated').dataset.failed === '1', null, { timeout: 10000 }).catch(() => {});
    ok('a cut tracking reply: fails at once and says why', /Еконт прекъсна отговора\. Опитай пак след малко\./.test(await p.textContent('#parcelsUpdated')) && Date.now() - tc < 4000,
      (Date.now() - tc) + ' ms ' + await p.textContent('#parcelsUpdated'));
    await mock.control({ clearFaults: true });
    // The cards read Econt's statuses in the browser: English texts after a switch.
    await p.click('#langEn'); await p.waitForTimeout(100);
    await p.click('#refreshParcelsBtn');
    await p.waitForFunction(() => !$('parcelsUpdated').dataset.failed && !$('refreshParcelsBtn').disabled, null, { timeout: 10000 }).catch(() => {});
    const card = await p.evaluate(() => { const c = document.querySelector('.parcel'); c.querySelector('[data-toggle]').click(); return c.textContent; });
    ok('tracking events read in the browser, in English', /Passing through a hub/.test(card) && !/Преминава през логистичен център/.test(card), card.slice(0, 200));
    await p.click('#langBg'); await p.waitForTimeout(100);
    ok('no page errors (tracking)', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 7. a browser without regex lookbehind (Safari before 16.4) ----------
  // Old Safari cannot compile a lookbehind: one in core/parser.js stopped it from
  // loading, and nothing could be read. Here the page's RegExp refuses lookbehind
  // the same way (literals with one are kept out by tests/lookbehind-free.js).
  await mock.reset();
  { const strictRegExp = () => {
      const R = RegExp;
      const S = function RegExp(src, flags) {
        const s = src instanceof R ? src.source : String(src);
        if (/\(\?<[=!]/.test(s)) throw new SyntaxError('Invalid regular expression: /' + s + '/: Invalid group specifier name');
        return new R(src, flags);
      };
      S.prototype = R.prototype;
      window.RegExp = S;
    };
    const p = await fresh(b, { cod: false, init: strictRegExp, ready: () => typeof enterApp === 'function' });
    const strict = await p.evaluate(() => { try { new RegExp('(?' + '<!a)b'); return false; } catch (e) { return /group specifier/.test(e.message); } });
    ok('no-lookbehind browser: the page refuses lookbehind', strict);
    ok('no-lookbehind browser: core/parser.js and core/match.js load', await p.evaluate(() => !!window.EcontParser && !!window.EcontMatch), p.errs.join(' | '));
    await parse(p, 'Мария Петрова 0888123456 Пловдив Тракия 45 лв');
    const single = await p.waitForSelector('#preview:not(.hide)', { timeout: 8000 }).then(() => true, () => false);
    ok('no-lookbehind browser: a message is read', single && (await p.inputValue('#pName')) === 'Мария Петрова' && (await p.inputValue('#pOffice')) === '2223', single ? (await p.inputValue('#pName')) + ' ' + (await p.inputValue('#pOffice')) : await p.textContent('#parseErr'));
    await p.click('#clearBtn');
    await parse(p, 'Петър Колев 0888777666 Варна офис Чайка 10 лв\n\nАна Димитрова 0899555444 Бургас Сарафово 20 лв');
    const batch = await p.waitForSelector('#batch:not(.hide)', { timeout: 8000 }).then(() => true, () => false);
    ok('no-lookbehind browser: a batch is read', batch && (await p.$$('.brow')).length === 2);
    await p.click('#clearBtn');
    await p.click('#settingsBtn');
    await p.fill('#cfgSenderSearch', 'Чайка'); await p.click('#cfgSenderSearchBtn');
    await p.waitForFunction(() => $('cfgSenderOfficeSel').options.length > 0 && $('cfgSenderOfficeSel').options[0].value !== '', null, { timeout: 5000 }).catch(() => {});
    ok('no-lookbehind browser: office search works', (await p.inputValue('#cfgSenderOfficeSel')) === '3333', await p.$eval('#cfgSenderOfficeSel', (s) => [...s.options].map((o) => o.textContent).join(' | ')));
    ok('no-lookbehind browser: no page errors', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 8. a batch read while the page sleeps ----------
  // A phone locks its screen or switches apps, or the tab is hidden, while a long
  // paste is being read: the clock jumps between rows. The 30 s wall clock the
  // server used would then leave every later row without an office.
  await mock.reset();
  { const p = await fresh(b, { cod: false });
    await p.waitForFunction(() => !!localStorage.getItem('econt_offices_production'), null, { timeout: 10000 });
    await p.evaluate(() => {
      const realNow = Date.now.bind(Date), st = window.setTimeout;
      let off = 0;
      window.__slept = 0;
      Date.now = () => realNow() + off;
      // Every yield between rows "sleeps" 31 s while __sleepy is set.
      window.setTimeout = function (fn, ms, ...a) { if (!ms && window.__sleepy) { off += 31000; window.__slept++; } return st.call(window, fn, ms, ...a); };
    });
    await p.evaluate(() => { window.__sleepy = true; });
    await parse(p, Array.from({ length: 100 }, (_, i) => 'Клиент ' + i + ' 0888' + String(100000 + i).slice(-6) + ' Варна Чайка 10 лв').join('\n'));
    await p.waitForSelector('#batch:not(.hide)', { timeout: 20000 });
    const slept = await p.evaluate(() => { window.__sleepy = false; return window.__slept; });
    const offices = await p.$$eval('.brow select[data-f="office"]', (els) => els.map((e) => e.value));
    ok('page asleep during a 100-row read: every row keeps its office', slept > 0 && offices.length === 100 && offices.every((v) => v === '3333') && (await p.textContent('#batchErr')) === '',
      JSON.stringify({ slept, rows: offices.length, matched: offices.filter((v) => v === '3333').length, err: await p.textContent('#batchErr') }));
    ok('no page errors (asleep)', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 9. Settings refresh tells the truth, and can be pressed again ----------
  // The kept copy stands in for a list Econt cannot give (section 3), but when the
  // app's own server cannot be reached the refresh says so, as it did before.
  await mock.reset();
  { const p = await fresh(b, { cod: false });
    await p.waitForFunction(() => !!localStorage.getItem('econt_offices_production'), null, { timeout: 10000 });
    await p.click('#settingsBtn');
    await p.waitForFunction(() => /активни офиса/.test($('officeStatus').textContent), null, { timeout: 8000 });
    const press = async () => {
      // (a button left stuck by the press before is freed here, so every check below
      // still runs; the `idle` flag of that press has already reported it)
      await p.evaluate(() => { $('officeStatus').textContent = ''; const btn = $('refreshOfficesBtn'); if (btn.disabled) btnBusy(btn, false); });
      await p.click('#refreshOfficesBtn');
      await p.waitForFunction(() => /Заредени|Грешка/.test($('officeStatus').textContent) && !$('refreshOfficesBtn').disabled, null, { timeout: 8000 }).catch(() => {});
      return { msg: await p.textContent('#officeStatus'), idle: await p.evaluate(() => !$('refreshOfficesBtn').disabled && !$('refreshOfficesBtn').hasAttribute('aria-busy') && !$('refreshOfficesBtn').querySelector('.spin')) };
    };
    let r = await press();
    ok('refresh: loads and the button is ready again', r.msg === 'Заредени са 35 офиса.' && r.idle, JSON.stringify(r));
    r = await press();
    ok('refresh: a second press works too', r.msg === 'Заредени са 35 офиса.' && r.idle && (await mock.state()).offices.production === 3, JSON.stringify(r) + ' ' + JSON.stringify((await mock.state()).offices));
    await p.context().setOffline(true);
    r = await press();
    await p.context().setOffline(false);
    ok('refresh offline: says there is no connection', r.msg === 'Грешка: Няма връзка с интернет.' && r.idle, JSON.stringify(r));
    p.faults.set({ '/api/offices/list': 1 });
    r = await press();
    ok('refresh while the server wakes up: says so', r.msg === 'Грешка: Сървърът се събужда. Изчакай 30 секунди и опитай пак.' && r.idle, JSON.stringify(r));
    await mock.control({ faults: { offices: { mode: '502', n: 1 } } });
    r = await press();
    ok('refresh with Econt down: the kept copy, as before', r.msg === 'Заредени са 35 офиса.' && r.idle, JSON.stringify(r));
    r = await press();
    ok('refresh: works again afterwards', r.msg === 'Заредени са 35 офиса.' && r.idle, JSON.stringify(r));
    ok('no page errors (refresh)', p.errs.length === 0, p.errs.join(' | '));
    await p.context().close(); }

  // ---------- 10. a tab still open from before the update ----------
  // Its app.js calls the old routes; the login check must not show "Налични са ,
  // офиса." but the reload message. Needs the old files from git (724526c).
  let oldApp = null, oldHtml = null;
  try {
    const root = path.join(__dirname, '..', '..');
    oldApp = execFileSync('git', ['show', '724526c:public/app.js'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    oldHtml = execFileSync('git', ['show', '724526c:public/index.html'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { console.error('note: git history not available, the old-tab check is left out'); }
  if (oldApp && oldHtml) {
    await mock.reset();
    const p = await fresh(b, { cod: false, routes: { '/': oldHtml, '/index.html': oldHtml, '/app.js': oldApp }, ready: () => typeof enterApp === 'function' });
    await p.click('#settingsBtn');
    await p.click('#cfgTestBtn');
    await p.waitForFunction(() => $('cfgTestMsg').textContent && !/Проверявам/.test($('cfgTestMsg').textContent), null, { timeout: 8000 }).catch(() => {});
    const msg = await p.textContent('#cfgTestMsg');
    ok('old tab: login check says reload (not "Налични са , офиса.")', msg === 'Приложението е обновено. Презаредете страницата.', msg);
    // Its parcel refresh expects the statuses already read by the server: same.
    await p.click('#settingsBackBtn');
    await p.evaluate(() => saveParcels([{ number: '1051602800001', recipient: 'Клиент', createdAt: Date.now(), mode: 'production' }]));
    const t0 = (await mock.state()).tracks;
    await p.click('#navParcels');
    await p.waitForFunction(() => $('parcelsUpdated').dataset.failed === '1', null, { timeout: 10000 }).catch(() => {});
    const upd = await p.textContent('#parcelsUpdated');
    ok('old tab: parcel refresh says reload, Econt not asked', /Приложението е обновено\. Презаредете страницата\./.test(upd) && (await mock.state()).tracks === t0, upd);
    await p.context().close();
  }

  await b.close();
  finish();
})().catch((e) => finish(e));
