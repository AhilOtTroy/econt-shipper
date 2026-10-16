'use strict';

// Captures the golden outputs the parser and office-matching tests compare against.
//
// It runs the ORIGINAL code of commit 724526c (the last version that parsed and
// matched on the server): server.js, parser.js and econt.js are taken with
// `git show 724526c:<file>` into a temporary folder, econt.js is pointed at the
// Econt mock (tests/mock-econt.js), the old server is started, and every message
// in tests/golden/inputs.json is sent to its /api/parse and /api/parse-batch.
// The old parser's own functions are recorded too.
//
//   node tests/capture-golden.js            (writes tests/golden/*.json)
//
// Only re-run this on purpose: the point of the golden files is that the moved
// browser code must keep producing exactly these outputs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const mock = require('./mock-econt');
const { edgeCases } = require('./golden/edge-cases');

const ROOT = path.join(__dirname, '..');
const COMMIT = process.env.GOLDEN_COMMIT || '724526c';
const GOLDEN = path.join(__dirname, 'golden');
const CREDS = { mode: 'production', username: 'golden', password: 'golden-pass' };

function gitShow(file) { return execFileSync('git', ['show', COMMIT + ':' + file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }); }

function writeLines(file, entries) {
  fs.writeFileSync(path.join(GOLDEN, file), '[\n' + entries.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n');
}

async function post(base, route, body) {
  const r = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return JSON.parse(await r.text());
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'econt-golden-'));
  for (const f of ['server.js', 'parser.js', 'econt.js']) fs.writeFileSync(path.join(dir, f), gitShow(f));
  fs.mkdirSync(path.join(dir, 'public'));
  // The old econt.js has its base URLs hard-coded: point them at the mock.
  const econtSrc = fs.readFileSync(path.join(dir, 'econt.js'), 'utf8');
  const patched = econtSrc
    .replace("'https://ee.econt.com/services'", "(process.env.ECONT_BASE_PRODUCTION + '/services')")
    .replace("'http://demo.econt.com/ee/services'", "(process.env.ECONT_BASE_DEMO + '/services')");
  if (patched === econtSrc) throw new Error('could not patch econt.js base URLs');
  fs.writeFileSync(path.join(dir, 'econt.js'), patched);

  const m = await mock.start(0);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const env = Object.assign({}, process.env, { PORT: String(port), ECONT_BASE_PRODUCTION: m.url + '/prod', ECONT_BASE_DEMO: m.url + '/demo/ee' });
  const child = spawn(process.execPath, ['server.js'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { if (/running/.test(String(d))) resolve(); });
    child.on('exit', (c) => reject(new Error('old server exited ' + c)));
    setTimeout(() => reject(new Error('old server did not start')), 10000);
  });
  const base = 'http://127.0.0.1:' + port;
  try {
    const inputs = JSON.parse(fs.readFileSync(path.join(GOLDEN, 'inputs.json'), 'utf8'));
    const all = inputs.single.map((text) => ({ kind: 'single', text })).concat(inputs.batch.map((text) => ({ kind: 'batch', text })));

    // 1. The old parser's functions, run directly.
    const P = require(path.join(dir, 'parser.js'));
    const parserOut = all.map(({ kind, text }) => ({
      kind, text,
      parseMessage: P.parseMessage(text),
      parseClean: P.parseMessage(P.stripNoise(text)),
      stripNoise: P.stripNoise(text),
      splitBatch: P.splitBatch(text),
      splitParsed: P.splitBatch(text).map((c) => P.parseMessage(c)),
      namedParcelCount: P.namedParcelCount(text),
      countPhones: P.countPhones(text),
      findWaybill: P.findWaybill(text),
      phoneIndexOf: P.phoneIndexOf(text),
    }));
    // JSON round trip: what the file holds is what the test will compare.
    writeLines('parser.json', JSON.parse(JSON.stringify(parserOut)));

    // 2. The old server's /api/parse and /api/parse-batch, Bulgarian for all,
    //    English for every fifth (the messages and office names do not change, but
    //    the error texts do).
    const parse = [], batch = [];
    for (let i = 0; i < all.length; i++) {
      const { text } = all[i];
      for (const lang of i % 5 === 0 ? ['bg', 'en'] : ['bg']) {
        parse.push({ text, lang, response: await post(base, '/api/parse', { text, creds: CREDS, lang }) });
        batch.push({ text, lang, response: await post(base, '/api/parse-batch', { text, creds: CREDS, lang }) });
      }
    }
    writeLines('server-parse.json', parse);
    writeLines('server-batch.json', batch);

    // 3. The old office search (/api/offices).
    const queries = ['Тракия', 'пловдив', 'Варна', 'чайка', '1000', 'София Младост', 'Еконтомат', 'ЛЛЦ', 'Сарафово Бургас', 'Възрожденци', 'Орфей', '', 'xyz', 'бул. Васил Левски', 'Казанлък', '9000', 'Plovdiv', 'а'.repeat(500) + ' Чайка'];
    const offices = [];
    for (const q of queries) offices.push({ q, response: await post(base, '/api/offices', { q, creds: CREDS, lang: 'bg' }) });
    writeLines('server-offices.json', offices);

    // 4. Edge cases (tests/golden/edge-cases.js): limits, a wrong login, a missing
    //    login, an office list that fails, the demo list.
    const edge = [];
    const credsFor = (k) => (k === 'bad' ? Object.assign({}, CREDS, { password: mock.BAD_PASSWORD })
      : k === 'missing' ? {} : k === 'demo' ? Object.assign({}, CREDS, { mode: 'demo' }) : CREDS);
    for (const c of edgeCases()) {
      // The demo list is never loaded before these: Econt fails once for each.
      if (c.fault === 'offices502') mock.applyControl({ faults: { offices: { mode: '502', n: 1 } } });
      const response = await post(base, c.route === 'batch' ? '/api/parse-batch' : '/api/parse', { text: c.text, creds: credsFor(c.creds), lang: c.lang });
      edge.push({ name: c.name, response });
    }
    writeLines('server-edge.json', edge);

    const counts = { parser: parserOut.length, parse: parse.length, batch: batch.length, offices: offices.length, edge: edge.length };
    fs.writeFileSync(path.join(GOLDEN, 'meta.json'), JSON.stringify({ commit: COMMIT, capturedFrom: 'git show ' + COMMIT + ':server.js + parser.js + econt.js with tests/mock-econt.js', counts }, null, 1) + '\n');
    console.log('captured', counts);
  } finally {
    child.kill();
    m.server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
