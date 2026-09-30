// A reload changes nothing. The matter is completed stage by stage, the page
// is reloaded, and every stage's state and every export must read the same.
//
// Run against a dev or preview server:
//   node tests/e2e/reload.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import {
  launch, checker, freshPage, go, body, loadSample, runCheck, download, preview, stored, normalize,
} from './helpers.mjs';

const b = await launch();
const { check, failures } = checker();
const LEASE = '06_Lease_Renewal_Letter.txt';

// ---------- Regression: a reload must not put a held-back document on the index ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  await runCheck(p);
  check(/CURE REQUIRED/.test(await body(p)) && (await body(p)).includes(LEASE), 'Harlow check holds back the lease letter');
  await p.reload();
  await p.waitForTimeout(1500);
  const idx = await download(p, 'Production Index');
  check(!idx.text.includes(LEASE), 'after a reload the exported Production Index does not list the held-back lease letter');
  check(/PNC-000001,01_Supply_Agreement\.txt,Produced/.test(idx.text), 'the index still lists the documents the check cleared');
  check(p.errs.length === 0, 'regression: no console errors ' + p.errs.join(' | '));
}

// ---------- Full workflow, reload, compare ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);

  // Stage 02: firm name
  await go(p, 'Review & Designate');
  await p.getByPlaceholder('Printed at the head of every deliverable').fill('Morrow & Pike LLP');
  await p.locator('h4:text-is("Privilege review")').click();
  // Stage 03: check, acknowledge the held-back letter
  await runCheck(p);
  await p.getByRole('button', { name: /Acknowledge exceptions/ }).click();
  // Stage 04: chronology
  await go(p, 'Deep Analysis');
  await p.getByText(/Chronology assembled/).first().waitFor();
  // Stage 05: a note and a tag
  await go(p, 'Citation Matrix');
  await p.getByPlaceholder('Add a note about this specific passage...').fill('Key admission on delivery.');
  await p.getByRole('button', { name: 'Save Note' }).click();
  await p.getByRole('button', { name: /^Tags/ }).first().click();
  await p.getByPlaceholder('New tag…').first().fill('delay');
  await p.getByPlaceholder('New tag…').first().press('Enter');
  // Stage 06: counsel's own text
  await go(p, 'Interactive Review');
  await p.locator('textarea').last().fill('Counsel analysis: the delivery was late and the buyer rejected it in time.');
  // Stage 07: approval
  await go(p, 'Override & Refine');
  await p.getByPlaceholder(/Approving attorney/).fill('Dana Ruiz');
  await p.getByRole('button', { name: 'Approve and Package' }).click();
  await p.waitForTimeout(400);
  // Stage 08: one export
  await download(p, 'Production Index');
  await p.waitForTimeout(800);

  const TITLES = ['Citation Digest', 'Privilege Log', 'Production Index', 'Exceptions Report', 'Audit Log'];
  const snapshot = async () => {
    const out = { stages: {}, exports: {} };
    for (const stage of ['Integrity Check', 'Deep Analysis', 'Interactive Review', 'Override & Refine', 'Package Ready', 'Completion Check']) {
      await go(p, stage);
      await p.waitForTimeout(300);
      out.stages[stage] = normalize(await body(p));
    }
    out.stepper = await p.locator('div.flex-1.overflow-y-auto.p-4 button span.font-mono.truncate').allTextContents();
    for (const t of TITLES) out.exports[t] = normalize(await preview(p, t));
    out.stored = await stored(p);
    return out;
  };

  const before = await snapshot();
  check(/Production Complete/.test(before.stages['Completion Check']), 'workflow reaches Production Complete before the reload');
  if (!/Production Complete/.test(before.stages['Completion Check'])) {
    console.log(before.stages['Completion Check'].split('\n').filter(l => /Stage 0\d ·/.test(l)).join('\n'));
  }

  await p.reload();
  await p.waitForTimeout(2000);
  const after = await snapshot();

  for (const stage of Object.keys(before.stages)) {
    check(before.stages[stage] === after.stages[stage], `Stage "${stage}" reads the same after the reload`);
  }
  check(JSON.stringify(before.stepper) === JSON.stringify(after.stepper), 'every stage\'s progress state is the same after the reload');
  for (const t of TITLES) check(before.exports[t] === after.exports[t], `${t} export is identical after the reload`);

  const keys = ['integrityReport', 'exceptionsAck', 'manifest', 'timeline', 'timelineKey', 'approval', 'batesAssignments',
    'batesNext', 'firmName', 'auditLog', 'memoText', 'memoEdited', 'notes', 'citations', 'privilege', 'selectedForReview'];
  for (const k of keys) {
    check(JSON.stringify(before.stored[k]) === JSON.stringify(after.stored[k]), `stored ${k} unchanged by the reload`);
  }
  check(p.errs.length === 0, 'workflow: no console errors ' + p.errs.join(' | '));
}

console.log(failures() ? `\n${failures()} FAILED` : '\nall passed');
await b.close();
process.exit(failures() ? 1 : 0);
