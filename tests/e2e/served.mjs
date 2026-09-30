// What served deliverables rest on and say: a current readiness check, the
// firm's name, the audit log's chain head, the production manifest, Bates
// numbers that are never reused, and a chronology that is never stale.
//
// Run against a dev or preview server:
//   node tests/e2e/served.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  launch, checker, freshPage, go, body, row, card, loadSample, runCheck, download, preview,
  stored, tamper, checkHead, printedHead,
} from './helpers.mjs';

const SAMPLES = fileURLToPath(new URL('../../src/samples/harlow', import.meta.url));
const b = await launch();
const { check, failures } = checker();
const SERVED = ['Citation Digest', 'Privilege Log', 'Production Index'];

// ---------- Exports require a current readiness check ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  await go(p, 'Package Ready');
  for (const t of SERVED) {
    const c = card(p, t);
    const reason = await c.getByTestId('export-blocked').innerText().catch(() => '');
    check(/No readiness check result/.test(reason) && await c.getByRole('button', { name: /^(CSV|Text)$/ }).isDisabled(),
      `${t}: blocked with a reason before any check`);
  }
  check(!(await card(p, 'Audit Log').getByRole('button', { name: /^CSV$/ }).isDisabled()), 'Audit Log is never blocked');

  await runCheck(p);
  await go(p, 'Package Ready');
  check((await p.getByTestId('export-blocked').count()) === 0, 'served exports unblock once a current check exists');

  // A stored result whose inputs no longer match reads as stale, not current.
  await tamper(p, "m.privilege['05_Email_to_Counsel_PRIVILEGED.txt'].description += ' (edited outside the app)';");
  await p.reload(); await p.waitForTimeout(1500);
  await go(p, 'Package Ready');
  const stale = await card(p, 'Production Index').getByTestId('export-blocked').innerText().catch(() => '');
  check(/out of date/.test(stale), 'a restored result whose inputs changed blocks export as out of date');
  await go(p, 'Completion Check');
  check(/Check out of date/.test(await body(p)), 'Stage 09 reports the stale check');
  check(p.errs.length === 0, 'gating: no console errors ' + p.errs.join(' | '));
}

// ---------- Firm name, chain head, manifest, storage, approval ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  check(/Browser storage: (persistent|best-effort)/.test(await p.getByTestId('storage-status').innerText().catch(async () => {
    await go(p, 'Orientation Hub'); return p.getByTestId('storage-status').innerText();
  })), 'storage status is shown once a matter exists');
  let m = await stored(p);
  check(m.auditLog.some(e => e.action === 'Requested persistent browser storage'), 'the storage request and its answer are logged');

  await runCheck(p);
  await go(p, 'Package Ready');
  check(await p.getByTestId('firm-missing').count() > 0, 'Stage 08 warns when no firm name is set');
  let idx = await preview(p, 'Production Index');
  check(/^\[Firm name not set\] — Production Index/.test(idx), 'without a firm name the header says so');

  await go(p, 'Review & Designate');
  const firm = p.getByPlaceholder('Printed at the head of every deliverable');
  await firm.fill('Morrow & Pike LLP');
  await p.locator('h4:text-is("Privilege review")').click();
  await p.waitForTimeout(300);

  const texts = {};
  for (const t of [...SERVED, 'Exceptions Report', 'Audit Log']) texts[t] = await preview(p, t);
  for (const [t, text] of Object.entries(texts)) {
    check(/Morrow & Pike LLP|MORROW & PIKE LLP/.test(text.split('\n').slice(0, 4).join('\n')), `${t}: header carries the firm name`);
    check(!/Avant Society/.test(text), `${t}: no "Avant Society" in the served text`);
    check(!/Prepared with Case Intelligence/.test(text), `${t}: no product footer by default`);
    check(/Audit log chain head at export: entry \d+, SHA-256 [0-9a-f]{64}/.test(text), `${t}: prints the audit log chain head`);
  }
  m = await stored(p);
  const man = m.manifest;
  check(man && man.count === 4, `manifest covers the production set only (${man?.count} documents: 6 minus the withheld email and the held-back letter)`);
  for (const t of ['Production Index', 'Citation Digest']) {
    check(texts[t].includes(man.hash) && new RegExp(`Production manifest SHA-256 \\(${man.count} documents`).test(texts[t]),
      `${t}: prints the full production manifest`);
  }
  check(!texts['Privilege Log'].includes(man.hash), 'Privilege Log does not claim the production manifest');

  await go(p, 'Override & Refine');
  await p.locator('text=Add a “Prepared with Case Intelligence” footer').click();
  await p.waitForTimeout(200);
  check(/Prepared with Case Intelligence\s*$/.test((await preview(p, 'Production Index')).trim()), 'footer appears when turned on');
  await go(p, 'Override & Refine');
  await p.locator('text=Add a “Prepared with Case Intelligence” footer').click();

  await p.getByPlaceholder(/Approving attorney/).fill('Dana Ruiz');
  await p.getByRole('button', { name: 'Approve and Package' }).click();
  await p.waitForTimeout(500);
  m = await stored(p);
  check(m.approval?.chainHead?.hash?.length === 64 && m.approval.chainHead.seq > 0, 'approval record stores the chain head');
  const digest = await preview(p, 'Citation Digest');
  check(digest.includes(`audit log chain head at approval: entry ${m.approval.chainHead.seq}, SHA-256 ${m.approval.chainHead.hash}`),
    'digest prints the chain head stored with the approval');

  // Truncation after an export is detected against the exported head.
  const exported = await download(p, 'Production Index');
  const head = printedHead(exported.text);
  check(!!head, `exported index prints its chain head (${head?.slice(0, 20)}…)`);
  check(/^Matches entry \d+/.test(await checkHead(p, head)), 'the untouched log matches the exported head');
  const seq = Number(head.match(/entry (\d+)/)[1]);
  await tamper(p, `m.auditLog = m.auditLog.slice(0, ${seq - 2});`);
  await p.reload(); await p.waitForTimeout(1500);
  const after = await checkHead(p, head);
  check(/entries were removed after that export/.test(after), `truncation after the export is detected: "${after}"`);
  check(p.errs.length === 0, 'served: no console errors ' + p.errs.join(' | '));
}

// ---------- Draft from findings over edited text ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  await go(p, 'Interactive Review');
  const memo = p.locator('textarea').last();
  await memo.fill('Counsel opening paragraph.\n\nCounsel closing paragraph.');
  // Put the caret after the first paragraph with real keystrokes.
  await memo.click();
  await p.keyboard.press('Control+Home');
  for (let i = 0; i < 27; i++) await p.keyboard.press('ArrowRight');
  await p.getByRole('button', { name: /Draft from findings/ }).click();
  await p.waitForTimeout(200);
  check(await p.getByRole('alertdialog').count() === 1 && /Your draft has edits/.test(await body(p)), 'drafting over edited text asks first');
  await p.getByRole('button', { name: 'Insert at cursor' }).click();
  await p.waitForTimeout(200);
  const inserted = await memo.inputValue();
  check(/^Counsel opening paragraph\.\n\nThis digest is drawn from/.test(inserted) && /Counsel closing paragraph\.$/.test(inserted),
    'insert at cursor keeps counsel\'s text and places the digest at the cursor');
  await p.getByRole('button', { name: /Draft from findings/ }).click();
  await p.getByRole('button', { name: 'Cancel' }).click();
  check((await memo.inputValue()) === inserted, 'cancel leaves the draft untouched');
  await p.getByRole('button', { name: /Draft from findings/ }).click();
  await p.getByRole('button', { name: 'Replace draft' }).click();
  await p.waitForTimeout(300);
  check(/^This digest is drawn from/.test(await memo.inputValue()), 'replace swaps in the generated digest');
  const m = await stored(p);
  const actions = m.auditLog.map(e => e.action);
  check(actions.includes('Inserted a generated digest draft at the cursor') && actions.includes('Replaced the edited brief with a generated digest draft'),
    'both choices are logged');
  check(p.errs.length === 0, 'draft: no console errors ' + p.errs.join(' | '));
}

// ---------- Bates numbers are never reused; chronology never stale ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  await runCheck(p);
  let m = await stored(p);
  const removed = '03_Invoice_HIS-20417.txt';
  const retired = m.batesAssignments[removed];
  const highest = Math.max(...Object.values(m.batesAssignments).map(v => Number(v.slice(-6))));

  // Chronology built, then a designation change makes it stale.
  await go(p, 'Deep Analysis');
  await p.getByText(/Chronology assembled/).first().waitFor();
  m = await stored(p);
  const eventsBefore = m.timeline.length;
  await go(p, 'Review & Designate');
  const r = row(p, '04_Receiving_Inspection_Log.txt');
  await r.getByRole('button', { name: 'Withhold', exact: true }).click();
  await r.locator('select').selectOption('Work Product');
  await r.getByPlaceholder('Description for the log').fill('Inspection notes prepared for counsel.');
  await p.locator('h4:text-is("Privilege review")').click();
  await p.waitForTimeout(800);
  await go(p, 'Completion Check');
  m = await stored(p);
  check(m.auditLog.some(e => e.action === 'Rebuilt chronology after the producible set changed'), 'a designation change rebuilds the chronology automatically');
  check(m.timeline.every(e => e.source !== '04_Receiving_Inspection_Log.txt') && m.timeline.length < eventsBefore,
    `the rebuilt chronology excludes the newly withheld document (${eventsBefore} → ${m.timeline.length} events)`);
  check(/Stage 04 · \d+ dated events/.test(await body(p)), 'Stage 09 item 4 reflects the rebuilt chronology');

  // Remove a numbered document: its number is retired and never reissued.
  await go(p, 'Discovery Ingest');
  await p.getByTitle(`Remove ${removed}`).click();
  await p.waitForTimeout(1000);
  m = await stored(p);
  check(m.retiredBates.some(x => x.number === retired) && m.auditLog.some(e => e.action === 'Retired Bates number' && e.target.startsWith(retired)),
    `removing a document retires ${retired} and logs it`);
  // A reissued copy of the removed invoice: same matter, new content.
  const reissue = join(mkdtempSync(join(tmpdir(), 'bates-')), '03_Invoice_HIS-20417_reissued.txt');
  writeFileSync(reissue, readFileSync(`${SAMPLES}/03_Invoice_HIS-20417.txt`, 'utf8') + '\nReissued with corrected remittance details.\n');
  await p.setInputFiles('input[type=file]', [reissue]);
  await p.waitForTimeout(1500);
  await go(p, 'Review & Designate');
  const NEW = '03_Invoice_HIS-20417_reissued.txt';
  await row(p, NEW).locator('button').first().click();
  await runCheck(p);
  m = await stored(p);
  const fresh = Number(m.batesAssignments[NEW].slice(-6));
  const all = Object.values(m.batesAssignments);
  check(fresh === highest + 1 && new Set(all).size === all.length && !all.includes(retired),
    `a new document gets ${m.batesAssignments[NEW]}, above every number issued; ${retired} is not reused`);
  const idx = await preview(p, 'Production Index');
  check(new RegExp(`${retired},,"?Withdrawn: number retired, not reused`).test(idx) && !idx.includes(`${retired},${removed}`),
    'the index shows the retired number as withdrawn, without the removed document\'s name');
  check(p.errs.length === 0, 'bates: no console errors ' + p.errs.join(' | '));
}

// ---------- Every assigned Bates number is accounted for on the index ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  await runCheck(p);                       // PNC-000001 … PNC-000006
  let m = await stored(p);
  const numbers = m.batesAssignments;
  // Deselect a numbered document and mark it Not Responsive.
  await go(p, 'Review & Designate');
  const NR = '03_Invoice_HIS-20417.txt';
  await row(p, NR).locator('button').first().click();
  await row(p, NR).getByRole('button', { name: 'Not Responsive…' }).click();
  await row(p, NR).getByPlaceholder(/Reason it is not responsive/).fill('Duplicate of the invoice in the thread');
  await row(p, NR).getByRole('button', { name: 'Mark Not Responsive' }).click();
  await runCheck(p);
  const idx = await preview(p, 'Production Index');
  const lines = idx.split('\n').map(l => l.trim()).filter(l => /^PNC-\d{6},/.test(l));
  const listed = lines.map(l => l.slice(0, 10));
  check(JSON.stringify(listed) === JSON.stringify(['PNC-000001', 'PNC-000002', 'PNC-000003', 'PNC-000004', 'PNC-000005', 'PNC-000006']),
    `every assigned number appears once, in order, with no gaps (${listed.join(' ')})`);
  check(lines.some(l => l === `${numbers[NR]},,Not produced: Not Responsive,,,,`), `the deselected document's ${numbers[NR]} shows "Not produced: Not Responsive"`);
  check(lines.some(l => l.startsWith(`${numbers['05_Email_to_Counsel_PRIVILEGED.txt']},,Not produced: Withheld`)), 'the withheld document\'s number shows as not produced, withheld');
  check(lines.some(l => l === `${numbers['06_Lease_Renewal_Letter.txt']},,Not produced: Held back by the readiness check,,,,`), 'the held-back document\'s number shows as not produced, held back');
  check(!idx.includes('06_Lease_Renewal_Letter') && !idx.includes(NR), 'not-produced rows do not name the document');
  check(p.errs.length === 0, 'not produced: no console errors ' + p.errs.join(' | '));
}

// ---------- Annotation, draft label and estimate rates ----------
{
  const p = await freshPage(b);
  await loadSample(p, 0);
  await go(p, 'Interactive Review');
  check(/Draft not started/i.test(await body(p)) && !/Machine-assembled from findings/.test(await body(p)),
    'the untouched placeholder is not labelled machine-assembled');
  await p.getByRole('button', { name: /Draft from findings/ }).click();
  await p.waitForTimeout(200);
  check(/Machine-assembled from findings/.test(await body(p)), 'a generated draft is labelled machine-assembled');

  // A note on the withheld email does not satisfy the annotation item.
  await tamper(p, "const c = m.citations['05_Email_to_Counsel_PRIVILEGED.txt'][0]; m.notes['05_Email_to_Counsel_PRIVILEGED.txt::' + c.id] = 'Note on a withheld document';");
  await p.reload(); await p.waitForTimeout(1500);
  await go(p, 'Completion Check');
  const item5 = p.locator('button').filter({ hasText: 'Stage 05 ·' }).first();
  check(/At least one producing finding annotated/.test(await item5.innerText()) && (await item5.locator('svg.text-emerald-500').count()) === 0,
    'a note on a withheld document does not satisfy "At least one producing finding annotated"');

  await runCheck(p);
  await go(p, 'Package Ready');
  await p.getByLabel('Pages per hour').fill('25');
  await p.getByLabel('Hourly rate ($)').fill('400');
  await p.locator('h4:text-is("Review Effort Estimate")').click();
  await p.waitForTimeout(600);
  const est = await body(p);
  check(/Calculated at 25 pages per hour and \$400 per hour/.test(est) && /AT \$400\/HR/.test(est), 'estimate uses the rates entered');
  await p.reload(); await p.waitForTimeout(1500);
  await go(p, 'Package Ready');
  check(await p.getByLabel('Pages per hour').inputValue() === '25' && await p.getByLabel('Hourly rate ($)').inputValue() === '400',
    'estimate rates are saved with the matter');
  const m = await stored(p);
  check(m.auditLog.some(e => e.action === 'Changed estimate review rate' && e.target === '50 → 25'), 'rate changes are logged');
  check(p.errs.length === 0, 'rows 10/16/25: no console errors ' + p.errs.join(' | '));
}

console.log(failures() ? `\n${failures()} FAILED` : '\nall passed');
await b.close();
process.exit(failures() ? 1 : 0);
