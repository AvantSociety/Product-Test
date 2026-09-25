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

// Abbreviations whose trailing period never ends a sentence. Seeded from the
// usage legal documents are full of — honorifics, corporate forms, reporters
// and court abbreviations — because a splitter that breaks on "Mr." or "F.3d"
// severs the very passages worth citing.
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'hon', 'esq', 'jr', 'sr', 'st',
  'inc', 'llc', 'llp', 'ltd', 'co', 'corp', 'plc', 'gmbh',
  'no', 'nos', 'vol', 'ed', 'eds', 'p', 'pp', 'para', 'art', 'sec', 'ch',
  'v', 'vs', 'al', 'seq', 'cf', 'ibid', 'id', 'supra', 'infra',
  'cir', 'ct', 'dist', 'div', 'app', 'rev', 'supp', 'stat', 'reg', 'rul',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'approx', 'est', 'dept', 'univ', 'assn', 'bros', 'etc', 'e.g', 'i.e',
]);

/**
 * Decides whether the period at `index` genuinely ends a sentence.
 *
 * The previous implementation split on every period, which produced citations
 * truncated mid-email-address, citations opening on the decimal half of a
 * dollar figure, and citations that dropped the first named party after an
 * honorific. Each of those reads as a defect in a brief.
 */
function endsSentence(text, index) {
  const next = text[index + 1];

  // A period with no following whitespace sits inside a token: an email
  // address, a domain, a decimal, a version, a reporter cite like F.3d.
  if (next !== undefined && !/\s/.test(next)) return false;

  const before = text.slice(0, index);

  // Decimal fraction: "$92,000.00" — digits on both sides.
  if (/\d$/.test(before) && /^\d/.test(text.slice(index + 1).trimStart())) return false;

  // A single capital is an initial: "Robert V. Vertex".
  if (/(?:^|[\s(])[A-Z]$/.test(before)) return false;

  // Known abbreviation immediately before the period.
  const word = (before.match(/([A-Za-z.]+)$/) || [])[1];
  if (word && ABBREVIATIONS.has(word.toLowerCase().replace(/\.$/, ''))) return false;

  return true;
}

/**
 * Email and similar headers are routing metadata, never the substance of a
 * document. Citing a From: line displaces a real finding, so the header block
 * is skipped for extraction while remaining visible in the viewer.
 */
const HEADER_LINE = /^\s*(from|to|cc|bcc|subject|date|sent|reply-to|message-id|importance|attachments?)\s*:/i;

export function headerBlockLength(text) {
  const lines = text.split(/\n/);
  let consumed = 0;
  let sawHeader = false;
  for (const line of lines) {
    if (HEADER_LINE.test(line)) {
      sawHeader = true;
      consumed += line.length + 1;
      continue;
    }
    // A blank line closes the header block; anything else means it was never
    // a header block at all.
    if (sawHeader && line.trim() === '') { consumed += line.length + 1; break; }
    if (sawHeader) break;
    return 0;
  }
  return sawHeader ? Math.min(consumed, text.length) : 0;
}

/**
 * Splits into sentences while tracking each sentence's start offset in the
 * source text, so highlights can be anchored precisely. Also records the
 * sentence's ordinal on its line, which is what makes two citations from the
 * same paragraph distinguishable in a brief.
 */
function sentencesWithOffsets(text, startAt = 0) {
  const out = [];
  let cursor = startAt;
  let index = startAt;

  const push = (end) => {
    const raw = text.slice(cursor, end);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 40) out.push({ text: trimmed, offset: cursor + leading });
    cursor = end;
  };

  while (index < text.length) {
    const ch = text[index];
    if (ch === '\n') { push(index + 1); }
    else if (ch === '!' || ch === '?') { push(index + 1); }
    else if (ch === '.' && endsSentence(text, index)) { push(index + 1); }
    index += 1;
  }
  push(text.length);
  return out;
}

/**
 * The signals a passage carries. These are observable facts about the text, so
 * they are reported the same way whether the extractor surfaced the passage or
 * the attorney selected it by hand.
 */
export function detectSignals(text) {
  const signals = [];
  if (DATE_PATTERN.test(text)) signals.push('date');
  if (MONEY_PATTERN.test(text)) signals.push('money');
  if (PARTY_PATTERN.test(text)) signals.push('party');
  if (OPERATIVE_PATTERN.test(text)) signals.push('operative');
  return signals;
}

/** Builds a citation from a passage the attorney selected in the viewer. */
export function buildUserCitation({ id, content, excerpt, offset, fileName, tags = [] }) {
  const span = lineSpan(content, offset, excerpt.length);
  return {
    id,
    line: span.start,
    lineEnd: span.end,
    ...pageSpan(content, offset, excerpt.length),
    sentence: 1,
    finding: excerpt.length > 150 ? `${excerpt.slice(0, 150)}…` : excerpt,
    excerpt,
    offset,
    signals: detectSignals(excerpt),
    source: fileName,
    origin: 'user',
    tags,
  };
}

export function extractCitations(content, fileName) {
  if (!content || !content.trim()) return [];

  // Routing headers are skipped so a From: line cannot displace a real finding.
  const bodyStart = headerBlockLength(content);

  const scored = sentencesWithOffsets(content, bodyStart).map((s, i) => {
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

  // Ordinal within the line (or, for a paginated document, within the page),
  // so two passages from one paragraph or page cite distinctly.
  const perLocator = new Map();

  return top.map((item, i) => {
    const span = lineSpan(content, item.offset, item.text.length);
    const pages = pageSpan(content, item.offset, item.text.length);
    const key = pages.page ? `p${pages.page}` : `l${span.start}`;
    const seen = (perLocator.get(key) || 0) + 1;
    perLocator.set(key, seen);
    return {
      id: i,
      line: span.start,
      lineEnd: span.end,
      ...pages,
      sentence: seen,
      finding: item.text.length > 150 ? `${item.text.slice(0, 150)}…` : item.text,
      excerpt: item.text,
      offset: item.offset,
      signals: item.signals,
      source: fileName,
      origin: 'extracted',
      tags: [],
    };
  });
}

/**
 * The locator as it would appear in a brief. A passage spanning lines cites a
 * range; several passages on one line are told apart by sentence ordinal.
 */
export function formatLocator(citation) {
  const { line, lineEnd, page, pageEnd, sentence } = citation;
  // A PDF is cited by page, the way a brief pin-cites a produced document. Its
  // extracted text has no meaningful line breaks, so a line number would
  // point nowhere.
  const range = page
    ? (pageEnd && pageEnd > page ? `Pages ${page}-${pageEnd}` : `Page ${page}`)
    : (lineEnd && lineEnd > line ? `Lines ${line}-${lineEnd}` : `Line ${line}`);
  return sentence && sentence > 1 ? `${range}, sent. ${sentence}` : range;
}

/** Marks the start of each page in text extracted from a paginated document. */
export const PAGE_BREAK = '\f';

/** Page on which a character offset falls, or null for unpaginated text. */
export function pageNumberAt(text, offset) {
  if (!text.includes(PAGE_BREAK)) return null;
  let page = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === PAGE_BREAK) page++;
  return page;
}

/** The pages a passage spans; empty for unpaginated text. */
export function pageSpan(text, offset, length) {
  const page = pageNumberAt(text, offset);
  if (page === null) return {};
  return { page, pageEnd: pageNumberAt(text, Math.min(offset + length, text.length)) };
}

export function lineNumberAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** How many lines a passage spans, so a long passage cites a range. */
export function lineSpan(text, offset, length) {
  const start = lineNumberAt(text, offset);
  const end = lineNumberAt(text, Math.min(offset + length, text.length));
  return { start, end };
}

/** Formats a record citation the way it would appear in a brief. */
export function formatCitation(citation, batesNumber) {
  const locator = formatLocator(citation);
  return batesNumber
    ? `${batesNumber} (${citation.source}, ${locator})`
    : `${citation.source}, ${locator}`;
}
