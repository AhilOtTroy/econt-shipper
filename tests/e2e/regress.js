'use strict';

// Regression suite for the create guards (ported from tests/e2e/legacy/test2.js):
// frozen editor while a create waits, batch not swapped mid-run, no-COD consent
// scoped to the named rows and one run, no create from the Parcels tab, double
// click and key repeat, lost replies kept as "unclear" across a reload and into a
// batch, unclear editor create from a batch row, global paste vs an open preview,
// language switch mid-run, tracking details offline, demo badge on a phone,
// forget-this-device.
//
// Updated for the current app: the confirm counts only for a click more than
// 700 ms after the one that armed it; rows are named "ред 1" in the consent
// message; a bare number with no currency is not COD (amounts say "лв"); names are
// written in full ("Рая Маринова"): the parser takes no one-letter surname
// ("Рая М"), so such a row has no name.
//
//   APP_URL=... MOCK_URL=... NODE_PATH=$(npm root -g) node tests/e2e/regress.js

const { suite, mock, launch, account, fresh, parse } = require('./lib');

const { ok, finish } = suite('regress');
const state = () => mock.state();
const idle = (p, ms) => p.waitForFunction(() => !$('batchCreateBtn').hasAttribute('aria-busy'), null, { timeout: ms || 15000 });

(async () => {
  await mock.reset();
  const b = await launch();
  // A. Editor frozen during create wait; paste blocked; summary from sent data.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Мария Петрова 0888100001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(600);
    await p.evaluate(() => { LAST_OK = 0; });
    p.faults.set({ '/api/ping': 2 });
    await p.click('#createBtn'); await p.waitForTimeout(300);
    ok('A editor inert during wake', await p.evaluate(() => $('preview').inert === true));
    const applied = await p.evaluate(async () => { $('msg').value = 'Георги Иванов 0899100002 Варна офис Чайка'; return doParse(); });
    ok('A parse blocked during create', applied === false);
    await p.waitForSelector('#result:not(.hide)', { timeout: 20000 });
    ok('A summary is the sent customer', (await p.textContent('#resultSummary')).includes('Мария'), await p.textContent('#resultSummary'));
    ok('A editor unfrozen after', await p.evaluate(() => $('preview').inert === false));
    p.faults.set({}); ok('A no errors', p.errs.length === 0, p.errs.join('|')); await p.context().close(); }
  // B. Batch: paste during wake must not swap the batch.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Петър Колев 0888200001 Варна офис Чайка 10 лв\n\nАна Димитрова 0899200002 Пловдив офис Център 20 лв');
    await p.waitForSelector('#batch:not(.hide)');
    await p.evaluate(() => { LAST_OK = 0; }); p.faults.set({ '/api/ping': 2 });
    const s0 = await state();
    await p.click('#batchCreateBtn'); await p.waitForTimeout(300);
    const swapped = await p.evaluate(async () => { $('msg').value = 'Х Y 0877200003 Варна офис Чайка 5\n\nZ W 0877200004 Варна офис Чайка 6\n\nQ R 0877200005 Варна офис Чайка 7'; return doParse(); });
    ok('B parse blocked during batch wake', swapped === false);
    await idle(p, 25000);
    const s1 = await state();
    const phones = (s1.createdLabels || []).slice((s0.createdLabels || []).length).map((x) => x.phone);
    ok('B created the confirmed batch only', phones.length === 2 && phones.every((x) => /08882|08992/.test(x)), phones.join(','));
    p.faults.set({}); await p.context().close(); }
  // C. Batch no-COD consent is scoped to the named rows and one run.
  { const p = await fresh(b, { cod: true });
    await parse(p, 'Мира Антонова 0888300001 Варна офис Чайка\n\nНели Борисова 0899300002 Пловдив офис Център 40 лв\n\nОля Василева 0877300003 Варна офис Чайка');
    await p.waitForSelector('#batch:not(.hide)');
    await p.uncheck('.brow[data-i="2"] [data-f="on"]');
    await p.click('#batchCreateBtn'); await p.waitForTimeout(150);
    const msg1 = await p.textContent('#batchNoCodMsg');
    ok('C prompt names row 1 only', /ред 1\b/.test(msg1) && !/3/.test(msg1), msg1);
    ok('C focus on safe button', await p.evaluate(() => document.activeElement.id === 'batchNoCodFix'));
    await p.click('#batchNoCodGo');
    await idle(p, 10000);
    await p.check('.brow[data-i="2"] [data-f="on"]'); await p.waitForTimeout(100);
    ok('C re-ticked row shows no-COD', (await p.textContent('.brow[data-i="2"] [data-status]')).includes('без наложен'), await p.textContent('.brow[data-i="2"] [data-status]'));
    const s0 = await state();
    await p.click('#batchCreateBtn'); await p.waitForTimeout(300);
    ok('C asks again for row 3', await p.isVisible('#batchNoCodConfirm') && /ред 3\b/.test(await p.textContent('#batchNoCodMsg')), await p.textContent('#batchNoCodMsg'));
    ok('C nothing created without consent', (await state()).creates === s0.creates);
    await p.context().close(); }
  // D. Ctrl+Enter on the Parcels tab never creates.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Мария Петрова 0888400001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.click('#navParcels'); await p.waitForTimeout(300);
    const s0 = await state();
    await p.fill('#trackNumInput', '1234567890999'); await p.press('#trackNumInput', 'Control+Enter'); await p.waitForTimeout(500);
    ok('D no create from parcels tab', (await state()).creates === s0.creates);
    await p.context().close(); }
  // E. Duplicate: double-click and key repeat do not confirm.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Мария Петрова 0888500001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
    await p.click('#newBtn'); await parse(p, 'Мария Петрова 0888500001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    const s0 = await state();
    await p.dblclick('#createBtn'); await p.waitForTimeout(400);
    ok('E dblclick does not create a duplicate', (await state()).creates === s0.creates);
    await p.focus('#pName'); await p.keyboard.down('Control'); await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.up('Enter'); await p.keyboard.up('Control');
    await p.waitForTimeout(400);
    ok('E held Ctrl+Enter does not create', (await state()).creates === s0.creates);
    await p.waitForTimeout(800); await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
    ok('E deliberate second click creates', (await state()).creates === s0.creates + 1);
    await p.context().close(); }
  // F. Econt took the create but the reply was lost (socket cut) => unclear,
  // persisted across reload, blocks the batch too.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Стоян Петров 0888600001 Варна офис Чайка'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    const s0 = await state();
    await mock.control({ faults: { create: { mode: 'lost' } } });
    await p.click('#createBtn'); await p.waitForTimeout(1200);
    ok('F lost reply => unclear', (await p.textContent('#previewErr')).includes('Не стана ясно'), await p.textContent('#previewErr'));
    ok('F the waybill really exists at Econt', (await state()).creates === s0.creates + 1);
    await mock.control({ clearFaults: true });
    await p.reload(); await p.waitForFunction(() => typeof enterApp === 'function');
    await p.evaluate(async (cfg) => { SESSION.password = 'pw'; SESSION.pin = '1234'; CONFIG = cfg; enterApp(); }, account({ cod: false }));
    await parse(p, 'Стоян Петров 0888 600 001 Варна офис Чайка 12 лв'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    ok('F unclear survives reload + edits', await p.isVisible('#dupWarn') && (await p.textContent('#dupMsg')).includes('Не стана ясно'));
    await p.click('#clearBtn');
    await parse(p, 'Стоян Петров 0888600001 Варна офис Чайка 12 лв\n\nИва Колева 0899600002 Пловдив офис Център 30 лв');
    await p.waitForSelector('#batch:not(.hide)');
    const r0 = await p.$$eval('.brow', (els) => els.map((e) => e.querySelector('[data-f="on"]').checked + ':' + e.querySelector('[data-status]').textContent));
    ok('F batch row for unclear phone starts unticked', r0[0].startsWith('false:неясно'), r0.join(' | '));
    await p.context().close(); }
  // G. Editor create from a batch row with an unclear result marks that row.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Рая Маринова 0888700001 Варна офис Чайка 10 лв\n\nДеси Николова 0899700002 Пловдив офис Център 20 лв');
    await p.waitForSelector('#batch:not(.hide)');
    await p.click('.brow[data-i="0"] [data-f="edit"]'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    p.faults.set({ '/api/create': 1 });
    await p.click('#createBtn'); await p.waitForTimeout(800); p.faults.set({});
    await p.click('#backToBatchBtn'); await p.waitForTimeout(200);
    const row0 = await p.$eval('.brow[data-i="0"]', (e) => e.querySelector('[data-f="on"]').checked + ':' + e.querySelector('[data-status]').textContent);
    ok('G unclear editor create unticks its row', row0.startsWith('false:неясно'), row0);
    await p.context().close(); }
  // H. Global paste never replaces an open preview.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Мария Петрова 0888800001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.fill('#pName', 'Мария Петрова-Иванова'); await p.evaluate(() => document.activeElement.blur());
    await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', '0888 777 666'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await p.waitForTimeout(500);
    ok('H open preview kept', (await p.inputValue('#pName')) === 'Мария Петрова-Иванова');
    await p.context().close(); }
  // I. Language switch mid batch run and result summary language.
  { const p = await fresh(b, { cod: false });
    await mock.control({ slowCreate: 600 });
    await parse(p, 'Рая Маринова 0888900001 Варна офис Чайка 10 лв\n\nДеси Николова 0899900002 Пловдив офис Център 20 лв');
    await p.waitForSelector('#batch:not(.hide)');
    await p.click('#batchCreateBtn'); await p.waitForTimeout(300);
    await p.click('#langEn');
    await idle(p, 10000);
    const sts = await p.$$eval('.brow [data-status]', (els) => els.map((e) => e.textContent));
    ok('I statuses in EN after mid-run switch', sts.every((x) => /^created: \d{13}$/.test(x)), sts.join(' | '));
    ok('I run button label in EN', !(/[а-я]/i.test(await p.textContent('#batchCreateBtn'))), await p.textContent('#batchCreateBtn'));
    await mock.control({ clearFaults: true }); await p.context().close(); }
  // J. Snapshot card details resolve when refresh fails.
  { const p = await fresh(b, { cod: false });
    await parse(p, 'Мария Петрова 0888110001 Пловдив офис Център'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(500);
    await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
    await p.click('#navParcels'); await p.waitForTimeout(800); await p.click('#navNew');
    p.faults.set({ '/api/track': 99 });
    await p.evaluate(() => { const _f = window.fetch; window.fetch = (u, o) => (String(u).includes('/api/track') ? Promise.reject(new TypeError('offline')) : _f(u, o)); Object.defineProperty(navigator, 'onLine', { get: () => false }); });
    await p.click('#navParcels'); await p.waitForTimeout(600);
    await p.click('.parcel >> nth=0 >> [data-toggle]');
    const det = await p.textContent('.parcel >> nth=0 >> [data-details]');
    ok('J details not stuck on loading', !det.includes('Зареждане'), det.slice(0, 80));
    p.faults.set({}); await p.context().close(); }
  // K. Demo badge on a 390px phone: no horizontal overflow.
  { const p = await fresh(b, { mode: 'demo', cod: false, context: { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true } });
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, en: Math.round(document.getElementById('langEn').getBoundingClientRect().right) }));
    ok('K demo topbar fits 390', m.sw <= m.iw && m.en <= m.iw, JSON.stringify(m));
    await p.context().close(); }
  // L. Forget keeps parcels and closes on lock.
  { const p = await fresh(b, { cod: false });
    await p.evaluate(() => addParcel({ number: '1999999999999', createdAt: Date.now(), mode: 'production' }));
    await p.click('#lockNowBtn'); await p.click('#forgetBtn');
    await p.evaluate(() => { $('lockPin').value = '1234'; }); await p.evaluate(() => tryUnlock(false)); await p.waitForTimeout(300);
    await p.click('#lockNowBtn'); await p.waitForTimeout(100);
    ok('L forget confirm closed on lock', !(await p.isVisible('#forgetConfirm')));
    await p.click('#forgetBtn'); await p.click('#forgetYes'); await p.waitForTimeout(500);
    ok('L parcels kept after forget', await p.evaluate(() => loadParcels().length === 1));
    await p.context().close(); }
  await b.close();
  finish();
})().catch((e) => finish(e));
