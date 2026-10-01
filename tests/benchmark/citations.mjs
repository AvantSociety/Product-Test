// Citation recall benchmark: how many of the passages an attorney would cite
// does the extractor surface on its own?
//
//   node tests/benchmark/citations.mjs            report, and fail below the floors
//   node tests/benchmark/citations.mjs --compare path/to/other/citations.js
//
// Two sets, so a change is never tuned to one case:
//   - samples-mustfind.json: 33 passages across the three sample matters
//   - the stress matter's planted passages (testdata/stress-matter manifest)
// Documents are read with the app's own parsers (PDF page text, .eml headers,
// .docx via mammoth), so the benchmark sees what the app sees.
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { SAMPLE_MATTERS } from '../../src/lib/sampleMatters.js';
import { pageText, joinPdfPages, parseEml } from '../../src/lib/documents.js';
import { parseCriteriaList } from '../../src/lib/relevance.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(`${root}package.json`);

// Floors: the recall this build achieves. A change that drops below fails.
const FLOORS = { samples: 12, stress: 20 };

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
// Same rule as the answer key: the passage's first sentence must appear
// inside one extracted citation.
const firstSentence = (p) => norm(norm(p).split(/(?<=[.!?])\s/)[0]);
const hit = (passage, citations) => citations.some(c => norm(c.excerpt).includes(firstSentence(passage)));

async function readAsApp(path) {
  if (path.endsWith('.pdf')) {
    const pdfjs = await import(`${root}node_modules/pdfjs-dist/legacy/build/pdf.mjs`);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) pages.push(pageText((await (await pdf.getPage(i)).getTextContent()).items));
    return joinPdfPages(pages);
  }
  if (path.endsWith('.docx')) return (await require('mammoth').extractRawText({ path })).value;
  const raw = readFileSync(path, 'utf8');
  return path.endsWith('.eml') ? parseEml(raw) : raw;
}

async function measure(lib) {
  const result = {};

  // Sample matters, each with its own screening criteria.
  const list = JSON.parse(readFileSync(`${root}tests/benchmark/samples-mustfind.json`, 'utf8'));
  const missedSamples = [];
  let found = 0;
  for (const item of list) {
    const sample = SAMPLE_MATTERS.find(m => m.id === item.matter);
    const criteria = { parties: parseCriteriaList(sample.criteria.parties), terms: parseCriteriaList(sample.criteria.terms) };
    const text = await readAsApp(`${root}src/samples/${item.matter}/${item.file}`);
    if (hit(item.passage, lib.extractCitations(text, item.file, criteria))) found++;
    else missedSamples.push(`${item.matter}/${item.file}: ${item.passage.slice(0, 60)}`);
  }
  result.samples = { found, total: list.length, missed: missedSamples };

  // Stress matter: planted passages in documents that are produced.
  const dir = `${root}testdata/stress-matter/out/120`;
  if (existsSync(`${dir}/manifest.json`)) {
    const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
    const criteria = { parties: parseCriteriaList(manifest.criteria.parties), terms: parseCriteriaList(manifest.criteria.terms) };
    let sf = 0; let st = 0; const missedStress = [];
    for (const d of manifest.documents) {
      if (!d.passages?.length || d.designation === 'withhold') continue;
      const cites = lib.extractCitations(await readAsApp(`${dir}/${d.file}`), d.file, criteria);
      for (const p of d.passages) {
        st++;
        if (hit(p, cites)) sf++; else missedStress.push(`${d.file}: ${p.slice(0, 60)}`);
      }
    }
    result.stress = { found: sf, total: st, missed: missedStress };
  }
  return result;
}

const pct = (r) => `${r.found}/${r.total} (${Math.round((r.found / r.total) * 100)}%)`;
const current = await measure(await import(`${root}src/lib/citations.js`));

const compareArg = process.argv.indexOf('--compare');
if (compareArg > -1) {
  const other = await measure(await import(new URL(process.argv[compareArg + 1], `file://${process.cwd()}/`).href));
  console.log(`samples  ${pct(other.samples)} → ${pct(current.samples)}`);
  if (current.stress) console.log(`stress   ${pct(other.stress)} → ${pct(current.stress)}`);
} else {
  console.log(`samples  ${pct(current.samples)}`);
  if (current.stress) console.log(`stress   ${pct(current.stress)}`);
}
if (process.argv.includes('-v')) {
  console.log('\nmissed (samples):\n  ' + current.samples.missed.join('\n  '));
  if (current.stress) console.log('missed (stress):\n  ' + current.stress.missed.join('\n  '));
}

let failed = false;
if (current.samples.found < FLOORS.samples) { failed = true; console.log(`FAIL samples recall ${current.samples.found} below floor ${FLOORS.samples}`); }
if (current.stress && current.stress.found < FLOORS.stress) { failed = true; console.log(`FAIL stress recall ${current.stress.found} below floor ${FLOORS.stress}`); }
console.log(failed ? '\nbenchmark FAILED' : '\nbenchmark passed');
process.exit(failed ? 1 : 0);
