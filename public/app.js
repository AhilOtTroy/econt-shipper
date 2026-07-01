'use strict';

const $ = (id) => document.getElementById(id);
const $q = (sel) => document.querySelector(sel);
const KEY = 'econt_shipper_v1';
const PKEY = 'econt_parcels';

// ===================== i18n =====================
const I18N = {
  bg: {
    land_pill: 'Еконт, опростено', land_title: 'Съобщение. Товарителница. Готово.',
    land_sub: 'Превърнете чата на клиента в готова пратка. За секунди.',
    land_cta: 'Започнете', land_what_h: 'Накратко',
    land_what_p: 'Поставяте съобщението. Проверявате. Готова товарителница във вашия Еконт. Входът остава на устройството, с PIN.',
    land_f1: 'Разпознава офис, име и телефон.', land_f2: 'Виждате цената преди да потвърдите.',
    land_f3: 'Жив статус на всяка пратка.', land_f4: 'Евро или лева. Наложен платеж.',
    setup_title: 'Бърза настройка', setup_sub: 'Еднократно. Всичко остава на устройството, с PIN.',
    setup_s1: 'Изберете PIN', setup_s1_sub: 'Заключва приложението и криптира паролата ви за Еконт на това устройство.',
    setup_pin: 'PIN (4–6 цифри)', setup_pin2: 'Повторете PIN', setup_s2: 'Вашият Еконт акаунт', setup_mode: 'Режим', mode_prod: 'Реален', mode_demo: 'Демо',
    setup_user: 'Потребителско име в Еконт (точно, с главни/малки букви)', setup_pass: 'Парола за Еконт', setup_test: 'Проверка на входа',
    setup_s3: 'Вие (подателят)', setup_yourname: 'Вашето име', setup_yourphone: 'Вашият телефон', setup_youroffice: 'Вашият офис за подаване',
    setup_search_office: 'търсене по град / име на офис…', find: 'Намери', setup_s4: 'Вашите обичайни настройки', weight: 'Тегло (кг)', contents: 'Съдържание', who_pays: 'Кой плаща',
    receiver_pays: 'Получателят плаща', i_pay: 'Аз плащам', setup_cod: 'Обикновено с наложен платеж (сумата въвеждате за всяка пратка)',
    cod_currency: 'Валута на наложен платеж', setup_finish: 'Завършете настройката →',
    lock_title: 'Въведете PIN', unlock: 'Отключи', forget: 'Изтрий от това устройство и започни наново',
    app_brand: 'Econt Shipper', nav_new: 'Нова', nav_parcels: 'Пратки',
    set_account: 'Еконт акаунт', username: 'Потребител', pass_keep: 'Парола (празно = без промяна)',
    set_sender: 'Подател', name: 'Име', phone: 'Телефон', set_office_code: 'Код на вашия офис за подаване', search: 'търсене…',
    set_defaults: 'Настройки по подразбиране', receiver: 'Получател', sender: 'Подател', set_cod_default: 'Наложен платеж по подразбиране',
    refresh_offices: 'Обнови офисите', save: 'Запази',
    paste_label: 'Поставете съобщението на клиента', paste_ph: 'Моля да ги изпратите в Офис на еконт: …  Име – 08xx xxx xxx', paste_hint: 'Съвет: Ctrl+Enter за преглед',
    img_cta: 'Снимка → товарителница', img_hint: 'Пуснете, поставете или изберете снимка на чата', or_paste: 'или поставете текста',
    ocr_loading: 'Подготовка на четеца…', ocr_reading: 'Разчитане на снимката… {p}%', ocr_empty: 'Не открих текст в снимката. Опитайте по-ясна снимка.', ocr_fail: 'Неуспешно разчитане. Поставете текста ръчно.',
    clear: 'Изчисти', preview: 'Преглед →', prev_h: 'Проверете и потвърдете', recipient: 'Име на получателя', deliver_office: 'Доставка до офис',
    wrong_office: 'грешен офис? търсене по име/град…', search_btn: 'Търси', description: 'Описание', pays: 'Плаща',
    cod: 'Нал. платеж', amount: 'сума', recalc: 'Преизчисли', create_btn: '✓ Създай товарителница',
    res_h: 'Товарителницата е създадена', copy: 'Копирай номера', label_pdf: '🖨 Етикет PDF', view_in_profile: '👤 Виж в профила', new: '+ Нова',
    parcels_h: 'Вашите пратки', parcels_refresh: 'Обнови', parcels_note: 'Показва пратките, създадени през това приложение, с актуален статус от Еконт.',
    parcels_empty: 'Все още няма пратки тук. Създайте първата от раздел „Нова“.', exp_delivery: 'Очаквана доставка', collected: 'Събрано НП',
    track_events: 'Проследяване', reprint: 'Етикет', copied: 'Копирано ✓', need_desc: 'Описанието е задължително за колетни пратки.',
    loading: 'Зареждане…', no_status: 'няма статус', other_env: 'друга среда', status_delivered: 'Доставена', status_transit: 'В движение', kg: 'кг',
    review_only: 'Преглед', review_test: 'Преглед и тест', review_none: 'Без преглед',
    review_setting: 'Фиксирай „Преглед“ за всяка пратка', review_unanchored: 'Избирам за всяка пратка',
    review_label: 'Опция „Преглед“', review_from_settings: 'Преглед: {mode} (от настройките)',
    track_ph: 'добави номер на пратка…', track_add: 'Добави', already_added: 'Вече е добавена', invalid_number: 'Невалиден номер на пратка',
    details: 'Детайли', hide_details: 'Скрий детайли', in_operation: 'Във движение от', delivered_ok: 'Доставена успешно', returned_ok: 'Върната към подателя', awaiting_dispatch: 'Очаква изпращане',
    d_status: 'Статус', d_sender: 'Подател', d_recipient: 'Получател', d_phone: 'Телефон', d_office: 'Офис получател', d_sender_office: 'Офис подател', d_storage: 'Съхранява се в', d_type: 'Тип', d_packs: 'Брой', d_weight: 'Тегло', d_contents: 'Съдържание', d_review: 'Преглед', d_created: 'Създадена', d_sent: 'Изпратена', d_expected: 'Очаквана доставка', d_delivered: 'Доставена на', d_cod: 'Наложен платеж', d_price: 'Цена', d_attempts: 'Опити за доставка', d_routing: 'Маршрут',
    dd: 'д', dh: 'ч', dm: 'м', ds: 'с',
    testing: 'Проверка…', login_ok: '✓ Входът работи — {n} офиса са налични.', need_creds: 'Първо въведете потребител и парола.',
    pin_short: 'PIN трябва да е поне 4 цифри.', pin_mismatch: 'PIN кодовете не съвпадат.', test_first: 'Първо проверете входа за Еконт (стъпка 2).',
    fill_sender: 'Попълнете име, телефон и изберете офис за подаване (стъпка 3).',
    paste_first: 'Първо поставете съобщение.', pick_office: 'Първо изберете офис.', need_recip: 'Нужни са име, телефон и офис.',
    cod_blank: 'Наложеният платеж е включен, но сумата е празна — въведете сума или го изключете.',
    saved: 'Запазено ✓', creating: 'Създаване…', getting_price: 'Изчисляване на цена…', validated: 'Проверено ✓',
    est_price: 'Очаквана цена: <span class="price">{v} {cur}</span>', price_label: 'Цена: {v} {cur}',
    no_match: 'няма съвпадащ офис за „{q}“ — търсете отдолу', office_err: '⚠ грешка със списъка офиси: {err}',
    demo_hint: '⚠ ДЕМО списък с офиси (~585) — превключете на Реален в ⚙ за всички офиси.',
    wrong_pin: 'Грешен PIN.', forget_confirm: 'Да премахна ли запазения Еконт вход и настройки от това устройство?',
    refreshing: 'Обновяване…', offices_loaded: 'Заредени {n} офиса ✓', searching: 'търсене…', no_matches: 'няма резултати',
    no_number: '(няма върнат номер)', econt_prefix: 'Еконт: ', error_prefix: 'Грешка: ',
  },
  en: {
    land_pill: 'Econt, simplified', land_title: 'A message in. A label out.',
    land_sub: "Turn a customer's chat into a ready shipment. In seconds.",
    land_cta: 'Get started', land_what_h: 'In short',
    land_what_p: 'Paste the message. Check it. Get a label in your Econt account. Login stays on this device, behind a PIN.',
    land_f1: 'Reads the office, name and phone.', land_f2: 'See the price before you confirm.',
    land_f3: 'Live status for every parcel.', land_f4: 'Euro or leva. Cash on delivery.',
    setup_title: 'Quick setup', setup_sub: 'One time. Everything stays on this device, behind a PIN.',
    setup_s1: 'Choose a PIN', setup_s1_sub: 'Locks the app and encrypts your Econt password on this device.',
    setup_pin: 'PIN (4–6 digits)', setup_pin2: 'Repeat PIN', setup_s2: 'Your Econt account', setup_mode: 'Mode', mode_prod: 'Production', mode_demo: 'Demo',
    setup_user: 'Econt username (exact, case-sensitive)', setup_pass: 'Econt password', setup_test: 'Test login',
    setup_s3: 'You (the sender)', setup_yourname: 'Your name', setup_yourphone: 'Your phone', setup_youroffice: 'Your drop-off office',
    setup_search_office: 'search by city / office name…', find: 'Find', setup_s4: 'Your usual options', weight: 'Weight (kg)', contents: 'Contents', who_pays: 'Who pays',
    receiver_pays: 'Receiver pays', i_pay: 'I pay', setup_cod: 'Usually cash-on-delivery (you type the amount per parcel)',
    cod_currency: 'COD currency', setup_finish: 'Finish setup →',
    lock_title: 'Enter PIN', unlock: 'Unlock', forget: 'Forget this device & start over',
    app_brand: 'Econt Shipper', nav_new: 'New', nav_parcels: 'Parcels',
    set_account: 'Econt account', username: 'Username', pass_keep: 'Password (blank = keep)',
    set_sender: 'Sender', name: 'Name', phone: 'Phone', set_office_code: 'Your drop-off office code', search: 'search…',
    set_defaults: 'Default options', receiver: 'Receiver', sender: 'Sender', set_cod_default: 'COD on by default',
    refresh_offices: 'Refresh offices', save: 'Save',
    paste_label: "Paste the customer's message", paste_ph: 'Моля да ги изпратите в Офис на еконт: …  Name – 08xx xxx xxx', paste_hint: 'Tip: Ctrl+Enter to preview',
    img_cta: 'Screenshot → label', img_hint: 'Drop, paste or pick a screenshot of the chat', or_paste: 'or paste the text',
    ocr_loading: 'Preparing the reader…', ocr_reading: 'Reading the screenshot… {p}%', ocr_empty: 'No text found in the image. Try a clearer screenshot.', ocr_fail: 'Could not read it. Paste the text manually.',
    clear: 'Clear', preview: 'Preview →', prev_h: 'Check & confirm', recipient: 'Recipient name', deliver_office: 'Deliver to office',
    wrong_office: 'wrong office? search by name/city…', search_btn: 'Search', description: 'Description', pays: 'Pays',
    cod: 'COD', amount: 'amount', recalc: 'Recalculate', create_btn: '✓ Create shipment number',
    res_h: 'Shipment created', copy: 'Copy number', label_pdf: '🖨 Label PDF', view_in_profile: '👤 View in profile', new: '+ New',
    parcels_h: 'Your parcels', parcels_refresh: 'Refresh', parcels_note: 'Shows parcels created through this app, with live status from Econt.',
    parcels_empty: 'No parcels yet. Create your first from the New tab.', exp_delivery: 'Expected delivery', collected: 'COD collected',
    track_events: 'Tracking', reprint: 'Label', copied: 'Copied ✓', need_desc: 'Description is required for parcels.',
    loading: 'Loading…', no_status: 'no status', other_env: 'other env', status_delivered: 'Delivered', status_transit: 'In transit', kg: 'kg',
    review_only: 'Review', review_test: 'Review & Test', review_none: 'No review',
    review_setting: 'Fix a review option for every parcel', review_unanchored: 'Choose per shipment',
    review_label: 'Review option', review_from_settings: 'Review: {mode} (from settings)',
    track_ph: 'add a shipment number…', track_add: 'Add', already_added: 'Already added', invalid_number: 'Invalid shipment number',
    details: 'Details', hide_details: 'Hide details', in_operation: 'In transit for', delivered_ok: 'Delivered successfully', returned_ok: 'Returned to sender', awaiting_dispatch: 'Awaiting dispatch',
    d_status: 'Status', d_sender: 'Sender', d_recipient: 'Recipient', d_phone: 'Phone', d_office: 'Receiver office', d_sender_office: 'Sender office', d_storage: 'Stored at', d_type: 'Type', d_packs: 'Packs', d_weight: 'Weight', d_contents: 'Contents', d_review: 'Review', d_created: 'Created', d_sent: 'Dispatched', d_expected: 'Expected delivery', d_delivered: 'Delivered at', d_cod: 'COD', d_price: 'Price', d_attempts: 'Delivery attempts', d_routing: 'Routing',
    dd: 'd', dh: 'h', dm: 'm', ds: 's',
    testing: 'Testing…', login_ok: '✓ Login works — {n} offices available.', need_creds: 'Enter username and password first.',
    pin_short: 'PIN must be at least 4 digits.', pin_mismatch: 'PINs do not match.', test_first: 'Test your Econt login first (step 2).',
    fill_sender: 'Fill your name, phone and pick your drop-off office (step 3).',
    paste_first: 'Paste a message first.', pick_office: 'Pick an office first.', need_recip: 'Need recipient name, phone and an office.',
    cod_blank: 'COD is on but the amount is empty — enter the amount or uncheck COD.',
    saved: 'Saved ✓', creating: 'Creating…', getting_price: 'Getting price…', validated: 'Validated ✓',
    est_price: 'Estimated price: <span class="price">{v} {cur}</span>', price_label: 'Price: {v} {cur}',
    no_match: 'no office matched “{q}” — search below', office_err: '⚠ office list error: {err}',
    demo_hint: '⚠ DEMO office list (~585) — switch to Production in ⚙ for all offices.',
    wrong_pin: 'Wrong PIN.', forget_confirm: 'Remove your saved Econt login and settings from this device?',
    refreshing: 'Refreshing…', offices_loaded: 'Loaded {n} offices ✓', searching: 'searching…', no_matches: 'no matches',
    no_number: '(no number returned)', econt_prefix: 'Econt: ', error_prefix: 'Error: ',
  },
};
let LANG = ['bg', 'en'].includes(localStorage.getItem('econt_lang')) ? localStorage.getItem('econt_lang') : 'bg';
// Escape untrusted text before it goes into innerHTML.
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function t(key, params) {
  const dict = I18N[LANG] || I18N.en;
  let s = dict[key];
  if (s == null) s = (I18N.en[key] != null ? I18N.en[key] : key);
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}
function applyLang() {
  const dict = I18N[LANG] || I18N.en;
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (dict[k] != null) el.textContent = dict[k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const k = el.getAttribute('data-i18n-ph'); if (dict[k] != null) el.placeholder = dict[k]; });
  $('langBg').classList.toggle('active', LANG === 'bg');
  $('langEn').classList.toggle('active', LANG === 'en');
}
function setLang(l) {
  LANG = l; localStorage.setItem('econt_lang', l); applyLang();
  if (!$('tab-parcels').classList.contains('hide')) openParcels();
  // Refresh dynamically-generated strings in an open preview so they follow the language.
  if (!$('view-app').classList.contains('hide') && !$('preview').classList.contains('hide')) { applyReviewUI(); doPreview(); }
}

// ===================== helpers =====================
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2300); }
function btnBusy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.disabled = true; if (btn.dataset.html == null) btn.dataset.html = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>' + (label || ''); }
  else { btn.disabled = false; if (btn.dataset.html != null) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; } }
}
function fmtDate(ms) { if (!ms) return ''; let n = Number(ms); if (n < 1e12) n *= 1000; const d = new Date(n); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString(LANG === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: 'short' }); }
// Review service (преглед): one setting, three states — None / Review / Review & Test.
function reviewFlags(mode) { return { payAfterAccept: mode === 'review' || mode === 'review_test', payAfterTest: mode === 'review_test' }; }
// The review mode "anchored" in settings: '' = not anchored (user picks per shipment).
// Legacy 'none'/unset both mean "not anchored" now that the no-review choice lives on the creation page.
function reviewAnchor(d) {
  if (!d) return '';
  if (d.reviewMode === 'review' || d.reviewMode === 'review_test') return d.reviewMode;
  if (d.reviewMode === 'none') return '';
  if (d.payAfterTest) return 'review_test';
  if (d.payAfterAccept) return 'review';
  return '';
}

// ===================== state =====================
const SESSION = { password: null, pin: null };
let CONFIG = { mode: 'production', username: '', sender: {}, defaults: {} };

// ---------- crypto ----------
const tenc = new TextEncoder(), tdec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', tenc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptSecret(plain, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, tenc.encode(plain));
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function decryptSecret(e, pin) {
  const key = await deriveKey(pin, unb64(e.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, key, unb64(e.ct));
  return tdec.decode(pt);
}

// ---------- storage ----------
const loadStore = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const saveStore = (o) => localStorage.setItem(KEY, JSON.stringify(o));
async function persist() { saveStore({ v: 1, mode: CONFIG.mode, username: CONFIG.username, enc: await encryptSecret(SESSION.password, SESSION.pin), sender: CONFIG.sender, defaults: CONFIG.defaults, pinLen: (SESSION.pin || '').length }); }
const loadParcels = () => { try { return JSON.parse(localStorage.getItem(PKEY)) || []; } catch { return []; } };
const saveParcels = (a) => localStorage.setItem(PKEY, JSON.stringify(a.slice(0, 300)));
const addParcel = (p) => { const a = loadParcels(); a.unshift(p); saveParcels(a); };

// ---------- views ----------
function show(view) { for (const v of ['landing', 'setup', 'lock', 'app']) $('view-' + v).classList.toggle('hide', v !== view); }
const creds = () => ({ mode: CONFIG.mode, username: CONFIG.username, password: SESSION.password });
// Official e-Econt account ("profile") URL for the active environment, so the
// user can log in and confirm the shipment really landed in their account.
const econtProfileUrl = () => (CONFIG.mode === 'production' ? 'https://ee.econt.com/' : 'https://demo.econt.com/ee/');
const api = async (path, body) => (await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
function officeLabel(c) { return `${c.name} — ${c.address}${c.city ? ', ' + c.city : ''}${c.postCode ? ' (' + c.postCode + ')' : ''}`; }
async function fillOfficeSelect(sel, q, credsObj) {
  sel.classList.remove('hide'); sel.innerHTML = `<option>${t('searching')}</option>`;
  const r = await api('/api/offices', { creds: credsObj, q });
  if (!r.ok) { sel.innerHTML = `<option value="">${esc(r.error)}</option>`; return; }
  sel.innerHTML = '';
  for (const c of (r.candidates || [])) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }
  if (!sel.options.length) sel.innerHTML = `<option value="">${t('no_matches')}</option>`;
}

// ===================== WIZARD =====================
let wizardTested = false;
const wizardCreds = () => ({ mode: $('suMode').value, username: $('suUser').value.trim(), password: $('suPass').value });
$('suTestBtn').onclick = async () => {
  const c = wizardCreds();
  if (!c.username || !c.password) { $('suTestMsg').className = 'err'; $('suTestMsg').textContent = t('need_creds'); return; }
  $('suTestMsg').className = 'muted'; $('suTestMsg').textContent = t('testing');
  const r = await api('/api/test', { creds: c });
  if (r.ok) { wizardTested = true; $('suTestMsg').className = 'good'; $('suTestMsg').textContent = t('login_ok', { n: r.officeCount }); $('suFinishBtn').disabled = false; }
  else { wizardTested = false; $('suTestMsg').className = 'err'; $('suTestMsg').textContent = '✗ ' + r.error; $('suFinishBtn').disabled = true; }
};
for (const id of ['suUser', 'suPass', 'suMode']) $(id).addEventListener('input', () => { wizardTested = false; $('suFinishBtn').disabled = true; });
$('suSenderSearchBtn').onclick = () => fillOfficeSelect($('suSenderOffice'), $('suSenderOfficeSearch').value, wizardCreds());
$('suFinishBtn').onclick = async () => {
  const pin = $('suPin').value, e = $('suFinishMsg');
  if (pin.length < 4) { e.textContent = t('pin_short'); return; }
  if (pin !== $('suPin2').value) { e.textContent = t('pin_mismatch'); return; }
  if (!wizardTested) { e.textContent = t('test_first'); return; }
  const office = $('suSenderOffice').value;
  if (!$('suSenderName').value.trim() || !$('suSenderPhone').value.trim() || !office) { e.textContent = t('fill_sender'); return; }
  const c = wizardCreds();
  SESSION.password = c.password; SESSION.pin = pin;
  CONFIG = {
    mode: c.mode, username: c.username,
    sender: { name: $('suSenderName').value.trim(), phone: $('suSenderPhone').value.trim(), officeCode: office, address: null },
    defaults: { shipmentType: 'pack', packCount: 1, weight: Number($('suWeight').value) || 1, shipmentDescription: $('suDesc').value.trim(), payer: $('suPayer').value, payAfterAccept: false, payAfterTest: false, cod: { enabled: $('suCod').checked, amount: 0, currency: $('suCur').value }, countryCode: 'BGR' },
  };
  await persist(); enterApp();
};

// ===================== LOCK =====================
function showLock() { show('lock'); $('lockMsg').textContent = ''; $('lockPin').value = ''; setTimeout(() => $('lockPin').focus(), 50); }
let UNLOCKING = false;
async function tryUnlock(silentOnFail) {
  if (UNLOCKING) return;
  const store = loadStore(); if (!store) return show('landing');
  UNLOCKING = true;
  try {
    SESSION.password = await decryptSecret(store.enc, $('lockPin').value); SESSION.pin = $('lockPin').value;
    CONFIG = { mode: store.mode, username: store.username, sender: store.sender, defaults: store.defaults };
    enterApp();
  } catch { if (!silentOnFail) $('lockMsg').textContent = t('wrong_pin'); }
  finally { UNLOCKING = false; }
}
const unlock = () => tryUnlock(false);
$('lockBtn').onclick = unlock;
// Auto-unlock the moment the full PIN is entered — no button click needed.
$('lockPin').addEventListener('input', () => {
  $('lockMsg').textContent = '';
  const store = loadStore(); if (!store) return;
  const len = $('lockPin').value.length, expected = store.pinLen || 0;
  if (expected) { if (len === expected) tryUnlock(false); }
  else if (len >= 4) tryUnlock(len < 6); // legacy store: only show error at the 6-char cap
});
$('forgetBtn').onclick = () => { if (confirm(t('forget_confirm'))) { localStorage.removeItem(KEY); location.reload(); } };
$('lockNowBtn').onclick = () => { SESSION.password = null; SESSION.pin = null; showLock(); };

// ===================== APP =====================
function switchTab(which) {
  $('navNew').classList.toggle('active', which === 'new');
  $('navParcels').classList.toggle('active', which === 'parcels');
  $('tab-new').classList.toggle('hide', which !== 'new');
  $('tab-parcels').classList.toggle('hide', which !== 'parcels');
  const ind = document.querySelector('.seg-ind');
  if (ind) ind.style.transform = which === 'parcels' ? 'translateX(calc(100% + 5px))' : 'translateX(0)';
  if (which === 'parcels') openParcels(); else stopTimers();
}
function enterApp() {
  const badge = $('modeBadge'); badge.textContent = CONFIG.mode.toUpperCase(); badge.className = 'badge ' + CONFIG.mode;
  $('cfgMode').value = CONFIG.mode; $('cfgUser').value = CONFIG.username || ''; $('cfgPass').value = '';
  const s = CONFIG.sender, d = CONFIG.defaults;
  $('cfgSenderName').value = s.name || ''; $('cfgSenderPhone').value = s.phone || ''; $('cfgSenderOffice').value = s.officeCode || '';
  $('cfgWeight').value = d.weight ?? 1; $('cfgDesc').value = d.shipmentDescription || '';
  $('cfgPayer').value = d.payer || 'receiver'; $('cfgCodOn').checked = !!(d.cod && d.cod.enabled);
  $('cfgCur').value = (d.cod && d.cod.currency) || 'EUR';
  $('cfgReviewMode').value = reviewAnchor(d);
  applyReviewUI();  // keep the preview's review control in sync after a settings change
  switchTab('new');
  show('app');
}
$('navNew').onclick = () => switchTab('new');
$('navParcels').onclick = () => switchTab('parcels');
$('settingsBtn').onclick = () => { switchTab('new'); $('settings').classList.toggle('hide'); };
$('cfgTestBtn').onclick = async () => {
  const c = { mode: $('cfgMode').value, username: $('cfgUser').value.trim(), password: $('cfgPass').value || SESSION.password };
  $('cfgMsg').textContent = t('testing');
  const r = await api('/api/test', { creds: c });
  $('cfgMsg').textContent = r.ok ? t('login_ok', { n: r.officeCount }) : ('✗ ' + r.error);
};
$('cfgSenderSearchBtn').onclick = () => {
  const c = { mode: $('cfgMode').value, username: $('cfgUser').value.trim(), password: $('cfgPass').value || SESSION.password };
  fillOfficeSelect($('cfgSenderOfficeSel'), $('cfgSenderSearch').value, c);
};
$('cfgSenderOfficeSel').onchange = () => { $('cfgSenderOffice').value = $('cfgSenderOfficeSel').value; };
$('refreshOfficesBtn').onclick = async (ev) => {
  btnBusy(ev.currentTarget, true); $('cfgMsg').textContent = t('refreshing');
  const r = await api('/api/offices/refresh', { creds: creds() });
  btnBusy(ev.currentTarget, false);
  $('cfgMsg').textContent = r.ok ? t('offices_loaded', { n: r.count }) : (t('error_prefix') + r.error);
};
$('saveCfgBtn').onclick = async () => {
  CONFIG.mode = $('cfgMode').value; CONFIG.username = $('cfgUser').value.trim();
  if ($('cfgPass').value) SESSION.password = $('cfgPass').value;
  CONFIG.sender = { name: $('cfgSenderName').value.trim(), phone: $('cfgSenderPhone').value.trim(), officeCode: $('cfgSenderOffice').value.trim(), address: CONFIG.sender.address || null };
  const rm = $('cfgReviewMode').value, rf = reviewFlags(rm);
  CONFIG.defaults = Object.assign({}, CONFIG.defaults, { weight: Number($('cfgWeight').value) || 1, shipmentDescription: $('cfgDesc').value.trim(), payer: $('cfgPayer').value, reviewMode: rm, payAfterAccept: rf.payAfterAccept, payAfterTest: rf.payAfterTest, cod: Object.assign({}, CONFIG.defaults.cod, { enabled: $('cfgCodOn').checked, currency: $('cfgCur').value }) });
  await persist(); enterApp(); toast(t('saved'));
};

// ---------- parse / preview / create ----------
let CANDIDATES = [];
async function doParse(ev) {
  $('parseErr').textContent = '';
  const text = $('msg').value.trim();
  if (!text) { $('parseErr').textContent = t('paste_first'); return; }
  const btn = $('parseBtn'); btnBusy(btn, true);
  try {
    const r = await api('/api/parse', { text, creds: creds() });
    if (!r.ok) { $('parseErr').textContent = r.error || 'Parse failed'; return; }
    const p = r.parsed;
    $('pName').value = p.recipientName || ''; $('pPhone').value = p.phone || '';
    CANDIDATES = r.candidates || [];
    const sel = $('pOffice'); sel.innerHTML = '';
    if (r.officesError) sel.innerHTML = `<option value="">${esc(t('office_err', { err: r.officesError }))}</option>`;
    else if (!CANDIDATES.length) sel.innerHTML = `<option value="">${esc(t('no_match', { q: p.locationText }))}</option>`;
    else for (const c of CANDIDATES) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }
    $('officeHint').innerHTML = CONFIG.mode === 'demo' ? t('demo_hint') : '';
    const d = CONFIG.defaults;
    $('pWeight').value = d.weight ?? 1; $('pDesc').value = d.shipmentDescription || '';
    $('pPayer').value = d.payer || 'receiver';
    // COD: use a detected amount/currency from the message if present, else defaults.
    if (p.cod && p.cod.amount) {
      $('pCodOn').checked = true; $('pCodAmount').value = p.cod.amount;
      $('pCodCur').value = p.cod.currency || (d.cod && d.cod.currency) || 'EUR';
    } else {
      $('pCodOn').checked = !!(d.cod && d.cod.enabled); $('pCodAmount').value = (d.cod && d.cod.amount) || '';
      $('pCodCur').value = (d.cod && d.cod.currency) || 'EUR';
    }
    applyReviewUI();
    // Reset the per-shipment review each parse (never leak a prior message's choice),
    // then apply the review hint detected in THIS message, if any.
    if (!reviewAnchor(CONFIG.defaults)) $('pReviewMode').value = p.reviewMode || 'none';
    $('preview').classList.remove('hide'); $('result').classList.add('hide');
    $('preview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    doPreview();
  } finally { btnBusy(btn, false); }
}
// Show the per-shipment review selector only when settings does NOT anchor a mode.
// When anchored, hide the selector and show a small read-only note instead.
function applyReviewUI() {
  const anchor = reviewAnchor(CONFIG.defaults);
  if (anchor) {
    $('reviewRow').classList.add('hide');
    $('reviewAnchored').classList.remove('hide');
    $('reviewAnchored').textContent = t('review_from_settings', { mode: reviewLabel(anchor) });
  } else {
    $('reviewRow').classList.remove('hide');
    $('reviewAnchored').classList.add('hide');
    if (!$('pReviewMode').value) $('pReviewMode').value = 'none';
  }
}
function gatherOverrides() {
  // Anchored in settings → use it; otherwise the per-shipment choice on this page.
  const anchor = reviewAnchor(CONFIG.defaults);
  const mode = anchor || $('pReviewMode').value || 'none';
  const rf = reviewFlags(mode);
  return {
    recipientName: $('pName').value.trim(), phone: $('pPhone').value.trim(), officeCode: $('pOffice').value,
    weight: Number($('pWeight').value) || undefined, description: $('pDesc').value.trim(), payer: $('pPayer').value,
    cod: { enabled: $('pCodOn').checked, amount: Number($('pCodAmount').value) || 0, currency: $('pCodCur').value },
    payAfterAccept: rf.payAfterAccept, payAfterTest: rf.payAfterTest, reviewMode: mode,
  };
}
const shipBody = (overrides) => ({ creds: creds(), sender: CONFIG.sender, defaults: CONFIG.defaults, overrides });
function showPrice(resp) {
  const st = resp.label || resp, total = st.totalPrice;
  const cur = st.totalPriceCurrency || st.currency || $('pCodCur').value || 'EUR';
  return total != null ? t('est_price', { v: Number(total).toFixed(2), cur }) : t('validated');
}
async function doPreview(ev) {
  $('previewErr').textContent = '';
  const o = gatherOverrides();
  if (!o.officeCode) { $('priceBox').textContent = ''; $('previewErr').textContent = t('pick_office'); return; }
  const btn = ev && ev.currentTarget && ev.currentTarget.id === 'recalcBtn' ? $('recalcBtn') : null;
  btnBusy(btn, true); $('priceBox').innerHTML = '<span class="sk">price price price</span>';
  const r = await api('/api/preview', shipBody(o));
  btnBusy(btn, false);
  if (!r.ok) { $('priceBox').textContent = ''; $('previewErr').textContent = t('econt_prefix') + r.error; return; }
  $('priceBox').innerHTML = showPrice(r.response);
}
function playCheck() {
  const old = $q('#result .check-c'); if (!old) return;
  old.replaceWith(old.cloneNode(true));
}
async function doCreate() {
  $('previewErr').textContent = '';
  const o = gatherOverrides();
  if (!o.recipientName || !o.phone || !o.officeCode) { $('previewErr').textContent = t('need_recip'); return; }
  if (!o.description) { $('previewErr').textContent = t('need_desc'); $('pDesc').focus(); return; }
  if (o.cod.enabled && !(o.cod.amount > 0)) { $('previewErr').textContent = t('cod_blank'); return; }
  const btn = $('createBtn'); btnBusy(btn, true, t('creating'));
  try {
    const r = await api('/api/create', shipBody(o));
    if (!r.ok) { $('previewErr').textContent = t('econt_prefix') + r.error; return; }
    const st = r.response.label || r.response;
    const num = st.shipmentNumber || t('no_number');
    $('shipNum').textContent = num;
    const pdf = st.pdfURL;
    if (pdf) { $('pdfLink').href = pdf; $('pdfLink').style.display = ''; } else { $('pdfLink').style.display = 'none'; }
    $('profileLink').href = econtProfileUrl();
    $('resultMeta').textContent = st.totalPrice != null ? t('price_label', { v: Number(st.totalPrice).toFixed(2), cur: st.totalPriceCurrency || $('pCodCur').value || 'EUR' }) : '';
    if (st.shipmentNumber) addParcel({ number: st.shipmentNumber, recipient: o.recipientName, office: o.officeCode, weight: o.weight, description: o.description, cod: o.cod.enabled ? o.cod.amount : 0, currency: o.cod.currency, reviewMode: o.reviewMode, createdAt: Date.now(), pdfURL: pdf, mode: CONFIG.mode });
    $('preview').classList.add('hide'); $('result').classList.remove('hide');
    playCheck();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } finally { btnBusy(btn, false); }
}
$('clearBtn').onclick = () => { $('msg').value = ''; $('preview').classList.add('hide'); $('result').classList.add('hide'); };
$('parseBtn').onclick = doParse;

// ---------- screenshot → text (client-side OCR, nothing leaves the device) ----------
let _tessLoad = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (_tessLoad) return _tessLoad;
  _tessLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { _tessLoad = null; reject(new Error('ocr-load-failed')); };
    document.head.appendChild(s);
  });
  return _tessLoad;
}
// Isolate the customer's message from a full-chat screenshot: start at the greeting
// so the listing header/price above it (a false COD) is excluded from parsing.
function isolateMessage(text) {
  const m = String(text).match(/(здравей\S*|здрасти|привет|добър\s+ден|добро\s+утро|\bhello\b|\bhi\b)/i);
  return m ? text.slice(m.index) : text;
}
// Best-effort listing description: the longest multi-word line before the greeting,
// trimmed at a dash/comma and stripped of a trailing price.
function guessDescription(text) {
  const stop = /здравей|привет|\bhello\b|\bhi\b/i;
  let best = '';
  for (const raw of String(text).split(/\n+/)) {
    const line = raw.trim();
    if (stop.test(line)) break;
    if (line.split(/\s+/).length < 2) continue;
    if (line.length > best.length) best = line;
  }
  if (!best) return '';
  let d = best.split(/[—–,|]/)[0].trim();
  d = d.replace(/\s*\d+[.,]?\d*\s*(лв\.?|bgn|eur|€)\b.*$/i, '').trim();
  return d.slice(0, 40);
}
async function runOCR(file) {
  if (!file || !/^image\//.test(file.type || '')) return;
  const box = $('ocrBox'), msgEl = $('ocrMsg');
  $('parseErr').textContent = '';
  box.classList.remove('hide'); msgEl.textContent = t('ocr_loading');
  try {
    const T = await loadTesseract();
    const { data } = await T.recognize(file, 'bul+eng', {
      logger: (m) => { if (m && m.status === 'recognizing text') msgEl.textContent = t('ocr_reading', { p: Math.round((m.progress || 0) * 100) }); },
    });
    const text = ((data && data.text) || '').replace(/[ \t]+\n/g, '\n').trim();
    box.classList.add('hide');
    if (!text) { $('parseErr').textContent = t('ocr_empty'); return; }
    const desc = guessDescription(text);
    $('msg').value = isolateMessage(text);
    await doParse();
    // The product from the screenshot is the most relevant description for this parcel.
    if (desc) { $('pDesc').value = desc; if (!$('preview').classList.contains('hide')) doPreview(); }
  } catch (e) {
    box.classList.add('hide');
    $('parseErr').textContent = t('ocr_fail');
  }
}
(function initOCRInputs() {
  const drop = $('imgDrop'), input = $('imgInput');
  if (!drop || !input) return;
  drop.onclick = (e) => { if (e.target !== input) input.click(); };
  input.onchange = () => { const f = input.files && input.files[0]; if (f) runOCR(f); input.value = ''; };
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) runOCR(f); });
  // Paste a screenshot anywhere while the New tab is open.
  document.addEventListener('paste', (e) => {
    if ($('view-app').classList.contains('hide') || $('tab-new').classList.contains('hide')) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { e.preventDefault(); runOCR(f); return; } } }
  });
})();
$('recalcBtn').onclick = doPreview;
$('pReviewMode').onchange = doPreview;
$('createBtn').onclick = doCreate;
$('officeSearchBtn').onclick = async () => { await fillOfficeSelect($('pOffice'), $('officeSearch').value, creds()); doPreview(); };
$('pOffice').onchange = () => doPreview();
$('copyBtn').onclick = () => { navigator.clipboard.writeText($('shipNum').textContent); toast(t('copied')); };
$('newBtn').onclick = () => { $('msg').value = ''; $('result').classList.add('hide'); $('preview').classList.add('hide'); $('msg').focus(); };

// ---------- parcels (live status + operation timer) ----------
const toMs = (v) => { if (v == null) return null; let n = Number(v); if (!n) return null; if (n < 1e12) n *= 1000; return n; };
function fmtDateTime(ms) { const d = new Date(toMs(ms)); if (isNaN(d.getTime())) return ''; return d.toLocaleString(LANG === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function fmtDuration(ms) {
  if (!(ms > 0)) ms = 0;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), p2 = (x) => String(x).padStart(2, '0');
  return (d > 0 ? d + t('dd') + ' ' : '') + p2(Math.floor(s % 86400 / 3600)) + ':' + p2(Math.floor(s % 3600 / 60)) + ':' + p2(s % 60);
}
// Operation state: timer runs in transit, stops on delivered or returned.
function classify(p) {
  const txt = ((p.status || '') + ' ' + (p.statusEn || '')).toLowerCase();
  if (/върнат|върната|return|отказан|refus|reject/.test(txt)) return 'returned';
  if (p.deliveryTime || /достав|получена|получен|delivered/.test(txt)) return 'delivered';
  if (p.sendTime) return 'transit';
  return 'created';
}
function statusClass(p) { const st = classify(p); return st === 'returned' ? 's-red' : st === 'delivered' ? 's-green' : st === 'transit' ? 's-blue' : 's-gray'; }

const TICK = {}; let TIMER_INT = null;
function startTimers() { stopTimers(); TIMER_INT = setInterval(() => { const now = Date.now(); for (const num in TICK) { const c = $q(`.parcel[data-num="${num}"] [data-timer] .clk`); if (c) c.textContent = fmtDuration(now - TICK[num]); } }, 1000); }
function stopTimers() { if (TIMER_INT) { clearInterval(TIMER_INT); TIMER_INT = null; } }
function renderTimer(num, p) {
  const cell = $q(`.parcel[data-num="${num}"] [data-timer]`); if (!cell) return;
  const st = classify(p), sent = toMs(p.sendTime); delete TICK[num];
  if (st === 'delivered') { const dt = toMs(p.deliveryTime); cell.className = 'parcel-timer t-green'; cell.innerHTML = '✓ ' + t('delivered_ok') + (sent && dt ? ' <span class="clk">· ' + fmtDuration(dt - sent) + '</span>' : ''); }
  else if (st === 'returned') { const dt = toMs(p.deliveryTime) || Date.now(); cell.className = 'parcel-timer t-amber'; cell.innerHTML = '↩ ' + t('returned_ok') + (sent ? ' <span class="clk">· ' + fmtDuration(dt - sent) + '</span>' : ''); }
  else if (st === 'transit' && sent) { cell.className = 'parcel-timer t-blue'; cell.innerHTML = '⏱ ' + t('in_operation') + ' <span class="clk">' + fmtDuration(Date.now() - sent) + '</span>'; TICK[num] = sent; }
  else { cell.className = 'parcel-timer t-muted'; cell.textContent = '• ' + t('awaiting_dispatch'); }
}

function reviewLabel(mode) { return mode === 'review_test' ? t('review_test') : mode === 'review' ? t('review_only') : null; }
function detailRows(p, local) {
  const rows = []; const add = (k, v) => { if (v != null && v !== '') rows.push([k, v]); };
  add(t('d_status'), p.status);
  add(t('d_recipient'), p.recipient); add(t('d_phone'), p.recipientPhone);
  add(t('d_office'), p.office || p.receiverAddress); add(t('d_storage'), p.storageOffice);
  add(t('d_sender'), p.sender); add(t('d_sender_office'), p.senderOffice);
  add(t('d_type'), p.type); add(t('d_packs'), p.packCount);
  add(t('d_weight'), p.weight != null ? p.weight + ' ' + t('kg') : null); add(t('d_contents'), p.description);
  add(t('d_review'), reviewLabel(local && local.reviewMode));
  add(t('d_sent'), p.sendTime ? fmtDateTime(p.sendTime) : null);
  add(t('d_expected'), p.expectedDeliveryDate ? fmtDate(p.expectedDeliveryDate) : null);
  add(t('d_delivered'), p.deliveryTime ? fmtDateTime(p.deliveryTime) : null);
  add(t('d_attempts'), p.deliveryAttempts);
  add(t('d_cod'), p.cdCollected ? Number(p.cdCollected).toFixed(2) + ' ' + (p.cdCurrency || '') : null);
  add(t('d_price'), p.totalPrice != null ? Number(p.totalPrice).toFixed(2) + ' ' + (p.currency || '') : null);
  add(t('d_routing'), p.routingCode);
  return rows;
}
function parcelCardHTML(p) {
  return `<div class="parcel" data-num="${esc(p.number)}">
    <div class="parcel-top"><span class="parcel-num">${esc(p.number)}</span><span class="statusb sk" data-status>${t('loading')}</span></div>
    <div class="parcel-sub" data-sub>${esc(p.recipient || '')}${p.office ? ' · ' + esc(p.office) : ''}</div>
    <div class="parcel-timer t-muted" data-timer></div>
    <div class="parcel-row">
      <button data-copy>${t('copy')}</button>
      <a data-pdf hidden target="_blank"><button class="ghost">${t('reprint')}</button></a>
      <button class="ghost" data-toggle>${t('details')}</button>
    </div>
    <div class="details hide" data-details></div>
  </div>`;
}
function updateParcelCard(p) {
  const c = $q(`.parcel[data-num="${p.number}"]`); if (!c) return;
  const local = loadParcels().find((x) => x.number === p.number) || {};
  const s = c.querySelector('[data-status]');
  s.className = 'statusb ' + statusClass(p);
  s.textContent = p.error ? t('no_status') : (p.status || t('status_transit'));
  if (p.recipient || p.office) c.querySelector('[data-sub]').textContent = (p.recipient || '') + (p.office ? ' · ' + p.office : '');
  const pdf = p.pdfURL || local.pdfURL, a = c.querySelector('[data-pdf]');
  if (pdf) { a.href = pdf; a.hidden = false; } else { a.hidden = true; }
  renderTimer(p.number, p);
  const det = c.querySelector('[data-details]');
  let html = detailRows(p, local).map(([k, v]) => `<div class="drow"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
  if (p.events && p.events.length) html += '<div class="events">' + p.events.map((ev) => `<div class="event"><span class="dot"></span><span>${[fmtDate(ev.time), esc(ev.office), esc(ev.text)].filter(Boolean).join(' · ')}</span></div>`).join('') + '</div>';
  det.innerHTML = html || `<div class="muted">${t('no_status')}</div>`;
  const tg = c.querySelector('[data-toggle]');
  tg.onclick = () => { det.classList.toggle('hide'); tg.textContent = det.classList.contains('hide') ? t('details') : t('hide_details'); };
}
async function openParcels() {
  const list = loadParcels(), box = $('parcelList');
  if (!list.length) { box.innerHTML = `<div class="card muted" style="text-align:center">${t('parcels_empty')}</div>`; stopTimers(); return; }
  box.innerHTML = list.map(parcelCardHTML).join('');
  box.querySelectorAll('[data-copy]').forEach((b) => { const num = b.closest('.parcel').getAttribute('data-num'); b.onclick = () => { navigator.clipboard.writeText(num); toast(t('copied')); }; });
  await refreshParcels();
  startTimers();
}
async function refreshParcels() {
  const list = loadParcels();
  list.filter((p) => p.mode !== CONFIG.mode).forEach((p) => { const c = $q(`.parcel[data-num="${p.number}"] [data-status]`); if (c) { c.className = 'statusb s-gray'; c.textContent = t('other_env'); } });
  const nums = list.filter((p) => p.mode === CONFIG.mode).map((p) => p.number);
  if (!nums.length) return;
  const btn = $('refreshParcelsBtn'); btnBusy(btn, true);
  try {
    const r = await api('/api/track', { creds: creds(), shipmentNumbers: nums });
    if (!r.ok) { toast(r.error); return; }
    (r.parcels || []).forEach(updateParcelCard);
  } finally { btnBusy(btn, false); }
}
$('refreshParcelsBtn').onclick = refreshParcels;
$('trackNumBtn').onclick = () => {
  const v = ($('trackNumInput').value || '').replace(/\D/g, '');
  if (v.length < 8) { toast(t('invalid_number')); return; }
  if (loadParcels().some((p) => p.number === v)) { toast(t('already_added')); $('trackNumInput').value = ''; return; }
  addParcel({ number: v, recipient: '', office: '', createdAt: Date.now(), mode: CONFIG.mode, manual: true });
  $('trackNumInput').value = '';
  openParcels();
};

// ---------- landing / language / enter-key ----------
// ---------- theme (light / dark) ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = theme === 'dark' ? '#080c12' : '#0a4ea8';
}
function initTheme() {
  let th = localStorage.getItem('econt_theme');
  if (!th) th = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  applyTheme(th);
}
$('themeBtn').onclick = () => { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('econt_theme', next); applyTheme(next); };

$('langBg').onclick = () => setLang('bg');
$('langEn').onclick = () => setLang('en');
$('getStartedBtn').onclick = () => { if (SESSION.password) show('app'); else if (loadStore()) showLock(); else show('setup'); };
$('infoBtn').onclick = () => show('landing');
$('brandHome').onclick = (e) => { e.preventDefault(); show('landing'); };
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (el && el.id === 'msg') { if (e.ctrlKey || e.metaKey) { e.preventDefault(); $('parseBtn').click(); } return; }
  if (el && el.tagName === 'INPUT' && el.dataset.enter) { e.preventDefault(); const b = $(el.dataset.enter); if (b && !b.disabled) b.click(); }
});

// ---------- boot ----------
applyLang();
initTheme();
if (!('crypto' in window) || !crypto.subtle) {
  document.body.innerHTML = '<div style="padding:24px">This app needs a secure connection (https) to encrypt your PIN. Open it via the https link or http://localhost.</div>';
} else if (loadStore()) { showLock(); } else { show('landing'); }

// ---------- 3D pointer tilt on showcase cards (desktop, fine pointer only) ----------
(function initTilt() {
  if (!window.matchMedia) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let active = null;
  const reset = () => { if (active) { active.style.transform = ''; active = null; } };
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest ? e.target.closest('.tilt') : null;
    if (active && active !== card) reset();
    if (!card || card.classList.contains('hide')) return;
    active = card;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const m = 5;
    card.style.transform = `perspective(1000px) rotateY(${(x * m).toFixed(2)}deg) rotateX(${(-y * m).toFixed(2)}deg) translateY(-4px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', reset, true);
  window.addEventListener('blur', reset);
})();
