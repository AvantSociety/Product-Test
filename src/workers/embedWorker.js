// ==========================================
// LOCAL SEMANTIC SEARCH WORKER (prototype)
// ==========================================
//
// Embeds passages from the documents being produced and answers searches
// against them, inside this browser. The model and its runtime are served
// from this site's own files; remote model loading is switched off, so the
// library cannot fall back to fetching from a model hub or a CDN.
//
// Only locations go back to the page: document name, character offset and
// length, in rank order. Similarity values stay here, so the page has no
// score to display.

import { env, pipeline } from '@huggingface/transformers';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { citablePassages } from '../lib/citations.js';
import { loadEmbeddings, saveEmbeddings, pruneEmbeddings } from '../lib/persistence.js';
import { MODEL_ID, MODEL_DTYPE, BATCH_SIZE } from '../lib/semanticSearch.js';

const BASE = new URL(import.meta.env.BASE_URL, self.location.origin).href;

env.allowRemoteModels = false;
env.allowLocalModels = true;
// A path on this site, not a full URL: given an http(s) URL here the library
// skips its local-file check and reports the tokenizer missing.
env.localModelPath = `${import.meta.env.BASE_URL}models/`;
// The library's default is to fetch the ONNX runtime from cdn.jsdelivr.net.
// Vite emits the runtime (vite.config.js swaps in the CPU-only build) into
// this site's assets, and these point at those copies. Given both files, the
// library also keeps them in the browser's cache with the model, so a later
// visit fetches neither.
env.backends.onnx.wasm.wasmPaths = {
  wasm: new URL(ortWasmUrl, self.location.href).href,
  mjs: new URL(ortMjsUrl, self.location.href).href,
};
// GitHub Pages cannot send the cross-origin isolation headers threads need.
env.backends.onnx.wasm.numThreads = 1;

let extractor = null;
// The index held in memory: passage locations and one row of vectors each.
let index = { entries: [], vectors: new Float32Array(0), dim: 0 };

const post = (msg) => self.postMessage(msg);

async function loadModel(id) {
  if (extractor) return extractor;
  const started = performance.now();
  post({ type: 'model', id, status: 'loading' });
  // No progress_callback: given one, the library first fetches every model
  // file in full just to learn its size, downloading the weights twice.
  extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: MODEL_DTYPE, device: 'wasm' });
  post({ type: 'model', id, status: 'ready', ms: Math.round(performance.now() - started) });
  return extractor;
}

async function embed(texts) {
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return { data: output.data, dim: output.dims[output.dims.length - 1] };
}

async function build(id, docs) {
  await loadModel(id);
  const started = performance.now();
  const hashes = docs.map(d => d.hash).filter(Boolean);
  const stored = await loadEmbeddings(hashes);

  const records = [];
  const pending = [];
  docs.forEach(doc => {
    const cached = stored.get(doc.hash);
    if (cached && cached.model === MODEL_ID) { records.push({ doc, record: cached }); return; }
    const passages = citablePassages(doc.content).map(p => [p.offset, p.text.length]);
    pending.push({ doc, passages });
  });

  const total = pending.reduce((n, p) => n + p.passages.length, 0);
  let done = 0;
  const fresh = [];
  for (const { doc, passages } of pending) {
    const chunks = [];
    let dim = 0;
    for (let i = 0; i < passages.length; i += BATCH_SIZE) {
      const batch = passages.slice(i, i + BATCH_SIZE).map(([o, l]) => doc.content.slice(o, o + l));
      const out = await embed(batch);
      dim = out.dim;
      chunks.push(out.data);
      done += batch.length;
      post({ type: 'progress', id, done, total });
    }
    const vectors = new Float32Array(passages.length * dim);
    let at = 0;
    chunks.forEach(c => { vectors.set(c, at); at += c.length; });
    const record = { hash: doc.hash, model: MODEL_ID, dim, passages, vectors };
    fresh.push(record);
    records.push({ doc, record });
  }
  if (fresh.length) await saveEmbeddings(fresh);
  const pruned = await pruneEmbeddings(hashes);

  // Assemble the in-memory index in the order the documents were given.
  const order = new Map(docs.map((d, i) => [d.hash, i]));
  records.sort((a, b) => order.get(a.doc.hash) - order.get(b.doc.hash));
  const dim = records.find(r => r.record.dim)?.record.dim || 0;
  const count = records.reduce((n, r) => n + r.record.passages.length, 0);
  const vectors = new Float32Array(count * dim);
  const entries = [];
  let row = 0;
  records.forEach(({ doc, record }) => {
    record.passages.forEach(([offset, length]) => entries.push({ name: doc.name, offset, length }));
    vectors.set(record.vectors, row * dim);
    row += record.passages.length;
  });
  index = { entries, vectors, dim };

  post({
    type: 'built', id,
    model: MODEL_ID,
    docs: docs.length,
    passages: entries.length,
    embedded: total,
    reused: count - total,
    pruned,
    storedBytes: vectors.byteLength,
    ms: Math.round(performance.now() - started),
  });
}

async function search(id, query, k) {
  if (!index.entries.length) { post({ type: 'results', id, hits: [], ms: 0 }); return; }
  await loadModel(id);
  const started = performance.now();
  const { data: q } = await embed([query]);
  const { entries, vectors, dim } = index;
  const scores = new Float32Array(entries.length);
  for (let r = 0; r < entries.length; r++) {
    let s = 0;
    const base = r * dim;
    for (let c = 0; c < dim; c++) s += vectors[base + c] * q[c];
    scores[r] = s;
  }
  const top = Array.from(scores.keys())
    .sort((a, b) => scores[b] - scores[a] || a - b)
    .slice(0, k);
  post({
    type: 'results', id,
    hits: top.map(r => entries[r]),
    ms: Math.round(performance.now() - started),
  });
}

self.onmessage = async ({ data }) => {
  const { type, id } = data;
  try {
    if (type === 'build') await build(id, data.docs);
    else if (type === 'search') await search(id, data.query, data.k);
  } catch (err) {
    post({ type: 'error', id, message: err?.message || String(err) });
  }
};
