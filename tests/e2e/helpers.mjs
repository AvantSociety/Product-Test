// Shared browser helpers for the e2e suites.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const urlArg = process.argv.indexOf('--url');
export const URL_ = urlArg > -1 ? process.argv[urlArg + 1] : (process.env.E2E_URL || 'http://localhost:5173/Product-Test/');

export async function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

export function checker() {
  let failures = 0;
  const check = (c, msg) => { if (!c) failures += 1; console.log((c ? 'PASS ' : 'FAIL ') + msg); };
  return { check, failures: () => failures };
}

export async function freshPage(browser) {
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })).newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept(d.defaultValue()));
  await p.goto(URL_);
  await p.waitForTimeout(800);
  return p;
}

export const go = async (p, n) => {
  await p.locator('button', { has: p.locator(`h3:text-is("${n}")`) }).first().click();
  await p.waitForTimeout(400);
};
export const body = (p) => p.locator('body').innerText();
export const row = (p, n) => p.locator('div.rounded-xl.border')
  .filter({ has: p.locator(`span.font-mono.text-xs.font-bold:text-is("${n}")`) }).first();
export const card = (p, title) => p.locator('div.border.rounded-2xl').filter({ has: p.locator(`h4:text-is("${title}")`) }).first();

export async function loadSample(p, index = 0) {
  await p.getByRole('button', { name: /Load sample/ }).nth(index).click();
  await p.waitForTimeout(2500);
}

export async function runCheck(p) {
  await go(p, 'Integrity Check');
  await p.getByRole('button', { name: /(Run|Re-run) Readiness Check/ }).click();
  await p.waitForTimeout(1500);
}

export async function download(p, title, button = /^(CSV|Text)$/) {
  await go(p, 'Package Ready');
  const [dl] = await Promise.all([p.waitForEvent('download'), card(p, title).getByRole('button', { name: button }).click()]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
}

/** A deliverable's preview text, which, unlike a download, adds nothing to the log. */
export async function preview(p, title) {
  await go(p, 'Package Ready');
  await card(p, title).getByRole('button', { name: 'Preview' }).click();
  await p.waitForTimeout(300);
  const text = await p.locator('pre').first().textContent();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  return text;
}

export const stored = (p) => p.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('discovery-framework');
  r.onsuccess = () => {
    const get = r.result.transaction('matter').objectStore('matter').get('current');
    get.onsuccess = () => { r.result.close(); resolve(get.result); };
    get.onerror = () => reject(get.error);
  };
}));

/** Rewrites the stored matter directly, bypassing the app. */
export const tamper = (p, fnSource) => p.evaluate((src) => new Promise((resolve) => {
  const fn = new Function('m', src);
  const r = indexedDB.open('discovery-framework');
  r.onsuccess = () => {
    const store = r.result.transaction('matter', 'readwrite').objectStore('matter');
    const get = store.get('current');
    get.onsuccess = () => {
      const m = get.result;
      fn(m);
      store.put(m, 'current').onsuccess = () => { r.result.close(); resolve(); };
    };
  };
}), fnSource);

export async function openLedger(p) {
  await p.getByRole('button', { name: /Ledger/ }).first().click();
  await p.waitForTimeout(300);
}
export async function closeLedger(p) {
  await p.getByRole('button', { name: 'Close ledger' }).click();
  await p.waitForTimeout(200);
}

/** Checks a pasted chain head in the ledger drawer and returns the result text. */
export async function checkHead(p, head) {
  await openLedger(p);
  await p.getByLabel('Chain head from an export').fill(head);
  await p.getByRole('button', { name: 'Check', exact: true }).click();
  await p.waitForTimeout(200);
  const text = await p.getByTestId('head-check').innerText();
  await closeLedger(p);
  return text;
}

export const printedHead = (text) => (text.match(/Audit log chain head at export: (entry \d+, SHA-256 [0-9a-f]{64})/) || [])[1];

/** Drops the per-generation timestamp so two renderings can be compared. */
export const normalize = (text) => String(text).replace(/Generated [^\r\n]*/g, 'Generated <time>');
