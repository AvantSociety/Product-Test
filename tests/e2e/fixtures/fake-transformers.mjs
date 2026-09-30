// Stands in for @huggingface/transformers in tests/e2e/search.mjs, so the real
// worker, passage splitter, vector store and Stage 05 flow can be exercised
// without the model files. Embeds text as a hashed bag of words: passages
// sharing words with the query rank first. It says nothing about the real
// model's quality; testdata/stress-matter/run.mjs --search measures that.
//
// Each call announces how many texts it embedded on a BroadcastChannel, so a
// test can tell a cache hit from a re-embed.
export const env = { backends: { onnx: { wasm: {} } } };

const DIM = 128;
const channel = new BroadcastChannel('fake-embedder');

function embedOne(text) {
  const v = new Float32Array(DIM);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) { h ^= word.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[(h >>> 0) % DIM] += 1;
  }
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

export async function pipeline(task, model, options = {}) {
  options.progress_callback?.({ status: 'progress', file: 'fake-model.onnx', loaded: 1, total: 1 });
  return async (texts) => {
    const list = Array.isArray(texts) ? texts : [texts];
    channel.postMessage({ embedded: list.length });
    const data = new Float32Array(list.length * DIM);
    list.forEach((t, i) => data.set(embedOne(t), i * DIM));
    return { data, dims: [list.length, DIM] };
  };
}
