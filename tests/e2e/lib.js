'use strict';

// Shared harness for the end-to-end suites in tests/e2e/. Every suite runs the
// same way against either runtime:
//
//   APP_URL   the app under test: the Node server (server.js) or `wrangler dev`
//             (Cloudflare's workerd running worker.js), pointed at the mock
//   MOCK_URL  tests/mock-econt.js (its /__state and /__control endpoints)
//   RUNTIME   a label for the summary line: node | workerd
//   SHOT_DIR  optional: where to save screenshots (none when unset)
//
// Playwright comes from the global install: NODE_PATH=$(npm root -g).
// Each suite prints PASS/FAIL lines and one
//   RESULT suite=<name> runtime=<runtime> pass=<n> fail=<n>
// line that tests/run-all.sh collects; the exit code is 1 when anything failed.

const fs = require('fs');
const path = require('path');

const APP = (process.env.APP_URL || 'http://127.0.0.1:5402').replace(/\/+$/, '');
const MOCK = (process.env.MOCK_URL || 'http://127.0.0.1:5301').replace(/\/+$/, '');
const RUNTIME = process.env.RUNTIME || 'node';
const SHOT_DIR = process.env.SHOT_DIR || '';

function suite(name) {
  const results = [];
  const started = Date.now();
  const ok = (label, cond, extra) => {
    const line = (cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 300) : '');
    results.push(line);
    if (process.env.E2E_VERBOSE) console.log('[' + ((Date.now() - started) / 1000).toFixed(1) + 's] ' + line);
    return !!cond;
  };
  const finish = async (crash) => {
    if (!process.env.E2E_VERBOSE) console.log(results.join('\n'));
    if (crash) { console.error('CRASH', crash); results.push('FAIL crashed: ' + ((crash && crash.message) || crash)); }
    const fail = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`RESULT suite=${name} runtime=${RUNTIME} pass=${results.length - fail} fail=${fail} secs=${Math.round((Date.now() - started) / 1000)}`);
    // A crash leaves the browser open, which would keep this process (and the test
    // run) waiting forever: close what this suite launched, then exit.
    await Promise.all(LAUNCHED.splice(0).map((b) => b.close().catch(() => {})));
    process.exit(fail ? 1 : 0);
  };
  return { ok, finish, results };
}

// ---------- the Econt mock ----------
const mock = {
  async state() { return (await fetch(MOCK + '/__state')).json(); },
  async control(obj) { const r = await fetch(MOCK + '/__control', { method: 'POST', body: JSON.stringify(obj) }); return r.json(); },
  reset() { return mock.control({ reset: true }); },
};

// ---------- faults at the app's own door ----------
// What Render's proxy answers while the Node server wakes up: an HTML 502 page.
// Done in the browser with Playwright routes, so it is the same on both runtimes:
//   const f = await appFaults(context); f.set({ '/api/ping': 2 }); f.set({});
const WAKING_PAGE = '<html><head><title>502</title></head><body>502 waking</body></html>';
async function appFaults(ctx) {
  const left = new Map();
  await ctx.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const p = new URL(route.request().url()).pathname;
    const n = left.get(p) || 0;
    if (n > 0) {
      left.set(p, n - 1);
      return route.fulfill({ status: 502, contentType: 'text/html', body: WAKING_PAGE });
    }
    return route.continue();
  });
  return {
    set(map) { left.clear(); for (const [k, v] of Object.entries(map || {})) left.set(k, v); },
    left: (p) => left.get(p) || 0,
  };
}

// ---------- browser ----------
function playwright() {
  try { return require('playwright'); } catch (e) {
    throw new Error('Playwright not found. Run with NODE_PATH=$(npm root -g) (global playwright install).');
  }
}
const LAUNCHED = [];
async function launch() {
  const b = await playwright().chromium.launch();
  LAUNCHED.push(b);
  return b;
}

const SENDER = { name: 'Иван', phone: '0878916695', officeCode: '1111' };
// A set-up account, as the setup wizard leaves it (password "pw", PIN 1234).
function account(o) {
  o = o || {};
  return {
    mode: o.mode || 'production', username: o.username || 'u', sender: Object.assign({}, SENDER),
    defaults: Object.assign({ weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: !!o.cod, currency: 'EUR' } }, o.defaults || {}),
  };
}
async function seed(page, o) {
  o = o || {};
  await page.evaluate(async ([cfg, pw]) => {
    SESSION.password = pw; SESSION.pin = '1234';
    CONFIG = cfg;
    await persist(); enterApp();
  }, [account(o), o.password || 'pw']);
}
// A fresh browser context with the app open and an account set up.
async function fresh(b, o) {
  o = o || {};
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }, o.context || {}));
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push('console: ' + m.text()); });
  if (o.lang) await p.addInitScript((l) => localStorage.setItem('econt_lang', l), o.lang);
  // o.init: scripts that run in the page before any of its own (string or function).
  for (const s of [].concat(o.init || [])) await p.addInitScript(s);
  // o.routes: { '/path': body } served instead of the app's file (e.g. an older app.js).
  for (const [route, body] of Object.entries(o.routes || {})) {
    await ctx.route((u) => u.pathname === route, (r) => r.fulfill({ status: 200, contentType: /\.js$/.test(route) ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', body }));
  }
  p.faults = await appFaults(ctx);
  await p.goto(APP + '/');
  await p.waitForFunction(o.ready || (() => typeof enterApp === 'function' && !!window.EcontMatch), null, { timeout: 15000 });
  if (o.seed !== false) await seed(p, o);
  return p;
}
const parse = async (p, text) => { await p.fill('#msg', text); await p.click('#parseBtn'); };
const shot = async (p, name, opts) => {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await p.screenshot(Object.assign({ path: path.join(SHOT_DIR, RUNTIME + '-' + name) }, opts || {}));
};

module.exports = { APP, MOCK, RUNTIME, suite, mock, appFaults, launch, account, seed, fresh, parse, shot, SENDER };
