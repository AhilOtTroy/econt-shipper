'use strict';

// The main UI walk-through (ported from tests/e2e/legacy/test.js, which passed
// 48/48 against 724526c): paste, live price, currency hint, no-COD consent, create,
// customer reply, duplicate guard, waking server, unclear create, Parcels tab,
// batch with consent and repeats, language switch, phone layout.
//
// Updated for the current app: a duplicate/unclear confirm needs a click more than
// 700 ms after the one that armed it; prices are written with a decimal comma
// (6,40); batch statuses carry no check glyph; a bare number with no currency is
// not a COD amount. Faults at the app's own door (Render waking up) are Playwright
// routes; faults at Econt are the mock's.
//
//   APP_URL=... MOCK_URL=... NODE_PATH=$(npm root -g) node tests/e2e/ui.js

const { APP, suite, mock, launch, account, seed, appFaults, shot } = require('./lib');

const { ok, finish } = suite('ui');
const BASE = APP + '/';
const state = () => mock.state();

(async () => {
  await mock.reset();
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const faults = await appFaults(ctx);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(BASE); await p.waitForFunction(() => typeof enterApp === 'function' && !!window.EcontMatch);
  // Seed an account directly (COD on by default, EUR).
  await seed(p, { cod: true, defaults: { shipmentType: 'pack', packCount: 1, weight: 1, shipmentDescription: 'лични вещи', payer: 'receiver', cod: { enabled: true, amount: 0, currency: 'EUR' }, declaredValue: { enabled: false } } });
  await p.waitForTimeout(300);
  ok('msg focused on enter', await p.evaluate(() => document.activeElement && document.activeElement.id === 'msg'));
  // 1. Global text paste (focus body first).
  await p.evaluate(() => document.activeElement.blur());
  const st0 = await state();
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'Мария Петрова 0888123456 Пловдив офис Център'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.waitForSelector('#preview:not(.hide)', { timeout: 8000 });
  await p.waitForFunction(() => /6,40/.test(document.getElementById('priceBox').textContent), null, { timeout: 8000 });
  ok('global paste parsed + price', true, await p.textContent('#prevSummary'));
  // 2. Live price after COD input.
  const pv0 = (await state()).previews;
  await p.fill('#pCodAmount', '45'); await p.waitForTimeout(1200);
  const pv1 = (await state()).previews;
  ok('live price re-quote', pv1 === pv0 + 1, `${pv0}->${pv1}`);
  // 3. Currency hint: switch to BGN.
  await p.selectOption('#pCodCur', 'BGN'); await p.waitForTimeout(200);
  ok('currency hint', await p.isVisible('#codCurHint'), await p.textContent('#codCurHint'));
  await p.selectOption('#pCodCur', 'EUR'); await p.waitForTimeout(100);
  ok('currency hint hides', !(await p.isVisible('#codCurHint')));
  // 4. No-COD confirm.
  await p.uncheck('#pCodOn'); await p.waitForTimeout(100);
  await p.click('#createBtn'); await p.waitForTimeout(200);
  ok('nocod confirm shown', await p.isVisible('#noCodConfirm'));
  let c0 = (await state()).creates;
  ok('nothing created yet', c0 === st0.creates, 'creates=' + c0);
  await p.click('#noCodFix'); await p.fill('#pCodAmount', '45');
  ok('fix re-checks COD', await p.isChecked('#pCodOn'));
  // 5. Sticky bar visible in viewport while scrolled to top.
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  const barBox = await p.locator('#confirmBar').boundingBox();
  ok('confirm bar within viewport', barBox && barBox.y + barBox.height <= 900 + 1, JSON.stringify(barBox));
  // 6. Ctrl+Enter creates (not focused on msg).
  await p.focus('#pName'); await p.keyboard.press('Control+Enter');
  await p.waitForSelector('#result:not(.hide)', { timeout: 8000 });
  const num1 = (await p.textContent('#shipNum')).trim();
  ok('ctrl+enter created', /^\d{13}$/.test(num1), num1);
  ok('reply preview has cod line', /Наложен платеж: 45 €/.test(await p.textContent('#replyText')), await p.textContent('#replyText'));
  ok('result summary', (await p.textContent('#resultSummary')).includes('Мария'));
  ok('focus on reply btn', await p.evaluate(() => document.activeElement.id === 'replyBtn'));
  await p.click('#replyBtn'); await p.waitForTimeout(150);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok('reply copied to clipboard', clip.includes(num1) && clip.includes('econt.com'), clip.replace(/\n/g, ' | '));
  ok('reply btn flashes', (await p.textContent('#replyBtn')).includes('Копирано'));
  // 7. Duplicate guard: paste same phone again.
  await p.click('#newBtn');
  await p.fill('#msg', 'Мария Петрова 0888 123 456 Пловдив офис Център'); await p.click('#parseBtn');
  await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(300);
  ok('dup warn shown', await p.isVisible('#dupWarn'), await p.textContent('#dupMsg'));
  await p.fill('#pCodAmount', '45');
  await p.click('#createBtn'); await p.waitForTimeout(200);
  ok('dup: first click only arms', (await p.textContent('#createBtn')).includes('втора'), await p.textContent('#createBtn'));
  c0 = (await state()).creates;
  await p.waitForTimeout(800);   // the confirm counts only after 700 ms
  await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
  const c1 = (await state()).creates;
  ok('dup: second click creates', c1 === c0 + 1);
  ok('create label restored', (await p.textContent('#createBtn')).includes('Създай товарителница'), await p.textContent('#createBtn'));
  // 8. Waking server: reading a message needs only the office list from the
  // server now (parsing runs in the browser). With no list kept yet, the list
  // gets 2x a 502 page, then comes through.
  await p.click('#newBtn');
  await p.evaluate(() => { for (const k of ['production', 'demo']) { localStorage.removeItem('econt_offices_' + k); OFFICES[k] = null; } });
  faults.set({ '/api/offices/list': 2 });
  await p.fill('#msg', 'Георги Иванов 0899111222 Варна офис Чайка'); await p.click('#parseBtn');
  await p.waitForFunction(() => /събужда/.test(document.getElementById('parseErr').textContent), null, { timeout: 6000 });
  ok('wake message shown', true);
  await p.waitForSelector('#preview:not(.hide)', { timeout: 20000 });
  ok('parse succeeded after retries', (await p.inputValue('#pPhone')).includes('0899'));
  ok('wake message cleared', (await p.textContent('#parseErr')).trim() === '');
  // 9. Unclear create: the app's door answers 502 to the create.
  await p.fill('#pCodAmount', '30');
  faults.set({ '/api/create': 1 });
  c0 = (await state()).creates;
  await p.click('#createBtn'); await p.waitForTimeout(800);
  ok('unsure message', (await p.textContent('#previewErr')).includes('Не стана ясно'), await p.textContent('#previewErr'));
  ok('unsure warn at top', await p.isVisible('#dupWarn'));
  await p.click('#createBtn'); await p.waitForTimeout(200);
  ok('unsure: next click arms only', (await p.textContent('#createBtn')).includes('втора') && (await state()).creates === c0);
  await p.waitForTimeout(800);
  await p.click('#createBtn'); await p.waitForSelector('#result:not(.hide)');
  ok('unsure: deliberate retry creates', (await state()).creates === c0 + 1);
  // 10. Parcels tab.
  await p.click('#navParcels'); await p.waitForTimeout(1000);
  const cards = await p.$$('.parcel');
  ok('parcels rendered', cards.length === 3, 'n=' + cards.length);
  ok('no skeleton left', (await p.$$('.statusb.sk')).length === 0);
  ok('progress track set', await p.evaluate(() => [...document.querySelectorAll('[data-track]')].map((x) => x.dataset.step).join(',')), '');
  ok('collected pill', (await p.$$('[data-coll]')).length >= 1);
  ok('updated line', (await p.textContent('#parcelsUpdated')).includes('Обновено'), await p.textContent('#parcelsUpdated'));
  ok('snapshot saved', await p.evaluate(() => loadParcels().every((x) => x.snap && x.snapAt)));
  // instant paint on revisit: block track and reopen
  faults.set({ '/api/track': 99 });
  await p.click('#navNew'); await p.click('#navParcels'); await p.waitForTimeout(150);
  ok('instant paint from snapshot', (await p.$$('.statusb.sk')).length === 0 && (await p.$$('.parcel')).length === 3);
  faults.set({});
  await p.waitForFunction(() => /Проследяване/.test(document.querySelector('.parcel [data-details]').textContent), null, { timeout: 8000 }).catch(() => {});
  // details toggle + events heading
  await p.click('.parcel >> nth=0 >> [data-toggle]');
  ok('details open + aria', await p.evaluate(() => document.querySelector('.parcel [data-toggle]').getAttribute('aria-expanded') === 'true'));
  ok('events heading', (await p.textContent('.parcel >> nth=0 >> [data-details]')).includes('Проследяване'));
  // reply from parcels
  await p.click('.parcel >> nth=0 >> [data-reply]'); await p.waitForTimeout(150);
  ok('parcel reply copied', (await p.evaluate(() => navigator.clipboard.readText())).includes('Товарителница'));
  // delete in place
  await p.click('.parcel >> nth=0 >> [data-del]'); await p.click('.parcel >> nth=0 >> [data-yes]'); await p.waitForTimeout(500);
  ok('delete in place', (await p.$$('.parcel')).length === 2);
  // clear all -> empty state
  await p.click('#clearParcelsBtn'); await p.click('#clearAllYes'); await p.waitForTimeout(200);
  ok('empty state', await p.isVisible('.card.empty'));
  ok('clear btn hidden', !(await p.isVisible('#clearParcelsBtn')));
  // manual track add
  await p.fill('#trackNumInput', '1234567890123'); await p.click('#trackNumBtn'); await p.waitForTimeout(800);
  ok('manual add in place', (await p.$$('.parcel')).length === 1 && (await p.$$('.statusb.sk')).length === 0);
  await shot(p, 'parcels.png', { fullPage: true });
  // 11. Batch with no-COD rows (COD is the default; only "40 лв" is an amount).
  await p.click('#navNew');
  await p.fill('#msg', 'Петър Колев 0888777666 Варна офис Чайка\n\nАна Димитрова 0899555444 Пловдив офис Център 40 лв');
  await p.click('#parseBtn'); await p.waitForSelector('#batch:not(.hide)', { timeout: 8000 });
  const sts = await p.$$eval('.brow [data-status]', (els) => els.map((e) => e.textContent));
  ok('batch statuses', sts.length === 2, sts.join(' | '));
  await p.click('#batchCreateBtn'); await p.waitForTimeout(200);
  ok('batch nocod confirm', await p.isVisible('#batchNoCodConfirm'), await p.textContent('#batchNoCodMsg'));
  c0 = (await state()).creates;
  await p.click('#batchNoCodGo');
  await p.waitForFunction(() => !$('batchCreateBtn').hasAttribute('aria-busy'), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
  const c2 = (await state()).creates;
  ok('batch created after confirm', c2 === c0 + 2, `${c0}->${c2}`);
  ok('batch send buttons', (await p.$$('.brow [data-f="send"]')).length === 2);
  await shot(p, 'batch.png', { fullPage: true });
  // 12. Batch dup: same paste again -> rows start unticked.
  await p.click('#clearBtn');
  await p.fill('#msg', 'Петър Колев 0888777666 Варна офис Чайка\n\nАна Димитрова 0899555444 Пловдив офис Център 40 лв');
  await p.click('#parseBtn'); await p.waitForSelector('#batch:not(.hide)');
  const ticks = await p.$$eval('.brow [data-f="on"]', (els) => els.map((e) => e.checked));
  ok('batch dup rows unticked', ticks.every((x) => !x), JSON.stringify(ticks) + ' ' + (await p.$$eval('.brow [data-status]', (els) => els.map((e) => e.textContent).join(' | '))));
  // 13. Language switch
  await p.click('#langEn'); await p.waitForTimeout(200);
  ok('EN batch status', (await p.$$eval('.brow [data-status]', (els) => els.map((e) => e.textContent).join(' | '))).includes('already sent'));
  await p.click('#langBg');
  // 14. Phone layout of the preview
  const m = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage(); mp.on('pageerror', (e) => errs.push('mobile: ' + e.message));
  await mp.goto(BASE); await mp.waitForFunction(() => typeof enterApp === 'function');
  await mp.evaluate(async (cfg) => { SESSION.password = 'pw'; SESSION.pin = '1234'; CONFIG = cfg; await persist(); enterApp(); }, account({ cod: true }));
  await mp.fill('#msg', 'Мария Петрова 0888123456 Пловдив офис Център 45 лв'); await mp.click('#parseBtn');
  await mp.waitForSelector('#preview:not(.hide)'); await mp.waitForTimeout(800);
  await shot(mp, 'mobile-preview.png');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok('mobile no horizontal overflow', !overflow);
  // A bare number with no currency is not a COD amount.
  await p.click('#navNew'); await p.click('#clearBtn');
  await p.fill('#msg', 'Стоян 0877000111 Варна офис Чайка 20'); await p.click('#parseBtn'); await p.waitForSelector('#preview:not(.hide)'); await p.waitForTimeout(600);
  const bare = await p.evaluate(() => ({ amt: $('pCodAmount').value, office: $('pOffice').value }));
  ok('bare number is not COD', bare.amt === '' && bare.office === '3333', JSON.stringify(bare));
  await shot(p, 'desktop-preview.png');
  ok('no page errors', errs.length === 0, errs.join(' || '));
  await b.close();
  finish();
})().catch((e) => finish(e));
