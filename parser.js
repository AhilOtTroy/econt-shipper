'use strict';

// Parse a free-text Bulgarian shipping message into structured fields, and
// fuzzy-match the office description against the Econt office nomenclature.

// Bulgarian mobile: 0 8 X + 8 more digits (10 total), or +359 8XXXXXXXX.
const PHONE_RE = /(?:\+?\s?359|0)[\s\-.]?8(?:[\s\-.]?\d){8}/;

// Words that carry no signal when matching an office.
const STOP = new Set([
  'еконт', 'econt', 'офис', 'office', 'ул', 'бул', 'ж', 'к', 'жк', 'кв',
  'град', 'гр', 'село', 'с', 'до', 'на', 'в', 'и', 'на', 'апс', 'aps',
]);

function normalizePhone(raw) {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+359')) d = '0' + d.slice(4);
  else if (d.startsWith('00359')) d = '0' + d.slice(5);
  else if (d.startsWith('359') && d.length === 12) d = '0' + d.slice(3);
  return d;
}

function detectDeliveryType(text) {
  const t = text.toLowerCase();
  if (/(до\s*)?адрес|до\s*врата|до\s*мен|courier|куриер/.test(t)) {
    // explicit office mention still wins
    if (/офис|office/.test(t)) return 'office';
    return 'door';
  }
  return 'office';
}

function parseMessage(text) {
  const out = {
    deliveryType: detectDeliveryType(text),
    recipientName: '',
    phone: '',
    phoneRaw: '',
    locationText: '',
  };
  const m = PHONE_RE.exec(text);
  if (!m) return out;

  out.phoneRaw = m[0].trim();
  out.phone = normalizePhone(m[0]);

  // Everything before the phone, minus trailing separators.
  let before = text.slice(0, m.index).replace(/[\s\-–—:•.,()]+$/u, '');

  // Name = the run of letters after the last digit (the house number that ends
  // the address), capped at 3 words.
  let lastDigit = -1;
  for (let i = before.length - 1; i >= 0; i--) {
    if (/\d/.test(before[i])) { lastDigit = i; break; }
  }
  const nameZone = lastDigit >= 0 ? before.slice(lastDigit + 1) : before;
  const nm = nameZone.match(/([\p{L}][\p{L}.'’\-]*(?:\s+[\p{L}][\p{L}.'’\-]*){0,2})\s*$/u);
  out.recipientName = nm ? nm[1].trim() : '';

  // Location text = part before the name; strip a leading intro up to a colon.
  const nameStart = out.recipientName ? before.lastIndexOf(out.recipientName) : before.length;
  let loc = before.slice(0, nameStart);
  const colon = loc.lastIndexOf(':');
  if (colon >= 0) loc = loc.slice(colon + 1);
  out.locationText = loc.replace(/[\-–—:•,\s]+$/u, '').replace(/^[\-–—:•,\s]+/u, '').trim();

  return out;
}

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && (w.length >= 3 || /^\d{4}$/.test(w)));
}

function officeHaystack(o) {
  const a = o.address || {};
  const city = a.city || {};
  return [o.name, o.nameEn, a.fullAddress, a.quarter, a.street, city.name, city.postCode]
    .filter(Boolean)
    .join(' ');
}

// Rank offices by weighted token overlap with the parsed location text.
function matchOffices(locationText, offices, limit) {
  const qTokens = tokenize(locationText);
  const postcode = (locationText.match(/\b\d{4}\b/) || [])[0];
  const ranked = [];

  for (const o of offices) {
    const hay = officeHaystack(o);
    const hayTokens = new Set(tokenize(hay));
    let score = 0;
    for (const t of qTokens) {
      if (hayTokens.has(t)) score += /^\d{4}$/.test(t) ? 4 : Math.min(t.length, 8);
    }
    if (postcode && (o.address?.city?.postCode === postcode)) score += 6;
    if (score > 0) {
      ranked.push({
        code: o.code,
        name: o.name,
        address: o.address?.fullAddress || '',
        city: o.address?.city?.name || '',
        postCode: o.address?.city?.postCode || '',
        score,
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit || 6);
}

module.exports = { parseMessage, matchOffices, normalizePhone, tokenize };
