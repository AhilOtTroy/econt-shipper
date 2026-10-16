'use strict';

// Old Safari: the parser runs in the browser now, and Safari before 16.4 (iOS 15,
// iOS 16.0 to 16.3, Safari 15 on macOS Catalina) cannot compile a regex with a
// lookbehind. One such pattern made the whole of core/parser.js fail to load, so
// nothing could be read. This test keeps it that way, four ways:
//
//  1. no file the browser loads (public/) has a lookbehind in it, written as a
//     regex literal or as a string for new RegExp();
//  2. the browser code needs no syntax newer than the app has always used (the
//     old app.js ran on Safari 13.1 / iOS 13.4), checked with esbuild when it is
//     installed (npm install);
//  3. parser.js and match.js load and read messages in a JS context whose RegExp
//     rejects lookbehind, as old Safari does;
//  4. every pattern that used to carry a lookbehind behaves exactly as before:
//     the originals are kept below (REFERENCE, copied verbatim from f9880f4) and
//     compared with the parser's lookbehind-free versions (parser.js _patterns)
//     on the golden messages and a seeded random corpus, for each way the parser
//     uses them (test, exec loops, lastIndex jumps, replace).
//
// If a pattern in parser.js is changed on purpose, change its REFERENCE twin too.
//
//   node tests/lookbehind-free.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'public/core/parser.js'));
const INPUTS = require('./golden/inputs.json');

const results = [];
const started = Date.now();
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
const LOOKBEHIND = /\(\?<[=!]/;

// ---------- 1. static ----------
function filesUnder(dir, re) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(f, re));
    else if (re.test(e.name)) out.push(f);
  }
  return out;
}
const browserFiles = filesUnder(path.join(ROOT, 'public'), /\.(js|html|mjs)$/);
const hits = [];
for (const f of browserFiles) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (LOOKBEHIND.test(l)) hits.push(path.relative(ROOT, f) + ':' + (i + 1)); });
}
ok('no lookbehind in any browser file (' + browserFiles.length + ' files)', browserFiles.length >= 3 && !hits.length, hits.slice(0, 10).join(' '));

// ---------- 2. syntax ----------
let esbuild = null;
try { esbuild = require(path.join(ROOT, 'node_modules/esbuild')); } catch {}
if (esbuild) {
  // Syntax Safari 13.1 lacks. esbuild rewrites (or refuses) code that uses any of
  // it, so the output differs from a plain run exactly when such syntax is there.
  const NEWER = ['regexp-lookbehind-assertions', 'regexp-match-indices', 'regexp-set-notation', 'logical-assignment', 'class-field',
    'class-private-field', 'class-private-method', 'class-private-accessor', 'class-private-static-field', 'class-private-static-method',
    'class-private-static-accessor', 'class-private-brand-check', 'class-static-field', 'class-static-blocks', 'top-level-await', 'bigint',
    'arbitrary-module-namespace-names', 'decorators', 'using'];
  const supported = {}; for (const k of NEWER) supported[k] = false;
  const bad = [];
  for (const f of browserFiles.filter((x) => /\.js$/.test(x))) {
    const code = fs.readFileSync(f, 'utf8');
    try {
      const plain = esbuild.transformSync(code, { loader: 'js', target: 'esnext' }).code;
      const old = esbuild.transformSync(code, { loader: 'js', target: 'esnext', supported }).code;
      if (plain !== old) { const pl = plain.split('\n'); bad.push(path.relative(ROOT, f) + ': ' + (old.split('\n').find((l, i) => l !== pl[i]) || '').trim().slice(0, 80)); }
    } catch (e) { bad.push(path.relative(ROOT, f) + ': ' + ((e.errors && e.errors[0] && e.errors[0].text) || e.message)); }
  }
  // The check itself catches a lookbehind literal.
  const probe = esbuild.transformSync('const r = /(?' + '<!a)b/;', { loader: 'js', target: 'esnext', supported }).code;
  ok('browser JS needs no syntax newer than Safari 13.1 (esbuild ' + esbuild.version + ')', !bad.length && /new RegExp/.test(probe), bad.join(' | '));
} else {
  results.push('SKIP browser JS syntax check: esbuild not installed (run npm install)');
}
// Browser APIs newer than Safari 13.1 that are easy to reach for by habit.
const NEWER_API = /\.at\(|Object\.hasOwn|structuredClone|\.findLast|Promise\.any|AggregateError|WeakRef|FinalizationRegistry|AbortSignal\.timeout|randomUUID|CompressionStream|DecompressionStream|\.toSorted|\.toReversed|Object\.groupBy|Array\.fromAsync|replaceChildren|BroadcastChannel|Intl\.Segmenter|showModal|\.replaceAll\(/;
const apiHits = [];
for (const f of browserFiles.filter((x) => /\.js$/.test(x))) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { const m = NEWER_API.exec(l); if (m) apiHits.push(path.relative(ROOT, f) + ':' + (i + 1) + ' ' + m[0]); });
}
ok('browser JS uses no API newer than Safari 13.1 from the watch list', !apiHits.length, apiHits.slice(0, 10).join(' '));

// ---------- 3. loads where lookbehind is a SyntaxError ----------
{
  const ctx = vm.createContext({ console });
  vm.runInContext(`(() => {
    const R = RegExp;
    const Strict = function RegExp(src, flags) {
      const s = src instanceof R ? src.source : String(src);
      if (/\\(\\?<[=!]/.test(s)) throw new SyntaxError('Invalid regular expression: /' + s + '/: Invalid group specifier name');
      return new R(src, flags);
    };
    Strict.prototype = R.prototype;
    Object.defineProperty(globalThis, 'RegExp', { value: Strict, writable: true, configurable: true });
  })();`, ctx);
  let err = null;
  try {
    for (const f of ['public/core/parser.js', 'public/core/match.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  } catch (e) { err = e; }
  const probe = (() => { try { vm.runInContext("new RegExp('(?' + '<!a)b')", ctx); return false; } catch (e) { return /group specifier/.test(String(e && e.message)); } })();
  ok('the strict RegExp of this check rejects lookbehind', probe);
  ok('parser.js and match.js load where lookbehind is rejected', !err && !!ctx.EcontParser && !!ctx.EcontMatch, err ? err.message : '');
  if (!err && ctx.EcontParser) {
    const want = JSON.stringify(P.parseMessage('Мария Петрова 0888123456 Пловдив Тракия 45 лв с преглед'));
    const got = JSON.stringify(ctx.EcontParser.parseMessage('Мария Петрова 0888123456 Пловдив Тракия 45 лв с преглед'));
    ok('a message reads the same there', got === want, got);
    const text = INPUTS.batch[0];
    ok('a batch splits the same there', JSON.stringify(ctx.EcontParser.splitBatch(text)) === JSON.stringify(P.splitBatch(text)));
  }
}

// ---------- 4. each rewritten pattern == its lookbehind original ----------
// REFERENCE: the original definitions (f9880f4 public/core/parser.js), verbatim
// except that the few patterns written inline there get a name here.
const REF = (() => {
  const NL = '(?<![а-яёa-z])', NR = '(?![а-яёa-z])';
  const OFFICE_WORD_RE = new RegExp(NL + '(?:офис[а-яё]*|office|апс|aps|автомат|еконтомат)' + NR, 'i');
  const DT_REF_HEAD = NL + '(?:(?:не|без)\\s+(?:(?:искам|желая|ща|трябва|може|е)\\s+)?|(?:нямам|няма)\\s+)(?:(?:до|в|във|на|през)\\s+)?';
  const DT_OFF_REF_RE = new RegExp(DT_REF_HEAD + '(?:офис[а-яё]*|office|апс|aps|автомат)' + NR, 'gi');
  const DT_ADDR_REF_RE = new RegExp(DT_REF_HEAD + '(?:адрес[а-яё]*|врата|вкъщи|дома)' + NR, 'gi');
  const DT_OFFICE_ADDR_RE = new RegExp('(?<!(?:^|[^а-яёa-z])(?:с|със|чрез|по|през)\\s+)' + NL + '(?:офис[а-яё]*|office|апс|aps|автомат|еконт|econt)' + NR
    + '(?:[^.;!?\\n,/]|,(?=\\s*(?:който|която|което|намиращ|намира|разположен)))' + '{0,40}?' + NL + '(?:с|със|на)\\s+адрес'
    + '|' + NL + 'адрес(?:ът|а)?\\s+на\\s+офис'
    // "Адрес: Еконт Пловдив Тракия" — the address given IS an Econt office
    + '|' + NL + 'адрес[а-яё]*(?:\\s+за\\s+доставка)?\\s*[:\\-–]\\s*(?:до\\s+|в\\s+)?(?:офис[а-яё]*\\s+(?:на\\s+)?)?(?:еконт|econt)' + NR, 'i');
  const HOME_ADDR_RE = new RegExp(NL + '(?:ж\\.?\\s*к|жк\\s|кв\\.?\\s|бл\\.?\\s*\\d|блок\\s*\\d|вх\\.?\\s|ет\\.?\\s*\\d|етаж|ап\\.?\\s*\\d|апартамент)|\\sдо\\s+(?:училище|блок|бл\\.?)');
  const BLOCK_ENTRANCE_RE = new RegExp(NL + '(?:бл\\.?\\s*\\d|вх\\.?\\s)');
  const DOOR_WORD_RE = new RegExp('адрес|до\\s*врата|до\\s*мен|до\\s+(?:вкъщи|дома)' + NR + '|' + NL + '(?:courier|куриер)');
  const CUR_SRC = '€|евро|evro|euro|eur|лв\\.?|лева|лев|bgn|lv\\.?|leva|lev';
  const CUR_BEFORE_RE = new RegExp(NL + '(' + CUR_SRC + ')\\s*$', 'i');
  const NUM_PLAIN_SRC = '\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,6}(?:[.,]\\d{1,2})?';
  const NUM_SPACED_SRC = '\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?:[.,]\\d{1,2})?';
  const NUM_SRC = '(?<![\\d.,])(' + NUM_SPACED_SRC + '|' + NUM_PLAIN_SRC + ')(?!\\d)';
  const GROUP_OK_BEFORE_RE = new RegExp('(?:^|\\n)[ \\t]*$|[:=\\-–—,;(+/]\\s*$|' + NL + '(?:наложен[а-яё]*|платеж[а-яё]*|нп|cod|сума(?:та)?|общо|всичко|тотал|total|цена(?:та)?|стойност|получаване|плащане|е|за|от|€|евро|eur|лв\\.?|лева|bgn)\\s*$', 'i');
  const PAID_BEFORE_RE = /(?:^|[^а-яёa-z])(?<!(?:без|не|няма)\s+)(?:(?:за)?плат(?:их|ихме|ил|ила|или|ено|ена|ен|ени)|преведох(?:ме)?|преведен[аио]?|преведени|капаро|аванс|депозит|предплат[а-яё]*)(?![а-яёa-z])(?!\s+(?:доставк|транспорт|куриер))[^,.;!?\n\d]{0,25}$/i;
  const KW_SRC = NL + '(?:наложен[а-яё]*(?:\\s+платеж[а-яё]*)?|нал\\.?\\s*платеж[а-яё]*|нп|cod|сума(?:та)?|за\\s+получаване|за\\s+плащане)' + NR;
  const LOOSE_PHONE_RE = /(?<!\d)(?:(?:\+|00)?359|0)[\s\-./]{0,2}8[\s\-./]{0,2}[7-9](?:[\s\-./]{0,2}\d){5,9}(?!\d)/g;
  const EUR_RE = new RegExp('€|' + NL + '(?:евро|evro|euro|eur)' + NR, 'i');
  const BGN_RE = new RegExp(NL + '(?:лв|лева|bgn|lv|leva)' + NR, 'i');
  const RV_W = '(?<![а-яёa-z])', RV_E = '(?![а-яёa-z])';
  const RV_MENTION_RE = new RegExp(RV_W + '(?<!(?:бърз[аи]?|антигенен|антигенни|pcr|covid|ковид|кръвен|домашен|минал[аио]?|мина|премина(?:л[аио]?)?|издържа(?:л[аио]?)?|направих(?:ме)?|пуснах|успешен|успешно)\\s+)'
    + '(?:(преглед|pregled)(?:\\s*(?:и\\s*/\\s*или|и|или|i|ili|/|,|&|\\+)\\s*(тест|test))?|(тест)(?!\\s+(?:за\\s+(?:бременност|овулация)|ленти|лента|касет)|\\s+(?:ок|ok|окей|мина|премина|успешен)' + RV_E + ')(?:\\s*(?:и|или|/|,|&|\\+)\\s*(преглед))?)' + RV_E, 'g');
  const RV_NEG_RE = new RegExp(RV_W + '(без|не|няма|нямам|нямаме|отказвам|отказваме|отказва|no|without|нито|bez|ne|nqma|nyama)' + RV_E, 'g');
  const RV_BUT_RE = new RegExp(RV_W + '(?:с|със|но|а|s|sas)' + RV_E);
  const OFFICE_LINE_RE = new RegExp('еконт|econt|' + NL + '(?:офис[а-яё]*|office|апс|aps|автомат|адрес)' + NR + '|' + NL + '(?:ул|бул|гр|с|кв|бл|вх|общ|обл)\\.|' + NL + 'ж\\.?\\s*к|' + NL + 'жк' + NR, 'i');
  const CUR_NUM_RE = new RegExp('\\d\\s*(?:' + CUR_SRC + ')' + NR + '|' + NL + '(?:€|евро|лв)\\s*\\d', 'i');
  const ORIGIN_HEAD_RE = /(?<![а-яёa-z])(?:изпраща[а-яё]*|праща[а-яё]*|изпрат[а-яё]*|прат[а-яё]*|пуска[а-яё]*|подава[а-яё]*|тръгва[а-яё]*)\s+(?:[а-яё]+\s+){0,2}?от\s/i;
  const ORIGIN_RE = new RegExp(ORIGIN_HEAD_RE.source.slice(0, -2) + '\\s+((?:(?:офис[а-яё]*|office|апс|автомат)\\s+)?(?:(?:на\\s+)?(?:еконт|econt)\\s+)?)'
    + '(?:гр\\.?\\s*|град\\s+|с\\.\\s*)?([а-яё]+(?:\\s+[а-яё]+){0,2})', 'gi');
  const MONEY_AFTER_RE = new RegExp('(?<![\\d.,])(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?\\s*(?:' + CUR_SRC + ')' + NR, 'gi');
  const MONEY_BEFORE_RE = new RegExp(NL + '(?:€|евро|eur|лв\\.?|bgn)\\s*\\d+(?:[.,]\\d{1,2})?', 'gi');
  const MONEY_KW_RE = new RegExp('(' + KW_SRC + ')\\s*[:\\-–=]?\\s*\\d+(?:[.,]\\d{1,2})?', 'gi');
  const ALT_HINT_RE = /(?<![а-яё])(?:(?:дъщеря|син|съпруг|съпруга|мъж|жена|майка|баща|сестра|брат|снаха|зет|внук|внучка)\s+ми|дъщерята|сина|синът|съпругата|съпругът|мъжа|мъжът|жената|майката|бащата|сестрата|брата|братът|снахата|ако\s+не\s+(?:вдига|отговаря|се\s+обади|ме\s+намерите)|резервен|друг\s+(?:телефон|номер)|втори\s+(?:телефон|номер))(?![а-яё])/;
  const SHOP_LINE_RE = /^\s*(?:магазин|shop|store)(?![а-яёa-z])|(?<![а-яёa-z])е?оод(?![а-яёa-z])/i;
  const SEP_RE = /[;|,]|(?<!\S)\d{1,2}\)\s/g;
  const DROPOFF_RE = /(?<![а-яё])(?:за\s+подаване|подава[а-яё]*|предава[а-яё]*|мо(?:я|ят|ия)\s+офис|наши(?:я|ят)\s+офис)(?![а-яё])/i;
  const ALL_PARCELS_RE = /(?<![а-яё])(?:всички(?:те)?|всичките|двете|трите|четирите|всяка|всеки)(?![а-яё])/i;
  return {
    OFFICE_WORD_RE, DT_OFF_REF_RE, DT_ADDR_REF_RE, DT_OFFICE_ADDR_RE, HOME_ADDR_RE, BLOCK_ENTRANCE_RE, DOOR_WORD_RE, CUR_BEFORE_RE,
    NUM_SRC, GROUP_OK_BEFORE_RE, PAID_BEFORE_RE, KW_SRC, LOOSE_PHONE_RE, EUR_RE, BGN_RE, RV_MENTION_RE, RV_NEG_RE, RV_BUT_RE,
    OFFICE_LINE_RE, CUR_NUM_RE, ORIGIN_HEAD_RE, ORIGIN_RE, MONEY_AFTER_RE, MONEY_BEFORE_RE, MONEY_KW_RE, ALT_HINT_RE, SHOP_LINE_RE,
    SEP_RE, DROPOFF_RE, ALL_PARCELS_RE,
  };
})();
const NEW = P._patterns;

// The corpus: golden messages (as written, lowercased, line by line, and the
// 40-character windows before each digit that the COD reader looks at), plus
// seeded random strings of the words, numbers and separators these patterns
// care about, glued with and without separators so word edges get tested.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(16042026);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const WORDS = ('офис офиса Офис ОФИС office апс aps автомат еконтомат еконт Еконт ЕКОНТ econt адрес Адрес адресът адреса с със чрез по през '
  + 'на до в във не Не без Без няма нямам искам желая ща трябва може е врата вкъщи дома ж.к жк кв. кв бл. бл вх. вх ет. ет етаж ап. ап '
  + 'апартамент блок училище courier куриер наложен Наложен наложения платеж нал. нп НП cod COD сума сумата за получаване плащане общо '
  + 'всичко тотал total цена цената стойност от лв лв. Лв лева лев bgn BGN lv lv. leva lev € евро Евро eur EUR euro evro платих '
  + 'заплатих платено платена преведох преведени преведена капаро аванс депозит предплата предплатено доставка доставката транспорт '
  + 'преглед Преглед ПРЕГЛЕД тест Тест test pregled и или i ili бърз бързи антигенен антигенни pcr covid ковид кръвен домашен мина минал '
  + 'минала премина преминал издържа издържал направих направихме пуснах успешен успешно бременност ленти ок ok окей но а s sas ул. ул '
  + 'бул. гр. гр общ. обл. изпращам изпраща пращаме пускам подавам подаваме тръгва тръгват утре ги Пловдив Варна София град магазин '
  + 'Магазин ООД ЕООД оод еоод дъщеря син ми сина съпругата мъжа ако вдига отговаря резервен друг телефон втори номер подаване моя моят '
  + 'нашия всички всичките двете трите всяка всеки който която намира разположен Мария Иванова Петров x X ж к').split(' ');
// Whole phrases the patterns are about, so the rarer shapes get tested often too.
const PHRASES = ['изпращам от Пловдив', 'пращаме утре от гр. Русе', 'подавам ги от офис Еконт Бургас Сарафово', 'тръгва от Еконт Варна',
  'изпращаме от офиса на Еконт', 'не до офис', 'без офис', 'не искам до офис', 'нямам офис наблизо', 'няма офис', 'не до адрес',
  'без адрес', 'не искам до врата', 'офис Еконт с адрес бул. Марица 12', 'до Еконт на адрес ул. Шипка 3', 'с Еконт на адрес',
  'по еконт на адрес', 'чрез Еконт на адрес', 'адресът на офиса', 'Адрес: Еконт Пловдив Тракия', 'адрес за доставка: офис на Еконт',
  'до офис на Еконт, който е на адрес ул. Гладстон', 'офис, намира се на адрес', 'адрес на офис', 'без преглед', 'не искам с преглед',
  'бърз тест', 'минал тест', 'тест ок', 'преглед и тест', 'тест и преглед', 'преглед/тест', 'направихме преглед', 'вече платих',
  'не платих', 'без капаро', 'платено капаро', 'преведох по Revolut', 'наложен платеж', 'нал. платеж', 'за получаване', 'НП:',
  'сумата е', 'Магазин Бебе ЕООД', 'тел. на дъщеря ми', 'ако не вдига', 'друг номер', 'моя офис за подаване', 'всички с преглед',
  'и двете с преглед', 'ж.к. Люлин бл. 5 вх. А', 'courier', 'с куриер до врата', '1) Мария', ' 2) Иван', 'лв 45', '€12', 'евро 30'];
const NUMS = ['45', '1 200', '1 200', '1.200', '1,200', '45,50', '45.50', '12', '9.99', '2025', '1000', '0888123456', '0888 123 456',
  '+359888123456', '00359 88 812 3456', '0899 654 32', '0888/123 4567', '2)', '1)', '3', '7', '100000', '12,5', '1.5'];
const SEPS = [' ', ' ', ' ', ' ', '', '', '  ', '\n', '\t', ' ', ', ', ',', '.', '. ', ';', ' | ', ':', ': ', ' - ', ' – ', '(', ')', '/', '!', '?', '=', ' x ', '*'];
function randomText() {
  const n = 1 + Math.floor(rnd() * 10);
  let s = rnd() < 0.2 ? pick(SEPS) : '';
  for (let i = 0; i < n; i++) {
    const r = rnd();
    s += r < 0.25 ? pick(NUMS) : r < 0.45 ? pick(PHRASES) : pick(WORDS);
    if (i < n - 1 || rnd() < 0.3) s += pick(SEPS);
  }
  return rnd() < 0.1 ? s.toUpperCase() : s;
}
const golden = [...INPUTS.single, ...INPUTS.batch];
const corpus = new Set();
for (const t of golden) {
  corpus.add(t); corpus.add(t.toLowerCase());
  for (const l of t.split('\n')) { corpus.add(l); corpus.add(l.toLowerCase()); }
  for (let i = 0; i < t.length; i++) if (/\d/.test(t[i])) corpus.add(t.slice(Math.max(0, i - 40), i));
}
for (let i = 0; i < 30000; i++) corpus.add(randomText());
const CORPUS = [...corpus];

const show = (s) => JSON.stringify(s.length > 120 ? s.slice(0, 120) + '…' : s);
const reset = (r) => { if (r) r.lastIndex = 0; return r; };
const testOf = (r, s) => reset(r).test(s);
function execAll(r, s, jump) {
  reset(r);
  const out = [];
  let m;
  for (let guard = 0; guard < 10000 && (m = r.exec(s)); guard++) {
    out.push([m.index, ...m]);
    if (jump) r.lastIndex = m.index + Math.min(m[0].length, 1 + (m.index % 3));
    else if (!m[0].length) r.lastIndex++;
  }
  return JSON.stringify(out);
}
const execOne = (r, s) => { const m = reset(r).exec(s); return JSON.stringify(m ? [m.index, ...m] : null); };
const tag = (...a) => '<' + a.slice(0, -2).map((x) => (x === undefined ? '~' : x)).join('|') + '@' + a[a.length - 2] + '>';
const OPS = {
  test: (r, s) => String(testOf(r, s)),
  execAll: (r, s) => execAll(r, s, false),
  execJump: (r, s) => execAll(r, s, true),
  execOne,
  replaceSpace: (r, s) => s.replace(reset(r), ' '),
  replaceGroup: (r, s) => s.replace(reset(r), '$1 '),
  replaceFn: (r, s) => s.replace(reset(r), tag),
  match: (r, s) => JSON.stringify(s.match(reset(r))),
};
// name -> [the original, the rewritten one, the ways the parser uses it, names it also covers]
const mk = (f) => (typeof f === 'function' ? f() : f);
const CASES = [
  ['OFFICE_WORD_RE', REF.OFFICE_WORD_RE, NEW.OFFICE_WORD_RE, ['test', 'execOne']],
  ['DT_OFF_REF_RE (replace)', REF.DT_OFF_REF_RE, NEW.DT_OFF_REF_RE, ['replaceSpace', 'execAll', 'match']],
  ['DT_OFF_REF_RE (test, as new RegExp(source, i))', new RegExp(REF.DT_OFF_REF_RE.source, 'i'), NEW.DT_OFF_REF_I, ['test', 'execOne']],
  ['DT_ADDR_REF_RE (replace)', REF.DT_ADDR_REF_RE, NEW.DT_ADDR_REF_RE, ['replaceSpace', 'execAll']],
  ['DT_ADDR_REF_RE (test, as new RegExp(source, i))', new RegExp(REF.DT_ADDR_REF_RE.source, 'i'), NEW.DT_ADDR_REF_I, ['test']],
  ['DT_OFFICE_ADDR_RE', REF.DT_OFFICE_ADDR_RE, NEW.DT_OFFICE_ADDR_RE, ['test']],
  ['homeAddr', REF.HOME_ADDR_RE, NEW.HOME_ADDR_RE, ['test']],
  ['street block/entrance', REF.BLOCK_ENTRANCE_RE, NEW.BLOCK_ENTRANCE_RE, ['test', 'execOne']],
  ['doorWord', REF.DOOR_WORD_RE, NEW.DOOR_WORD_RE, ['test']],
  ['CUR_BEFORE_RE', REF.CUR_BEFORE_RE, NEW.CUR_BEFORE_RE, ['test', 'execOne']],
  ['NUM_SRC (codCandidates)', () => new RegExp(REF.NUM_SRC, 'g'), NEW.NUM_RE, ['execAll', 'execJump']],
  ['GROUP_OK_BEFORE_RE', REF.GROUP_OK_BEFORE_RE, NEW.GROUP_OK_BEFORE_RE, ['test']],
  ['PAID_BEFORE_RE', REF.PAID_BEFORE_RE, NEW.PAID_BEFORE_RE, ['test']],
  ['KW_SRC (gi exec loop)', () => new RegExp(REF.KW_SRC, 'gi'), NEW.KW_RE_GI, ['execAll']],
  ['KW_SRC (i test)', new RegExp(REF.KW_SRC, 'i'), NEW.KW_RE_I, ['test', 'execOne']],
  ['LOOSE_PHONE_RE', REF.LOOSE_PHONE_RE, NEW.LOOSE_PHONE_RE, ['replaceFn', 'execAll']],
  ['globalCurrency EUR', REF.EUR_RE, { test: (s) => s.indexOf('€') >= 0 || reset(NEW.EUR_WORD_RE).test(s) }, ['test'], ['EUR_WORD_RE']],
  ['globalCurrency BGN', REF.BGN_RE, NEW.BGN_WORD_RE, ['test']],
  ['RV_MENTION_RE', REF.RV_MENTION_RE, NEW.RV_MENTION_RE, ['execAll', 'test']],
  ['RV_NEG_RE', REF.RV_NEG_RE, NEW.RV_NEG_RE, ['execAll']],
  ['reviewRefused с/със/но', REF.RV_BUT_RE, NEW.RV_BUT_RE, ['test']],
  ['OFFICE_LINE_RE', REF.OFFICE_LINE_RE, NEW.OFFICE_LINE_RE, ['test']],
  ['CUR_NUM_RE', REF.CUR_NUM_RE, NEW.CUR_NUM_RE, ['test']],
  ['ORIGIN_HEAD_RE', REF.ORIGIN_HEAD_RE, NEW.ORIGIN_HEAD_RE, ['test']],
  ['ORIGIN_RE', REF.ORIGIN_RE, NEW.ORIGIN_RE, ['replaceFn', 'execAll']],
  ['MONEY_AFTER_RE', REF.MONEY_AFTER_RE, NEW.MONEY_AFTER_RE, ['replaceSpace', 'execAll']],
  ['MONEY_BEFORE_RE', REF.MONEY_BEFORE_RE, NEW.MONEY_BEFORE_RE, ['replaceSpace', 'execAll']],
  ['MONEY_KW_RE', REF.MONEY_KW_RE, NEW.MONEY_KW_RE, ['replaceGroup', 'execAll']],
  ['ALT_HINT_RE', REF.ALT_HINT_RE, NEW.ALT_HINT_RE, ['test']],
  ['SHOP_LINE_RE', REF.SHOP_LINE_RE, NEW.SHOP_LINE_RE, ['test']],
  ['splitTwoOnLine separators', () => new RegExp(REF.SEP_RE.source, 'g'), NEW.SEP_RE, ['execAll']],
  ['DROPOFF_RE', REF.DROPOFF_RE, NEW.DROPOFF_RE, ['test']],
  ['ALL_PARCELS_RE', REF.ALL_PARCELS_RE, NEW.ALL_PARCELS_RE, ['test']],
];
const covered = new Set();
for (const [name, refF, newF, ops, also] of CASES) {
  let firstDiff = null, n = 0, matched = 0;
  for (const op of ops) {
    const ref = mk(refF), neu = mk(newF);
    for (const s of CORPUS) {
      n++;
      const a = OPS[op](ref, s), b = OPS[op](neu, s);
      if (op === 'test' && a === 'true') matched++;
      if (a !== b && !firstDiff) firstDiff = op + ' on ' + show(s) + ': lookbehind ' + a.slice(0, 160) + ' vs now ' + b.slice(0, 160);
    }
  }
  for (const k of Object.keys(NEW)) if (newF === NEW[k]) covered.add(k);
  for (const k of also || []) covered.add(k);
  ok('same as the lookbehind original: ' + name + ' (' + n + ' runs' + (ops.includes('test') ? ', ' + matched + ' matches' : '') + ')', !firstDiff, firstDiff || '');
}
const notCovered = Object.keys(NEW).filter((k) => !covered.has(k));
ok('every rewritten pattern is compared', !notCovered.length, notCovered.join(', '));

// The lb() helper itself, with a check that always passes: it must then be the
// plain RegExp in every way the parser (or a later change) may use it, including
// empty matches, groups that did not take part and $-patterns.
{
  const lb = P._lb;
  const pats = [['(о)(ф)?', 'g'], ['(о)(ф)?', ''], ['x*', 'g'], ['(a)|(b)', 'gi'], ['\\d+', 'g'], ['^', 'g'], ['(?:ab)?', 'g'], ['(\\s)(\\S)', 'g']];
  const texts = ['офис хофис офис', 'о оф ОФ', '', 'xaxbxx', 'aBab', '12 3 456', 'a b\nc', 'ab ab'];
  const reps = [' ', '$1 ', '[$2]', '$&$&', '$$', '$9', '$1$2$3', (...a) => tag(...a)];
  let firstDiff = null, n = 0;
  for (const [src, fl] of pats) {
    for (const t of texts) {
      const cmp = (what, a, b) => { n++; if (a !== b && !firstDiff) firstDiff = what + ' /' + src + '/' + fl + ' on ' + show(t) + ': ' + a + ' vs ' + b; };
      for (const r of reps) cmp('replace ' + String(r).slice(0, 12), t.replace(new RegExp(src, fl), r), t.replace(lb(src, fl, () => true), r));
      cmp('match', JSON.stringify(t.match(new RegExp(src, fl))), JSON.stringify(t.match(lb(src, fl, () => true))));
      cmp('test', String(new RegExp(src, fl).test(t)), String(lb(src, fl, () => true).test(t)));
      if (fl.includes('g')) cmp('exec loop', execAll(new RegExp(src, fl), t), execAll(lb(src, fl, () => true), t));
    }
  }
  ok('lb() with a check that always holds is the plain RegExp (' + n + ' comparisons)', !firstDiff, firstDiff || '');
  const lbo = P._patterns.MONEY_KW_RE;
  ok('lb objects carry no source to rebuild a RegExp from', lbo.source === undefined);
  let threw = 0;
  try { 'x'.split(lbo); } catch (e) { threw++; }
  try { 'x'.search(lbo); } catch (e) { threw++; }
  ok('lb objects refuse split/search instead of misreading them', threw === 2);
}

console.log(results.join('\n'));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
const pass = results.filter((r) => r.startsWith('PASS')).length;
console.log('RESULT suite=lookbehind-free runtime=node pass=' + pass + ' fail=' + fail + ' secs=' + Math.round((Date.now() - started) / 1000));
process.exit(fail ? 1 : 0);
