'use strict';

// Shared helpers: phone normalisation, resumable storage, CSV output.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// ------------------------------------------------------------------ phones

// Returns the number in +359… form, or null if it does not look like a usable
// phone. Google gives both "0888 123 456" and "+359 88 812 3456".
function normalizePhone(raw) {
  if (!raw) return null;

  const s = String(raw).trim();
  const international = s.startsWith('+') || s.startsWith('00');
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00359')) digits = digits.slice(5);
  else if (digits.startsWith('359') && (international || digits.length > 10)) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  else if (international) return `+${digits}`; // foreign number — keep as is

  // Bulgarian national number without the leading zero: mobiles are 87/88/89
  // plus 7 digits, landlines 2 + 7 for Sofia and 3-4 + 5-6 elsewhere.
  if (digits.length < 7 || digits.length > 9) return null;
  return `+359${digits}`;
}

function isMobile(e164) {
  return /^\+3598[7-9]/.test(e164 || '');
}

// ----------------------------------------------------------------- storage

// Records are appended line by line (JSONL) so an interrupted sweep survives.
class Store {
  constructor(dir = DATA_DIR) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.placesPath = path.join(dir, 'places.jsonl');
    this.donePath = path.join(dir, 'done.json');

    this.seen = new Set();   // keys of places already visited
    this.done = new Set();   // finished searches (city|term|point)
    this.count = 0;

    for (const rec of this.readPlaces()) {
      if (rec.key) this.seen.add(rec.key);
      this.count++;
    }
    if (fs.existsSync(this.donePath)) {
      try {
        this.done = new Set(JSON.parse(fs.readFileSync(this.donePath, 'utf8')));
      } catch {
        this.done = new Set();
      }
    }
  }

  // A half-written last line (killed mid-append) is skipped, not fatal.
  readPlaces() {
    if (!fs.existsSync(this.placesPath)) return [];
    return fs
      .readFileSync(this.placesPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  has(key) {
    return this.seen.has(key);
  }

  add(rec) {
    if (rec.key && this.seen.has(rec.key)) return false;
    if (rec.key) this.seen.add(rec.key);
    fs.appendFileSync(this.placesPath, JSON.stringify(rec) + '\n');
    this.count++;
    return true;
  }

  isDone(jobId) {
    return this.done.has(jobId);
  }

  markDone(jobId) {
    this.done.add(jobId);
    fs.writeFileSync(this.donePath, JSON.stringify([...this.done], null, 0));
  }
}

// --------------------------------------------------------------------- CSV

// Header labels stay Bulgarian — this ends up in a Bulgarian sales sheet.
const COLUMNS = [
  ['name', 'Фирма'],
  ['phone', 'Телефон'],
  ['phoneType', 'Тип'],
  ['group', 'Бранш'],
  ['category', 'Категория (Google)'],
  ['city', 'Град'],
  ['address', 'Адрес'],
  ['website', 'Уебсайт'],
  ['rating', 'Рейтинг'],
  ['reviews', 'Отзиви'],
  ['term', 'Търсена фраза'],
  ['url', 'Google Maps'],
];

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The leading BOM makes Excel open the Cyrillic correctly; Sheets accepts it too.
function toCsv(rows) {
  const head = COLUMNS.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((r) => COLUMNS.map(([key]) => csvCell(r[key])).join(','));
  return '﻿' + [head, ...body].join('\n') + '\n';
}

// One phone per row. On a duplicate the record with more filled fields wins,
// since the same business shows up under several search terms.
function dedupeByPhone(records) {
  const best = new Map();
  const score = (r) => [r.name, r.address, r.website, r.category, r.rating].filter(Boolean).length;

  for (const r of records) {
    if (!r.phone) continue;
    const existing = best.get(r.phone);
    if (!existing || score(r) > score(existing)) best.set(r.phone, r);
  }
  return [...best.values()].sort(
    (a, b) =>
      String(a.city).localeCompare(String(b.city), 'bg') ||
      String(a.name).localeCompare(String(b.name), 'bg'),
  );
}

module.exports = { DATA_DIR, normalizePhone, isMobile, Store, toCsv, dedupeByPhone, COLUMNS };
