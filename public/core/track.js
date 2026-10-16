// Econt's tracking reply, turned into the parcel cards' data. Shared by the
// browser and Node.
//
// The relay passes Econt's getShipmentStatuses reply through unread (as it does
// the office list): a real Econt status is about 15 KB per parcel, and parsing a
// batch of them took a Worker that had just started over the CPU a free Cloudflare
// request may use. So the reading happens here, in the browser, and gives exactly
// what the relay's /api/track used to answer: { ok: true, parcels: [...] }.
//
// Browser: a plain <script>, sets window.EcontTrack. Node: require() it (relay.js
// uses flattenEcontError from here for its error messages).
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.EcontTrack = api;
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

// What Econt's ShipmentTrackingEvent.destinationType means, for events that
// carry no destinationDetails text.
const EVENT_TYPE_TEXT = {
  client: ['Доставена на получателя', 'Delivered to the recipient'],
  courier: ['При куриер', 'With a courier'],
  courier_direction: ['Пътува към направлението', 'On the way'],
  office: ['В офис', 'At an office'],
  first_try: ['Първи опит за доставка', 'First delivery attempt'],
  second_try: ['Втори опит за доставка', 'Second delivery attempt'],
  instruction: ['Изпълнено указание', 'Instruction carried out'],
  redirect: ['Пренасочена', 'Redirected'],
  return: ['Връща се към подателя', 'Being returned to the sender'],
  destroy: ['Унищожена', 'Destroyed'],
  failed_delivery: ['Неуспешна доставка', 'Delivery failed'],
  in_pickup_courier: ['Взета от куриер', 'Picked up by a courier'],
  in_pickup_office: ['Приета в офис', 'Accepted at an office'],
  in_delivery_courier: ['При куриер за доставка', 'Out for delivery'],
  in_delivery_office: ['Пристигнала в офиса за получаване', 'Ready for pick-up at the office'],
  arrival_departure_from_hub: ['Преминава през логистичен център', 'Passing through a hub'],
  is_returning_to_sender: ['Връща се към подателя', 'Being returned to the sender'],
  returned_to_sender: ['Върната на подателя', 'Returned to the sender'],
};

// Econt nests its real validation message inside innerErrors with blank parents.
// Walk the tree and collect every non-empty message.
function flattenEcontError(node, acc) {
  if (!node) return acc;
  const arr = Array.isArray(node) ? node : [node];
  for (const n of arr) {
    if (n && typeof n.message === 'string' && n.message.trim()) acc.push(n.message.trim());
    if (n && n.innerErrors) flattenEcontError(n.innerErrors, acc);
    if (n && n.errors) flattenEcontError(n.errors, acc);
  }
  return acc;
}

// Econt's tracking event: { isReceipt, destinationType, destinationDetails,
// destinationDetailsEn, officeName, officeNameEn, cityName, cityNameEn,
// countryCode, officeCode, time }. Keeps the { time, office, text } shape the
// client renders, and adds the raw type so returns/failed deliveries can be told apart.
function mapTrackingEvent(ev, lang) {
  ev = ev || {};
  const en = lang === 'en';
  const pick = (bg, eng) => (en ? (eng || bg) : (bg || eng)) || '';
  const office = pick(ev.officeName, ev.officeNameEn) || pick(ev.cityName, ev.cityNameEn) || null;
  const type = ev.destinationType || null;
  const typeText = type ? (EVENT_TYPE_TEXT[type] ? EVENT_TYPE_TEXT[type][en ? 1 : 0] : String(type).replace(/_/g, ' ')) : '';
  let text = pick(ev.destinationDetails, ev.destinationDetailsEn)
    || pick(ev.destinationDescription, ev.destinationDescriptionEn) || ev.description || typeText;
  if (office && text && String(text).trim() === String(office).trim()) text = typeText !== text ? typeText : '';
  return {
    time: ev.time || ev.eventTime || ev.date || null,
    office,
    text: text || '',
    type,
    isReceipt: !!ev.isReceipt,
    officeCode: ev.officeCode || null,
  };
}

// One entry of Econt's shipmentStatuses ({ status, error }) as a parcel card's data.
function mapParcel(e, lang) {
  e = e || {};
  const s = e.status || {};
  const evRaw = s.trackingEvents || [];
  return {
    number: s.shipmentNumber,
    error: e.error ? (flattenEcontError(e.error, []).join(' ') || null) : null,
    sender: (s.senderClient && s.senderClient.name) || null,
    senderOffice: s.senderOfficeCode || null,
    recipient: (s.receiverClient && s.receiverClient.name) || null,
    recipientPhone: (s.receiverClient && s.receiverClient.phones && s.receiverClient.phones[0]) || null,
    office: s.receiverOfficeCode || null,
    receiverAddress: (s.receiverAddress && s.receiverAddress.fullAddress) || null,
    storageOffice: s.storageOfficeName || null,
    type: s.shipmentType, packCount: s.packCount, weight: s.weight, description: s.shipmentDescription,
    status: s.shortDeliveryStatus || s.shortDeliveryStatusEn || null,
    statusEn: s.shortDeliveryStatusEn || null,
    deliveryAttempts: s.deliveryAttemptCount,
    createdTime: s.createdTime, sendTime: s.sendTime, deliveryTime: s.deliveryTime,
    expectedDeliveryDate: s.expectedDeliveryDate,
    cdCollected: s.cdCollectedAmount, cdCurrency: s.cdCollectedCurrency,
    totalPrice: s.totalPrice, currency: s.currency,
    routingCode: s.routingCode || null, returnURL: s.returnShipmentURL || null, pdfURL: s.pdfURL,
    events: evRaw.map((ev) => mapTrackingEvent(ev, lang)),
  };
}

// Econt's whole reply ({ shipmentStatuses: [...] }) as the old /api/track answer.
// The JSON round trip drops what JSON would (undefined fields), as the relay's
// JSON reply did, so the cards get exactly the same data as before.
function trackReply(raw, lang) {
  const list = (raw && Array.isArray(raw.shipmentStatuses)) ? raw.shipmentStatuses : [];
  return JSON.parse(JSON.stringify({ ok: true, parcels: list.map((e) => mapParcel(e, lang)) }));
}

return { EVENT_TYPE_TEXT, flattenEcontError, mapTrackingEvent, mapParcel, trackReply };
}));
