// Every ingested document must end in an explicit designation, and Stage 09
// must reflect it. Two fresh matters: an uploaded set with a scanned PDF, and
// the Harlow sample with its misfiled letter.
//
// Run against a dev or preview server:
//   node tests/e2e/unaccounted.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
const FIX = fileURLToPath(new URL('./fixtures', import.meta.url));
const SCAN_NAME = '2025-02-19 Site sign-in sheet (scan).pdf';
const SCAN = `${FIX}/${SCAN_NAME}`;
const urlArg = process.argv.indexOf('--url');
const URL_ = urlArg > -1 ? process.argv[urlArg + 1] : (process.env.E2E_URL || 'http://localhost:5173/Product-Test/');

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ok = (c, msg) => console.log((c ? 'PASS ' : 'FAIL ') + msg);
let failures = 0;
const check = (c, msg) => { if (!c) failures += 1; ok(c, msg); };

async function fresh() {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })).newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_);
  await p.waitForTimeout(800);
  return p;
}
const body = (p) => p.locator('body').innerText();
const go = async (p, n) => { await p.locator('button', { has: p.locator(`h3:text-is("${n}")`) }).first().click(); await p.waitForTimeout(500); };
const row = (p, name) => p.locator('div.rounded-xl.border').filter({ has: p.locator(`span.font-mono.text-xs.font-bold:text-is("${name}")`) }).first();
const checklistItem = (p, stage) => p.locator('button').filter({ hasText: `Stage 0${stage} ·` }).first();
const itemDone = async (p, stage) => (await checklistItem(p, stage).locator('svg.text-emerald-500').count()) > 0;
const runCheck = async (p) => {
  await go(p, 'Integrity Check');
  await p.getByRole('button', { name: /(Run|Re-run) Readiness Check/ }).click();
  await p.waitForTimeout(1500);
};
const markNR = async (p, name, reason) => {
  await go(p, 'Review & Designate');
  await row(p, name).getByRole('button', { name: 'Not Responsive…' }).click();
  const submit = row(p, name).getByRole('button', { name: 'Mark Not Responsive' });
  const disabledEmpty = await submit.isDisabled();
  await row(p, name).getByPlaceholder(/Reason it is not responsive/).fill(reason);
  await submit.click();
  await p.waitForTimeout(300);
  return disabledEmpty;
};
// Drives the rest of the workflow: analysis, a note, an edited draft, approval
// and one download.
async function finishMatter(p) {
  await go(p, 'Deep Analysis');
  await p.getByText('Analysis Complete').waitFor({ timeout: 20000 });
  await go(p, 'Citation Matrix');
  await p.getByPlaceholder('Add a note about this specific passage...').fill('Key admission.');
  await p.getByRole('button', { name: 'Save Note' }).click();
  await go(p, 'Interactive Review');
  await p.locator('textarea').last().fill('Counsel analysis: the record supports the claim.');
  await go(p, 'Override & Refine');
  await p.getByPlaceholder(/Approving attorney/).fill('Dana Ruiz');
  await p.getByRole('button', { name: 'Approve and Package' }).click();
  await p.waitForTimeout(600);
  const card = p.locator('div.border.rounded-2xl').filter({ has: p.locator('h4:text-is("Audit Log")') }).first();
  const [dl] = await Promise.all([p.waitForEvent('download'), card.getByRole('button', { name: /^CSV$/ }).click()]);
  return readFileSync(await dl.path(), 'utf8');
}

// ---------- A: uploaded set with an unselected scanned PDF ----------
{
  const p = await fresh();
  await go(p, 'Discovery Ingest');
  await p.setInputFiles('input[type=file]', [
    `${FIX}/email_thread.txt`, `${FIX}/invoice.txt`,
    `${FIX}/contract.txt`, `${FIX}/inspection_log.txt`, SCAN,
  ]);
  await p.waitForTimeout(3000);
  await go(p, 'Review & Designate');
  let t = await body(p);
  check((t.match(/UNACCOUNTED/g) || []).length === 5, 'A: all 5 freshly ingested documents start unaccounted (no implicit Produce)');
  for (const n of ['email_thread.txt', 'invoice.txt', 'contract.txt', 'inspection_log.txt']) {
    await row(p, n).locator('button').first().click();
  }
  await p.waitForTimeout(300);
  t = await body(p);
  check(/1 of 5 ingested documents have no designation|1 of 5 ingested documents has no designation/.test(t)
    || /1 of 5 ingested document/.test(t), 'A: Stage 02 warns 1 of 5 ingested documents has no designation');

  await runCheck(p);
  t = await body(p);
  const firstException = await p.locator('div.bg-amber-500\\/\\[0\\.06\\]').first().innerText();
  check(firstException.includes(SCAN_NAME) && /Unaccounted: no designation/.test(firstException)
    && /Run OCR on this document/.test(firstException), 'A: unselected scanned PDF listed first as Unaccounted, with the OCR cure');
  check(/CURE REQUIRED/.test(t) && !/READY TO PRODUCE/.test(t), 'A: unaccounted scan blocks the check (CURE REQUIRED)');
  check(/1\s*unaccounted/.test(t), 'A: breakdown counts 1 unaccounted');
  check(await p.getByRole('button', { name: /Acknowledge exceptions/ }).count() === 0
    && /must be\s+designated in Stage/.test(t), 'A: unaccounted document cannot be acknowledged away');

  await go(p, 'Completion Check');
  t = await body(p);
  check(!(await itemDone(p, 2)) && /4 of 5 ingested documents designated · 1 unaccounted/.test(t),
    'A: Stage 09 item 2 fails and reports "4 of 5 ingested documents designated · 1 unaccounted"');
  check(/Production Not Yet Complete/.test(t), 'A: Stage 09 not complete while a document is unaccounted');

  const disabledEmpty = await markNR(p, SCAN_NAME, 'Site sign-in sheet; no bearing on the claims');
  check(disabledEmpty, 'A: Not Responsive cannot be recorded without a reason');
  t = await body(p);
  check(/NOT RESPONSIVE/.test(t) && /Reason: Site sign-in sheet; no bearing on the claims/.test(t) && !/UNACCOUNTED/.test(t),
    'A: Not Responsive with a reason recorded on the row');

  await runCheck(p);
  t = await body(p);
  check(/READY TO PRODUCE/.test(t) && !/Unaccounted: no designation/.test(t), 'A: Not Responsive with a reason passes the check');

  await go(p, 'Completion Check');
  t = await body(p);
  check(await itemDone(p, 2) && /5 of 5 ingested documents designated/.test(t) && /1 not responsive/.test(t),
    'A: Stage 09 item 2 passes and reports 5 of 5 designated, 1 not responsive');
  check(await itemDone(p, 3), 'A: Stage 09 item 3 passes on a clean check');

  const audit = await finishMatter(p);
  check(/Designated not responsive.*2025-02-19 Site sign-in sheet \(scan\)\.pdf — reason: Site sign-in sheet; no bearing on the claims/.test(audit),
    'A: audit log records the Not Responsive designation and its reason');
  await go(p, 'Completion Check');
  check(/Production Complete/.test(await body(p)), 'A: matter reaches Production Complete');
  check(p.errs.length === 0, 'A: no console errors ' + p.errs.join(' | '));
}

// ---------- B: Harlow sample, misfiled letter ----------
{
  const p = await fresh();
  const MISFILED = '06_Lease_Renewal_Letter.txt';
  await p.getByRole('button', { name: /Load sample/ }).first().click();
  await p.waitForTimeout(2500);
  await go(p, 'Review & Designate');
  let t = await body(p);
  check(!/UNACCOUNTED/.test(t), 'B: sample loads with all six documents designated');

  // Skipping the misfiled letter by deselecting it is no longer silent.
  await row(p, MISFILED).locator('button').first().click();
  await p.waitForTimeout(300);
  check(/UNACCOUNTED/.test(await row(p, MISFILED).innerText()), 'B: deselected misfiled letter shows UNACCOUNTED');
  await runCheck(p);
  t = await body(p);
  check(/Unaccounted: no designation/.test(t) && /CURE REQUIRED/.test(t), 'B: skipped misfiled letter is held as Unaccounted');
  await go(p, 'Completion Check');
  check(!(await itemDone(p, 2)) && /5 of 6 ingested documents designated · 1 unaccounted/.test(await body(p)),
    'B: Stage 09 item 2 fails while the misfiled letter is unaccounted');

  // Put it back: the check holds it for no connection; counsel acknowledges.
  await go(p, 'Review & Designate');
  await row(p, MISFILED).locator('button').first().click();
  await runCheck(p);
  t = await body(p);
  check(/CURE REQUIRED/.test(t) && /Does not appear to belong|Names no party or key term/.test(t) && !/Unaccounted: no designation/.test(t), 'B: reselected letter held as not belonging to the matter, no longer unaccounted');
  await go(p, 'Completion Check');
  check(!(await itemDone(p, 3)) && /held back, not acknowledged/.test(await body(p)), 'B: Stage 09 item 3 fails until exceptions are acknowledged');
  await go(p, 'Integrity Check');
  await p.getByRole('button', { name: /Acknowledge exceptions/ }).click();
  await p.waitForTimeout(300);
  check(/Exceptions acknowledged at/.test(await body(p)), 'B: acknowledgment shown in Stage 03');
  await go(p, 'Completion Check');
  check(await itemDone(p, 3) && /held back, acknowledged/.test(await body(p)), 'B: Stage 09 item 3 passes once acknowledged');

  const audit = await finishMatter(p);
  check(/Acknowledged 1 held-back document — proceeding with the ready set/.test(audit), 'B: acknowledgment in the audit log');
  const card = p.locator('div.border.rounded-2xl').filter({ has: p.locator('h4:text-is("Exceptions Report")') }).first();
  const [dl] = await Promise.all([p.waitForEvent('download'), card.getByRole('button', { name: /^CSV$/ }).click()]);
  const report = readFileSync(await dl.path(), 'utf8');
  check(/Acknowledged by counsel .*: production proceeds with the ready set while the document below is held back/.test(report)
    && report.includes(MISFILED), 'B: exceptions report lists the letter with counsel\'s acknowledgment');
  await go(p, 'Completion Check');
  check(/Production Complete/.test(await body(p)), 'B: matter with acknowledged exceptions reaches Production Complete');
  check(p.errs.length === 0, 'B: no console errors ' + p.errs.join(' | '));
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
await b.close();
process.exit(failures ? 1 : 0);
