// The audit log records material actions with an accurate actor, is
// hash-chained so a stored alteration is detected, and Clear Matter asks for
// an export first.
//
// Run against a dev or preview server:
//   node tests/e2e/audit.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const urlArg = process.argv.indexOf('--url');
const URL_ = urlArg > -1 ? process.argv[urlArg + 1] : (process.env.E2E_URL || 'http://localhost:5173/Product-Test/');
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;
const check = (c, msg) => { if (!c) failures += 1; console.log((c ? 'PASS ' : 'FAIL ') + msg); };

const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const go = async n => { await p.locator('button', { has: p.locator(`h3:text-is("${n}")`) }).first().click(); await p.waitForTimeout(400); };
const row = n => p.locator('div.rounded-xl.border').filter({ has: p.locator(`span.font-mono.text-xs.font-bold:text-is("${n}")`) }).first();
const openLedger = async () => { await p.getByRole('button', { name: /Ledger/ }).first().click(); await p.waitForTimeout(300); };
const closeLedger = async () => { await p.getByRole('button', { name: 'Close ledger' }).click(); await p.waitForTimeout(200); };
const ledgerText = async () => { await openLedger(); const t = await p.locator('body').innerText(); await closeLedger(); return t; };
const readStored = () => p.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('discovery-framework');
  r.onsuccess = () => {
    const get = r.result.transaction('matter').objectStore('matter').get('current');
    get.onsuccess = () => { r.result.close(); resolve(get.result); };
    get.onerror = () => reject(get.error);
  };
  r.onerror = () => reject(r.error);
}));
const downloadLog = async () => {
  await openLedger();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Export CSV/ }).click()]);
  await closeLedger();
  return readFileSync(await dl.path(), 'utf8');
};

await p.goto(URL_);
await p.waitForTimeout(800);
await p.getByRole('button', { name: /Load sample/ }).first().click();
await p.waitForTimeout(2500);

// --- Actors: ingest is System, counsel is "User" until a name is recorded ---
let stored = await readStored();
const ingest = stored.auditLog.filter(e => e.action === 'Ingested document');
check(ingest.length === 6 && ingest.every(e => e.actor === 'System'), 'ingest entries are attributed to System');
check(stored.auditLog.find(e => e.action.startsWith('Loaded sample'))?.actor === 'User', 'counsel action before any name is attributed to User');

// --- Matter name and Bates prefix ---
await go('Review & Designate');
const prefix = p.locator('label:text-is("Bates Prefix") + input');
await prefix.click(); await prefix.press('End'); await p.keyboard.type('X');
const name = p.locator('label:text-is("Matter Name") + input').first();
await name.click(); await name.press('End'); await p.keyboard.type(' (Amended)');
await p.locator('h4:text-is("Privilege review")').click();
await p.waitForTimeout(500);
stored = await readStored();
check(stored.auditLog.some(e => e.action === 'Changed Bates prefix' && /→ PNCX$/.test(e.target)), 'Bates prefix change logged');
check(stored.auditLog.some(e => e.action === 'Renamed matter' && /\(Amended\)"$/.test(e.target)), 'matter name change logged');

// --- Privilege description edit appears in the log ---
const PRIV = '05_Email_to_Counsel_PRIVILEGED.txt';
const desc = row(PRIV).getByPlaceholder('Description for the log');
await desc.click();
await desc.press('End');
await p.keyboard.type(' Dated March 2024.');
await p.locator('h4:text-is("Privilege review")').click();
await p.waitForTimeout(300);
let t = await ledgerText();
check(/Edited privilege description/.test(t) && t.includes(PRIV) && /Dated March 2024\./.test(t),
  'privilege description edit appears in the log');
stored = await readStored();
check(stored.auditLog.filter(e => e.action === 'Edited privilege description').length === 1,
  'a description typed letter by letter is one entry');

// --- Other material actions ---
await row(PRIV).locator('select').selectOption('Work Product');
await row('03_Invoice_HIS-20417.txt').locator('button').first().click();
await row('03_Invoice_HIS-20417.txt').locator('button').first().click();
await go('Discovery Ingest');
const terms = p.getByPlaceholder('escrow, wire transfer, account 4471-882');
await terms.click(); await terms.press('End'); await p.keyboard.type(', pallet');
await p.locator('body').click({ position: { x: 5, y: 500 } });
await p.waitForTimeout(500);
stored = await readStored();
const actions = stored.auditLog.map(e => e.action);
check(actions.includes('Set privilege basis'), 'privilege basis change logged');
check(actions.includes('Deselected from production (now unaccounted)') && actions.includes('Selected for production (Produce)'),
  'selection changes logged');
check(actions.includes('Changed screening criteria: key terms'), 'screening criteria change logged');

await go('Integrity Check');
await p.getByRole('button', { name: /Run Readiness Check/ }).click();
await p.waitForTimeout(1500);
stored = await readStored();
check(stored.auditLog.find(e => e.action.startsWith('Ran readiness check'))?.actor === 'System', 'readiness check attributed to System');

await go('Interactive Review');
const memo = p.locator('textarea').last();
await memo.click(); await memo.press('End');
await p.keyboard.type(' Counsel analysis follows.');
await go('Override & Refine');
stored = await readStored();
check(stored.auditLog.filter(e => e.action === 'Edited brief').length === 1, 'a brief editing session is one entry');

await p.getByPlaceholder(/Approving attorney/).fill('Dana Ruiz');
await p.getByRole('button', { name: 'Approve and Package' }).click();
await p.waitForTimeout(500);
await go('Review & Designate');
await row('03_Invoice_HIS-20417.txt').locator('button').first().click();
await p.waitForTimeout(500);
stored = await readStored();
const last = stored.auditLog.slice(-4);
check(stored.auditLog.find(e => e.action === 'Approved package for service')?.actor === 'Dana Ruiz', 'approval attributed to the named attorney');
check(last.some(e => e.action.startsWith('Deselected') && e.actor === 'Dana Ruiz'), 'later counsel actions carry the recorded name');
check(last.some(e => e.action.startsWith('Approval voided') && e.actor === 'System'), 'approval void logged as System');
check(last.some(e => e.action.startsWith('Readiness check voided') && e.actor === 'System'), 'check void logged as System');

// --- Export carries the hashes ---
let csv = await downloadLog();
check(/Seq,Timestamp,Actor,Action,Target,Previous Hash,Hash \(SHA-256\)/.test(csv), 'CSV export includes hash columns');
check(/Chain intact at export\. Head hash: [0-9a-f]{64}/.test(csv), 'CSV export states the chain is intact');
check(/Any change made after an export can be detected by comparing against the chain head printed on that export\./.test(csv)
  && !/any later alteration is detectable/.test(csv), 'CSV carries the log statement');
check(/Audit log chain head at export: entry \d+, SHA-256 [0-9a-f]{64}/.test(csv), 'CSV prints the chain head at export');
await openLedger();
check(/Chain intact/.test(await p.getByTestId('chain-status').innerText()), 'drawer shows "Chain intact"');
check(/Each entry is chained to the one before it\. Any change made after an export can be detected by comparing against the chain head printed on that export\./.test(await p.locator('body').innerText()),
  'drawer shows the new statement');
await closeLedger();

// --- A plain reload keeps the chain and voids nothing ---
const before = (await readStored()).auditLog.length;
await p.reload();
await p.waitForTimeout(1500);
await openLedger();
check(/Chain intact/.test(await p.getByTestId('chain-status').innerText()), 'chain intact after a reload');
await closeLedger();
const afterReload = (await readStored()).auditLog;
check(afterReload.length === before, 'reload appends no entries (no spurious voids)');

// --- Altering a stored entry breaks the chain ---
await p.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('discovery-framework');
  r.onsuccess = () => {
    const store = r.result.transaction('matter', 'readwrite').objectStore('matter');
    const get = store.get('current');
    get.onsuccess = () => {
      const m = get.result;
      m.auditLog[2] = { ...m.auditLog[2], target: 'altered after the fact' };
      store.put(m, 'current').onsuccess = () => { r.result.close(); resolve(); };
    };
    get.onerror = () => reject(get.error);
  };
}));
await p.reload();
await p.waitForTimeout(1500);
await openLedger();
check(/Chain broken at entry 3/.test(await p.getByTestId('chain-status').innerText()), 'altered stored entry shows "Chain broken at entry 3"');
await closeLedger();
csv = await downloadLog();
check(/CHAIN BROKEN AT ENTRY 3/.test(csv), 'CSV export reports the break');

// --- Clear prompts for export and says it erases the log ---
await p.getByRole('button', { name: /^Clear$/ }).first().click();
await p.waitForTimeout(300);
const prompt = p.getByTestId('clear-export-prompt');
check(await prompt.isVisible() && /Clearing erases the audit log\./.test(await prompt.innerText()), 'Clear states that clearing erases the audit log');
const [dl] = await Promise.all([p.waitForEvent('download'), prompt.getByRole('button', { name: /Export audit log/ }).click()]);
check(/audit-log\.csv$/.test(dl.suggestedFilename()), 'Clear offers the audit log export');
check(/Exported/.test(await prompt.innerText()), 'Clear confirms the export');
await p.getByRole('button', { name: 'Clear matter' }).click();
await p.waitForTimeout(800);
stored = await readStored();
check(!stored || (stored.auditLog || []).length === 0, 'matter cleared after export');

check(errs.length === 0, 'no console errors ' + errs.join(' | '));
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
await b.close();
process.exit(failures ? 1 : 0);
