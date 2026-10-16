'use strict';

// A real HTTP mock of the Econt (e-Econt) JSON API endpoints the app uses, for the
// end-to-end and relay tests on both runtimes (Node server and wrangler dev).
//
// Point the app at it with
//   ECONT_BASE_PRODUCTION=http://127.0.0.1:<port>/prod
//   ECONT_BASE_DEMO=http://127.0.0.1:<port>/demo/ee
// (the app appends /services/...). The first path segment tells the two hosts
// apart, so each mode has its own office list and counters.
//
// Control endpoints (JSON):
//   GET  /__state     counters (creates, previews, tracks, profiles, offices per mode)
//                     and every created label ({ number, phone, officeCode, label, mode })
//   POST /__control   { faults: { <op>: { mode, n, ms } }, bigOffices, extraOffices, reset }
//                     ops: profile | offices | calculate | create | track | any
//                     modes: 502 (gateway page, nothing done), 502after (done, then a
//                     502 page), lost (done, socket destroyed, no reply), cut (done,
//                     half a body then the socket is cut), down (socket destroyed,
//                     nothing done), slow (wait ms, then normal), auth (wrong login)
//                     n = how many requests the fault applies to (default 1).
//                     Shorthands: { lostReply: n }, { slowCreate: ms }.
//   POST /__reset     counters, labels and faults back to the start
//
// Run alone: node tests/mock-econt.js [port]   (default 5301)

const http = require('http');
const zlib = require('zlib');
const { productionOffices, demoOffices, bigOffices } = require('./fixtures/offices');

const BAD_PASSWORD = 'wrong';
const PDF_BASE = 'https://ee.econt.com/services/ws/pdf/';

function freshState() {
  return {
    creates: 0, previews: 0, validates: 0, tracks: 0, profiles: 0,
    offices: { production: 0, demo: 0 },
    createdLabels: [], lastLabel: null, lastTrack: null,
    officesAcceptEncoding: null, // what the last getOffices request accepted (the relay asks for identity)
    nextNum: 1051602900001,
  };
}
let STATE = freshState();
let FAULTS = {};
let BIG = false;
let EXTRA = []; // extra raw offices appended to the production list (e.g. "a new office opened")

const LISTS = { production: productionOffices(), demo: demoOffices() };
let BIG_LIST = null;
function officeList(mode) {
  if (mode === 'production' && BIG) return BIG_LIST || (BIG_LIST = bigOffices(1000));
  return EXTRA.length && mode === 'production' ? LISTS.production.concat(EXTRA) : LISTS[mode];
}
const officeByCode = (mode, code) => officeList(mode).find((o) => String(o.code) === String(code)) || null;

function takeFault(op) {
  for (const key of [op, 'any']) {
    const f = FAULTS[key];
    if (f && (f.n == null || f.n > 0)) {
      if (f.n != null) f.n--;
      return f;
    }
  }
  return null;
}

function send(res, status, obj, type) {
  const body = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}
const GATEWAY_PAGE = '<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Econt's way of saying a login is wrong: often not a 401, but a 500 whose message
// names the username/password (the app must recognise both).
function authFailure(res) {
  send(res, 500, { type: 'ExAccessDenied', message: 'Невалидно потребителско име и/или парола', fields: [], innerErrors: [] });
}
function checkAuth(req) {
  const h = req.headers.authorization || '';
  const m = /^Basic\s+(.+)$/.exec(h);
  if (!m) return false;
  const [user, ...rest] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
  const pass = rest.join(':');
  return !!user && !!pass && pass !== BAD_PASSWORD;
}
function econtError(res, status, message) {
  // Econt nests the real message under blank parents.
  send(res, status, { type: 'ExInvalidParam', message: '', fields: [], innerErrors: [{ type: 'ExInvalidParam', message: '', fields: [], innerErrors: [{ type: 'ExInvalidParam', message, fields: [], innerErrors: [] }] }] });
}

// ---------- endpoint logic ----------
function profiles() {
  return {
    profiles: [{
      client: { id: 7750001, clientNumber: '7750001', name: 'ЕТ Иван Иванов', nameEn: 'ET Ivan Ivanov', phones: ['0878916695'], email: 'shop@example.com', juridicalEntity: true },
      addresses: [],
      cdPayOptions: [
        { num: 'CD12345', client: null, moneyTransferReqPersonalData: false, method: 'bank', address: null, officeCode: null, IBAN: 'BG80BNBG96611020345678', BIC: 'BNBGBGSD', bankCurrency: 'EUR', payDays: [1, 15], payWeekdays: [], additionalInstructions: '', express: false },
        { num: 'CD54321', client: null, moneyTransferReqPersonalData: false, method: 'office', address: null, officeCode: '1111', IBAN: null, BIC: null, bankCurrency: null, payDays: [], payWeekdays: ['friday'], additionalInstructions: '', express: true },
        { num: 'CD12345', method: 'bank', IBAN: 'BG80BNBG96611020345678', BIC: 'BNBGBGSD', bankCurrency: 'EUR' }, // duplicate on purpose
      ],
    }],
  };
}

function labelReply(mode, label, number) {
  const office = label.receiverOfficeCode ? officeByCode(mode, label.receiverOfficeCode) : null;
  const door = !label.receiverOfficeCode;
  const price = door ? 7.9 : 6.4;
  const status = {
    shipmentNumber: number || undefined,
    storageOfficeName: null, storagePersonName: null,
    createdTime: Date.now(), sendTime: null, deliveryTime: null,
    shipmentType: label.shipmentType || 'pack', packCount: label.packCount || 1,
    weight: label.weight, shipmentDescription: label.shipmentDescription || '',
    senderDeliveryType: label.senderOfficeCode ? 'office' : 'door',
    senderClient: Object.assign({ id: null }, label.senderClient || {}),
    senderOfficeCode: label.senderOfficeCode || null,
    receiverDeliveryType: door ? 'door' : 'office',
    receiverClient: Object.assign({ id: null }, label.receiverClient || {}),
    receiverAddress: label.receiverAddress || (office ? office.address : null),
    receiverOfficeCode: label.receiverOfficeCode || null,
    cdAmount: label.services && label.services.cdAmount || 0,
    cdCurrency: label.services && label.services.cdCurrency || null,
    totalPrice: price,
    currency: 'EUR', // Econt's real field name for the price currency
    discountPercent: 0,
    services: [{ type: 'delivery', description: 'Доставка', count: 1, paymentSide: 'receiver', price, currency: 'EUR' }],
    pdfURL: number ? PDF_BASE + number + '.pdf' : undefined,
    expectedDeliveryDate: Date.now() + 86400000,
  };
  const reply = { label: status, blockingPaymentURL: null, courierRequestID: null };
  // Parcel lockers take no преглед/тест: Econt drops it and says so.
  if (office && office.isAPS && (label.payAfterAccept || label.payAfterTest)) {
    if (label.payAfterAccept) reply.payAfterAcceptIgnored = 'Услугата преглед не се предлага при доставка до Еконтомат.';
    if (label.payAfterTest) reply.payAfterTestIgnored = 'Услугата тест не се предлага при доставка до Еконтомат.';
  }
  return reply;
}
// The checks Econt itself makes; a failure is an HTTP 400 with a nested message.
function validateLabel(mode, label) {
  if (!label || typeof label !== 'object') return 'Липсва товарителница';
  const rc = label.receiverClient || {};
  if (!rc.name) return 'Липсва име на получателя';
  if (!rc.phones || !rc.phones[0]) return 'Липсва телефон на получателя';
  if (label.receiverOfficeCode) {
    const o = officeByCode(mode, label.receiverOfficeCode);
    if (!o || o.hubCode) return 'Невалиден обслужващ офис';
  } else if (!(label.receiverAddress && label.receiverAddress.city && label.receiverAddress.city.name)) {
    return 'Липсва адрес на получателя';
  }
  if ((label.shipmentType || 'pack') === 'pack' && !String(label.shipmentDescription || '').trim()) return 'Липсва описание на пратката';
  return null;
}

// A ShipmentStatus as getShipmentStatuses returns it: Econt's real field names,
// times in epoch milliseconds, and the tracking events with destinationType etc.
function shipmentStatus(num, i) {
  const now = Date.now(), H = 3600e3;
  const kind = i % 3; // 0 delivered, 1 in transit, 2 returned
  const sendTime = now - 20 * H;
  const ev = (type, offH, extra) => Object.assign({
    destinationType: type, destinationDetails: '', destinationDetailsEn: '',
    officeName: '', officeNameEn: '', cityName: '', cityNameEn: '', countryCode: 'BGR', officeCode: '', isReceipt: false, time: sendTime + offH * H,
  }, extra || {});
  const events = [
    ev('office', 0, { destinationDetails: 'Приета в офис София Павлово', destinationDetailsEn: 'Accepted at Sofia Pavlovo', officeName: 'София Павлово', officeNameEn: 'Sofia Pavlovo', cityName: 'София', cityNameEn: 'Sofia', officeCode: '1111' }),
    ev('arrival_departure_from_hub', 4, { cityName: 'Пловдив', cityNameEn: 'Plovdiv' }),
  ];
  if (kind === 0) {
    events.push(ev('in_delivery_office', 12, { officeName: 'Пловдив Център', officeNameEn: 'Plovdiv Center', officeCode: '2222' }));
    events.push(ev('client', 19, { destinationDetails: 'Пловдив Център', officeName: 'Пловдив Център', officeNameEn: 'Plovdiv Center', isReceipt: true }));
  } else if (kind === 1) {
    events.push(ev('courier_direction', 8, {}));
  } else {
    events.push(ev('in_delivery_office', 12, { officeName: 'Варна Чайка', officeNameEn: 'Varna Chayka', officeCode: '3333' }));
    events.push(ev('return', 18, { destinationDetails: 'Отказана от получателя', destinationDetailsEn: 'Refused by the recipient' }));
  }
  return {
    shipmentNumber: num,
    storageOfficeName: kind === 2 ? 'Варна Чайка' : null,
    storagePersonName: null,
    createdTime: sendTime - 2 * H,
    sendTime,
    deliveryTime: kind === 0 ? now - H : kind === 2 ? now - 2 * H : null,
    shipmentType: 'pack', packCount: 1, weight: 1, shipmentDescription: 'лични вещи',
    senderDeliveryType: 'office',
    senderClient: { id: 7750001, name: 'Иван', nameEn: 'Ivan', phones: ['0878916695'], email: null },
    senderAgent: null, senderOfficeCode: '1111', senderAddress: null,
    receiverDeliveryType: 'office',
    receiverClient: { id: null, name: 'Мария Петрова', nameEn: 'Maria Petrova', phones: ['0888123456'], email: null },
    receiverAgent: null, receiverOfficeCode: kind === 2 ? '3333' : '2222', receiverAddress: null,
    cdCollectedAmount: kind === 0 ? 45 : 0, cdCollectedCurrency: 'EUR', cdCollectedTime: kind === 0 ? now - H : null,
    cdPaidAmount: 0, cdPaidCurrency: null, cdPaidTime: null,
    totalPrice: 6.4, currency: 'EUR', discountPercent: 0, discountAmount: 0, discountDescription: '',
    senderDueAmount: 0, receiverDueAmount: 6.4, otherDueAmount: 0,
    deliveryAttemptCount: kind === 1 ? 0 : 1,
    previousShipmentNumber: null, previousShipmentReceiverPhone: null,
    shortDeliveryStatus: kind === 0 ? 'Доставена' : kind === 1 ? 'В движение' : 'Върната',
    shortDeliveryStatusEn: kind === 0 ? 'Delivered' : kind === 1 ? 'In transit' : 'Returned',
    expectedDeliveryDate: now + 86400e3,
    returnShipmentURL: null, rejectOriginalParcelPaySide: null, rejectReturnParcelPaySide: null,
    shipmentEdition: null,
    services: [{ type: 'delivery', description: 'Доставка', count: 1, paymentSide: 'receiver', price: 6.4, currency: 'EUR' },
      { type: 'cd', description: 'Наложен платеж', count: 1, paymentSide: 'receiver', price: 0.9, currency: 'EUR' }],
    pdfURL: PDF_BASE + num + '.pdf',
    routingCode: 'SOF-PDV-' + String(num).slice(-3),
    trackingEvents: events,
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
}

// Apply a fault around `work` (which does the real thing and returns { status, obj }).
async function withFault(req, res, op, work) {
  const f = takeFault(op);
  const mode = f && f.mode;
  if (mode === 'down') { req.socket.destroy(); return; }
  if (mode === '502') return send(res, 502, GATEWAY_PAGE, 'text/html');
  if (mode === 'auth') return authFailure(res);
  if (mode === 'slow') await sleep(f.ms || 600);
  const out = await work();
  if (!out) return;
  if (mode === '502after') return send(res, 502, GATEWAY_PAGE, 'text/html');
  if (mode === 'lost') { req.socket.destroy(); return; }
  if (mode === 'cut') {
    const body = Buffer.from(JSON.stringify(out.obj), 'utf8');
    res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
    res.write(body.subarray(0, Math.max(1, Math.floor(body.length / 2))));
    setTimeout(() => req.socket.destroy(), 30);
    return;
  }
  if (out.gzip) {
    // Like a real host: compress a big reply when the client accepts gzip.
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(out.obj), 'utf8'));
    res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Content-Length': body.length });
    return res.end(body);
  }
  send(res, out.status, out.obj);
}

async function handleEcont(req, res, mode, service) {
  const body = await readBody(req);
  if (body === null) return econtError(res, 400, 'Невалиден JSON');
  const authOk = checkAuth(req);

  if (service === 'Profile/ProfileService.getClientProfiles.json') {
    return withFault(req, res, 'profile', async () => {
      STATE.profiles++;
      if (!authOk) { authFailure(res); return null; }
      return { status: 200, obj: profiles() };
    });
  }
  if (service === 'Nomenclatures/NomenclaturesService.getOffices.json') {
    return withFault(req, res, 'offices', async () => {
      STATE.offices[mode]++;
      STATE.officesAcceptEncoding = req.headers['accept-encoding'] || null;
      if (!authOk) { authFailure(res); return null; }
      if (body.showLC !== false || body.showCargoReceptions !== false) { econtError(res, 400, 'Очакват се showLC и showCargoReceptions = false'); return null; }
      return { status: 200, obj: { offices: officeList(mode) }, gzip: /\bgzip\b/.test(req.headers['accept-encoding'] || '') };
    });
  }
  if (service === 'Shipments/LabelService.createLabel.json') {
    const op = body.mode === 'create' ? 'create' : 'calculate';
    return withFault(req, res, op, async () => {
      if (!authOk) { authFailure(res); return null; }
      const label = body.label;
      STATE.lastLabel = { mode, op: body.mode, label };
      const bad = validateLabel(mode, label);
      if (bad) { econtError(res, 400, bad); return null; }
      if (body.mode === 'create') {
        const number = String(STATE.nextNum++);
        STATE.creates++;
        STATE.createdLabels.push({ number, phone: label.receiverClient.phones[0], name: label.receiverClient.name, officeCode: label.receiverOfficeCode || null, mode, label, at: Date.now() });
        return { status: 200, obj: labelReply(mode, label, number) };
      }
      if (body.mode === 'validate') { STATE.validates++; return { status: 200, obj: labelReply(mode, label, null) }; }
      STATE.previews++;
      return { status: 200, obj: labelReply(mode, label, null) };
    });
  }
  if (service === 'Shipments/ShipmentService.getShipmentStatuses.json') {
    return withFault(req, res, 'track', async () => {
      STATE.tracks++;
      if (!authOk) { authFailure(res); return null; }
      const nums = Array.isArray(body.shipmentNumbers) ? body.shipmentNumbers.map(String) : [];
      STATE.lastTrack = nums;
      return {
        status: 200,
        obj: {
          shipmentStatuses: nums.map((n, i) => (/^9999/.test(n)
            ? { status: null, error: { type: 'ExInvalidParam', message: '', innerErrors: [{ message: 'Пратка ' + n + ' не е намерена' }] } }
            : { status: shipmentStatus(n, i), error: null })),
        },
      };
    });
  }
  return send(res, 404, { type: 'ExNotFound', message: 'Unknown service ' + service });
}

function applyControl(c) {
  if (!c || typeof c !== 'object') return;
  if (c.reset) { STATE = freshState(); FAULTS = {}; BIG = false; EXTRA = []; }
  if (c.faults && typeof c.faults === 'object') {
    for (const [op, f] of Object.entries(c.faults)) {
      if (f == null) delete FAULTS[op];
      else FAULTS[op] = Object.assign({ n: 1 }, f);
    }
  }
  if (c.clearFaults) FAULTS = {};
  if (c.lostReply) FAULTS.create = { mode: 'lost', n: c.lostReply };
  if (c.slowCreate) FAULTS.create = { mode: 'slow', ms: c.slowCreate, n: null };
  if (c.bigOffices != null) BIG = !!c.bigOffices;
  if (Array.isArray(c.extraOffices)) EXTRA = c.extraOffices;
}

function handler(req, res) {
  const url = new URL(req.url, 'http://mock');
  if (url.pathname === '/__state') return send(res, 200, Object.assign({}, STATE, { faults: FAULTS, big: BIG }));
  if (url.pathname === '/__control' || url.pathname === '/__reset') {
    return readBody(req).then((c) => {
      applyControl(url.pathname === '/__reset' ? { reset: true } : c);
      send(res, 200, { ok: true, faults: FAULTS });
    });
  }
  const m = /^\/(prod|demo)(?:\/ee)?\/services\/(.+)$/.exec(url.pathname);
  if (!m || req.method !== 'POST') return send(res, 404, { type: 'ExNotFound', message: 'Not found: ' + url.pathname });
  return handleEcont(req, res, m[1] === 'prod' ? 'production' : 'demo', m[2]).catch((e) => {
    try { send(res, 500, { type: 'ExMock', message: String(e && e.stack || e) }); } catch {}
  });
}

function start(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(port || 0, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({ server, port: p, url: 'http://127.0.0.1:' + p });
    });
  });
}

module.exports = { start, applyControl, shipmentStatus, labelReply, BAD_PASSWORD };

if (require.main === module) {
  const port = Number(process.argv[2] || process.env.MOCK_PORT || 5301);
  start(port).then(({ url }) => console.log('mock-econt listening on ' + url));
}
