'use strict';

// Stateless client for the Econt Delivery (e-Econt) JSON API + label builder.
// Every call takes a `creds` object { mode, username, password } supplied by the
// caller; nothing is stored here. Auth is HTTP Basic.
//
// Runs on Node 18+ and on Cloudflare Workers alike: only fetch, TextEncoder, btoa
// and AbortSignal, no Node built-ins. The base URLs can be overridden (tests point
// them at a mock) through opts.bases = { production, demo }, filled from the
// ECONT_BASE_PRODUCTION / ECONT_BASE_DEMO environment variables by the caller.

const DEFAULT_BASES = { production: 'https://ee.econt.com', demo: 'http://demo.econt.com/ee' };

// "https://ee.econt.com" or "https://ee.econt.com/services" both mean the same base.
function baseUrl(creds, opts) {
  const key = creds && creds.mode === 'production' ? 'production' : 'demo';
  const b = String((opts && opts.bases && opts.bases[key]) || DEFAULT_BASES[key]).replace(/\/+$/, '');
  return /\/services$/.test(b) ? b : b + '/services';
}

// HTTP Basic value for a login, UTF-8 safe (btoa alone only takes Latin-1).
function basicAuth(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'Basic ' + btoa(bin);
}

// The request itself. Resolves with the fetch Response (body unread); a failure to
// connect is thrown as { kind: 'network' }.
async function econtFetch(creds, path, body, opts) {
  const url = baseUrl(creds, opts) + path;
  const timeoutMs = opts && opts.timeoutMs;
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': basicAuth(creds.username, creds.password),
        ...((opts && opts.headers) || {}),
      },
      body: JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (e) {
    const err = new Error('Cannot reach Econt (' + url + '): ' + e.message);
    err.kind = 'network';
    throw err;
  }
}

// An HTTP error from Econt with its (small) body read: { kind: 'http', status, body }.
async function httpError(res, url) {
  let text = '';
  try { text = await res.text(); } catch (e) {
    const err = new Error('Econt reply cut off (' + url + '): ' + e.message);
    err.kind = 'network';
    throw err;
  }
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  const err = new Error('Econt returned HTTP ' + res.status);
  err.kind = 'http';
  err.status = res.status;
  err.body = json;
  return err;
}

// opts.timeoutMs: give up (as a network failure) when Econt has not answered in
// time. Never used for createLabel: a create cut short may still have made a waybill.
async function callEcont(creds, path, body, opts) {
  const res = await econtFetch(creds, path, body, opts);
  const url = baseUrl(creds, opts) + path;
  if (!res.ok) throw await httpError(res, url);
  // The body read can fail too (socket cut mid-reply): same as a network loss,
  // and for a create it means the waybill may exist.
  let text;
  try { text = await res.text(); } catch (e) {
    const err = new Error('Econt reply cut off (' + url + '): ' + e.message);
    err.kind = 'network';
    throw err;
  }
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return json;
}

const OFFICES_PATH = '/Nomenclatures/NomenclaturesService.getOffices.json';
const officesBody = (countryCode) => ({ countryCode: countryCode || 'BGR', showCargoReceptions: false, showLC: false });

// Customer-facing offices only. `showLC` adds Локални Логистични Центрове (ЛЛЦ):
// sorting hubs that are "active" on Econt's map but are NOT valid delivery
// destinations for a normal parcel; picking one fails createLabel with
// "Невалиден обслужващ офис". Cargo receptions are freight points, same story.
function getOffices(creds, countryCode, opts) {
  return callEcont(creds, OFFICES_PATH, officesBody(countryCode), opts);
}
// The same list as a raw Response with its ~4 MB body unread, so a relay can pass
// it through without parsing it. An HTTP error is thrown with its body read.
// Asked for uncompressed: the relay then never has to unpack it (on Cloudflare the
// edge compresses the reply for the browser, outside the Worker's CPU time; the
// Node server gzips it itself).
async function getOfficesRaw(creds, countryCode, opts) {
  const res = await econtFetch(creds, OFFICES_PATH, officesBody(countryCode), Object.assign({}, opts, { headers: { 'Accept-Encoding': 'identity' } }));
  if (!res.ok) throw await httpError(res, baseUrl(creds, opts) + OFFICES_PATH);
  return res;
}

// mode: 'validate' | 'calculate' | 'create'
function createLabel(creds, label, mode, opts) {
  return callEcont(creds, '/Shipments/LabelService.createLabel.json', { label, mode }, opts);
}

// Live status/tracking for a list of shipment numbers.
function getShipmentStatuses(creds, shipmentNumbers, opts) {
  return callEcont(creds, '/Shipments/ShipmentService.getShipmentStatuses.json', { shipmentNumbers }, opts);
}

// The client's own profile(s). Carries `cdPayOptions[]` — the COD payout
// agreements (споразумения) registered on the account. A bank agreement holds
// the IBAN/BIC; a label references one by its `num`, never by raw IBAN.
function getClientProfiles(creds, opts) {
  return callEcont(creds, '/Profile/ProfileService.getClientProfiles.json', {}, Object.assign({}, opts, { timeoutMs: (opts && opts.timeoutMs) || 20000 }));
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

module.exports = { callEcont, getOffices, getOfficesRaw, createLabel, getShipmentStatuses, getClientProfiles, buildLabel, baseUrl, basicAuth, DEFAULT_BASES };
