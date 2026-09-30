// Local semantic search (prototype): the index is built from the documents
// being produced, stored with the matter, reused after a reload, marked stale
// when the production set changes and erased with the matter. A result is
// cited only through the "select text to cite it" prompt, and building or
// searching changes nothing in screening, the readiness check or the
// checklist. Every request stays on this site.
//
// The model is replaced by tests/e2e/fixtures/fake-transformers.mjs (a hashed
// bag of words), so this tests the plumbing, not the model's quality. Needs
// the dev server, where transformers.js is served as its own module:
//   node tests/e2e/search.mjs [--url URL]   (or E2E_URL=URL npm run test:e2e)
// Set CHROMIUM_PATH to use a preinstalled browser.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  URL_, launch, checker, go, body, row, loadSample, runCheck, stored,
} from './helpers.mjs';

const FAKE = readFileSync(fileURLToPath(new URL('./fixtures/fake-transformers.mjs', import.meta.url)), 'utf8');
const ORIGIN = new URL(URL_).origin;
const b = await launch();
const { check, failures } = checker();

async function searchPage({ fake = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const requests = [];
  ctx.on('request', r => requests.push(r.url()));
  if (fake) {
    await ctx.route(u => u.pathname.includes('@huggingface') && u.pathname.includes('transformers'),
      route => route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE }));
  }
  const p = await ctx.newPage();
  p.errs = [];
  p.requests = requests;
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept(d.defaultValue()));
  await p.goto(URL_);
  await p.waitForTimeout(800);
  return p;
}

/** Counts texts the fake model embeds, from the page's side. */
const listen = (p) => p.evaluate(() => {
  window.__bc?.close();
  window.__embedded = 0;
  window.__bc = new BroadcastChannel('fake-embedder');
  window.__bc.onmessage = (e) => { window.__embedded += e.data.embedded; };
});
const embeddedCount = (p) => p.evaluate(() => window.__embedded);

const vectorRecords = (p) => p.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('discovery-framework');
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('embeddings')) { db.close(); resolve(null); return; }
    const req = db.transaction('embeddings').objectStore('embeddings').getAll();
    req.onsuccess = () => { db.close(); resolve(req.result.map(x => ({ hash: x.hash, passages: x.passages.length }))); };
  };
}));

const panel = (p) => p.getByTestId('semantic-search');
async function buildIndex(p, button = 'Build search index') {
  await panel(p).getByRole('button', { name: button }).click();
  await p.getByTestId('search-index-status').waitFor({ timeout: 60000 });
  await p.waitForTimeout(500);
}
async function search(p, query) {
  await panel(p).getByLabel('Search by meaning').fill(query);
  await panel(p).getByRole('button', { name: 'Search', exact: true }).click();
  await p.getByTestId('semantic-result').first().waitFor({ timeout: 30000 });
  return p.getByTestId('semantic-result').allInnerTexts();
}
const offSite = (p) => p.requests.filter(u => !u.startsWith(ORIGIN) && !/^(data|blob):/.test(u));

// ---------- Semantic similarity feeds nothing outside Stage 05 ----------
for (const lib of ['relevance.js', 'integrity.js', 'cohesion.js', 'exports.js', 'citations.js']) {
  const src = readFileSync(fileURLToPath(new URL(`../../src/lib/${lib}`, import.meta.url)), 'utf8');
  check(!/semanticSearch|embedWorker|transformers/.test(src), `src/lib/${lib} does not use the search model`);
}

// ---------- Build, search, cite, reload, stale, clear ----------
{
  const p = await searchPage();
  await listen(p);
  await loadSample(p, 0);
  await runCheck(p);

  // The stage content, not the whole page: the ledger count in the header
  // and Stage 09's "Audit Events" figure rightly count the index build.
  const stageContent = () => p.locator('div.max-w-6xl.w-full.mx-auto').first().innerText();
  const snapshot = async () => {
    const out = {};
    for (const stage of ['Discovery Ingest', 'Review & Designate', 'Integrity Check']) {
      await go(p, stage);
      out[stage] = await stageContent();
    }
    await go(p, 'Completion Check');
    out.checklist = (await p.locator('button').filter({ hasText: /Stage 0\d ·/ }).allInnerTexts()).join('\n');
    out.progress = (await p.locator('div.flex-1.overflow-y-auto.p-4 button span.font-mono.truncate').allTextContents()).join('\n');
    const m = await stored(p);
    out.report = JSON.stringify(m.integrityReport);
    return out;
  };
  const before = await snapshot();

  await go(p, 'Citation Matrix');
  check(await panel(p).isVisible(), 'Stage 05 shows the search panel');
  check(await p.getByTestId('search-index-status').count() === 0, 'no index until counsel builds one');
  await buildIndex(p);
  let m = await stored(p);
  const built = m.auditLog.find(e => e.action === 'Built local search index');
  check(!!built && built.actor === 'System', `index build is logged (${built?.target})`);
  const passages = m.searchIndex?.passages;
  check(passages > 0 && m.searchIndex.docs === 4, `index covers the 4 documents being produced (${m.searchIndex?.docs} documents, ${passages} passages)`);
  check(await embeddedCount(p) === passages, `every indexed passage was embedded once (${await embeddedCount(p)} of ${passages})`);
  const records = await vectorRecords(p);
  check(records?.length === 4 && records.reduce((n, r) => n + r.passages, 0) === passages, 'vectors are stored per document in IndexedDB');
  const produced = new Set(m.integrityReport.ready.filter(n => m.privilege[n]?.status !== 'withhold'));
  const hashes = new Set(m.documents.filter(d => produced.has(d.name)).map(d => d.hash));
  check(records.every(r => hashes.has(r.hash)), 'only documents being produced are indexed (not the withheld email or the held-back letter)');

  const results = await search(p, 'the steel coil shipment from the mill was held up');
  check(results.length > 0 && results.length <= 10, `search returns up to 10 results (${results.length})`);
  check(/steel coil shipment from the mill was held up/.test(results[0]), 'the closest passage ranks first');
  check(results.every(r => /^PNC-\d{6} · (Line \d+|Lines \d+-\d+|Page \d+|Pages \d+-\d+)/.test(r)), 'every result shows its Bates number and line locator');
  const panelText = await panel(p).innerText();
  check(!/\d\.\d{2}|\d+\s?%|score|similarity/i.test(panelText.replace(/Closest in meaning first/, '')), 'no numeric score is shown');

  const after = await snapshot();
  for (const k of Object.keys(before)) check(before[k] === after[k], `building and searching the index leaves ${k} unchanged`);

  // Save a result through the select-text-to-cite prompt.
  await go(p, 'Citation Matrix');
  await search(p, 'the steel coil shipment from the mill was held up');
  const citationsBefore = Object.values((await stored(p)).citations).flat().length;
  await p.getByTestId('semantic-result').first().click();
  await p.waitForTimeout(400);
  check(/Search result: add this passage as your citation\?/i.test(await body(p)), 'opening a result raises the "add this passage" prompt');
  check(/steel coil shipment from the mill was held up/.test(await p.locator('mark').first().innerText()), 'the viewer highlights the result in its document');
  check(await p.getByTestId('semantic-result').count() > 0, 'the results stay listed while a result is open');
  check(Object.values((await stored(p)).citations).flat().length === citationsBefore, 'nothing is cited until counsel saves it');
  await p.getByPlaceholder('New tag…').last().fill('delay cause');
  await p.getByRole('button', { name: 'Add tag' }).click();
  await p.getByRole('button', { name: 'Save citation' }).click();
  await p.waitForTimeout(600);
  m = await stored(p);
  const saved = m.citations['02_Email_Thread_Delivery_Delay.txt'].find(c => c.origin === 'user');
  check(saved && /steel coil shipment/.test(saved.excerpt) && saved.tags.includes('delay cause'), 'the result is saved as counsel\'s citation, with its tag');
  const doc = m.documents.find(d => d.name === '02_Email_Thread_Delivery_Delay.txt');
  check(saved && doc.content.slice(saved.offset, saved.offset + saved.excerpt.length) === saved.excerpt, 'the saved citation is anchored at the passage\'s offset');
  const logged = m.auditLog.find(e => e.action === 'Added citation from a search result');
  check(logged && logged.actor === 'User' && /^02_Email_Thread_Delivery_Delay\.txt, Lines? \d+/.test(logged.target), `saving is logged (${logged?.target})`);

  // Reload: the index survives and no passage is embedded again.
  await p.reload();
  await p.waitForTimeout(1500);
  await listen(p);
  await go(p, 'Citation Matrix');
  check(await p.getByTestId('search-index-status').count() === 1, 'the index is current after a reload');
  const again = await search(p, 'the steel coil shipment from the mill was held up');
  check(/steel coil shipment from the mill was held up/.test(again[0]), 'search works after a reload');
  check(await embeddedCount(p) === 1, `after a reload only the query is embedded (${await embeddedCount(p)} text)`);

  // A change to the production set marks the index stale.
  await go(p, 'Review & Designate');
  const r = row(p, '04_Receiving_Inspection_Log.txt');
  await r.getByRole('button', { name: 'Withhold', exact: true }).click();
  await r.locator('select').selectOption('Work Product');
  await r.getByPlaceholder('Description for the log').fill('Inspection notes prepared for counsel.');
  await p.locator('h4:text-is("Privilege review")').click();
  await p.waitForTimeout(500);
  await go(p, 'Citation Matrix');
  check(await p.getByTestId('search-index-stale').count() === 1 && await panel(p).getByLabel('Search by meaning').count() === 0,
    'withholding a document marks the index stale and search waits for an update');
  await listen(p);
  const withheldHash = m.documents.find(d => d.name === '04_Receiving_Inspection_Log.txt').hash;
  const reportAfterWithhold = (await stored(p)).integrityReport;
  await buildIndex(p, 'Update index');
  m = await stored(p);
  const updated = m.auditLog.find(e => e.action === 'Updated local search index');
  const [, docs, total, embedded, reused] = (updated?.target.match(/(\d+) documents · (\d+) passages \((\d+) embedded, (\d+) reused, 1 removed\)/) || []).map(Number);
  // Changing a designation voids the readiness check, so documents it held
  // back count as producible again until it is re-run (as for the chronology).
  const expectedDocs = reportAfterWithhold ? 3 : 4;
  check(docs === expectedDocs && embedded + reused === total && reused === passages - records.find(r => r.hash === withheldHash).passages,
    `the update reuses every stored vector and removes the withheld document's (${updated?.target})`);
  const embeddedNow = await embeddedCount(p);
  check(embeddedNow === embedded, `only passages of newly producible documents are embedded (${embedded} logged, ${embeddedNow} seen)`);
  const remaining = await vectorRecords(p);
  check(remaining.length === expectedDocs && !remaining.some(r => r.hash === withheldHash), 'the withheld document\'s vectors are deleted from storage');
  const afterWithhold = await search(p, 'receiving inspection log rejected beams');
  check(afterWithhold.every(t => !t.includes('04_Receiving_Inspection_Log.txt')), 'the withheld document no longer appears in results');

  // Clear Matter erases the vectors with the matter.
  await p.getByRole('button', { name: /^Clear$/ }).first().click();
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Clear matter' }).click();
  await p.waitForTimeout(800);
  check(((await vectorRecords(p)) || []).length === 0, 'Clear Matter deletes every stored vector');
  const cleared = await stored(p);
  check(!cleared || (cleared.documents || []).length === 0 && !cleared.searchIndex, 'Clear Matter deletes the matter and its index record');

  check(p.requests.some(u => u.includes('@huggingface')), 'the request log sees the worker\'s module requests');
  check(offSite(p).length === 0, `no request leaves ${ORIGIN} ${offSite(p).slice(0, 3).join(' ')}`);
  check(p.errs.length === 0, 'search: no console errors ' + p.errs.join(' | '));
}

// ---------- Without the model files, search says so and contacts no one ----------
{
  const p = await searchPage({ fake: false });
  await loadSample(p, 0);
  await runCheck(p);
  await go(p, 'Citation Matrix');
  const hasModel = await p.evaluate(async (base) => {
    const res = await fetch(`${base}models/Xenova/all-MiniLM-L6-v2/config.json`);
    return res.ok && (res.headers.get('content-type') || '').includes('json');
  }, new URL(URL_).pathname);
  await panel(p).getByRole('button', { name: 'Build search index' }).click();
  if (hasModel) {
    await p.getByTestId('search-index-status').waitFor({ timeout: 120000 });
    check(true, 'the real model loads from this site');
  } else {
    await p.getByTestId('search-error').waitFor({ timeout: 60000 });
    check(/Search is unavailable/.test(await p.getByTestId('search-error').innerText()), 'with no model files, search reports it is unavailable');
  }
  check(offSite(p).length === 0, `real library: no request leaves ${ORIGIN} ${offSite(p).slice(0, 3).join(' ')}`);
}

console.log(failures() ? `\n${failures()} FAILED` : '\nall passed');
await b.close();
process.exit(failures() ? 1 : 0);
