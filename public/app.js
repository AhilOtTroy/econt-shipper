'use strict';

const $ = (id) => document.getElementById(id);
const KEY = 'econt_shipper_v1';

// ===================== i18n =====================
const I18N = {
  bg: {
    land_pill: 'За подателите в Еконт',
    land_title: 'Поставете съобщение. Получавате товарителница.',
    land_sub: 'Превърнете съобщението на клиента в готов номер на пратка в Еконт — за секунди, с вашите обичайни настройки.',
    land_cta: 'Започнете',
    land_what_h: 'Какво е това?',
    land_what_p: 'Малък помощник за подателите в Еконт. Поставяте съобщението с офис/адрес, което клиентът ви праща, проверявате данните и приложението създава товарителницата във вашия Еконт профил. Данните ви за вход остават на вашето устройство, защитени с PIN.',
    land_f1: 'Автоматично разпознава офис, име и телефон от текста',
    land_f2: 'Преглед на цената преди да потвърдите — нищо не се създава по погрешка',
    land_f3: 'Работи на телефона ви като приложение',
    land_f4: 'Евро или лева, наложен платеж, вашите настройки по подразбиране',
    setup_title: 'Настройка на вашия Еконт помощник',
    setup_sub: 'Еднократна настройка. Всичко, което въведете, остава на това устройство, заключено с PIN. Нищо не се пази на сървър.',
    setup_s1: 'Изберете PIN', setup_s1_sub: 'Заключва приложението и криптира паролата ви за Еконт на това устройство.',
    setup_pin: 'PIN (4+ цифри)', setup_pin2: 'Повторете PIN',
    setup_s2: 'Вашият Еконт акаунт', setup_mode: 'Режим', mode_prod: 'Реален', mode_demo: 'Демо',
    setup_user: 'Потребителско име в Еконт (точно, с главни/малки букви)', setup_pass: 'Парола за Еконт', setup_test: 'Проверка на входа',
    setup_s3: 'Вие (подателят)', setup_yourname: 'Вашето име', setup_yourphone: 'Вашият телефон', setup_youroffice: 'Вашият офис за подаване',
    setup_search_office: 'търсене по град / име на офис…', find: 'Намери',
    setup_s4: 'Вашите обичайни настройки', weight: 'Тегло (кг)', contents: 'Съдържание', who_pays: 'Кой плаща',
    receiver_pays: 'Получателят плаща', i_pay: 'Аз плащам', setup_cod: 'Обикновено с наложен платеж (сумата въвеждате за всяка пратка)',
    cod_currency: 'Валута на наложен платеж', setup_finish: 'Завършете настройката →',
    lock_title: 'Въведете PIN', unlock: 'Отключи', forget: 'Изтрий от това устройство и започни наново',
    app_h: 'Нова товарителница', set_account: 'Еконт акаунт', username: 'Потребител', pass_keep: 'Парола (празно = без промяна)',
    set_sender: 'Подател', name: 'Име', phone: 'Телефон', set_office_code: 'Код на вашия офис за подаване', search: 'търсене…',
    set_defaults: 'Настройки по подразбиране', receiver: 'Получател', sender: 'Подател', set_cod_default: 'Наложен платеж по подразбиране',
    refresh_offices: 'Обнови офисите', save: 'Запази',
    paste_label: 'Поставете съобщението на клиента', paste_ph: 'Моля да ги изпратите в Офис на еконт: …  Име – 08xx xxx xxx',
    clear: 'Изчисти', preview: 'Преглед →',
    prev_h: 'Проверете и потвърдете', recipient: 'Име на получателя', deliver_office: 'Доставка до офис',
    wrong_office: 'грешен офис? търсене по име/град…', search_btn: 'Търси', description: 'Описание', pays: 'Плаща',
    cod: 'Нал. платеж', amount: 'сума', recalc: 'Преизчисли', create_btn: '✓ Създай товарителница',
    res_h: '✅ Товарителницата е създадена', copy: 'Копирай номера', label_pdf: '🖨 Етикет PDF', new: '+ Нова',
    // dynamic
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
    land_pill: 'For Econt senders',
    land_title: 'Paste a message. Get an Econt label.',
    land_sub: "Turn a customer's chat message into a ready Econt shipment number — in seconds, with your usual settings.",
    land_cta: 'Get started',
    land_what_h: 'What is this?',
    land_what_p: 'A tiny helper for Econt senders. Paste the office/address message your customer sends you, check the details, and it creates the shipment label (товарителница) in your Econt account. Your login stays on your device, locked by a PIN.',
    land_f1: 'Recognizes the office, name and phone from the text automatically',
    land_f2: 'Preview the price before you confirm — nothing is created by mistake',
    land_f3: 'Works on your phone like an app',
    land_f4: 'Euro or leva, cash-on-delivery, your default settings',
    setup_title: 'Set up your Econt helper',
    setup_sub: 'One-time setup. Everything you enter stays on this device, locked by a PIN. Nothing is stored on a server.',
    setup_s1: 'Choose a PIN', setup_s1_sub: 'Locks the app and encrypts your Econt password on this device.',
    setup_pin: 'PIN (4+ digits)', setup_pin2: 'Repeat PIN',
    setup_s2: 'Your Econt account', setup_mode: 'Mode', mode_prod: 'Production', mode_demo: 'Demo',
    setup_user: 'Econt username (exact, case-sensitive)', setup_pass: 'Econt password', setup_test: 'Test login',
    setup_s3: 'You (the sender)', setup_yourname: 'Your name', setup_yourphone: 'Your phone', setup_youroffice: 'Your drop-off office',
    setup_search_office: 'search by city / office name…', find: 'Find',
    setup_s4: 'Your usual options', weight: 'Weight (kg)', contents: 'Contents', who_pays: 'Who pays',
    receiver_pays: 'Receiver pays', i_pay: 'I pay', setup_cod: 'Usually cash-on-delivery (you type the amount per parcel)',
    cod_currency: 'COD currency', setup_finish: 'Finish setup →',
    lock_title: 'Enter PIN', unlock: 'Unlock', forget: 'Forget this device & start over',
    app_h: 'New shipment', set_account: 'Econt account', username: 'Username', pass_keep: 'Password (blank = keep)',
    set_sender: 'Sender', name: 'Name', phone: 'Phone', set_office_code: 'Your drop-off office code', search: 'search…',
    set_defaults: 'Default options', receiver: 'Receiver', sender: 'Sender', set_cod_default: 'COD on by default',
    refresh_offices: 'Refresh offices', save: 'Save',
    paste_label: "Paste the customer's message", paste_ph: 'Моля да ги изпратите в Офис на еконт: …  Name – 08xx xxx xxx',
    clear: 'Clear', preview: 'Preview →',
    prev_h: 'Check & confirm', recipient: 'Recipient name', deliver_office: 'Deliver to office',
    wrong_office: 'wrong office? search by name/city…', search_btn: 'Search', description: 'Description', pays: 'Pays',
    cod: 'COD', amount: 'amount', recalc: 'Recalculate', create_btn: '✓ Create shipment number',
    res_h: '✅ Shipment created', copy: 'Copy number', label_pdf: '🖨 Label PDF', new: '+ New',
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
let LANG = localStorage.getItem('econt_lang') || 'bg';
function t(key, params) {
  let s = (I18N[LANG] && I18N[LANG][key]);
  if (s == null) s = (I18N.en[key] != null ? I18N.en[key] : key);
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (I18N[LANG][k] != null) el.textContent = I18N[LANG][k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const k = el.getAttribute('data-i18n-ph'); if (I18N[LANG][k] != null) el.placeholder = I18N[LANG][k]; });
  $('langBg').classList.toggle('active', LANG === 'bg');
  $('langEn').classList.toggle('active', LANG === 'en');
}
function setLang(l) { LANG = l; localStorage.setItem('econt_lang', l); applyLang(); }

// ===================== state =====================
const SESSION = { password: null, pin: null };
let CONFIG = { mode: 'production', username: '', sender: {}, defaults: {} };

// ---------- crypto ----------
const tenc = new TextEncoder(), tdec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', tenc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
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
async function persist() {
  saveStore({ v: 1, mode: CONFIG.mode, username: CONFIG.username, enc: await encryptSecret(SESSION.password, SESSION.pin), sender: CONFIG.sender, defaults: CONFIG.defaults });
}

// ---------- views ----------
function show(view) { for (const v of ['landing', 'setup', 'lock', 'app']) $('view-' + v).classList.toggle('hide', v !== view); }
const creds = () => ({ mode: CONFIG.mode, username: CONFIG.username, password: SESSION.password });
const api = async (path, body) => (await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();

function officeLabel(c) { return `${c.name} — ${c.address}${c.city ? ', ' + c.city : ''}${c.postCode ? ' (' + c.postCode + ')' : ''}`; }
async function fillOfficeSelect(sel, q, credsObj) {
  sel.classList.remove('hide'); sel.innerHTML = `<option>${t('searching')}</option>`;
  const r = await api('/api/offices', { creds: credsObj, q });
  if (!r.ok) { sel.innerHTML = `<option value="">${r.error}</option>`; return; }
  sel.innerHTML = '';
  for (const c of (r.candidates || [])) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }
  if (!sel.options.length) sel.innerHTML = `<option value="">${t('no_matches')}</option>`;
}

// ===================== WIZARD =====================
let wizardTested = false;
const wizardCreds = () => ({ mode: $('suMode').value, username: $('suUser').value.trim(), password: $('suPass').value });
$('suTestBtn').onclick = async () => {
  const c = wizardCreds();
  if (!c.username || !c.password) { $('suTestMsg').textContent = t('need_creds'); return; }
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
$('lockBtn').onclick = unlock;
$('lockPin').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') unlock(); });
async function unlock() {
  const store = loadStore(); if (!store) return show('landing');
  try {
    SESSION.password = await decryptSecret(store.enc, $('lockPin').value); SESSION.pin = $('lockPin').value;
    CONFIG = { mode: store.mode, username: store.username, sender: store.sender, defaults: store.defaults };
    enterApp();
  } catch { $('lockMsg').textContent = t('wrong_pin'); }
}
$('forgetBtn').onclick = () => { if (confirm(t('forget_confirm'))) { localStorage.removeItem(KEY); location.reload(); } };
$('lockNowBtn').onclick = () => { SESSION.password = null; SESSION.pin = null; showLock(); };

// ===================== APP =====================
function enterApp() {
  const badge = $('modeBadge'); badge.textContent = CONFIG.mode.toUpperCase(); badge.className = 'badge ' + CONFIG.mode;
  $('cfgMode').value = CONFIG.mode; $('cfgUser').value = CONFIG.username || ''; $('cfgPass').value = '';
  const s = CONFIG.sender, d = CONFIG.defaults;
  $('cfgSenderName').value = s.name || ''; $('cfgSenderPhone').value = s.phone || ''; $('cfgSenderOffice').value = s.officeCode || '';
  $('cfgWeight').value = d.weight ?? 1; $('cfgDesc').value = d.shipmentDescription || '';
  $('cfgPayer').value = d.payer || 'receiver'; $('cfgCodOn').checked = !!(d.cod && d.cod.enabled);
  $('cfgCur').value = (d.cod && d.cod.currency) || 'EUR';
  show('app');
}
$('settingsBtn').onclick = () => $('settings').classList.toggle('hide');
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
$('refreshOfficesBtn').onclick = async () => {
  $('cfgMsg').textContent = t('refreshing');
  const r = await api('/api/offices/refresh', { creds: creds() });
  $('cfgMsg').textContent = r.ok ? t('offices_loaded', { n: r.count }) : (t('error_prefix') + r.error);
};
$('saveCfgBtn').onclick = async () => {
  CONFIG.mode = $('cfgMode').value; CONFIG.username = $('cfgUser').value.trim();
  if ($('cfgPass').value) SESSION.password = $('cfgPass').value;
  CONFIG.sender = { name: $('cfgSenderName').value.trim(), phone: $('cfgSenderPhone').value.trim(), officeCode: $('cfgSenderOffice').value.trim(), address: CONFIG.sender.address || null };
  CONFIG.defaults = Object.assign({}, CONFIG.defaults, { weight: Number($('cfgWeight').value) || 1, shipmentDescription: $('cfgDesc').value.trim(), payer: $('cfgPayer').value, cod: Object.assign({}, CONFIG.defaults.cod, { enabled: $('cfgCodOn').checked, currency: $('cfgCur').value }) });
  await persist(); enterApp(); $('cfgMsg').textContent = t('saved');
};

// ---------- parse / preview / create ----------
let CANDIDATES = [];
async function doParse() {
  $('parseErr').textContent = '';
  const text = $('msg').value.trim();
  if (!text) { $('parseErr').textContent = t('paste_first'); return; }
  $('parseBtn').disabled = true;
  try {
    const r = await api('/api/parse', { text, creds: creds() });
    if (!r.ok) { $('parseErr').textContent = r.error || 'Parse failed'; return; }
    const p = r.parsed;
    $('pName').value = p.recipientName || ''; $('pPhone').value = p.phone || '';
    CANDIDATES = r.candidates || [];
    const sel = $('pOffice'); sel.innerHTML = '';
    if (r.officesError) sel.innerHTML = `<option value="">${t('office_err', { err: r.officesError })}</option>`;
    else if (!CANDIDATES.length) sel.innerHTML = `<option value="">${t('no_match', { q: p.locationText })}</option>`;
    else for (const c of CANDIDATES) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }
    $('officeHint').innerHTML = CONFIG.mode === 'demo' ? t('demo_hint') : '';
    const d = CONFIG.defaults;
    $('pWeight').value = d.weight ?? 1; $('pDesc').value = d.shipmentDescription || '';
    $('pPayer').value = d.payer || 'receiver';
    $('pCodOn').checked = !!(d.cod && d.cod.enabled); $('pCodAmount').value = (d.cod && d.cod.amount) || '';
    $('pCodCur').value = (d.cod && d.cod.currency) || 'EUR';
    $('preview').classList.remove('hide'); $('result').classList.add('hide');
    $('preview').scrollIntoView({ behavior: 'smooth' });
    doPreview();
  } finally { $('parseBtn').disabled = false; }
}
function gatherOverrides() {
  return { recipientName: $('pName').value.trim(), phone: $('pPhone').value.trim(), officeCode: $('pOffice').value, weight: Number($('pWeight').value) || undefined, description: $('pDesc').value.trim(), payer: $('pPayer').value, cod: { enabled: $('pCodOn').checked, amount: Number($('pCodAmount').value) || 0, currency: $('pCodCur').value } };
}
const shipBody = (overrides) => ({ creds: creds(), sender: CONFIG.sender, defaults: CONFIG.defaults, overrides });
function showPrice(resp) {
  const st = resp.label || resp, total = st.totalPrice;
  const cur = st.totalPriceCurrency || st.currency || $('pCodCur').value || 'EUR';
  return total != null ? t('est_price', { v: Number(total).toFixed(2), cur }) : t('validated');
}
async function doPreview() {
  $('previewErr').textContent = ''; $('priceBox').textContent = t('getting_price');
  const o = gatherOverrides();
  if (!o.officeCode) { $('priceBox').textContent = ''; $('previewErr').textContent = t('pick_office'); return; }
  const r = await api('/api/preview', shipBody(o));
  if (!r.ok) { $('priceBox').textContent = ''; $('previewErr').textContent = t('econt_prefix') + r.error; return; }
  $('priceBox').innerHTML = showPrice(r.response);
}
async function doCreate() {
  $('previewErr').textContent = '';
  const o = gatherOverrides();
  if (!o.recipientName || !o.phone || !o.officeCode) { $('previewErr').textContent = t('need_recip'); return; }
  if (o.cod.enabled && !(o.cod.amount > 0)) { $('previewErr').textContent = t('cod_blank'); return; }
  $('createBtn').disabled = true; $('createBtn').textContent = t('creating');
  try {
    const r = await api('/api/create', shipBody(o));
    if (!r.ok) { $('previewErr').textContent = t('econt_prefix') + r.error; return; }
    const st = r.response.label || r.response;
    $('shipNum').textContent = st.shipmentNumber || t('no_number');
    const pdf = st.pdfURL;
    if (pdf) { $('pdfLink').href = pdf; $('pdfLink').style.display = ''; } else { $('pdfLink').style.display = 'none'; }
    $('resultMeta').textContent = st.totalPrice != null ? t('price_label', { v: Number(st.totalPrice).toFixed(2), cur: st.totalPriceCurrency || $('pCodCur').value || 'EUR' }) : '';
    $('preview').classList.add('hide'); $('result').classList.remove('hide'); $('result').scrollIntoView({ behavior: 'smooth' });
  } finally { $('createBtn').disabled = false; $('createBtn').textContent = t('create_btn'); }
}
$('clearBtn').onclick = () => { $('msg').value = ''; $('preview').classList.add('hide'); $('result').classList.add('hide'); };
$('parseBtn').onclick = doParse;
$('recalcBtn').onclick = doPreview;
$('createBtn').onclick = doCreate;
$('officeSearchBtn').onclick = async () => { await fillOfficeSelect($('pOffice'), $('officeSearch').value, creds()); doPreview(); };
$('pOffice').onchange = doPreview;
$('copyBtn').onclick = () => navigator.clipboard.writeText($('shipNum').textContent);
$('newBtn').onclick = () => { $('msg').value = ''; $('result').classList.add('hide'); $('preview').classList.add('hide'); $('msg').focus(); };

// ---------- landing / language ----------
$('langBg').onclick = () => setLang('bg');
$('langEn').onclick = () => setLang('en');
$('getStartedBtn').onclick = () => { if (SESSION.password) show('app'); else if (loadStore()) showLock(); else show('setup'); };
$('infoBtn').onclick = () => show('landing');

// ---------- boot ----------
applyLang();
if (!('crypto' in window) || !crypto.subtle) {
  document.body.innerHTML = '<div style="padding:24px">This app needs a secure connection (https) to encrypt your PIN. Open it via the https link or http://localhost.</div>';
} else if (loadStore()) {
  showLock();
} else {
  show('landing');
}
