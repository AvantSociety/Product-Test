// ==========================================
// DOCUMENT INGEST: parsing, hashing, typing
// ==========================================

export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.csv,.json,.log,.eml,.md';

// pdf.js and mammoth together are ~1MB. They are loaded on first use so that
// opening the app — or working entirely in plain text — never pays for them.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjsLib, workerUrl] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

let mammothPromise = null;
function loadMammoth() {
  if (!mammothPromise) mammothPromise = import('mammoth').then(m => m.default || m);
  return mammothPromise;
}

// Roughly 3,000 characters of plain text per printed page. Used only where a
// real page count is unavailable, and always surfaced to the user as an estimate.
const CHARS_PER_PAGE = 3000;

/** SHA-256 of a string, hex-encoded. Used for the custody manifest and dedupe. */
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Combined digest over an ordered set of document hashes. */
export async function manifestHash(hashes) {
  return sha256Hex([...hashes].sort().join('|'));
}

async function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

async function extractPdf(file) {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim());
  }
  return { text: pages.join('\n\n'), pageCount: pdf.numPages, pageCountExact: true };
}

async function extractDocx(file) {
  const mammoth = await loadMammoth();
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return { text: value, pageCount: null, pageCountExact: false };
}

/** Pulls the readable body out of an .eml, keeping the headers that matter for discovery. */
function parseEml(raw) {
  const split = raw.search(/\r?\n\r?\n/);
  if (split === -1) return raw;
  const headerBlock = raw.slice(0, split);
  const body = raw.slice(split).trim();
  const keep = ['from', 'to', 'cc', 'date', 'subject'];
  const headers = headerBlock
    .split(/\r?\n(?![ \t])/)
    .filter(line => keep.includes(line.split(':')[0]?.trim().toLowerCase()))
    .map(line => line.replace(/\s+/g, ' ').trim());
  return [...headers, '', body].join('\n');
}

/**
 * Classifies a document from its content, falling back to extension only when
 * the content is inconclusive. Extension alone mislabels exported email as
 * transcript, which is what the previous implementation did.
 */
export function classifyDocument(name, text) {
  const head = text.slice(0, 2000);
  if (/^(from|to|subject|date):/im.test(head) && /@/.test(head)) return 'EMAIL';
  if (/^\s*[QA][.:]\s/m.test(head) || /\b(deposition|examination) of\b/i.test(head)) return 'TRANSCRIPT';
  const lines = head.split('\n').filter(Boolean).slice(0, 5);
  if (lines.length >= 2 && lines.every(l => (l.match(/[,;\t]/g) || []).length >= 2)) return 'LEDGER';
  if (/^\s*[[{]/.test(head.trim())) return 'SYSTEM';
  if (name.toLowerCase().endsWith('.csv')) return 'LEDGER';
  if (name.toLowerCase().endsWith('.json')) return 'SYSTEM';
  return 'DOCUMENT';
}

export function estimatePages(text, exactPageCount) {
  if (exactPageCount) return { pages: exactPageCount, exact: true };
  return { pages: Math.max(1, Math.ceil(text.length / CHARS_PER_PAGE)), exact: false };
}

/**
 * Reads one file into a normalized document record.
 * Throws with a message suitable for display if the format cannot be read.
 */
export async function readDocument(file) {
  const lower = file.name.toLowerCase();
  let text = '';
  let pageCount = null;
  let pageCountExact = false;
  let needsOcr = false;

  if (lower.endsWith('.pdf')) {
    const result = await extractPdf(file);
    text = result.text;
    pageCount = result.pageCount;
    pageCountExact = true;
    // A PDF of scanned images yields a page count but almost no text.
    if (text.replace(/\s/g, '').length < 20 * pageCount) needsOcr = true;
  } else if (lower.endsWith('.docx')) {
    const result = await extractDocx(file);
    text = result.text;
  } else if (lower.endsWith('.doc')) {
    throw new Error('Legacy .doc is not supported — save as .docx and try again.');
  } else {
    text = await readAsText(file);
    if (lower.endsWith('.eml')) text = parseEml(text);
  }

  const { pages, exact } = estimatePages(text, pageCountExact ? pageCount : null);

  return {
    name: file.name,
    size: `${(file.size / 1024).toFixed(1)} KB`,
    bytes: file.size,
    type: classifyDocument(file.name, text),
    content: text,
    pages,
    pagesExact: exact,
    needsOcr,
    hash: await sha256Hex(text),
    ingestedAt: new Date().toISOString(),
  };
}
