// Which passages win citation slots: listed parties only, boilerplate and
// routing text excluded, and the brief's work-product status set only by text
// counsel types.
//
// Run against a dev or preview server:
//   node tests/e2e/citations.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const FIX = fileURLToPath(new URL('./fixtures', import.meta.url));
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
  p.on('dialog', d => d.accept(d.defaultValue()));
  await p.goto(URL_);
  await p.waitForTimeout(800);
  return p;
}
const go = async (p, n) => { await p.locator('button', { has: p.locator(`h3:text-is("${n}")`) }).first().click(); await p.waitForTimeout(400); };
const stored = (p) => p.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('discovery-framework');
  r.onsuccess = () => {
    const get = r.result.transaction('matter').objectStore('matter').get('current');
    get.onsuccess = () => { r.result.close(); resolve(get.result); };
    get.onerror = () => reject(get.error);
  };
}));
const loadSample = async (p, index) => {
  await p.getByRole('button', { name: /Load sample/ }).nth(index).click();
  await p.waitForTimeout(2500);
  await p.waitForTimeout(600);
  return stored(p);
};
const allCitations = (m) => Object.values(m.citations).flat();
const ROUTING = /^\s*(from|to|cc|sent|subject|date|re)\s*:/im;

// ---------- Harlow ----------
{
  const p = await fresh();
  const m = await loadSample(p, 0);
  const contract = m.citations['01_Supply_Agreement.txt'] || [];
  check(contract.length > 0 && !contract.some(c => /IN WITNESS WHEREOF/i.test(c.excerpt)),
    'Harlow: the execution clause is no longer cited');
  check(!contract.some(c => /^\s*(By|Title)\s*:/m.test(c.excerpt)), 'Harlow: signature block lines are not cited');
  check(!allCitations(m).some(c => ROUTING.test(c.excerpt)), 'Harlow: no routing header line is cited in any document');
  const parties = ['Harlow', 'Pinecrest', 'Castellanos', 'Pruitt'];
  check(allCitations(m).filter(c => c.signals.includes('party')).every(c => parties.some(x => new RegExp(`\\b${x}\\b`, 'i').test(c.excerpt))),
    'Harlow: every "named party" citation names a listed party');
  check(!allCitations(m).some(c => c.signals.includes('proper_name')), 'Harlow: with parties listed, no "proper name" signal is used');

  // Tag a finding, insert its section: the draft stays a scaffold.
  await go(p, 'Citation Matrix');
  await p.getByRole('button', { name: /^Tags/ }).first().click().catch(() => {});
  const tagInput = p.getByPlaceholder('New tag…').first();
  await tagInput.fill('delay');
  await tagInput.press('Enter');
  await p.waitForTimeout(300);
  await go(p, 'Interactive Review');
  const header = () => p.locator('h3').filter({ hasText: /Privileged & Confidential|Draft scaffold/i }).first().innerText();
  const before = await header();
  await p.locator('button', { hasText: 'delay' }).first().click();
  await p.waitForTimeout(400);
  const memo = await p.locator('textarea').last().inputValue();
  check(/DELAY/.test(memo), 'Harlow: tag section inserted into the draft');
  check(/Draft scaffold/i.test(before) && /Draft scaffold/i.test(await header()),
    'Harlow: inserting a tag section alone does not change the header');
  await go(p, 'Completion Check');
  check(!(await p.locator('button').filter({ hasText: 'Stage 06 ·' }).first().locator('svg.text-emerald-500').count()),
    'Harlow: Stage 09 "Brief reviewed and edited" stays open after a tag insertion');
  await go(p, 'Interactive Review');
  await p.locator('textarea').last().click();
  await p.keyboard.press('End');
  await p.keyboard.type(' Counsel: the delay is admitted.');
  await p.locator('body').click({ position: { x: 5, y: 600 } });
  check(/Privileged & Confidential/i.test(await header()), 'Harlow: typed text marks the draft as work product');
  await go(p, 'Completion Check');
  check(await p.locator('button').filter({ hasText: 'Stage 06 ·' }).first().locator('svg.text-emerald-500').count() > 0,
    'Harlow: Stage 09 item passes once counsel types');
  check(p.errs.length === 0, 'Harlow: no console errors ' + p.errs.join(' | '));
}

// ---------- Okafor ----------
{
  const p = await fresh();
  const m = await loadSample(p, 2);
  const texts = (m.citations['04_Text_Messages_Export.txt'] || []).map(c => c.excerpt);
  check(texts.some(t => /No problem\. Take care of your dad\./.test(t)), 'Okafor: the 12/9 text approving the late arrival is cited');
  check(texts.some(t => /SW to DO: Understood\./.test(t)), 'Okafor: the 1/28 text approving the late arrival is cited');
  check(!texts.some(t => /^\s*(Device|Participants|Exported by)\s*:/m.test(t)), 'Okafor: export metadata lines are not cited');
  check(!allCitations(m).some(c => /^\s*From\s*:/m.test(c.excerpt)), 'Okafor: no "From:" line is cited');
  const chain = (m.citations['03_HR_Email_Chain.txt'] || []).map(c => c.excerpt);
  check(chain.some(t => /look like retaliation/.test(t)), 'Okafor: the earlier message below "Original Message" stays citable');
  check(p.errs.length === 0, 'Okafor: no console errors ' + p.errs.join(' | '));
}

// ---------- No parties listed: the signal is "proper name" ----------
{
  const p = await fresh();
  await go(p, 'Discovery Ingest');
  await p.setInputFiles('input[type=file]', [`${FIX}/email_thread.txt`, `${FIX}/contract.txt`]);
  await p.waitForTimeout(2000);
  const m = await stored(p);
  const signals = allCitations(m).flatMap(c => c.signals);
  check(signals.includes('proper_name') && !signals.includes('party'), 'no parties listed: two capitalised words are a "proper name", not a named party');
  check(p.errs.length === 0, 'no-parties: no console errors ' + p.errs.join(' | '));
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
await b.close();
process.exit(failures ? 1 : 0);
