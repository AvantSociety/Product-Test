// ==========================================
// CITATION EXTRACTION
// ==========================================
//
// Surfaces passages that carry the signals a reviewer cares about — dates,
// money, named parties, operative legal verbs. Each citation records the exact
// character offset it came from, so the viewer highlights the passage it was
// actually drawn from rather than the first textual match, and records which
// signals fired, so the reason a passage surfaced can be shown instead of a
// fabricated confidence percentage.

export const DATE_PATTERN =
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i;

const MONTH_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Two-digit years follow the POSIX convention: 00-68 are 2000s, 69-99 are
// 1900s. So "9-11-26" reads as 2026.
const TWO_DIGIT_YEAR_PIVOT = 68;

/**
 * Builds a local-midnight timestamp, rejecting dates that do not exist.
 *
 * Local rather than UTC matters: Date.parse('2024-03-05') yields UTC midnight,
 * which renders as March 4 anywhere west of Greenwich — an off-by-one day on a
 * case chronology. Constructing from parts keeps the date the reader sees the
 * same as the date in the document.
 *
 * Rejecting rollovers matters too: the platform turns 2-30-24 into March 1
 * rather than reporting it as invalid, so a garbled or mistyped date would
 * otherwise land on the timeline as a confident wrong entry.
 */
function buildDate(year, month, day) {
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

/**
 * Parses a date matched by DATE_PATTERN into a timestamp, or null.
 *
 * Numeric dates are read as MONTH/DAY/YEAR — the US convention these documents
 * use. This is done explicitly rather than through Date.parse, whose handling
 * of non-ISO formats is unspecified by ECMAScript and differs between browsers.
 */
export function parseEventDate(raw) {
  const text = String(raw).trim();

  // Year-first ISO (YYYY-MM-DD) is unambiguous and stays year, month, day.
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Numeric shorthand: month, day, year.
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const rawYear = Number(numeric[3]);
    const year = numeric[3].length <= 2
      ? (rawYear <= TWO_DIGIT_YEAR_PIVOT ? 2000 + rawYear : 1900 + rawYear)
      : rawYear;
    return buildDate(year, month, day);
  }

  // Written month: "Sep 11, 2026".
  const named = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const month = MONTH_INDEX[named[1].slice(0, 3).toLowerCase()];
    if (month) return buildDate(Number(named[3]), month, Number(named[2]));
  }

  return null;
}

/** M/D/YYYY. Fixed rather than locale-dependent, so the axis cannot contradict
 *  the month-day-year rule used to read the documents. */
export function formatEventDate(time) {
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const MONEY_PATTERN = /\$\s?[\d,]+(?:\.\d{2})?\b/;
const PARTY_PATTERN = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/;
const OPERATIVE_PATTERN =
  /\b(wire|transfer|account|unauthorized|denied|confirmed|executed|breach|alleged|pursuant|agreement|contract|deposition|payment|receipt|authorization|liability|terminate|indemnif\w*|warrant\w*)\b/i;

export const SIGNAL_LABELS = {
  date: 'date',
  money: 'amount',
  party: 'named party',
  operative: 'operative term',
};

/** One citation per ~40 pages of text, floored at 3 and capped at 25. */
function citationBudget(text) {
  return Math.max(3, Math.min(25, Math.round(text.length / 12000) + 3));
}

/**
 * Splits into sentences while tracking each sentence's start offset in the
 * source text, so highlights can be anchored precisely.
 */
function sentencesWithOffsets(text) {
  const out = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 40) out.push({ text: trimmed, offset: match.index + leading });
  }
  return out;
}

export function extractCitations(content, fileName) {
  if (!content || !content.trim()) return [];

  const scored = sentencesWithOffsets(content).map((s, i) => {
    const signals = [];
    let score = 0;
    if (DATE_PATTERN.test(s.text)) { signals.push('date'); score += 3; }
    if (MONEY_PATTERN.test(s.text)) { signals.push('money'); score += 3; }
    if (PARTY_PATTERN.test(s.text)) { signals.push('party'); score += 2; }
    if (OPERATIVE_PATTERN.test(s.text)) { signals.push('operative'); score += 2; }
    score += Math.min(s.text.length / 100, 1.5);
    return { ...s, index: i, score, signals };
  });

  // Only passages that carry at least one real signal are worth citing.
  const candidates = scored.filter(s => s.signals.length > 0);
  const top = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, citationBudget(content))
    .sort((a, b) => a.index - b.index);

  return top.map((item, i) => ({
    id: i,
    line: lineNumberAt(content, item.offset),
    finding: item.text.length > 150 ? `${item.text.slice(0, 150)}…` : item.text,
    excerpt: item.text,
    offset: item.offset,
    signals: item.signals,
    source: fileName,
  }));
}

export function lineNumberAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** Formats a record citation the way it would appear in a brief. */
export function formatCitation(citation, batesNumber) {
  const locator = `Line ${citation.line}`;
  return batesNumber
    ? `${batesNumber} (${citation.source}, ${locator})`
    : `${citation.source}, ${locator}`;
}
