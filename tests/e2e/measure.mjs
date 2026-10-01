// Measuring the matter: counsel's verdicts on quotes (keep, dismiss, add by
// hand) and the Time Report built from the audit log.
//
// Run against a dev or preview server:
//   node tests/e2e/measure.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import {
  launch, checker, freshPage, go, body, card, loadSample, runCheck, preview, stored,
} from './helpers.mjs';

const b = await launch();
const { check, failures } = checker();
const DOC = '01_Supply_Agreement.txt';
const HAND = 'Buyer may reject any goods that do not conform to the specifications';

const p = await freshPage(b);
await loadSample(p, 0);
await runCheck(p);
await go(p, 'Citation Matrix');

// --- Keep one quote, dismiss another ---
const cards = p.locator('[data-review]');
const keptText = (await cards.nth(0).locator('p').first().innerText()).slice(0, 40);
const dismissedText = (await cards.nth(1).locator('p').first().innerText()).slice(0, 40);
await cards.nth(0).getByRole('button', { name: 'Keep' }).click();
await cards.nth(1).getByRole('button', { name: 'Dismiss' }).click();
await p.waitForTimeout(300);
check(await cards.nth(0).getAttribute('data-review') === 'kept' && /KEPT/.test(await cards.nth(0).innerText()), 'Keep marks the quote kept');
check(await cards.nth(1).getAttribute('data-review') === 'dismissed' && /DISMISSED/.test(await cards.nth(1).innerText())
  && await cards.nth(1).getByRole('button', { name: 'Restore' }).count() === 1, 'Dismiss marks the quote dismissed, with Restore');

// --- Add a passage the tool missed, by hand ---
await p.evaluate((phrase) => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const i = node.textContent.indexOf(phrase);
    if (i > -1 && node.parentElement.closest('.select-text')) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + phrase.length);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      node.parentElement.closest('.select-text').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return;
    }
  }
}, HAND);
await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Save citation' }).click();
await p.waitForTimeout(400);

let m = await stored(p);
const cites = m.citations[DOC];
check(cites.filter(c => c.review === 'kept').length === 1 && cites.filter(c => c.review === 'dismissed').length === 1, 'verdicts are saved with the matter');
check(cites.some(c => c.origin === 'user' && c.excerpt === HAND), 'the hand-added passage is saved as counsel\'s own quote');
const actions = m.auditLog.map(e => e.action);
check(actions.includes('Kept extracted quote') && actions.includes('Dismissed extracted quote') && actions.includes('Added citation'),
  'keep, dismiss and add are each logged');

// --- Dismissed quotes leave the digest ---
const digest = await preview(p, 'Citation Digest');
check(!digest.includes(dismissedText) && digest.includes(keptText) && digest.includes(HAND),
  'the digest keeps kept and hand-added quotes and drops the dismissed one');

// --- Verdicts survive a reload and a re-analysis ---
await p.reload(); await p.waitForTimeout(1500);
await go(p, 'Override & Refine');
await p.getByRole('button', { name: /Re-analyze Documents/ }).click();
await p.waitForTimeout(1500);
m = await stored(p);
check(m.citations[DOC].filter(c => c.review === 'kept').length === 1 && m.citations[DOC].filter(c => c.review === 'dismissed').length === 1,
  'verdicts survive a reload and a re-extraction');

// --- Stage 09 panel and the exported report ---
await go(p, 'Completion Check');
const panel = await p.getByTestId('time-report').innerText();
check(/of counsel time/.test(panel) && /gaps over\s+10 minutes/.test(panel) && /Time spent, not time saved/.test(panel),
  'Stage 09 shows counsel time with its method and the "not time saved" caveat');
const acc = await p.getByTestId('quote-accuracy').innerText();
check(/Quotes kept\s+1/i.test(acc) && /Dismissed\s+1/i.test(acc) && /Added by hand\s+1/i.test(acc), `quote accuracy counts (${acc.replace(/\s+/g, ' ')})`);
check(/kept: 50% \(1 of 2\)/.test(panel) && /found by the tool: 50% \(1 of 2\)/.test(panel), 'kept rate 1/2 and found rate 1/(1+1), with their counts');

const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Export Time Report/ }).click()]);
const { readFileSync } = await import('fs');
const report = readFileSync(await dl.path(), 'utf8');
check(/COUNSEL ACTIVE TIME/.test(report) && /PRODUCED BY THE TOOL/.test(report) && /QUOTE ACCURACY/.test(report), 'exported report has all three sections');
check(/Dismissed: 1/.test(report) && /Added by hand \(passages the tool missed\): 1/.test(report), 'exported report carries the verdicts');
check(/Bates numbers assigned: 6/.test(report) && /Privilege log entries generated: 1/.test(report), 'exported report counts the tool\'s outputs');
check(/time-report\.txt$/.test(dl.suggestedFilename()), 'report downloads as a text file');
await p.waitForTimeout(800);
m = await stored(p);
check(m.auditLog.some(e => e.action === 'Exported time report'), 'the export is logged');

await go(p, 'Package Ready');
check(await card(p, 'Time Report').count() === 1 && (await card(p, 'Time Report').getByTestId('export-blocked').count()) === 0,
  'Stage 08 offers the Time Report, never blocked');
check(/A planning estimate of reading time, not time saved/.test(await body(p)), 'the Stage 08 estimate is labelled as not time saved');

check(p.errs.length === 0, 'no console errors ' + p.errs.join(' | '));
console.log(failures() ? `\n${failures()} FAILED` : '\nall passed');
await b.close();
process.exit(failures() ? 1 : 0);
