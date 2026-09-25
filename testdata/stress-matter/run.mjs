// Drives Case Intelligence through every stage with a generated collection,
// the way a paralegal would, and records what the app shows at each stage.
//
//   node testdata/stress-matter/run.mjs out/120 [--url http://localhost:5310/Product-Test/]
//
// Writes results.json next to the collection. answer_key.py compares it with
// the ground truth in manifest.json.
//
// Two readiness passes are run on purpose:
//   Pass 1: every document selected, as if someone clicked through without
//           reading. This tests the safety net: does the check catch the
//           scans, the empty file, the corrupt export and the other client's
//           documents on its own?
//   Pass 2: the attorney's actual selection ("Select relevant", then add the
//           responsive text messages and drop the holiday party), with the
//           privilege and redaction calls made. This is the set that gets
//           analysed, cited and packaged.

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright');

const dir = resolve(process.argv[2] || 'testdata/stress-matter/out/120');
const urlArg = process.argv.indexOf('--url');
const APP_URL = urlArg > 0 ? process.argv[urlArg + 1] : 'http://localhost:5302/Product-Test/';
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const files = readdirSync(dir).filter(f => !['manifest.json', 'results.json', 'failure.png'].includes(f) && !f.endsWith('.xlsx') && !f.startsWith('.'));
const byName = Object.fromEntries(manifest.documents.map(d => [d.file, d]));

const t0 = Date.now();
const timings = {};
const time = async (label, fn) => { const s = Date.now(); const r = await fn(); timings[label] = (Date.now() - s) / 1000; return r; };
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(90 * 1000);
const LONG = { timeout: 60 * 60 * 1000 };
process.on('unhandledRejection', async (e) => { console.error('FAILED:', e.message.split('\n')[0]); await page.screenshot({ path: join(dir, 'failure.png'), fullPage: false }).catch(() => {}); process.exit(1); });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const go = async (title) => {
  await page.locator('button', { has: page.locator(`h3:text-is("${title}")`) }).first().click();
  await page.waitForTimeout(400);
};
const readMatter = () => page.evaluate(() => new Promise((res) => {
  const req = indexedDB.open('discovery-framework', 1);
  req.onsuccess = () => {
    const tx = req.result.transaction('matter', 'readonly');
    const get = tx.objectStore('matter').get('current');
    get.onsuccess = () => res(get.result);
  };
}));
const rowFor = (name) => page.locator('div.rounded-xl').filter({ has: page.locator(`span.font-mono.text-xs.font-bold:text-is(${JSON.stringify(name)})`) }).first();

const results = { size: files.length, url: APP_URL, startedAt: new Date().toISOString() };

// ---------------- Stage 00 → 01: criteria and upload ----------------
await page.goto(APP_URL);
await page.waitForTimeout(1200);
await go('Discovery Ingest');
const c = manifest.criteria;
await page.getByPlaceholder('Acme Holdings, Jane Doe, Meridian Partners').fill(c.parties);
await page.getByPlaceholder('escrow, wire transfer, account 4471-882').fill(c.terms);
const dates = page.locator('input[type=date]');
await dates.nth(0).fill(c.from);
await dates.nth(1).fill(c.to);

const expectedAccepted = files.length - manifest.documents.filter(d => d.integrity === 'duplicate').length;
log(`uploading ${files.length} files`);
await time('upload_and_index', async () => {
  await page.setInputFiles('input[type=file]', files.map(f => join(dir, f)));
  // Wait for the count to appear and then hold steady. The count is not
  // assumed: how many the app accepts is itself one of the results.
  let last = null, steady = 0;
  while (steady < 4) {
    await page.waitForTimeout(1000);
    const n = await page.evaluate(() => Number((document.body.innerText.match(/(\d+) ingested/) || [])[1] || 0));
    steady = n > 0 && n === last ? steady + 1 : 0;
    last = n;
  }
  results.accepted = last;
});
results.expectedAccepted = expectedAccepted;
log('ingested');
await page.waitForTimeout(1500);
results.uploadNotices = await page.evaluate(() =>
  [...document.querySelectorAll('p, span, li')].map(e => e.textContent.trim())
    .filter(t => /already ingested|scanned image|not supported|Could not read/.test(t) && t.length < 400));
results.uploadNotices = [...new Set(results.uploadNotices)];
results.chips = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim())
  .filter(t => /^(ALL|LIKELY|POSSIBLE|NO MATCH|OUT OF PERIOD|UNSCREENED)\s*\d+$/.test(t)));

// ---------------- Stage 02: matter settings, what the row shows ----------------
await go('Review & Designate');
const nameInput = page.locator('label:text-is("Matter Name") + input');
await nameInput.fill(manifest.matter);
const prefix = page.locator('label:text-is("Bates Prefix") + input');
if (await prefix.count()) await prefix.fill(manifest.batesPrefix);

results.rows = await time('stage02_render_rows', () => page.evaluate(() => {
  const out = {};
  document.querySelectorAll('span.font-mono.text-xs.font-bold').forEach(span => {
    const btn = span.closest('button');
    if (!btn) return;
    const meta = [...btn.querySelectorAll('span')].map(s => s.textContent.trim());
    const pt = meta.find(t => /^\d+p · /.test(t)) || '';
    const badge = meta.find(t => /^(LIKELY|POSSIBLE|NO MATCH|OUT OF PERIOD|UNSCREENED)$/.test(t)) || null;
    out[span.textContent.trim()] = { pages: parseInt(pt, 10) || null, type: pt.split('· ')[1] || null, screen: badge };
  });
  return out;
}));

// ---------------- Pass 1: everything selected ----------------
const clickSelectButton = async (label) => {
  const b = page.getByRole('button', { name: label, exact: true }).first();
  if (await b.count()) await b.click();
  await page.waitForTimeout(300);
};
await clickSelectButton('Select relevant');
const unselected = Object.entries(results.rows).filter(([, r]) => ['NO MATCH', 'OUT OF PERIOD'].includes(r.screen)).map(([n]) => n);
for (const name of unselected) await rowFor(name).locator('button').first().click();
log(`pass 1: selected all (${unselected.length} added by hand)`);

const readReadiness = () => page.evaluate(() => {
  const body = document.body.innerText;
  const state = (body.match(/READY TO PRODUCE|CURE REQUIRED|SET DOES NOT COHERE|RE-COLLECTION ADVISED/) || [null])[0];
  const exceptions = [...document.querySelectorAll('div.p-3.rounded-xl.border')]
    .filter(d => d.className.includes('amber-500/[0.06]'))
    .map(d => ({
      name: d.querySelector('span.font-mono.font-bold')?.textContent.trim(),
      bates: d.querySelectorAll('span.font-mono')[1]?.textContent.trim(),
      defects: [...d.querySelectorAll('p.text-amber-500')].map(p => p.textContent.trim()),
      detail: d.innerText.match(/Shares [\d.]+% .*?averages [\d.]+%/s)?.[0]?.replace(/\s+/g, ' ') || null,
    }));
  const advisories = [...document.querySelectorAll('div.p-3.rounded-xl.border')]
    .filter(d => d.querySelector('span.text-\\[11px\\].font-bold') && d.querySelector('p.break-words'))
    .map(d => ({ label: d.querySelector('span').textContent.trim(), detail: d.querySelectorAll('p')[0]?.textContent.trim(),
                 names: d.querySelector('p.break-words').textContent }));
  return { state, exceptions, advisories };
});
const runCheck = async (label) => {
  await go('Integrity Check');
  await time(label, async () => {
    await page.getByRole('button', { name: /Run Readiness Check|Re-run/i }).first().click();
    await page.getByText(/READY TO PRODUCE|CURE REQUIRED|SET DOES NOT COHERE|RE-COLLECTION ADVISED/).first().waitFor(LONG);
  });
  await page.waitForTimeout(800);
  return readReadiness();
};
results.pass1 = await runCheck('pass1_readiness_check');
log(`pass 1: ${results.pass1.state}, ${results.pass1.exceptions.length} held`);

// ---------------- Pass 2: the attorney's selection and designations ----------------
await go('Review & Designate');
await clickSelectButton('Deselect All');
await clickSelectButton('Select relevant');
const addBack = manifest.documents.filter(d => d.planted && d.responsive !== 'No' && !String(d.responsive || '').startsWith('No')
  && d.integrity !== 'duplicate' && ['NO MATCH', 'OUT OF PERIOD'].includes(results.rows[d.file]?.screen)
  && d.responsive !== 'Attorney call' && !d.integrity);
const dropOut = manifest.documents.filter(d => String(d.responsive || '').startsWith('No')
  && !['NO MATCH', 'OUT OF PERIOD'].includes(results.rows[d.file]?.screen));
for (const d of addBack) await rowFor(d.file).locator('button').first().click();
for (const d of dropOut) await rowFor(d.file).locator('button').first().click();
results.attorneySelection = { addedByHand: addBack.map(d => d.file), removedByHand: dropOut.map(d => d.file) };

const designations = manifest.documents.filter(d => d.designation !== 'produce');
for (const d of designations) {
  const row = rowFor(d.file);
  await row.getByRole('button', { name: d.designation === 'withhold' ? 'Withhold' : 'Redact', exact: true }).click();
  await row.locator('select').selectOption(d.basis);
  await row.getByPlaceholder('Description for the log').fill(d.description);
}
await page.waitForTimeout(500);
results.selectionSummary = (await page.locator('body').innerText()).match(/\d+ selected · \d+ producible · \d+ withheld/)?.[0] || null;
log(`pass 2 selection: ${results.selectionSummary}`);

results.pass2 = await runCheck('pass2_readiness_check');
// A document the attorney deliberately added over a NO MATCH screen is held
// for confirmation. Confirm those (and only those), then check again.
const toConfirm = results.pass2.exceptions.filter(e => addBack.some(d => d.file === e.name)
  && e.defects.includes('Names no party or key term of this matter'));
if (toConfirm.length) {
  results.pass2BeforeConfirm = results.pass2;
  for (const e of toConfirm) {
    const card = page.locator('div.p-3.rounded-xl.border').filter({ has: page.locator(`span.font-mono.font-bold:text-is(${JSON.stringify(e.name)})`) }).first();
    await card.getByRole('button', { name: /belongs to the matter/ }).click();
    await page.waitForTimeout(300);
  }
  results.confirmedByAttorney = toConfirm.map(e => e.name);
  results.pass2 = await runCheck('pass2_readiness_check_after_confirm');
}
log(`pass 2: ${results.pass2.state}, ${results.pass2.exceptions.length} held`);

// ---------------- Stage 04: chronology ----------------
await go('Deep Analysis');
await time('stage04_analysis', async () => {
  await page.getByText(/Chronology assembled — \d+ dated event|Analysis complete — no dated events/).first().waitFor(LONG);
});
await page.waitForTimeout(800);
results.chronology = await page.evaluate(() => {
  const summary = document.body.innerText.match(/Chronology assembled — (\d+) dated events?/);
  const points = [...document.querySelectorAll('[aria-label$=". Open document."]')].map(e => e.getAttribute('aria-label'))
    .map(l => { const m = l.match(/^(\d+\/\d+\/\d+) — (.*)\. Open document\.$/); return m ? { date: m[1], source: m[2] } : null; }).filter(Boolean);
  return { events: summary ? Number(summary[1]) : 0, points };
});
log(`chronology: ${results.chronology.events} events, ${results.chronology.points.length} plotted`);

// ---------------- Stage 05: citations (from the app's own saved state) ----------------
await go('Citation Matrix');
await page.waitForTimeout(800);
log('reading saved matter');
const matter = await readMatter();
log('saved matter read');
results.documents = Object.fromEntries((matter.documents || []).map(d => [d.name, {
  type: d.type, pages: d.pages, pagesExact: d.pagesExact, needsOcr: d.needsOcr, chars: (d.content || '').length,
  hasReplacementChar: (d.content || '').includes('�'), hash: d.hash,
}]));
results.citations = Object.fromEntries(Object.entries(matter.citations || {}).map(([n, list]) =>
  [n, list.map(x => ({
    locator: x.page ? (x.pageEnd > x.page ? `Pages ${x.page}-${x.pageEnd}` : `Page ${x.page}`)
      : (x.lineEnd > x.line ? `Lines ${x.line}-${x.lineEnd}` : `Line ${x.line}`),
    excerpt: x.excerpt, signals: x.signals }))]));
results.bates = matter.batesAssignments;
results.privilege = matter.privilege;

// ---------------- Stage 07 → 08: approve, then download the deliverables ----------------
log('approving');
await go('Override & Refine');
await page.getByPlaceholder(/Approving attorney/).fill('Stephen Mabry (test approver)');
await page.getByRole('button', { name: 'Approve and Package' }).click();
await page.waitForTimeout(1000);
log('downloading deliverables');
results.deliverables = {};
for (const title of ['Privilege Log', 'Production Index', 'Exceptions Report']) {
  const card = page.locator('div.border.rounded-2xl').filter({ has: page.locator(`h4:text-is("${title}")`) }).first();
  const btn = card.getByRole('button', { name: /^(CSV|Text)$/ }).first();
  const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  const path = await dl.path();
  results.deliverables[title] = readFileSync(path, 'utf8');
}

// ---------------- Stage 09 ----------------
await go('Completion Check');
await page.waitForTimeout(600);
results.completion = (await page.locator('body').innerText()).slice(0, 6000);

results.storage = await page.evaluate(async () => {
  const est = await navigator.storage.estimate();
  return { usageMB: +(est.usage / 1048576).toFixed(1), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
});
results.timings = timings;
results.totalSeconds = (Date.now() - t0) / 1000;
results.errors = errors;
writeFileSync(join(dir, 'results.json'), JSON.stringify(results, null, 1));
log(`done in ${results.totalSeconds}s; ${errors.length} console errors`);
await browser.close();
