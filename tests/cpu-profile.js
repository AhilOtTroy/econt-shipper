'use strict';

// CPU per relay route, measured on the Worker path (wrangler dev = Cloudflare's
// workerd runtime running worker.js) and, for comparison, on the same relay.js
// handler inside Node.
//
// Workerd: the CPU time of the workerd process that runs the Worker under
// `wrangler dev` (/proc/<pid>/task/*/schedstat, nanoseconds). That is everything
// the local runtime does for a request in that process, the asset router and the
// HTTP plumbing as well as the Worker. /api/ping, which does no work at all,
// measures that fixed overhead; "route - ping" is what the route itself costs,
// the part Cloudflare counts against the Free plan's 10 ms CPU limit.
//
// Two measurements:
//  - warm: the running wrangler dev (WRANGLER_PID), 10 warm-up calls, then the
//    median of 5 rounds of N sequential calls per route;
//  - cold: a Worker that has just started, as a low-traffic Worker on Cloudflare
//    usually is (idle isolates are evicted). For each route, fresh `wrangler dev`
//    instances (started and stopped here, one at a time) each get exactly one
//    call of it, and the median is compared with the first /api/ping of fresh
//    instances. Counted on the process's main thread only, where the JavaScript
//    runs (V8's background threads are busy with start-up work then).
// Tracking is measured with the mock's Econt-sized replies (heavyTracking: 12
// events, full client/address objects, about 15 KB per parcel) as well as small ones.
//
// Env: APP_URL (the wrangler dev URL), MOCK_URL (tests/mock-econt.js), WRANGLER_PID
// (the wrangler process the test runner started), COLD_RUNS (fresh instances per
// route, default 3; 0 skips the cold part). Without WRANGLER_PID only the Node
// measurement runs. Fails when a route the app uses costs 5 ms or more warm, or
// 6 ms or more on a fresh Worker.

const fs = require('fs');
const path = require('path');

const APP = (process.env.APP_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const MOCK = (process.env.MOCK_URL || 'http://127.0.0.1:5301').replace(/\/$/, '');
const WPID = Number(process.env.WRANGLER_PID || 0);
const COLD_RUNS = process.env.COLD_RUNS == null ? 3 : Number(process.env.COLD_RUNS);
const LIMIT_MS = 5;        // warm, well under Cloudflare's 10 ms
const COLD_LIMIT_MS = 6;   // first call on a fresh Worker (noisier, and JIT not warm yet)
const ROOT = path.join(__dirname, '..');
const started = Date.now();

const CREDS = { mode: 'production', username: 'cpu', password: 'cpu-pass' };
const SENDER = { name: 'Иван', phone: '0878916695', officeCode: '1111' };
const DEFAULTS = { shipmentType: 'pack', packCount: 1, weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: true, currency: 'EUR' } };
const OVERRIDES = { recipientName: 'Мария Петрова', phone: '0888123456', officeCode: '2222', cod: { enabled: true, amount: 45, currency: 'EUR' }, payAfterAccept: true, reviewMode: 'review' };
const nums = (n) => Array.from({ length: n }, (_, i) => String(1051602900000 + i));

const ROUTES = [
  { name: 'ping', path: '/api/ping', body: {}, cold: true },
  { name: 'test (login check)', path: '/api/test', body: { creds: CREDS }, cold: true },
  { name: 'payouts', path: '/api/payouts', body: { creds: CREDS } },
  { name: 'preview (price)', path: '/api/preview', body: { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVERRIDES } },
  { name: 'create', path: '/api/create', body: { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVERRIDES }, cold: true },
  { name: 'track, 1 parcel', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(1) }, minBytes: 1000 },
  { name: 'track, 10 parcels (small replies)', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(10) }, minBytes: 10000 },
  { name: 'track, 10 parcels, Econt-sized', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(10) }, heavy: true, cold: true, minBytes: 140000 },
  { name: 'track, 40 parcels, Econt-sized', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(40) }, heavy: true, info: true, cold: true, minBytes: 560000 },
  { name: 'offices list, 35 offices (64 KB)', path: '/api/offices/list', body: { creds: CREDS }, cold: true },
  { name: 'offices list, 1000 offices (4 MB)', path: '/api/offices/list', body: { creds: CREDS }, big: true, info: 'pump' },
];

async function control(obj) {
  await fetch(MOCK + '/__control', { method: 'POST', body: JSON.stringify(obj) });
}

// ---------- workerd process CPU ----------
function descendants(pid) {
  const out = [];
  const kids = (p) => { try { return fs.readFileSync(`/proc/${p}/task/${p}/children`, 'utf8').trim().split(/\s+/).filter(Boolean).map(Number); } catch { return []; } };
  const walk = (p) => { for (const k of kids(p)) { out.push(k); walk(k); } };
  walk(pid);
  return out;
}
const cmdline = (p) => { try { return fs.readFileSync(`/proc/${p}/cmdline`, 'utf8'); } catch { return ''; } };
// wrangler dev runs two workerd processes: its dev proxy, and the one that runs the
// Worker (and the asset router), started with an inspector. Only the latter counts.
function workerdPids(root) {
  const all = descendants(root || WPID).filter((p) => /workerd/.test(cmdline(p)));
  const user = all.filter((p) => /inspector-addr/.test(cmdline(p)));
  return user.length ? user : all;
}
// mainOnly: just the main thread, where workerd runs the Worker's JavaScript (not
// V8's background compiler and GC threads, which right after a start are busy with
// work that is no request's).
function cpuNs(pids, mainOnly) {
  let total = 0;
  for (const p of pids) {
    let tasks = [];
    try { tasks = mainOnly ? [String(p)] : fs.readdirSync(`/proc/${p}/task`); } catch { continue; }
    for (const t of tasks) {
      try { total += Number(fs.readFileSync(`/proc/${p}/task/${t}/schedstat`, 'utf8').split(' ')[0]); } catch {}
    }
  }
  return total;
}

// Plain http with Accept-Encoding: identity. Locally, workerd gzips a reply itself
// when the client takes gzip; on Cloudflare that happens at the edge, outside the
// Worker, so it must not be counted here.
const http = require('http');
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
// (every body carries client: 2, as the app's do)
function hit(base, r) {
  const u = new URL(base + r.path);
  const payload = JSON.stringify(Object.assign({ client: 2 }, r.body));
  return new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', agent,
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'identity', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      let bytes = 0;
      res.on('data', (c) => { bytes += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, bytes }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function measureWorkerd(r, n) {
  const pids = workerdPids(WPID);
  if (!pids.length) throw new Error('no workerd process under pid ' + WPID);
  for (let i = 0; i < 10; i++) await hit(APP, r);   // warm up (JIT, connection pool)
  const samples = [];
  let bytes = 0;
  // Several rounds: the median round is reported, so a stray background tick
  // (the dev server's own timers) does not decide the figure.
  for (let round = 0; round < 5; round++) {
    const c0 = cpuNs(pids);
    for (let i = 0; i < n; i++) bytes = (await hit(APP, r)).bytes;
    samples.push((cpuNs(pids) - c0) / n / 1e6);
  }
  samples.sort((a, b) => a - b);
  return { ms: samples[2], min: samples[0], max: samples[4], bytes };
}

// ---------- a Worker that has just started ----------
const { spawn } = require('child_process');
const net = require('net');
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const freePort = () => new Promise((res) => { const sv = net.createServer(); sv.listen(0, '127.0.0.1', () => { const p = sv.address().port; sv.close(() => res(p)); }); });
const STARTED = new Set();   // wrangler processes started here: stopped on the way out
function stopTree(pid) {
  const all = [pid, ...descendants(pid)];
  for (const p of all.slice().reverse()) { try { process.kill(p, 'SIGTERM'); } catch {} }
  setTimeout(() => { for (const p of all) { try { process.kill(p, 'SIGKILL'); } catch {} } }, 400).unref();
  STARTED.delete(pid);
}
process.on('exit', () => { for (const p of [...STARTED]) stopTree(p); });
function getStatus(base, p) {
  return new Promise((res) => { const q = http.get(base + p, (r) => { r.resume(); r.on('end', () => res(r.statusCode)); }); q.on('error', () => res(0)); });
}
// One fresh wrangler dev; resolves with the CPU (ms) of the Worker's process for one call.
async function coldOnce(r) {
  const port = await freePort(), insp = await freePort();
  const w = spawn(path.join(ROOT, 'node_modules/.bin/wrangler'), ['dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(insp),
    '--var', 'ECONT_BASE_PRODUCTION:' + MOCK + '/prod', '--var', 'ECONT_BASE_DEMO:' + MOCK + '/demo/ee', '--show-interactive-dev-session=false'],
  { cwd: ROOT, env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false' }), stdio: 'ignore' });
  STARTED.add(w.pid);
  try {
    const base = 'http://127.0.0.1:' + port;
    // Up = a static file answers. Static files are served by the asset router, so
    // the Worker's own code has not run yet.
    let up = false;
    for (let i = 0; i < 240 && !up; i++) { up = (await getStatus(base, '/manifest.webmanifest')) === 200; if (!up) await sleep(250); }
    if (!up) throw new Error('fresh wrangler dev did not start');
    await sleep(1500);   // let start-up work settle
    const pids = workerdPids(w.pid);
    const c0 = cpuNs(pids, true);
    const res = await hit(base, r);
    await sleep(60);
    return { ms: (cpuNs(pids, true) - c0) / 1e6, status: res.status, bytes: res.bytes };
  } finally { stopTree(w.pid); }
}
async function measureCold(r) {
  const runs = [];
  // One at a time, so the starts do not compete for the machine.
  for (let i = 0; i < COLD_RUNS; i++) runs.push(await coldOnce(r));
  const ms = runs.map((x) => x.ms).sort((a, b) => a - b);
  return { ms: ms[Math.floor(ms.length / 2)], all: ms, ok: runs.every((x) => x.status === 200), bytes: runs[0] && runs[0].bytes };
}

// ---------- the same handler in Node ----------
async function measureNode(r, n) {
  const relay = require(path.join(__dirname, '..', 'relay.js'));
  const cfg = relay.configFromEnv({ ECONT_BASE_PRODUCTION: MOCK + '/prod', ECONT_BASE_DEMO: MOCK + '/demo/ee' });
  const call = async () => {
    const res = await relay.handle(new Request('http://localhost' + r.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ client: 2 }, r.body)) }), cfg);
    return (await res.arrayBuffer()).byteLength;
  };
  for (let i = 0; i < 10; i++) await call();
  const samples = [];
  for (let round = 0; round < 5; round++) {
    const c0 = process.cpuUsage();
    for (let i = 0; i < n; i++) await call();
    const d = process.cpuUsage(c0);
    samples.push((d.user + d.system) / n / 1000);
  }
  samples.sort((a, b) => a - b);
  return { ms: samples[2] };
}

(async () => {
  const rows = [];
  let worst = 0;
  const haveWorkerd = WPID > 0;
  for (const r of ROUTES) {
    await control({ bigOffices: !!r.big, heavyTracking: !!r.heavy, clearFaults: true });
    const n = r.big ? 10 : /track, 100/.test(r.name) ? 20 : 40;
    const w = haveWorkerd ? await measureWorkerd(r, n) : null;
    const nd = await measureNode(r, n);
    rows.push({ r, w, nd });
  }
  await control({ bigOffices: false, heavyTracking: false });
  const base = rows[0].w ? rows[0].w.ms : 0;
  const lines = [];
  lines.push('CPU per request (median of 5 rounds)' + (haveWorkerd ? '' : ', Node only'));
  lines.push(['route'.padEnd(36), haveWorkerd ? 'workerd total'.padStart(14) : '', haveWorkerd ? 'route - ping'.padStart(13) : '', 'Node handler'.padStart(13), 'reply bytes'.padStart(12)].join(' '));
  for (const { r, w, nd } of rows) {
    const own = w ? Math.max(0, w.ms - base) : null;
    if (r.name !== 'ping' && own != null && !r.info) worst = Math.max(worst, own);
    lines.push([(r.name + (r.info === 'pump' ? ' **' : r.info ? ' *' : '')).padEnd(36), w ? (w.ms.toFixed(2) + ' ms').padStart(14) : '', w ? (r.name === 'ping' ? 'baseline' : own.toFixed(2) + ' ms').padStart(13) : '',
      (nd.ms.toFixed(2) + ' ms').padStart(13), String(w ? w.bytes : '').padStart(12)].join(' '));
  }
  lines.push('*  for comparison only: the app asks for at most 10 parcels per call.');
  lines.push('** the Worker\'s own work is the same as for the 64 KB list (it hands Econt\'s body over');
  lines.push('   unread); the rest is the runtime pumping 4 MB through local sockets and wrangler\'s dev');
  lines.push('   proxy. On Cloudflare a body passed through unread is streamed natively after the Worker');
  lines.push('   returns (deferred proxying) and does not count as Worker CPU time.');
  // Fresh Workers.
  let coldWorst = 0, coldOk = true;
  if (haveWorkerd && COLD_RUNS > 0) {
    const cold = [];
    for (const r of ROUTES.filter((x) => x.cold)) {
      await control({ heavyTracking: !!r.heavy, clearFaults: true });
      cold.push({ r, c: await measureCold(r) });
    }
    await control({ heavyTracking: false });
    const cbase = cold[0].c.ms;
    lines.push('');
    lines.push('CPU of the first call on a Worker that has just started (main thread, median of ' + COLD_RUNS + ' fresh wrangler dev instances)');
    lines.push(['route'.padEnd(36), 'main thread'.padStart(14), 'route - ping'.padStart(13), 'all runs'.padStart(24)].join(' '));
    for (const { r, c } of cold) {
      const own = Math.max(0, c.ms - cbase);
      if (r.name !== 'ping' && !r.info) coldWorst = Math.max(coldWorst, own);
      coldOk = coldOk && c.ok && (!r.minBytes || c.bytes >= r.minBytes);
      lines.push([(r.name + (r.info ? ' *' : '')).padEnd(36), (c.ms.toFixed(2) + ' ms').padStart(14), (r.name === 'ping' ? 'baseline' : own.toFixed(2) + ' ms').padStart(13),
        c.all.map((x) => x.toFixed(1)).join(' / ').padStart(24)].join(' '));
    }
    lines.push('*  for comparison only: 40 parcels per call was the old setting.');
  }
  console.log(lines.join('\n'));
  // The replies must be the real ones (not an error or a "reload" answer).
  const short = rows.filter(({ r, w }) => w && r.minBytes && w.bytes < r.minBytes).map(({ r, w }) => r.name + ': ' + w.bytes + ' bytes');
  if (short.length) console.log('FAIL replies smaller than expected :: ' + short.join(', '));
  const okWarm = (!haveWorkerd || worst < LIMIT_MS) && !short.length;
  const okCold = !haveWorkerd || COLD_RUNS <= 0 || (coldOk && coldWorst < COLD_LIMIT_MS);
  console.log((okWarm ? 'PASS' : 'FAIL') + ' every relay route under ' + LIMIT_MS + ' ms CPU on workerd (warm) :: worst ' + worst.toFixed(2) + ' ms');
  if (haveWorkerd && COLD_RUNS > 0) console.log((okCold ? 'PASS' : 'FAIL') + ' every relay route under ' + COLD_LIMIT_MS + ' ms CPU on a fresh Worker :: worst ' + coldWorst.toFixed(2) + ' ms');
  const pass = (okWarm ? 1 : 0) + (haveWorkerd && COLD_RUNS > 0 ? (okCold ? 1 : 0) : 0), fail = (okWarm ? 0 : 1) + (okCold ? 0 : 1);
  console.log('RESULT suite=cpu runtime=' + (haveWorkerd ? 'workerd' : 'node') + ' pass=' + pass + ' fail=' + fail + ' secs=' + Math.round((Date.now() - started) / 1000));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
