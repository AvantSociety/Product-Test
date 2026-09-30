// Measures local semantic search (prototype) in Stage 05: bytes the model
// and runtime download, time to build the index, renderer memory, search
// response time, and where known admissions land for plain-language queries.
//
// With the stress set, as a phase of the full run (after Stage 05):
//   node testdata/stress-matter/run.mjs <dir> --url <app> --search [--model-dir <dir>]
// With the Harlow sample on its own:
//   node testdata/stress-matter/search_bench.mjs --url <app> [--model-dir <dir>]
//
// --model-dir serves model files from a local folder in place of the site's
// public/models/, for timing a stand-in before the real files are committed.
// Rankings from a stand-in say nothing about the real model.
//
// Run against a production build (npm run build && npx vite preview) for
// honest timings. Memory is the resident set of the browser's renderer
// processes (the page and its worker share one), sampled once a second.
import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

export const QUERIES = [
  { query: 'material did not meet the specified thickness', target: 'We ran 22 gauge on the Level 3 supply trunks' },
  { query: 'we missed the deadline to ask for more time', target: 'We blew the 21-day window on Change Order 14' },
  { query: 'the superintendent told them to keep working anyway', target: "Don't hold up the ceiling grid on 3" },
];
export const HARLOW_QUERIES = [
  { query: 'why the shipment was late', target: 'Our steel coil shipment from the mill was held up' },
  { query: 'we were never warned about the delay in advance', target: 'we did not receive any written notice of delay' },
];

const MODEL_PATH = '/models/Xenova/all-MiniLM-L6-v2/';

/** Serves model files from a local folder; call before the page loads. */
export async function routeModelDir(context, dir) {
  await context.route(u => u.pathname.includes(MODEL_PATH), (route) => {
    const rel = new URL(route.request().url()).pathname.split(MODEL_PATH)[1];
    const file = join(dir, rel);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, body: readFileSync(file), contentType: rel.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  });
}

/**
 * Records every model and runtime file the page fetches, with the bytes that
 * actually crossed the network (0 when served from the browser's cache).
 */
export function watchDownloads(context) {
  const files = [];
  context.on('requestfinished', async (req) => {
    const url = req.url();
    if (!url.includes(MODEL_PATH) && !url.endsWith('.wasm')) return;
    const res = await req.response();
    const sizes = await req.sizes().catch(() => null);
    files.push({ url: url.replace(/^https?:\/\/[^/]+/, ''), status: res?.status(), bytes: sizes?.responseBodySize ?? 0 });
  });
  context.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes(MODEL_PATH) || url.endsWith('.wasm')) files.push({ url: url.replace(/^https?:\/\/[^/]+/, ''), failed: req.failure()?.errorText, bytes: 0 });
  });
  return files;
}

function rendererRssMB() {
  try {
    const out = execSync("ps -eo rss,args | grep -- '--type=renderer' | grep -v grep", { encoding: 'utf8' });
    return Math.round(out.trim().split('\n').reduce((n, l) => n + Number(l.trim().split(/\s+/)[0] || 0), 0) / 1024);
  } catch { return null; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Builds the index in Stage 05 and runs the queries. Page must be on Stage 05. */
export async function measureSearch(page, { queries, downloads, log = console.log }) {
  const out = { memoryMB: { before: rendererRssMB() } };
  const panel = page.getByTestId('semantic-search');
  let peak = out.memoryMB.before || 0;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) { peak = Math.max(peak, rendererRssMB() || 0); await sleep(1000); }
  })();

  const t0 = Date.now();
  await panel.getByRole('button', { name: 'Build search index' }).click();
  await page.getByText(/Embedding passages: |Index: |Search is unavailable/).first().waitFor({ timeout: 10 * 60 * 1000 });
  if (await page.getByTestId('search-error').count()) throw new Error(await page.getByTestId('search-error').innerText());
  out.modelLoadSeconds = (Date.now() - t0) / 1000;
  let last = Date.now();
  while (!(await page.getByTestId('search-index-status').count())) {
    if (await page.getByTestId('search-error').count()) throw new Error(await page.getByTestId('search-error').innerText());
    if (Date.now() - last > 60000) {
      last = Date.now();
      log((await page.getByTestId('search-index-progress').innerText().catch(() => '')).trim());
    }
    await sleep(500);
  }
  out.buildSeconds = (Date.now() - t0) / 1000;
  out.embedSeconds = +(out.buildSeconds - out.modelLoadSeconds).toFixed(1);
  out.index = (await page.getByTestId('search-index-status').innerText()).trim();
  out.memoryMB.afterBuild = rendererRssMB();
  out.memoryMB.peakDuringBuild = peak;
  out.downloads = downloads.slice();
  out.downloadMB = +(downloads.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(2);

  out.queries = [];
  for (const { query, target } of queries) {
    const times = [];
    let results = [];
    for (let i = 0; i < 3; i++) {
      await panel.getByLabel('Search by meaning').fill(query);
      const s = Date.now();
      await panel.getByRole('button', { name: 'Search', exact: true }).click();
      await page.waitForFunction(() => {
        const b = document.querySelector('[data-testid="semantic-search"] button[type="submit"]');
        return b && !/Searching/.test(b.textContent) && document.querySelector('[data-testid="semantic-result"]');
      }, null, { timeout: 120000 });
      times.push(Date.now() - s);
      results = await page.getByTestId('semantic-result').allInnerTexts();
    }
    const at = results.findIndex(r => r.includes(target));
    out.queries.push({
      query, target,
      rank: at === -1 ? null : at + 1,
      top: results.slice(0, 5).map(r => r.replace(/\s+/g, ' ').slice(0, 160)),
      responseMs: times,
    });
    log(`"${query}": target ${at === -1 ? 'not in the top 10' : `at rank ${at + 1}`}; ${times.join(' / ')} ms`);
  }
  sampling = false;
  await sampler;
  out.memoryMB.afterSearch = rendererRssMB();
  return out;
}

// ---------- Harlow sample on its own ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { createRequire } = await import('module');
  const require = createRequire(new URL('../../package.json', import.meta.url));
  const { chromium } = require('playwright');
  const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
  const url = arg('--url') || 'http://localhost:5310/Product-Test/';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const offSite = [];
  context.on('request', r => { if (!r.url().startsWith(new URL(url).origin) && !/^(data|blob):/.test(r.url())) offSite.push(r.url()); });
  if (arg('--model-dir')) await routeModelDir(context, resolve(arg('--model-dir')));
  const downloads = watchDownloads(context);
  const page = await context.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.error(`[browser ${m.type()}] ${m.text()}`); });
  page.on('worker', w => w.on('console', m => console.error(`[worker ${m.type()}] ${m.text()}`)));
  page.on('crash', () => console.error('[page crashed]'));
  await page.goto(url);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Load sample/ }).first().click();
  await page.waitForTimeout(2500);
  const go = async (t) => { await page.locator('button', { has: page.locator(`h3:text-is("${t}")`) }).first().click(); await page.waitForTimeout(400); };
  await go('Integrity Check');
  await page.getByRole('button', { name: /Run Readiness Check/ }).click();
  await page.waitForTimeout(1500);
  await go('Citation Matrix');
  const result = await measureSearch(page, { queries: HARLOW_QUERIES, downloads });
  // A second visit: reload, search once, and record what is fetched again.
  const before = downloads.length;
  await page.reload();
  await page.waitForTimeout(1500);
  await go('Citation Matrix');
  const t = Date.now();
  await page.getByTestId('semantic-search').getByLabel('Search by meaning').fill(HARLOW_QUERIES[0].query);
  await page.getByTestId('semantic-search').getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByTestId('semantic-result').first().waitFor({ timeout: 120000 });
  result.afterReload = {
    firstSearchMs: Date.now() - t,
    fetched: downloads.slice(before),
    downloadMB: +(downloads.slice(before).reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(2),
  };
  result.offSiteRequests = offSite;
  result.modelDir = arg('--model-dir');
  const outFile = arg('--out');
  if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
}
