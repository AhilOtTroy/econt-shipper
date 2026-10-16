const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:5099/';
const fault = (o) => fs.writeFileSync(__dirname + '/fault.json', JSON.stringify(o));
const R = []; const ok = (n, c, x) => R.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : ''));
const state = async (p) => (await p.request.get(BASE + '__state')).json();
async function fresh(b, codDefault, lang) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  if (lang) await p.addInitScript((l) => localStorage.setItem('econt_lang', l), lang);
  await p.goto(BASE); await p.waitForTimeout(300);
  await p.evaluate(async (cod) => {
    SESSION.password = 'pw'; SESSION.pin = '1234';
    CONFIG = { mode: 'production', username: 'u', sender: { name: 'Иван', phone: '0878916695', officeCode: '1111' },
      defaults: { weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: cod, currency: 'EUR' } } };
    await persist(); enterApp();
  }, codDefault);
  return p;
}
const parse = async (p, text) => { await p.fill('#msg', text); await p.click('#parseBtn'); };
(async () => {
  const b = await chromium.launch();
  // A. Editor frozen during create wait; paste blocked; summary from sent data.
  { const p = await fresh(b, false);
    await parse(p, 'Мария Петрова 0888100001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(600);
    await p.evaluate(() => { LAST_OK = 0; });
    fault({ '/api/ping': { n: 2 } });
    await p.click('#createBtn'); await p.waitForTimeout(300);
    ok('A editor inert during wake', await p.evaluate(() => $('preview').inert === true));
    const applied = await p.evaluate(async () => { $('msg').value = 'Георги Иванов 0899100002 Варна офис Чайка'; return doParse(); });
    ok('A parse blocked during create', applied === false);
    await p.waitForSelector('#result:not(.hide)', { timeout: 20000 });
    ok('A summary is the sent customer', (await p.textContent('#resultSummary')).includes('Мария'), await p.textContent('#resultSummary'));
    ok('A editor unfrozen after', await p.evaluate(() => $('preview').inert === false));
    fault({}); ok('A no errors', p.errs.length === 0, p.errs.join('|')); await p.context().close(); }
  // B. Batch: paste during wake must not swap the batch.
  { const p = await fresh(b, false);
    await parse(p, 'Петър Колев 0888200001 Варна офис Чайка 10\n\nАна Димитрова 0899200002 Пловдив офис Център 20');
    await p.waitForSelector('#batch:not(.hide)');
    await p.evaluate(() => { LAST_OK = 0; }); fault({ '/api/ping': { n: 2 } });
    const s0 = await state(p);
    await p.click('#batchCreateBtn'); await p.waitForTimeout(300);
    const swapped = await p.evaluate(async () => { $('msg').value = 'Х Y 0877200003 Варна офис Чайка 5\n\nZ W 0877200004 Варна офис Чайка 6\n\nQ R 0877200005 Варна офис Чайка 7'; return doParse(); });
    ok('B parse blocked during batch wake', swapped === false);
    await p.waitForFunction(() => !$('batchCreateBtn').hasAttribute('aria-busy'), null, { timeout: 25000 });
    const s1 = await state(p);
    const phones = (s1.createdLabels || []).slice((s0.createdLabels || []).length).map((x) => x.phone);
    ok('B created the confirmed batch only', phones.length === 2 && phones.every((x) => /08882|08992/.test(x)), phones.join(','));
    fault({}); await p.context().close(); }
  // C. Batch no-COD consent is scoped to the named rows and one run.
  { const p = await fresh(b, true);
    await parse(p, 'Мира А 0888300001 Варна офис Чайка\n\nНели Б 0899300002 Пловдив офис Център 40\n\nОля В 0877300003 Варна офис Чайка');
    await p.waitForSelector('#batch:not(.hide)');
    await p.uncheck('.brow[data-i="2"] [data-f="on"]');
    await p.click('#batchCreateBtn'); await p.waitForTimeout(150);
    ok('C prompt names #1 only', (await p.textContent('#batchNoCodMsg')).includes('#1') && !(await p.textContent('#batchNoCodMsg')).includes('#3'), await p.textContent('#batchNoCodMsg'));
    ok('C focus on safe button', await p.evaluate(() => document.activeElement.id === 'batchNoCodFix'));
    await p.click('#batchNoCodGo');
    await p.waitForFunction(() => !$('batchCreateBtn').hasAttribute('aria-busy'), null, { timeout: 10000 });
    await p.check('.brow[data-i="2"] [data-f="on"]'); await p.waitForTimeout(100);
    ok('C re-ticked row shows no-COD', (await p.textContent('.brow[data-i="2"] [data-status]')).includes('без наложен'), await p.textContent('.brow[data-i="2"] [data-status]'));
    const s0 = await state(p);
    await p.click('#batchCreateBtn'); await p.waitForTimeout(300);
    ok('C asks again for #3', await p.isVisible('#batchNoCodConfirm') && (await p.textContent('#batchNoCodMsg')).includes('#3'));
    ok('C nothing created without consent', (await state(p)).creates === s0.creates);
    await p.context().close(); }
  // D. Ctrl+Enter on the Parcels tab never creates.
  { const p = await fresh(b, false);
    await parse(p, 'Мария Петрова 0888400001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.click('#navParcels'); await p.waitForTimeout(300);
    const s0 = await state(p);
    await p.fill('#trackNumInput', '1234567890999'); await p.press('#trackNumInput', 'Control+Enter'); await p.waitForTimeout(500);
    ok('D no create from parcels tab', (await state(p)).creates === s0.creates);
    await p.context().close(); }
  // E. Duplicate: double-click and key repeat do not confirm.
  { const p = await fresh(b, false);
    await parse(p, 'Мария Петрова 0888500001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
    await p.click('#newBtn'); await parse(p, 'Мария Петрова 0888500001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    const s0 = await state(p);
    await p.dblclick('#createBtn'); await p.waitForTimeout(400);
    ok('E dblclick does not create a duplicate', (await state(p)).creates === s0.creates);
    await p.focus('#pName'); await p.keyboard.down('Control'); await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.up('Enter'); await p.keyboard.up('Control');
    await p.waitForTimeout(400);
    ok('E held Ctrl+Enter does not create', (await state(p)).creates === s0.creates);
    await p.waitForTimeout(800); await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
    ok('E deliberate second click creates', (await state(p)).creates === s0.creates + 1);
    await p.context().close(); }
  // F. Lost reply on the server side → unclear, persisted across reload, blocks batch too.
  { const p = await fresh(b, false);
    await parse(p, 'Стоян Петров 0888600001 Варна офис Чайка'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    fault({ lostReply: 1 });
    await p.click('#createBtn'); await p.waitForTimeout(800);
    ok('F server lost reply => unclear', (await p.textContent('#previewErr')).includes('Не стана ясно'), await p.textContent('#previewErr'));
    fault({});
    await p.reload(); await p.waitForTimeout(300);
    await p.evaluate(async () => { SESSION.password = 'pw'; SESSION.pin = '1234'; CONFIG = { mode: 'production', username: 'u', sender: { name: 'Иван', phone: '0878916695', officeCode: '1111' }, defaults: { weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: false, currency: 'EUR' } } }; enterApp(); });
    await parse(p, 'Стоян Петров 0888 600 001 Варна офис Чайка 12'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    ok('F unclear survives reload + edits', await p.isVisible('#dupWarn') && (await p.textContent('#dupMsg')).includes('Не стана ясно'));
    await p.click('#clearBtn');
    await parse(p, 'Стоян Петров 0888600001 Варна офис Чайка 12\n\nИва К 0899600002 Пловдив офис Център 30');
    await p.waitForSelector('#batch:not(.hide)');
    const r0 = await p.$$eval('.brow', (els) => els.map((e) => e.querySelector('[data-f="on"]').checked + ':' + e.querySelector('[data-status]').textContent));
    ok('F batch row for unclear phone starts unticked', r0[0].startsWith('false:неясно'), r0.join(' | '));
    await p.context().close(); }
  // G. Editor create from a batch row with an unclear result marks that row.
  { const p = await fresh(b, false);
    await parse(p, 'Рая М 0888700001 Варна офис Чайка 10\n\nДеси Н 0899700002 Пловдив офис Център 20');
    await p.waitForSelector('#batch:not(.hide)');
    await p.click('.brow[data-i="0"] [data-f="edit"]'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    fault({ '/api/create': { n: 1 } });
    await p.click('#createBtn'); await p.waitForTimeout(800); fault({});
    await p.click('#backToBatchBtn'); await p.waitForTimeout(200);
    const row0 = await p.$eval('.brow[data-i="0"]', (e) => e.querySelector('[data-f="on"]').checked + ':' + e.querySelector('[data-status]').textContent);
    ok('G unclear editor create unticks its row', row0.startsWith('false:неясно'), row0);
    await p.context().close(); }
  // H. Global paste never replaces an open preview.
  { const p = await fresh(b, false);
    await parse(p, 'Мария Петрова 0888800001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.fill('#pName', 'Мария Петрова-Иванова'); await p.evaluate(() => document.activeElement.blur());
    await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', '0888 777 666'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await p.waitForTimeout(500);
    ok('H open preview kept', (await p.inputValue('#pName')) === 'Мария Петрова-Иванова');
    await p.context().close(); }
  // I. Language switch mid batch run and result summary language.
  { const p = await fresh(b, false);
    fault({ slowCreate: 600 });
    await parse(p, 'Рая М 0888900001 Варна офис Чайка 10\n\nДеси Н 0899900002 Пловдив офис Център 20');
    await p.waitForSelector('#batch:not(.hide)');
    await p.click('#batchCreateBtn'); await p.waitForTimeout(300);
    await p.click('#langEn');
    await p.waitForFunction(() => !$('batchCreateBtn').hasAttribute('aria-busy'), null, { timeout: 10000 });
    const sts = await p.$$eval('.brow [data-status]', (els) => els.map((e) => e.textContent));
    ok('I statuses in EN after mid-run switch', sts.every((x) => /created|Created/i.test(x)), sts.join(' | '));
    ok('I run button label in EN', (await p.textContent('#batchCreateBtn')).includes('Run') || !(/[а-я]/i.test(await p.textContent('#batchCreateBtn'))), await p.textContent('#batchCreateBtn'));
    fault({}); await p.context().close(); }
  // J. Snapshot card details resolve when refresh fails.
  { const p = await fresh(b, false);
    await parse(p, 'Мария Петрова 0888110001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
    await p.click('#navParcels'); await p.waitForTimeout(800); await p.click('#navNew');
    fault({ '/api/track': { n: 99 } });
    await p.evaluate(() => { const _f = window.fetch; window.fetch = (u, o) => (String(u).includes('/api/track') ? Promise.reject(new TypeError('offline')) : _f(u, o)); Object.defineProperty(navigator, 'onLine', { get: () => false }); });
    await p.click('#navParcels'); await p.waitForTimeout(600);
    await p.click('.parcel >> nth=0 >> [data-toggle]');
    const det = await p.textContent('.parcel >> nth=0 >> [data-details]');
    ok('J details not stuck on loading', !det.includes('Зареждане'), det.slice(0, 80));
    fault({}); await p.context().close(); }
  // K. Demo badge on a 390px phone: no horizontal overflow.
  { const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.goto(BASE); await p.waitForTimeout(300);
    await p.evaluate(async () => { SESSION.password = 'pw'; SESSION.pin = '1234'; CONFIG = { mode: 'demo', username: 'u', sender: { name: 'Иван', phone: '0878916695', officeCode: '1111' }, defaults: { weight: 1, shipmentDescription: 'x', cod: { enabled: false } } }; await persist(); enterApp(); });
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, en: Math.round(document.getElementById('langEn').getBoundingClientRect().right) }));
    ok('K demo topbar fits 390', m.sw <= m.iw && m.en <= m.iw, JSON.stringify(m));
    await ctx.close(); }
  // L. Forget keeps parcels and closes on lock.
  { const p = await fresh(b, false);
    await p.evaluate(() => addParcel({ number: '1999999999999', createdAt: Date.now(), mode: 'production' }));
    await p.click('#lockNowBtn'); await p.click('#forgetBtn');
    await p.evaluate(() => { $('lockPin').value = '1234'; }); await p.evaluate(() => tryUnlock(false)); await p.waitForTimeout(300);
    await p.click('#lockNowBtn'); await p.waitForTimeout(100);
    ok('L forget confirm closed on lock', !(await p.isVisible('#forgetConfirm')));
    await p.click('#forgetBtn'); await p.click('#forgetYes'); await p.waitForTimeout(500);
    ok('L parcels kept after forget', await p.evaluate(() => loadParcels().length === 1));
    await p.context().close(); }
  console.log(R.join('\n'));
  await b.close();
})().catch((e) => { console.log(R.join('\n')); console.error('CRASH', e); process.exit(1); });
