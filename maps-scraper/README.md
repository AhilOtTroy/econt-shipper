# maps-scraper — blue-collar phone numbers from Google Maps

Sweeps Google Maps across Bulgarian cities and trade categories and produces one
CSV: **one row per phone number**, deduplicated, ready to import into Google Sheets.

Runs on your own machine. It does not belong on a server, and it is deliberately
not wired into the Econt app — it is a standalone lead-gathering tool that happens
to live in this repo.

## Setup

```bash
cd maps-scraper
npm install
npx playwright install chromium
```

## Use

```bash
node scrape.js                       # everything in targets.js
node export.js                       # write the CSV
```

Then in Google Sheets: **File → Import → Upload** and pick
`data/blue-collar-phones.csv`.

Start small to see it work before committing to a long run:

```bash
node scrape.js --cities Русе --groups "Авто и механика" --headful
```

`--headful` opens a visible browser so you can watch what it does.

| Flag | Meaning |
|------|---------|
| `--cities София,Пловдив` | only these cities |
| `--groups "Авто и механика"` | only these trades |
| `--concurrency 3` | parallel detail pages (default 3) |
| `--max-per-search 120` | cap results per search |
| `--limit 20` | run only the first N searches — good for a smoke test |
| `--headful` | show the browser |

`export.js` takes `--cities`, `--groups`, `--only-mobile` and `--out`.

## Interrupting is safe

Ctrl-C stops after the current search. Finished searches are recorded in
`data/done.json` and every business found is appended to `data/places.jsonl`,
so the next `node scrape.js` picks up where it left off instead of starting over.
Delete those two files to force a clean sweep.

## What to expect

`targets.js` currently expands to **1,100 searches** (8 cities × 44 Bulgarian
search terms, with Sofia swept on a 3×3 grid and Plovdiv/Varna/Burgas on 2×2).

- Runtime is a matter of hours, not minutes — plan on leaving it overnight.
- Rough yield is **thousands** of unique numbers, but the real figure depends
  entirely on how hard Google throttles you. Nobody can promise a number up front.
- Businesses without a published phone are skipped; a phone is the whole point.
- Not every business is on Maps at all, so "every single one" is out of reach by
  construction. This gets you the ones Google knows about.

Tune the trade list in `targets.js` — it is plain Bulgarian search phrases, and
adding a term you know your market uses is usually worth more than more cities.
The terms are Bulgarian on purpose: `водопроводчик София` returns the real market,
`plumber Sofia` returns a handful of expat-facing listings.

## When Google pushes back

Maps will eventually notice. The scraper already blocks images and fonts, uses a
Bulgarian locale and timezone, keeps a persistent browser profile, jitters every
delay, and backs off exponentially when it sees a CAPTCHA. If it still gets
blocked mid-run it stops rather than digging the hole deeper.

If that happens: wait a few hours, drop `--concurrency` to 1 or 2, and resume.
A home connection survives this far better than a VPN or a datacenter IP.

## Two things worth knowing

**Terms of service.** Automated scraping of Google Maps is against Google's ToS.
The supported route is the Places API, which needs a billed API key. This tool
takes the scraping route by choice; the risk is an IP block, and it is yours to
carry.

**The numbers are personal data.** A company landline is ordinarily fine, but a
sole trader's mobile is personal data under GDPR, and unsolicited marketing calls
and SMS to Bulgarian numbers are regulated (ЗЗЛД and the Electronic Communications
Act). Check a number against the marketing opt-out register before a campaign, and
keep a record of where each contact came from — the `Google Maps` column in the CSV
is exactly that record.

## Files

| File | What it does |
|------|--------------|
| `targets.js` | Cities, grids and Bulgarian search terms — the file you edit |
| `scrape.js` | Browser engine: search, scroll, extract, resume, back off |
| `lib.js` | Phone normalisation, JSONL store, dedupe, CSV |
| `export.js` | Store → CSV, with a breakdown by city and trade |
| `data/` | Results and browser profile (git-ignored) |
