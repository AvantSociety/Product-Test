// ==========================================
// LOCAL SEMANTIC SEARCH (prototype)
// ==========================================
//
// Finds passages in the documents being produced by closeness in meaning to a
// plain-language query. It is a way to find passages to read, and nothing
// more: relevance screening, the readiness check, document categories and the
// Stage 09 checklist never consult it. A passage it finds becomes a citation
// only when counsel saves it through the same "select text to cite it" prompt
// as any hand-selected passage.
//
// The model runs in a Web Worker (src/workers/embedWorker.js). Its files are
// served from this site's own public/models/ folder.

import { fingerprint } from './auditChain.js';

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** 8-bit quantized weights: onnx/model_quantized.onnx. */
export const MODEL_DTYPE = 'q8';
export const BATCH_SIZE = 32;
export const RESULT_COUNT = 10;
/** Bumped when passage splitting changes, so older vectors read as stale. */
export const PASSAGE_VERSION = 1;

/**
 * What a search index was built from: the producible set (names and content
 * hashes, the same signature the chronology is keyed by), the model and the
 * passage splitter. An index whose key differs from the current one is stale.
 */
export function searchIndexKey(producibleSignature) {
  return fingerprint({ set: producibleSignature, model: MODEL_ID, passages: PASSAGE_VERSION });
}

/**
 * The page's side of the worker. One request at a time per kind: a newer
 * search supersedes an older one still in flight.
 */
export function createSearchClient({ onProgress, onModel } = {}) {
  let worker = null;
  let nextId = 1;
  const waiting = new Map();

  const ensure = () => {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/embedWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { onProgress?.(data); return; }
      if (data.type === 'model') { onModel?.(data); return; }
      const pending = waiting.get(data.id);
      if (!pending) return;
      waiting.delete(data.id);
      if (data.type === 'error') pending.reject(new Error(data.message));
      else pending.resolve(data);
    };
    worker.onerror = (e) => {
      const err = new Error(e.message || 'The search worker failed to start');
      waiting.forEach(p => p.reject(err));
      waiting.clear();
    };
    return worker;
  };

  const request = (msg) => new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    ensure().postMessage({ ...msg, id });
  });

  return {
    /** docs: [{ name, hash, content }] in the order results should tie-break. */
    build: (docs) => request({ type: 'build', docs }),
    search: (query, k = RESULT_COUNT) => request({ type: 'search', query, k }),
    started: () => worker !== null,
    terminate: () => {
      worker?.terminate();
      worker = null;
      waiting.forEach(p => p.reject(new Error('Search stopped')));
      waiting.clear();
    },
  };
}
