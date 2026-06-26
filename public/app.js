'use strict';

const $ = (id) => document.getElementById(id);
const KEY = 'econt_shipper_v1';

// In-memory only — never persisted in plaintext.
const SESSION = { password: null, pin: null };
// Persisted (minus password, which is stored encrypted): mode, username, sender, defaults.
let CONFIG = { mode: 'production', username: '', sender: {}, defaults: {} };

// ---------- crypto (PIN-encrypt the Econt password at rest) ----------
const tenc = new TextEncoder(), tdec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', tenc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptSecret(plain, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
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
  saveStore({
    v: 1, mode: CONFIG.mode, username: CONFIG.username,
    enc: await encryptSecret(SESSION.password, SESSION.pin),
    sender: CONFIG.sender, defaults: CONFIG.defaults,
  });
}

// ---------- views ----------
function show(view) {
  for (const v of ['setup', 'lock', 'app']) $('view-' + v).classList.toggle('hide', v !== view);
}
const creds = () => ({ mode: CONFIG.mode, username: CONFIG.username, password: SESSION.password });
const api = async (path, body) => (await fetch(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
})).json();

function officeLabel(c) {
  return `${c.name} — ${c.address}${c.city ? ', ' + c.city : ''}${c.postCode ? ' (' + c.postCode + ')' : ''}`;
}
async function fillOfficeSelect(sel, q, credsObj) {
  sel.classList.remove('hide');
  sel.innerHTML = '<option>searching…</option>';
  const r = await api('/api/offices', { creds: credsObj, q });
  if (!r.ok) { sel.innerHTML = `<option value="">${r.error}</option>`; return; }
  sel.innerHTML = '';
  for (const c of (r.candidates || [])) {
    const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o);
  }
  if (!sel.options.length) sel.innerHTML = '<option value="">no matches</option>';
}

// ===================== SETUP WIZARD =====================
let wizardTested = false;
function wizardCreds() { return { mode: $('suMode').value, username: $('suUser').value.trim(), password: $('suPass').value }; }

$('suTestBtn').onclick = async () => {
  const c = wizardCreds();
  if (!c.username || !c.password) { $('suTestMsg').textContent = 'Enter username and password first.'; return; }
  $('suTestMsg').textContent = 'Testing…';
  const r = await api('/api/test', { creds: c });
  if (r.ok) { wizardTested = true; $('suTestMsg').className = 'good'; $('suTestMsg').textContent = `✓ Login works — ${r.officeCount} ${r.mode} offices available.`; $('suFinishBtn').disabled = false; }
  else { wizardTested = false; $('suTestMsg').className = 'err'; $('suTestMsg').textContent = '✗ ' + r.error; $('suFinishBtn').disabled = true; }
};
for (const id of ['suUser', 'suPass', 'suMode']) $(id).addEventListener('input', () => { wizardTested = false; $('suFinishBtn').disabled = true; });

$('suSenderSearchBtn').onclick = () => fillOfficeSelect($('suSenderOffice'), $('suSenderOfficeSearch').value, wizardCreds());

$('suFinishBtn').onclick = async () => {
  const pin = $('suPin').value, pin2 = $('suPin2').value;
  const e = $('suFinishMsg');
  if (pin.length < 4) { e.textContent = 'PIN must be at least 4 digits.'; return; }
  if (pin !== pin2) { e.textContent = 'PINs do not match.'; return; }
  if (!wizardTested) { e.textContent = 'Test your Econt login first (step 2).'; return; }
  const office = $('suSenderOffice').value;
  if (!$('suSenderName').value.trim() || !$('suSenderPhone').value.trim() || !office) { e.textContent = 'Fill your name, phone and pick your drop-off office (step 3).'; return; }

  const c = wizardCreds();
  SESSION.password = c.password; SESSION.pin = pin;
  CONFIG = {
    mode: c.mode, username: c.username,
    sender: { name: $('suSenderName').value.trim(), phone: $('suSenderPhone').value.trim(), officeCode: office, address: null },
    defaults: {
      shipmentType: 'pack', packCount: 1,
      weight: Number($('suWeight').value) || 1, shipmentDescription: $('suDesc').value.trim(),
      payer: $('suPayer').value, payAfterAccept: false, payAfterTest: false,
      cod: { enabled: $('suCod').checked, amount: 0, currency: $('suCur').value }, countryCode: 'BGR',
    },
  };
  await persist();
  enterApp();
};

// ===================== LOCK =====================
function showLock() { show('lock'); $('lockMsg').textContent = ''; $('lockPin').value = ''; setTimeout(() => $('lockPin').focus(), 50); }
$('lockBtn').onclick = unlock;
$('lockPin').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') unlock(); });
async function unlock() {
  const store = loadStore();
  if (!store) return show('setup');
  try {
    SESSION.password = await decryptSecret(store.enc, $('lockPin').value);
    SESSION.pin = $('lockPin').value;
    CONFIG = { mode: store.mode, username: store.username, sender: store.sender, defaults: store.defaults };
    enterApp();
  } catch { $('lockMsg').textContent = 'Wrong PIN.'; }
}
$('forgetBtn').onclick = () => {
  if (confirm('Remove your saved Econt login and settings from this device?')) { localStorage.removeItem(KEY); location.reload(); }
};
$('lockNowBtn').onclick = () => { SESSION.password = null; SESSION.pin = null; showLock(); };

// ===================== APP =====================
function enterApp() {
  const badge = $('modeBadge');
  badge.textContent = CONFIG.mode.toUpperCase();
  badge.className = 'badge ' + CONFIG.mode;
  // populate settings form
  $('cfgMode').value = CONFIG.mode;
  $('cfgUser').value = CONFIG.username || '';
  $('cfgPass').value = '';
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
  $('cfgMsg').textContent = 'Testing…';
  const r = await api('/api/test', { creds: c });
  $('cfgMsg').textContent = r.ok ? `✓ ${r.officeCount} ${r.mode} offices` : ('✗ ' + r.error);
};
$('cfgSenderSearchBtn').onclick = () => {
  const c = { mode: $('cfgMode').value, username: $('cfgUser').value.trim(), password: $('cfgPass').value || SESSION.password };
  fillOfficeSelect($('cfgSenderOfficeSel'), $('cfgSenderSearch').value, c);
};
$('cfgSenderOfficeSel').onchange = () => { $('cfgSenderOffice').value = $('cfgSenderOfficeSel').value; };
$('refreshOfficesBtn').onclick = async () => {
  $('cfgMsg').textContent = 'Refreshing…';
  const r = await api('/api/offices/refresh', { creds: creds() });
  $('cfgMsg').textContent = r.ok ? `Loaded ${r.count} offices ✓` : ('Error: ' + r.error);
};
$('saveCfgBtn').onclick = async () => {
  CONFIG.mode = $('cfgMode').value;
  CONFIG.username = $('cfgUser').value.trim();
  if ($('cfgPass').value) SESSION.password = $('cfgPass').value;
  CONFIG.sender = { name: $('cfgSenderName').value.trim(), phone: $('cfgSenderPhone').value.trim(), officeCode: $('cfgSenderOffice').value.trim(), address: CONFIG.sender.address || null };
  CONFIG.defaults = Object.assign({}, CONFIG.defaults, {
    weight: Number($('cfgWeight').value) || 1, shipmentDescription: $('cfgDesc').value.trim(),
    payer: $('cfgPayer').value, cod: Object.assign({}, CONFIG.defaults.cod, { enabled: $('cfgCodOn').checked, currency: $('cfgCur').value }),
  });
  await persist();
  enterApp();
  $('cfgMsg').textContent = 'Saved ✓';
};

// ---------- parse / preview / create ----------
let CANDIDATES = [];
async function doParse() {
  $('parseErr').textContent = '';
  const text = $('msg').value.trim();
  if (!text) { $('parseErr').textContent = 'Paste a message first.'; return; }
  $('parseBtn').disabled = true;
  try {
    const r = await api('/api/parse', { text, creds: creds() });
    if (!r.ok) { $('parseErr').textContent = r.error || 'Parse failed'; return; }
    const p = r.parsed;
    $('pName').value = p.recipientName || '';
    $('pPhone').value = p.phone || '';
    CANDIDATES = r.candidates || [];
    const sel = $('pOffice'); sel.innerHTML = '';
    if (r.officesError) sel.innerHTML = `<option value="">⚠ office list error: ${r.officesError}</option>`;
    else if (!CANDIDATES.length) sel.innerHTML = `<option value="">no office matched “${p.locationText}” — search below</option>`;
    else for (const c of CANDIDATES) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }

    $('officeHint').innerHTML = CONFIG.mode === 'demo'
      ? '⚠ DEMO office list (~585) — switch to Production in ⚙ for all offices.' : '';

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
  return {
    recipientName: $('pName').value.trim(), phone: $('pPhone').value.trim(), officeCode: $('pOffice').value,
    weight: Number($('pWeight').value) || undefined, description: $('pDesc').value.trim(), payer: $('pPayer').value,
    cod: { enabled: $('pCodOn').checked, amount: Number($('pCodAmount').value) || 0, currency: $('pCodCur').value },
  };
}
function shipBody(overrides) { return { creds: creds(), sender: CONFIG.sender, defaults: CONFIG.defaults, overrides }; }

function showPrice(resp) {
  const st = resp.label || resp;
  const total = st.totalPrice;
  const cur = st.totalPriceCurrency || st.currency || $('pCodCur').value || 'EUR';
  return total != null ? `Estimated price: <span class="price">${Number(total).toFixed(2)} ${cur}</span>` : 'Validated ✓';
}
async function doPreview() {
  $('previewErr').textContent = ''; $('priceBox').textContent = 'Getting price…';
  const o = gatherOverrides();
  if (!o.officeCode) { $('priceBox').textContent = ''; $('previewErr').textContent = 'Pick an office first.'; return; }
  const r = await api('/api/preview', shipBody(o));
  if (!r.ok) { $('priceBox').textContent = ''; $('previewErr').textContent = 'Econt: ' + r.error; return; }
  $('priceBox').innerHTML = showPrice(r.response);
}
async function doCreate() {
  $('previewErr').textContent = '';
  const o = gatherOverrides();
  if (!o.recipientName || !o.phone || !o.officeCode) { $('previewErr').textContent = 'Need recipient name, phone and an office.'; return; }
  if (o.cod.enabled && !(o.cod.amount > 0)) { $('previewErr').textContent = 'COD is on but amount is empty — enter the amount or uncheck COD.'; return; }
  $('createBtn').disabled = true; $('createBtn').textContent = 'Creating…';
  try {
    const r = await api('/api/create', shipBody(o));
    if (!r.ok) { $('previewErr').textContent = 'Econt: ' + r.error; return; }
    const st = r.response.label || r.response;
    $('shipNum').textContent = st.shipmentNumber || '(no number returned)';
    const pdf = st.pdfURL;
    if (pdf) { $('pdfLink').href = pdf; $('pdfLink').style.display = ''; } else { $('pdfLink').style.display = 'none'; }
    $('resultMeta').textContent = st.totalPrice != null ? `Price: ${Number(st.totalPrice).toFixed(2)} ${st.totalPriceCurrency || $('pCodCur').value || 'EUR'}` : '';
    $('preview').classList.add('hide'); $('result').classList.remove('hide');
    $('result').scrollIntoView({ behavior: 'smooth' });
  } finally { $('createBtn').disabled = false; $('createBtn').textContent = '✓ Create shipment number'; }
}

$('clearBtn').onclick = () => { $('msg').value = ''; $('preview').classList.add('hide'); $('result').classList.add('hide'); };
$('parseBtn').onclick = doParse;
$('recalcBtn').onclick = doPreview;
$('createBtn').onclick = doCreate;
$('officeSearchBtn').onclick = async () => { await fillOfficeSelect($('pOffice'), $('officeSearch').value, creds()); doPreview(); };
$('pOffice').onchange = doPreview;
$('copyBtn').onclick = () => navigator.clipboard.writeText($('shipNum').textContent);
$('newBtn').onclick = () => { $('msg').value = ''; $('result').classList.add('hide'); $('preview').classList.add('hide'); $('msg').focus(); };

// ---------- boot ----------
if (!('crypto' in window) || !crypto.subtle) {
  document.body.innerHTML = '<div style="padding:24px;color:#fff">This app needs a secure connection (https) to encrypt your PIN. Open it via the https link or http://localhost.</div>';
} else {
  show(loadStore() ? 'lock' : 'setup');
  if (loadStore()) showLock();
}
