// Mock Econt + fault injection for e2e tests. FAULT file controls behaviour.
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = require('path').resolve(__dirname, '../../..');
const econt = require(ROOT + '/econt.js');
const STATE = { creates: 0, previews: 0, parses: 0, tracks: 0, nextNum: 1000000000001 };
econt.getClientProfiles = async () => ({ profiles: [] });
econt.getOffices = async () => ({ offices: [
  { code: '1111', name: 'София Павлово', address: { city: { name: 'София', postCode: '1000' }, fullAddress: 'ул. Мадара 1' } },
  { code: '2222', name: 'Пловдив Център', address: { city: { name: 'Пловдив', postCode: '4000' }, fullAddress: 'бул. Цар Борис 2' } },
  { code: '3333', name: 'Варна Чайка', address: { city: { name: 'Варна', postCode: '9000' }, fullAddress: 'ул. Чайка 3' } },
] });
econt.createLabel = async (creds, label, mode) => {
  if (mode === 'create') { STATE.creates++; return { label: { shipmentNumber: String(STATE.nextNum++), totalPrice: 6.4, totalPriceCurrency: 'EUR', pdfURL: 'https://example.com/l.pdf' } }; }
  STATE.previews++; return { label: { totalPrice: 6.4, totalPriceCurrency: 'EUR' } };
};
econt.getShipmentStatuses = async (creds, nums) => { STATE.tracks++; return { shipmentStatuses: nums.map((n, i) => ({ status: {
  shipmentNumber: n, shortDeliveryStatus: i % 3 === 0 ? 'Доставена' : i % 3 === 1 ? 'В движение' : 'Върната', shortDeliveryStatusEn: i % 3 === 0 ? 'Delivered' : i % 3 === 1 ? 'In transit' : 'Returned',
  sendTime: Date.now() - 3600e3 * 20, deliveryTime: i % 3 === 0 ? Date.now() - 3600e3 : null, expectedDeliveryDate: Date.now() + 86400e3,
  cdCollectedAmount: i % 3 === 0 ? 45 : 0, cdCollectedCurrency: 'EUR',
  trackingEvents: [{ time: '2026-10-07 10:00:00', officeName: 'София', destinationDescription: 'Приета' }, { time: '2026-10-07 18:00:00', officeName: 'Пловдив', destinationDescription: 'Пристигна' }],
} })) }; };
// Fault injection: wrap the http handler.
const orig = http.createServer;
http.createServer = (handler) => orig((req, res) => {
  let f = {}; try { f = JSON.parse(fs.readFileSync(path.join(__dirname, 'fault.json'), 'utf8')); } catch {}
  const rule = f[req.url];
  if (rule && rule.n > 0) { rule.n--; fs.writeFileSync(path.join(__dirname, 'fault.json'), JSON.stringify(f)); res.writeHead(502, { 'Content-Type': 'text/html' }); return res.end('<html>502 waking</html>'); }
  if (req.url === '/__state') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(STATE)); }
  if (req.url === '/api/parse') STATE.parses++;
  return handler(req, res);
});
process.env.PORT = process.env.PORT || '5099';
require(ROOT + '/server.js');
