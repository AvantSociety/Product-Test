// Dates without a year on the chronology and in the viewer, and a chronology
// step that runs at processing speed.
//
// Run against a dev or preview server:
//   node tests/e2e/dates.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const urlArg = process.argv.indexOf('--url');
const URL_ = urlArg > -1 ? process.argv[urlArg + 1] : (process.env.E2E_URL || 'http://localhost:5173/Product-Test/');
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;
const check = (c, msg) => { if (!c) failures += 1; console.log((c ? 'PASS ' : 'FAIL ') + msg); };

async function fresh() {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(URL_);
  await p.waitForTimeout(800);
  return p;
}
const go = async (p, n) => { await p.locator('button', { has: p.locator(`h3:text-is("${n}")`) }).first().click(); };
const NOTE = 'year inferred from document date';

// ---------- Delgado: "11/14" in an email is placed with an inferred year ----------
{
  const p = await fresh();
  await p.getByRole('button', { name: /Load sample/ }).nth(1).click();
  await p.waitForTimeout(2500);
  await go(p, 'Review & Designate');
  await p.waitForTimeout(300);
  const started = Date.now();
  await go(p, 'Deep Analysis');
  await p.getByText(/Chronology assembled — \d+ dated events?/).first().waitFor({ timeout: 10000 });
  const elapsed = Date.now() - started;
  check(elapsed < 2500, `chronology for the sample completes at processing speed (${elapsed} ms, was ~120 ms per document plus 200 ms)`);
  const phase = await p.getByText(/Chronology assembled/).first().innerText();
  check(new RegExp(`\\(\\d+ with ${NOTE}\\) in \\d+\\.\\d+s`).test(phase), `phase line reports inferred dates and real time: "${phase}"`);

  const inferred = p.locator(`[aria-label*="(${NOTE})"]`);
  check(await inferred.count() > 0, 'inferred dates are marked on the chronology');
  const label = await inferred.first().getAttribute('aria-label');
  check(/^11\/14\/2025 \(year inferred from document date\) — 04_Email_Video_Retention\.txt/.test(label),
    `"11/14" placed as 11/14/2025 from the email's own date (${label})`);
  check(new RegExp(`\\d+ with ${NOTE}`).test(await p.locator('body').innerText()), 'chronology heading counts the inferred dates');

  await inferred.first().hover();
  await p.waitForTimeout(200);
  check(/Year inferred from document date \(email date\)/.test(await p.locator('body').innerText()), 'hover card says the year was inferred and from what');

  // Open the document from the chart: the viewer marks the inferred date.
  await inferred.first().click();
  await p.waitForTimeout(500);
  const mark = p.locator('mark[data-inferred-date]').first();
  check(await mark.count() > 0, 'viewer marks the inferred date');
  const title = await mark.getAttribute('title');
  check(title?.includes(NOTE) && title.startsWith('11/14/2025'), `viewer mark explains the inference (${title})`);
  check(p.errs.length === 0, 'Delgado: no console errors ' + p.errs.join(' | '));
}

// ---------- No year to infer: not placed on the chronology ----------
{
  const p = await fresh();
  const dir = mkdtempSync(join(tmpdir(), 'dates-'));
  const file = join(dir, 'callback_note.txt');
  writeFileSync(file, 'Call back March 4 about the beams and confirm the 4/3 delivery window with the yard foreman.\n');
  await go(p, 'Discovery Ingest');
  await p.setInputFiles('input[type=file]', [file]);
  await p.waitForTimeout(1500);
  await go(p, 'Review & Designate');
  await p.getByRole('button', { name: /Select All/ }).click();
  await go(p, 'Deep Analysis');
  await p.getByText(/Analysis complete — no dated events found/).first().waitFor({ timeout: 10000 });
  check(await p.getByText('NO DATED EVENTS FOUND').count() > 0, 'a date with no year to infer from is left off the chronology');
  check(p.errs.length === 0, 'no-anchor: no console errors ' + p.errs.join(' | '));
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
await b.close();
process.exit(failures ? 1 : 0);
