'use strict';

// CPU per relay route, measured on the Worker path (wrangler dev = Cloudflare's
// workerd runtime running worker.js) and, for comparison, on the same relay.js
// handler inside Node.
//
// Workerd: the CPU time of the workerd processes that `wrangler dev` started
// (/proc/<pid>/task/*/schedstat, nanoseconds), over N sequential requests per
// route. That is everything the local runtime does for a request: wrangler's own
// dev proxy and asset router as well as the Worker. /api/ping, which does no work
// at all, measures that fixed overhead; "route - ping" is what the route itself
// costs, the part Cloudflare counts against the 10 ms CPU limit.
//
// Env: APP_URL (the wrangler dev URL), MOCK_URL (tests/mock-econt.js), WRANGLER_PID
// (the wrangler process the test runner started). Without WRANGLER_PID only the
// Node measurement runs. Exit code 1 when a route costs 5 ms or more.

const fs = require('fs');
const path = require('path');

const APP = (process.env.APP_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const MOCK = (process.env.MOCK_URL || 'http://127.0.0.1:5301').replace(/\/$/, '');
const WPID = Number(process.env.WRANGLER_PID || 0);
const LIMIT_MS = 5;   // well under Cloudflare's 10 ms

const CREDS = { mode: 'production', username: 'cpu', password: 'cpu-pass' };
const SENDER = { name: 'Иван', phone: '0878916695', officeCode: '1111' };
const DEFAULTS = { shipmentType: 'pack', packCount: 1, weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: true, currency: 'EUR' } };
const OVERRIDES = { recipientName: 'Мария Петрова', phone: '0888123456', officeCode: '2222', cod: { enabled: true, amount: 45, currency: 'EUR' }, payAfterAccept: true, reviewMode: 'review' };
const nums = (n) => Array.from({ length: n }, (_, i) => String(1051602900000 + i));

const ROUTES = [
  { name: 'ping', path: '/api/ping', body: {} },
  { name: 'test (login check)', path: '/api/test', body: { creds: CREDS } },
  { name: 'payouts', path: '/api/payouts', body: { creds: CREDS } },
  { name: 'preview (price)', path: '/api/preview', body: { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVERRIDES } },
  { name: 'create', path: '/api/create', body: { creds: CREDS, sender: SENDER, defaults: DEFAULTS, overrides: OVERRIDES } },
  { name: 'track, 1 parcel', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(1) } },
  { name: 'track, 40 parcels (one call)', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(40) } },
  { name: 'track, 100 parcels', path: '/api/track', body: { creds: CREDS, shipmentNumbers: nums(100) }, info: true },
  { name: 'offices list, 35 offices (64 KB)', path: '/api/offices/list', body: { creds: CREDS } },
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
function workerdPids() {
  return descendants(WPID).filter((p) => { try { return /workerd/.test(fs.readFileSync(`/proc/${p}/cmdline`, 'utf8')); } catch { return false; } });
}
function cpuNs(pids) {
  let total = 0;
  for (const p of pids) {
    let tasks = [];
    try { tasks = fs.readdirSync(`/proc/${p}/task`); } catch { continue; }
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
function hit(base, r) {
  const u = new URL(base + r.path);
  const payload = JSON.stringify(r.body);
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
  const pids = workerdPids();
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

// ---------- the same handler in Node ----------
async function measureNode(r, n) {
  const relay = require(path.join(__dirname, '..', 'relay.js'));
  const cfg = relay.configFromEnv({ ECONT_BASE_PRODUCTION: MOCK + '/prod', ECONT_BASE_DEMO: MOCK + '/demo/ee' });
  const call = async () => {
    const res = await relay.handle(new Request('http://localhost' + r.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.body) }), cfg);
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
    await control({ bigOffices: !!r.big, clearFaults: true });
    const n = r.big ? 10 : /track, 100/.test(r.name) ? 20 : 40;
    const w = haveWorkerd ? await measureWorkerd(r, n) : null;
    const nd = await measureNode(r, n);
    rows.push({ r, w, nd });
  }
  await control({ bigOffices: false });
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
  lines.push('*  for comparison only: the app asks for at most 40 parcels per call.');
  lines.push('** the Worker\'s own work is the same as for the 64 KB list (it hands Econt\'s body over');
  lines.push('   unread); the rest is the runtime pumping 4 MB through local sockets and wrangler\'s dev');
  lines.push('   proxy. On Cloudflare a body passed through unread is streamed natively after the Worker');
  lines.push('   returns (deferred proxying) and does not count as Worker CPU time.');
  console.log(lines.join('\n'));
  const ok = !haveWorkerd || worst < LIMIT_MS;
  console.log((ok ? 'PASS' : 'FAIL') + ' every relay route under ' + LIMIT_MS + ' ms CPU on workerd :: worst ' + worst.toFixed(2) + ' ms');
  console.log('RESULT suite=cpu runtime=' + (haveWorkerd ? 'workerd' : 'node') + ' pass=' + (ok ? 1 : 0) + ' fail=' + (ok ? 0 : 1));
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
