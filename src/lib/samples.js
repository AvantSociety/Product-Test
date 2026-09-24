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

const TEXTS = import.meta.glob('../samples/*/*.txt', { query: '?raw', import: 'default' });

export const SAMPLE_MATTERS = [
  {
    id: 'harlow',
    title: 'Harlow Industrial Supply v. Pinecrest Distribution',
    kind: 'Commercial contract',
    place: 'Atlanta, GA',
    summary: 'A supplier sues for a $184,750 invoice; the buyer says the goods were late and defective.',
    shows: 'The safety check catching a document from a different client mixed into the folder.',
    batesPrefix: 'PNC',
    criteria: {
      parties: 'Harlow, Pinecrest, Castellanos, Pruitt',
      terms: 'PO 55120, beam, inspection, invoice',
      from: '2025-01-01',
      to: '2025-12-31',
    },
    privileged: {
      file: '05_Email_to_Counsel_PRIVILEGED.txt',
      basis: 'Attorney-Client',
      description: 'Email from client CEO to outside counsel requesting legal advice on the complaint.',
    },
  },
  {
    id: 'delgado',
    title: 'Delgado v. Brookhaven Market',
    kind: 'Premises liability, insurance defense',
    place: 'Birmingham, AL',
    summary: 'A customer slips on spilled liquid; the store’s insurer is defending.',
    shows: 'The chronology exposing a missed floor check and lost security video.',
    batesPrefix: 'BHM',
    criteria: {
      parties: 'Delgado, Brookhaven, Morrow, Tran',
      terms: 'aisle 7, floor, video, inspection',
      from: '2025-11-01',
      to: '2026-03-31',
    },
    privileged: {
      file: '06_Defense_Counsel_Letter_PRIVILEGED.txt',
      basis: 'Work Product',
      description: 'Defense counsel’s case evaluation and settlement recommendation to the insurer.',
    },
  },
  {
    id: 'okafor',
    title: 'Okafor v. Riverbend Logistics',
    kind: 'Employment',
    place: 'Montgomery, AL',
    summary: 'A supervisor is fired for lateness and says it was retaliation for reporting safety violations.',
    shows: 'Citations that contradict the stated reason for the firing.',
    batesPrefix: 'RVB',
    criteria: {
      parties: 'Okafor, Kowalski, Willis, Chen',
      terms: 'attendance, DOT, Mobile run, termination',
      from: '2025-01-01',
      to: '2026-06-30',
    },
    privileged: {
      file: '06_Memo_to_Counsel_PRIVILEGED.txt',
      basis: 'Attorney-Client',
      description: 'HR manager’s factual summary prepared at the request of outside counsel.',
    },
  },
];

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
