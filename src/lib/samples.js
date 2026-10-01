// ==========================================
// SAMPLE MATTERS
// ==========================================
//
// Three fictional matters for demonstrations, so a prospect sees a worked
// case in seconds instead of watching an upload. Everything in them is
// invented — people, companies, case numbers — and the app labels a loaded
// sample as such everywhere it shows the matter name.
//
// The text is loaded only when a sample is chosen, so a normal session never
// downloads it. Samples go through exactly the same ingest path as a real
// upload: nothing about them is pre-computed or staged.

import { SAMPLE_MATTERS } from './sampleMatters.js';

export { SAMPLE_MATTERS };

const TEXTS = import.meta.glob('../samples/*/*.txt', { query: '?raw', import: 'default' });


/** Fetches a sample's documents and returns them as File objects, in order. */
export async function loadSampleFiles(id) {
  const entries = Object.entries(TEXTS)
    .filter(([path]) => path.includes(`/samples/${id}/`))
    .sort(([a], [b]) => a.localeCompare(b));
  return Promise.all(entries.map(async ([path, load]) => {
    const text = await load();
    const name = path.split('/').pop();
    return new File([text], name, { type: 'text/plain' });
  }));
}
