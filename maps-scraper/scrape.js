#!/usr/bin/env node
'use strict';

// Sweeps Google Maps for the cities and trades listed in targets.js and stores
// every business that publishes a phone number. Safe to interrupt: finished
// searches and already-visited places are never repeated on the next run.
//
//   node scrape.js                                # everything in targets.js
//   node scrape.js --cities София,Пловдив
//   node scrape.js --groups "Авто и механика"
//   node scrape.js --headful --concurrency 2      # watch it work
//
const path = require('path');
const { chromium } = require('playwright');
const { buildJobs } = require('./targets');
const { Store, normalizePhone, isMobile } = require('./lib');

const PROFILE_DIR = path.join(__dirname, 'data', 'browser-profile');

// ------------------------------------------------------------------- args

function parseArgs(argv) {
  const args = { concurrency: 3, maxPerSearch: 120, headful: false, limit: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--cities') args.cities = next().split(',').map((s) => s.trim());
    else if (a === '--groups') args.groups = next().split(',').map((s) => s.trim());
    else if (a === '--concurrency') args.concurrency = Math.max(1, +next() || 3);
    else if (a === '--max-per-search') args.maxPerSearch = +next() || 120;
    else if (a === '--limit') args.limit = +next() || 0;
    else if (a === '--headful') args.headful = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base) => base + Math.floor(Math.random() * base * 0.6);

// ---------------------------------------------------------------- browser

async function launch({ headful }) {
  // A persistent profile keeps the cookie banner answered between runs.
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !headful,
    locale: 'bg-BG',
    timezoneId: 'Europe/Sofia',
    viewport: { width: 1400, height: 950 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  // Images and fonts are most of the bandwidth and carry none of the data.
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'media' || type === 'font') return route.abort();
    return route.continue();
  });

  await context.addCookies([
    { name: 'SOCS', value: 'CAESHAgBEhIaAB', domain: '.google.com', path: '/' },
  ]);

  return context;
}

// The EU consent interstitial, if the cookie above did not pre-empt it.
async function dismissConsent(page) {
  if (!/consent\.google\.|\/consent/.test(page.url())) return;
  const labels = [/Приемам всички/i, /Отхвърлям всички/i, /Accept all/i, /Reject all/i];
  for (const label of labels) {
    const button = page.getByRole('button', { name: label });
    if (await button.count().catch(() => 0)) {
      await button.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return;
    }
  }
}

class Blocked extends Error {}

async function assertNotBlocked(page) {
  if (/\/sorry\/|recaptcha/.test(page.url())) throw new Blocked('Google served a CAPTCHA');
  const body = await page.locator('body').innerText().catch(() => '');
  if (/unusual traffic|необичаен трафик/i.test(body)) throw new Blocked('Google flagged unusual traffic');
}

// ----------------------------------------------------------------- search

// Identifies the same business met through different search terms.
function placeKey(href) {
  const cid = href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (cid) return cid[1];
  const slug = href.match(/\/place\/([^/]+)/);
  return slug ? decodeURIComponent(slug[1]) : href;
}

function searchUrl(job) {
  const q = encodeURIComponent(`${job.term} ${job.city}`);
  return `https://www.google.com/maps/search/${q}/@${job.lat},${job.lng},${job.zoom}z?hl=bg&gl=BG`;
}

// Scrolls the results rail until it stops growing, then returns the place links.
async function harvestFeed(page, maxPerSearch) {
  const feed = page.locator('div[role="feed"]');
  if (!(await feed.count().catch(() => 0))) {
    await page.waitForSelector('div[role="feed"], a.hfpxzc', { timeout: 15000 }).catch(() => {});
  }
  if (!(await feed.count().catch(() => 0))) return [];

  let previous = 0;
  let stable = 0;
  while (stable < 3) {
    await feed.evaluate((el) => el.scrollTo(0, el.scrollHeight)).catch(() => {});
    await sleep(jitter(1100));

    const count = await page.locator('div[role="feed"] a.hfpxzc').count().catch(() => 0);
    if (count >= maxPerSearch) break;

    // Google prints this once the list is exhausted. Test for visibility rather
    // than presence: the node sits in the DOM hidden from the first paint, so
    // a presence check would stop the scroll on the very first pass.
    const ended = await page
      .getByText(/Разгледахте всички резултати|reached the end of the list/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (ended) break;

    if (count === previous) stable++;
    else {
      stable = 0;
      previous = count;
    }
  }

  const hrefs = await page
    .locator('div[role="feed"] a.hfpxzc')
    .evaluateAll((nodes) => nodes.map((n) => n.href).filter(Boolean));
  return hrefs.slice(0, maxPerSearch);
}

async function collectLinks(page, job, maxPerSearch) {
  await page.goto(searchUrl(job), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await dismissConsent(page);
  await assertNotBlocked(page);

  // On an exact match Maps skips the list and opens the business directly.
  if (/\/maps\/place\//.test(page.url())) return [page.url()];

  return harvestFeed(page, maxPerSearch);
}

// ---------------------------------------------------------------- details

async function scrapePlace(page, url, job) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await dismissConsent(page);
  await assertNotBlocked(page);
  await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});

  const text = async (locator) =>
    (await locator.first().innerText().catch(() => ''))?.trim() || null;

  const attr = async (locator, name) =>
    (await locator.first().getAttribute(name).catch(() => null)) || null;

  // The number sits in the attribute itself: data-item-id="phone:tel:+359…"
  const phoneRaw = await attr(page.locator('button[data-item-id^="phone:tel:"]'), 'data-item-id');
  const phone = normalizePhone(phoneRaw ? phoneRaw.replace('phone:tel:', '') : null);
  if (!phone) return null; // no phone, no lead

  const addressRaw = await attr(page.locator('button[data-item-id="address"]'), 'aria-label');
  const ratingBlock = await text(page.locator('div.F7nice'));
  const [, rating, reviews] = ratingBlock?.match(/([\d,.]+)\s*\(?([\d\s ]*)\)?/) || [];

  return {
    key: placeKey(url),
    name: await text(page.locator('h1')),
    phone,
    phoneType: isMobile(phone) ? 'мобилен' : 'стационарен',
    group: job.group,
    category: await text(page.locator('button.DkEaL')),
    city: job.city,
    address: addressRaw ? addressRaw.replace(/^Адрес:\s*|^Address:\s*/i, '') : null,
    website: await attr(page.locator('a[data-item-id="authority"]'), 'href'),
    rating: rating ? rating.replace(',', '.') : null,
    reviews: reviews ? reviews.replace(/\D/g, '') || null : null,
    term: job.term,
    url,
  };
}

// ------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('node scrape.js [--cities A,B] [--groups "X,Y"] [--concurrency 3] [--headful]');
    return;
  }

  const store = new Store();
  let jobs = buildJobs({ cities: args.cities, groups: args.groups });
  const total = jobs.length;
  jobs = jobs.filter((j) => !store.isDone(j.id));
  if (args.limit) jobs = jobs.slice(0, args.limit);

  console.log(`Searches: ${jobs.length} new of ${total} (${total - jobs.length} already done)`);
  console.log(`Places already stored: ${store.count}\n`);
  if (!jobs.length) return console.log('Nothing to do. For the CSV run: node export.js');

  const context = await launch(args);
  const searchPage = await context.newPage();
  const workers = await Promise.all(
    Array.from({ length: args.concurrency }, () => context.newPage()),
  );

  let stopping = false;
  process.on('SIGINT', () => {
    console.log('\nStopping after this search — everything collected so far is saved.');
    stopping = true;
  });

  let added = 0;
  let backoff = 30000;

  for (const [index, job] of jobs.entries()) {
    if (stopping) break;
    const label = `[${index + 1}/${jobs.length}] ${job.city} · ${job.term}`;

    let links;
    try {
      links = await collectLinks(searchPage, job, args.maxPerSearch);
    } catch (err) {
      if (err instanceof Blocked) {
        // Back off exponentially rather than hammering into a harder block.
        console.log(`${label} — ${err.message}. Pausing ${Math.round(backoff / 1000)}s.`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 15 * 60000);
        continue;
      }
      console.log(`${label} — skipped (${err.message.split('\n')[0]})`);
      continue;
    }
    backoff = 30000;

    const fresh = links.filter((href) => !store.has(placeKey(href)));
    let jobAdded = 0;

    // Workers pull from one queue so nobody idles behind the slowest page.
    const queue = [...fresh];
    await Promise.all(
      workers.map(async (page) => {
        while (queue.length && !stopping) {
          const url = queue.shift();
          if (store.has(placeKey(url))) continue;
          try {
            const record = await scrapePlace(page, url, job);
            if (record && store.add(record)) {
              added++;
              jobAdded++;
            }
          } catch (err) {
            if (err instanceof Blocked) {
              stopping = true;
              console.log(`\n${err.message} — stopping so the block does not get worse.`);
            }
          }
          await sleep(jitter(400));
        }
      }),
    );

    // Only bank the search as done if it ran to completion.
    if (!stopping) store.markDone(job.id);
    console.log(`${label} — ${links.length} results, ${jobAdded} new with phone (total ${store.count})`);
    await sleep(jitter(900));
  }

  await context.close();
  console.log(`\nDone. New records: ${added}. Total stored: ${store.count}.`);
  console.log('Next step:  node export.js');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  launch,
  dismissConsent,
  harvestFeed,
  collectLinks,
  scrapePlace,
  placeKey,
  searchUrl,
  Blocked,
};
