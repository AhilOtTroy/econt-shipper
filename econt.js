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

// Customer-facing offices only. `showLC` adds Локални Логистични Центрове (ЛЛЦ) —
// sorting hubs that are "active" on Econt's map but are NOT valid delivery
// destinations for a normal parcel; picking one fails createLabel with
// "Невалиден обслужващ офис". Cargo receptions are freight points, same story.
function getOffices(creds, countryCode) {
  return callEcont(creds, '/Nomenclatures/NomenclaturesService.getOffices.json', {
    countryCode: countryCode || 'BGR',
    showCargoReceptions: false,
    showLC: false,
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

// The client's own profile(s). Carries `cdPayOptions[]` — the COD payout
// agreements (споразумения) registered on the account. A bank agreement holds
// the IBAN/BIC; a label references one by its `num`, never by raw IBAN.
function getClientProfiles(creds) {
  return callEcont(creds, '/Profile/ProfileService.getClientProfiles.json', {});
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

  // Receiver location — office OR door (address) delivery.
  if (o.officeCode) label.receiverOfficeCode = String(o.officeCode);
  else if (o.address) label.receiverAddress = toAddress(o.address);

  // Who pays the delivery price
  const payer = o.payer || d.payer || 'receiver';
  if (payer === 'sender') label.paymentSenderMethod = 'cash';
  else label.paymentReceiverMethod = 'cash';

  // Services: cash-on-delivery + SMS notification, both nested under `services`
  // exactly as Econt's API expects (cdAmount/cdType/cdCurrency + smsNotification).
  const services = {};
  const cod = o.cod || d.cod;
  if (cod && cod.enabled && Number(cod.amount) > 0) {
    services.cdAmount = Number(cod.amount);
    services.cdType = 'get';   // 'get' = collect from receiver. Bank payout does NOT change this.
    services.cdCurrency = cod.currency || 'EUR';
    // Where the collected money is paid out to the sender. Econt does not accept a
    // raw IBAN per shipment: the bank account lives on the account as a signed CD
    // agreement (споразумение), and the label references it by number.
    const payoutNum = (o.cod && o.cod.payOptionNum) || (d.cod && d.cod.payOptionNum);
    if (payoutNum) services.cdPayOptionsTemplate = String(payoutNum);
  }
  // Declared value (обявена стойност) — Econt's liability for damage/loss/theft.
  // Always the amount+currency pair; currency is mandatory post euro-migration.
  const decl = o.declaredValue || d.declaredValue;
  if (decl && decl.enabled && Number(decl.amount) > 0) {
    services.declaredValueAmount = Number(decl.amount);
    services.declaredValueCurrency = decl.currency || (cod && cod.currency) || 'EUR';
  }
  const sms = o.smsNotification != null ? o.smsNotification : d.smsNotification;
  if (sms) services.smsNotification = true;
  if (Object.keys(services).length) label.services = Object.assign(label.services || {}, services);

  // Where a REFUSED parcel is returned (per-label return instruction). Uses the
  // reject* half of ReturnInstructionParams only — the returnParcel* fields would
  // silently order a PAID two-way return service instead of routing refusals.
  const ret = o.returnTo || d.returnTo;
  if (ret && (ret.mode === 'office' || ret.mode === 'address')) {
    const rp = {
      rejectReturnClient: { name: sender.name, phones: [sender.phone] },
      rejectOriginalParcelPaySide: 'sender',
      rejectReturnParcelPaySide: 'sender',
    };
    if (ret.mode === 'office' && ret.officeCode) {
      rp.rejectAction = 'return_to_office';
      rp.rejectReturnOfficeCode = String(ret.officeCode);
    } else if (ret.mode === 'address' && ret.address && ret.address.city) {
      rp.rejectAction = 'return_to_address';
      rp.rejectReturnAddress = toAddress(ret.address);
    }
    if (rp.rejectAction) label.instructions = [{ type: 'return', returnInstructionParams: rp }];
  }

  return label;
}

module.exports = { callEcont, getOffices, createLabel, getShipmentStatuses, getClientProfiles, buildLabel, baseUrl };
