#!/usr/bin/env node
'use strict';

// Turns whatever the sweep collected into one CSV, ready to import into Sheets.
//
//   node export.js                        # everything
//   node export.js --only-mobile          # mobiles only
//   node export.js --groups "Авто и механика"
//   node export.js --out ~/leads.csv
//
const fs = require('fs');
const path = require('path');
const { Store, toCsv, dedupeByPhone } = require('./lib');

function parseArgs(argv) {
  const args = { out: path.join(__dirname, 'data', 'blue-collar-phones.csv') };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--out') args.out = next();
    else if (a === '--cities') args.cities = next().split(',').map((s) => s.trim());
    else if (a === '--groups') args.groups = next().split(',').map((s) => s.trim());
    else if (a === '--only-mobile') args.onlyMobile = true;
  }
  return args;
}

const args = parseArgs(process.argv);
const store = new Store();

let records = store.readPlaces();
if (args.cities) records = records.filter((r) => args.cities.includes(r.city));
if (args.groups) records = records.filter((r) => args.groups.includes(r.group));
if (args.onlyMobile) records = records.filter((r) => r.phoneType === 'мобилен');

const rows = dedupeByPhone(records);

if (!rows.length) {
  console.log('No records yet. Run: node scrape.js');
  process.exit(0);
}

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, toCsv(rows));

// A quick breakdown so the shape of the haul is visible straight away.
const by = (key) =>
  Object.entries(
    rows.reduce((acc, r) => ((acc[r[key] || '—'] = (acc[r[key] || '—'] || 0) + 1), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

console.log(`${rows.length} unique phone numbers (from ${records.length} records)\n`);
console.log('By city:');
for (const [city, n] of by('city')) console.log(`  ${String(n).padStart(6)}  ${city}`);
console.log('\nBy trade:');
for (const [group, n] of by('group')) console.log(`  ${String(n).padStart(6)}  ${group}`);
console.log(`\nFile: ${args.out}`);
console.log('Import: Google Sheets → File → Import → Upload.');
