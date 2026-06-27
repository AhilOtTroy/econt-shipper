'use strict';

// Parse a free-text Bulgarian shipping message into structured fields, and
// fuzzy-match the office description against the Econt office nomenclature.
// Robust to the name appearing BEFORE or AFTER the phone, and detects a
// cash-on-delivery (наложен платеж) amount + currency when present.

const PHONE_RE = /(?:\+?\s?359|0)[\s\-.]?8(?:[\s\-.]?\d){8}/;

// Words that are never a person's name (office terms, fillers, sentence words).
const STOP_NAME = new Set([
  'моля', 'благодаря', 'мерси', 'здравейте', 'здрасти', 'привет', 'поздрави', 'btw',
  'ще', 'ви', 'ти', 'аз', 'той', 'тя', 'то', 'ние', 'те', 'и', 'или', 'за', 'на', 'във', 'в',
  'до', 'от', 'със', 'с', 'по', 'при', 'ако', 'как', 'кога', 'когато', 'че', 'да', 'не', 'ок', 'добре',
  'тел', 'телефон', 'гсм', 'gsm', 'офис', 'еконт', 'econt', 'склад', 'автомат', 'апс', 'aps', 'каса', 'машина',
  'адрес', 'име', 'имена', 'получател', 'получателя', 'подател', 'пратка', 'пратки', 'пратете', 'изпратите',
  'изпратете', 'съобщение', 'снимка', 'номер', 'сериен', 'кутия', 'кутията', 'едно', 'центру', 'център',
  'лева', 'лев', 'лв', 'евро', 'eur', 'bgn', 'наложен', 'наложена', 'платеж', 'нп', 'сума', 'сумата', 'плати',
  'град', 'гр', 'село', 'ул', 'бул', 'блок', 'бл', 'вход', 'вх', 'етаж', 'ет', 'апартамент', 'ап', 'кв', 'жк', 'район',
]);

// Major Bulgarian cities/towns (and the words of multi-word names) — never a name.
const CITIES = new Set([
  'софия', 'пловдив', 'варна', 'бургас', 'русе', 'стара', 'загора', 'плевен', 'сливен', 'добрич', 'шумен',
  'перник', 'хасково', 'ямбол', 'пазарджик', 'благоевград', 'велико', 'търново', 'враца', 'габрово',
  'асеновград', 'видин', 'казанлък', 'кърджали', 'кюстендил', 'монтана', 'димитровград', 'търговище',
  'силистра', 'ловеч', 'разград', 'дупница', 'горна', 'оряховица', 'петрич', 'самоков', 'лом', 'нова',
  'попово', 'велинград', 'севлиево', 'карлово', 'банско', 'несебър', 'поморие', 'созопол', 'царево',
  'балчик', 'каварна', 'аксаково', 'девня', 'провадия', 'белослав', 'своге', 'ботевград', 'козлодуй',
  'мездра', 'троян', 'тетевен', 'сандански', 'разлог', 'симитли', 'харманли', 'свиленград', 'елхово',
  'средец', 'айтос', 'карнобат', 'котел', 'твърдица', 'панагюрище', 'ихтиман', 'костинброд', 'нови',
  'пазар', 'омуртаг', 'берковица', 'чирпан', 'раднево', 'гълъбово', 'първомай', 'смолян', 'девин',
]);

const STOP_OFFICE = new Set([
  'еконт', 'econt', 'офис', 'office', 'ул', 'бул', 'ж', 'к', 'жк', 'кв', 'град', 'гр', 'село', 'с',
  'до', 'на', 'в', 'и', 'тел', 'телефон', 'апс', 'aps', 'гсм', 'gsm',
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
  if (/(до\s*)?адрес|до\s*врата|до\s*мен|courier|куриер/.test(t)) { if (/офис|office/.test(t)) return 'office'; return 'door'; }
  return 'office';
}

const isPunct = (s) => /^[^\p{L}\p{N}]+$/u.test(s);
function bare(tok) { return tok.toLowerCase().replace(/[.'’-]/g, ''); }
// A name word: starts uppercase, not all-caps, no digit, not a filler/city.
function isNameWord(tok) {
  if (!/^[А-ЯЁA-Z][\p{L}'’.-]*$/u.test(tok)) return false;
  if (bare(tok).length < 2) return false;
  if (/\d/.test(tok)) return false;
  if (tok === tok.toUpperCase()) return false;
  const b = bare(tok);
  return !STOP_NAME.has(b) && !CITIES.has(b);
}
// Up to 2 consecutive name words from the front / back of a token list.
function leadingName(tokens) { const o = []; for (const tk of tokens) { if (o.length < 2 && isNameWord(tk)) o.push(tk); else break; } return o; }
function trailingName(tokens) { const o = []; for (let i = tokens.length - 1; i >= 0 && o.length < 2; i--) { if (isNameWord(tokens[i])) o.unshift(tokens[i]); else break; } return o; }

function curOf(s) { s = (s || '').toLowerCase(); return (s.includes('€') || s.startsWith('евро') || s.startsWith('eur')) ? 'EUR' : 'BGN'; }

// Detect a COD amount + currency. `text` should have the phone digits removed.
function detectCod(text, phoneIndex) {
  let currency = null;
  if (/€|\bевро|\beur\b/i.test(text)) currency = 'EUR';
  else if (/\bлв\.?|\bлева\b|\bлев\b|\bbgn\b/i.test(text)) currency = 'BGN';

  let m, amount = null;
  const amt = '(\\d{1,6}(?:[.,]\\d{1,2})?)';
  const reCurrAfter = new RegExp(amt + '\\s*(€|евро|eur|лв\\.?|лева|лев|bgn)', 'i');
  const reCurrBefore = new RegExp('(€|евро|eur|лв\\.?|лева|лев|bgn)\\s*' + amt, 'i');
  const reKw = new RegExp('(?:наложен(?:\\s*платеж)?|нал\\.?\\s*платеж|\\bнп\\b|\\bcod\\b|сума(?:та)?|за\\s*получаване)\\D{0,15}?' + amt, 'i');
  if (m = reCurrAfter.exec(text)) { amount = m[1]; currency = curOf(m[2]); }
  else if (m = reCurrBefore.exec(text)) { amount = m[2]; currency = curOf(m[1]); }
  else if (m = reKw.exec(text)) { amount = m[1]; }
  else {
    const cands = [];
    const re = /\d{1,6}(?:[.,]\d{1,2})?/g; let x;
    while ((x = re.exec(text))) {
      const val = parseFloat(x[0].replace(',', '.'));
      const intLen = x[0].replace(/[.,].*/, '').length;
      const before = text.slice(Math.max(0, x.index - 12), x.index).toLowerCase();
      if (!(val >= 10 && val <= 100000)) continue;
      if (intLen === 4) continue;
      if (/(ул|бул|№|no|ж\.?к|кв|блок|бл|вх|ап|етаж|ет)\.?\s*$/.test(before)) continue;
      if (phoneIndex >= 0 && x.index < phoneIndex) continue;
      cands.push(x[0]);
    }
    if (cands.length) amount = cands[cands.length - 1];
  }
  if (amount == null) return null;
  return { amount: parseFloat(String(amount).replace(',', '.')), currency: currency || null };
}

function parseMessage(text) {
  const out = { deliveryType: detectDeliveryType(text), recipientName: '', phone: '', phoneRaw: '', locationText: '', cod: null };
  const m = PHONE_RE.exec(text);
  const phoneIndex = m ? m.index : -1;
  let codText = text;
  if (m) { out.phoneRaw = m[0].trim(); out.phone = normalizePhone(m[0]); codText = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length); }
  out.cod = detectCod(codText, phoneIndex);

  const before = m ? text.slice(0, m.index) : text;
  const after = m ? text.slice(m.index + m[0].length) : '';
  const tok = (s) => s.replace(/[,/]/g, ' ').split(/\s+/).filter(Boolean);
  let beforeTok = tok(before), afterTok = tok(after);
  while (beforeTok.length && isPunct(beforeTok[beforeTok.length - 1])) beforeTok.pop();   // trailing "-" / ":" before phone
  while (afterTok.length && isPunct(afterTok[0])) afterTok.shift();

  let nameTok = leadingName(afterTok), nameFrom = 'after';
  if (!nameTok.length) { nameTok = trailingName(beforeTok); nameFrom = 'before'; }
  out.recipientName = nameTok.join(' ').replace(/[.,'’-]+$/u, '').trim();

  let officeTokens = beforeTok.slice();
  if (nameFrom === 'before' && nameTok.length) officeTokens = officeTokens.slice(0, officeTokens.length - nameTok.length);
  officeTokens = officeTokens.filter((w) => !['тел', 'телефон', 'gsm', 'гсм'].includes(w.toLowerCase()));
  let loc = officeTokens.join(' ');
  const colon = loc.lastIndexOf(':'); if (colon >= 0) loc = loc.slice(colon + 1);
  loc = loc.replace(/\s+/g, ' ').trim();
  if (!/[\p{L}]/u.test(loc) && afterTok.length) loc = afterTok.filter((w) => !nameTok.includes(w)).join(' ').trim();
  out.locationText = loc;
  return out;
}

function tokenize(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((w) => w && !STOP_OFFICE.has(w) && (w.length >= 3 || /^\d{4}$/.test(w)));
}
function officeHaystack(o) { const a = o.address || {}, city = a.city || {}; return [o.name, o.nameEn, a.fullAddress, a.quarter, a.street, city.name, city.postCode].filter(Boolean).join(' '); }
function matchOffices(locationText, offices, limit) {
  const qTokens = tokenize(locationText);
  const postcode = (locationText.match(/\b\d{4}\b/) || [])[0];
  const ranked = [];
  for (const o of offices) {
    const hayArr = tokenize(officeHaystack(o));
    const hayTokens = new Set(hayArr);
    let score = 0;
    for (const tt of qTokens) {
      let hit = hayTokens.has(tt);
      if (!hit && tt.length >= 4) hit = hayArr.some((h) => h.length >= 4 && (h.startsWith(tt) || tt.startsWith(h)));
      if (hit) score += /^\d{4}$/.test(tt) ? 4 : Math.min(tt.length, 8);
    }
    if (postcode && (o.address?.city?.postCode === postcode)) score += 6;
    if (score > 0) ranked.push({ code: o.code, name: o.name, address: o.address?.fullAddress || '', city: o.address?.city?.name || '', postCode: o.address?.city?.postCode || '', score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit || 6);
}

module.exports = { parseMessage, matchOffices, normalizePhone, tokenize, detectCod };
