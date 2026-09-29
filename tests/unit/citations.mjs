// Citation scoring and date reading, checked directly against the library.
// Run: node tests/unit/citations.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { extractCitations, extractDates, detectSignals, formatEventDate } from '../../src/lib/citations.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
let failures = 0;
const check = (c, msg) => { if (!c) failures += 1; console.log((c ? 'PASS ' : 'FAIL ') + msg); };

// --- Key terms rank below named parties ---
// Each document has four equal-length passages and three citation slots, so
// the one left out is the lowest-ranked.
{
  const criteria = { parties: ['Acme', 'Baxter'], terms: ['escrow'] };
  const line = (body) => `${body} ${'and so on '.repeat(20)}`.slice(0, 180);
  const T = line('The escrow was discussed at length in the meeting that afternoon');
  const P = line('Acme raised the shipment schedule at length in the meeting that day');
  const PT = line('Acme raised the escrow at length in the meeting that afternoon today');
  const PP = line('Acme and Baxter raised the schedule at length in the meeting that day');

  check(detectSignals(T, criteria).includes('term') && !detectSignals(T, criteria).includes('party'),
    'a key-term hit is its own "key term" signal');
  const a = extractCitations([T, T, T, P].join('\n'), 'a.txt', criteria).map(c => c.excerpt);
  check(a.includes(P.trim()), 'a passage naming a listed party outranks one hitting only a key term');
  const b = extractCitations([PT, PT, PT, PP].join('\n'), 'b.txt', criteria).map(c => c.excerpt);
  check(b.includes(PP.trim()), 'a passage naming two listed parties outranks one party plus a key term');
  const c = extractCitations([P, P, P, PT].join('\n'), 'c.txt', criteria).map(x => x.excerpt);
  check(c.includes(PT.trim()), 'a key term still lifts a passage above the same passage without it');
}

// --- Chat and email exports: budget by message count ---
{
  const texts = read('src/samples/okafor/04_Text_Messages_Export.txt');
  const cited = extractCitations(texts, 'texts.txt', { parties: ['Okafor', 'Kowalski', 'Willis', 'Chen'] });
  check(cited.length > 3, `short multi-message export is not limited to 3 slots (${cited.length} cited)`);
  check(cited.some(c => /No problem\. Take care of your dad\./.test(c.excerpt))
    && cited.some(c => /SW to DO: Understood\./.test(c.excerpt)), 'Okafor approvals still cited');
}

// --- Dates without a year ---
{
  const email = read('testdata/stress-matter/out/120/2024-12-19 Oyelaran to Haldane - CO 14 notice window.eml');
  const dates = extractDates(email);
  check(dates.some(d => !d.inferred && formatEventDate(d.time) === '12/19/2024'), 'RFC 2822 Date header is read as the email date');
  const nov8 = dates.find(d => d.label === 'November 8');
  check(nov8?.inferred && formatEventDate(nov8.time) === '11/8/2024' && nov8.anchor === 'email date',
    '"November 8" takes its year from the email Date header');

  const memo = 'Status memo dated June 2, 2023.\n\nThe crane arrives March 4. Frames due 4/3.';
  const m = extractDates(memo).filter(d => d.inferred);
  check(m.length === 2 && m.every(d => new Date(d.time).getFullYear() === 2023 && d.anchor === 'June 2, 2023'),
    'with no header, the year comes from the nearest full date');

  check(extractDates('Call back March 4 about the beams.').length === 0, 'with nothing to infer from, the date is not placed');
  check(extractDates('Dated 1/5/2024. Use 3/4 inch ply and 5/8" bolts; $1/2 off.').filter(d => d.inferred).length === 0,
    'measurements and prices are not read as dates');
  check(extractDates('Dated 1/5/2024. You may 30 days.').filter(d => d.inferred).length === 0, '"may" the verb is not a month');

  const co = extractCitations(email, 'co14.eml', {
    parties: ['Tallis', 'Brightwater', 'Keystone', 'Lindqvist Rowe', 'Whitcomb', 'Oyelaran', 'Haldane', 'Wierzbicki', 'Carranza'],
    terms: ['Harpeth Ridge', 'Change Order 14', 'ductwork', 'liquidated damages', 'substantial completion', 'retainage'],
  });
  check(co.some(c => /blew the 21-day window/.test(c.excerpt)), 'Brightwater CO 14 email: the admission is cited');
  check(co.some(c => /November 29/.test(c.excerpt) && c.signals.includes('date')), 'Brightwater CO 14 email: the missed deadline is cited as dated');
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
