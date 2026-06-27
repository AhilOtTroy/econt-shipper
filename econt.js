'use strict';

// Stateless client for the Econt Delivery (e-Econt) JSON API + label builder.
// Every call takes a `creds` object { mode, username, password } supplied by the
// caller — nothing is stored here. Auth is HTTP Basic.

function baseUrl(creds) {
  return creds.mode === 'production'
    ? 'https://ee.econt.com/services'
    : 'http://demo.econt.com/ee/services';
}

async function callEcont(creds, path, body) {
  const url = baseUrl(creds) + path;
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Basic ' + auth,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error('Cannot reach Econt (' + url + '): ' + e.message);
    err.kind = 'network';
    throw err;
  }
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error('Econt returned HTTP ' + res.status);
    err.kind = 'http';
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function getOffices(creds, countryCode) {
  // Request the maximal set so nothing is filtered out of the office list.
  return callEcont(creds, '/Nomenclatures/NomenclaturesService.getOffices.json', {
    countryCode: countryCode || 'BGR',
    showCargoReceptions: true,
    showLC: true,
  });
}

// mode: 'validate' | 'calculate' | 'create'
function createLabel(creds, label, mode) {
  return callEcont(creds, '/Shipments/LabelService.createLabel.json', { label, mode });
}

// Live status/tracking for a list of shipment numbers.
function getShipmentStatuses(creds, shipmentNumbers) {
  return callEcont(creds, '/Shipments/ShipmentService.getShipmentStatuses.json', { shipmentNumbers });
}

function toAddress(a) {
  if (!a) return undefined;
  return {
    city: {
      name: a.city,
      postCode: a.postCode || a.zip,
      country: { code3: a.countryCode || 'BGR' },
    },
    street: a.street,
    num: a.num,
    other: a.other,
    quarter: a.quarter,
  };
}

// Assemble the ShippingLabel payload from the user's saved sender + default
// options and the per-shipment values chosen in the preview screen.
function buildLabel(sender, defaults, o) {
  const d = defaults || {};
  const label = {
    senderClient: { name: sender.name, phones: [sender.phone] },
    receiverClient: { name: o.recipientName, phones: [o.phone] },
    packCount: o.packCount || d.packCount || 1,
    shipmentType: o.shipmentType || d.shipmentType || 'pack',
    weight: Number(o.weight != null ? o.weight : d.weight) || 0.5,
    shipmentDescription: o.description || d.shipmentDescription || '',
  };

  // Review (преглед) / Test (тест) — per-parcel override falls back to the default.
  const review = o.payAfterAccept != null ? o.payAfterAccept : d.payAfterAccept;
  const test = o.payAfterTest != null ? o.payAfterTest : d.payAfterTest;
  if (review) label.payAfterAccept = true;
  if (test) label.payAfterTest = true;

  // Sender drop-off location
  if (sender.officeCode) label.senderOfficeCode = String(sender.officeCode);
  else if (sender.address) label.senderAddress = toAddress(sender.address);

  // Receiver location
  if (o.officeCode) label.receiverOfficeCode = String(o.officeCode);
  else if (o.address) label.receiverAddress = toAddress(o.address);

  // Who pays the delivery price
  const payer = o.payer || d.payer || 'receiver';
  if (payer === 'sender') label.paymentSenderMethod = 'cash';
  else label.paymentReceiverMethod = 'cash';

  // Cash on delivery (наложен платеж) collected from receiver, sent to sender
  const cod = o.cod || d.cod;
  if (cod && cod.enabled && Number(cod.amount) > 0) {
    label.services = Object.assign(label.services || {}, {
      cdAmount: Number(cod.amount),
      cdType: 'get',
      cdCurrency: cod.currency || 'BGN',
    });
  }

  return label;
}

module.exports = { callEcont, getOffices, createLabel, getShipmentStatuses, buildLabel, baseUrl };
