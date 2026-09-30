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

// ---------- Dates without a year ----------
//
// "March 4" and "4/3" are common in correspondence, and the year is almost
// always the document's own. It is inferred from the document's date (an
// email's Date or Sent header first, otherwise the nearest full date in the
// text) and every such date is flagged as inferred wherever it is shown. With
// nothing to infer from, the date is left off the chronology.

const MONTH_NAME = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
// Case-sensitive, so "may" the verb is never read as a month.
const YEARLESS_NAMED = new RegExp(`\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!,?\\s*\\d{4})(?!:\\d)`, 'g');
// M/D standing alone: not part of a longer number, a full date, a price or a
// measurement such as 3/4 inch.
const YEARLESS_NUMERIC = /(?<![\d/.$,-])(\d{1,2})\/(\d{1,2})(?![\d/])(?!\s*(?:"|in\b|inch|ft\b|foot|feet|mm\b|cm\b|lb|ga\b|gauge|thick|ths?\b))/g;
// RFC 2822 email dates: "Thu, 19 Dec 2024 17:48:02 -0600".
const DAY_MONTH_YEAR = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAME})[a-z]*\\.?\\s+(\\d{4})\\b`);

/** The date an email or memo carries in its own opening header block. */
function headerDate(content) {
  const block = content.slice(0, headerBlockLength(content));
  const line = block.split('\n').find(l => /^\s*(date|sent)\s*:/i.test(l));
  if (!line) return null;
  const full = line.match(DATE_PATTERN);
  if (full) {
    const time = parseEventDate(full[0]);
    if (time !== null) return time;
  }
  const rfc = line.match(DAY_MONTH_YEAR);
  if (rfc) return buildDate(Number(rfc[3]), MONTH_INDEX[rfc[2].slice(0, 3).toLowerCase()], Number(rfc[1]));
  return null;
}

/**
 * Every date in a document with its position: full dates as written, and
 * dates without a year given the year of the document's own date. Inferred
 * dates carry `inferred: true` and the date the year came from.
 */
export function extractDates(content) {
  const text = content || '';
  const full = [];
  const fullRe = new RegExp(DATE_PATTERN.source, 'gi');
  let m;
  while ((m = fullRe.exec(text)) !== null) {
    const time = parseEventDate(m[0]);
    if (time !== null) full.push({ time, label: m[0], offset: m.index, length: m[0].length, inferred: false });
  }
  // An email's own RFC 2822 Date header ("Thu, 19 Dec 2024 17:48:02") is a
  // full date the general pattern does not read; the email is dated by it.
  const headerEnd = headerBlockLength(text);
  const rfcLine = /^[ \t]*(?:date|sent)[ \t]*:.*$/gim;
  while ((m = rfcLine.exec(text)) !== null && m.index < headerEnd) {
    const rfc = m[0].match(DAY_MONTH_YEAR);
    if (!rfc || DATE_PATTERN.test(m[0])) continue;
    const time = buildDate(Number(rfc[3]), MONTH_INDEX[rfc[2].slice(0, 3).toLowerCase()], Number(rfc[1]));
    if (time !== null) {
      full.push({ time, label: rfc[0], offset: m.index + rfc.index, length: rfc[0].length, inferred: false });
    }
  }
  const overlapsFull = (start, end) => full.some(d => start < d.offset + d.length && d.offset < end);

  const fromHeader = headerDate(text);
  const anchorFor = (offset) => {
    if (fromHeader !== null) return { time: fromHeader, source: 'email date' };
    let best = null;
    full.forEach(d => {
      const distance = Math.abs(d.offset - offset);
      if (!best || distance < best.distance) best = { time: d.time, source: d.label, distance };
    });
    return best;
  };

  const inferred = [];
  const addYearless = (match, month, day) => {
    const start = match.index;
    const end = start + match[0].length;
    if (overlapsFull(start, end)) return;
    const anchor = anchorFor(start);
    if (!anchor) return;
    const time = buildDate(new Date(anchor.time).getFullYear(), month, day);
    if (time === null) return;
    inferred.push({
      time, label: match[0], offset: start, length: match[0].length,
      inferred: true, anchor: anchor.source,
    });
  };
  const named = new RegExp(YEARLESS_NAMED.source, 'g');
  while ((m = named.exec(text)) !== null) {
    addYearless(m, MONTH_INDEX[m[1].slice(0, 3).toLowerCase()], Number(m[2]));
  }
  const numeric = new RegExp(YEARLESS_NUMERIC.source, 'g');
  while ((m = numeric.exec(text)) !== null) {
    addYearless(m, Number(m[1]), Number(m[2]));
  }

  return [...full, ...inferred].sort((a, b) => a.offset - b.offset);
}

/** Shown wherever an inferred date appears. */
export const INFERRED_YEAR_NOTE = 'year inferred from document date';

/** M/D/YYYY. Fixed rather than locale-dependent, so the axis cannot contradict
 *  the month-day-year rule used to read the documents. */
export function formatEventDate(time) {
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const MONEY_PATTERN = /\$\s?[\d,]+(?:\.\d{2})?\b/;
// Used only when counsel has listed no parties: two capitalised words read as
// a proper name, which is all this pattern can honestly claim.
const PROPER_NAME_PATTERN = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/;
const OPERATIVE_PATTERN =
  /\b(wire|transfer|account|unauthorized|denied|confirmed|executed|breach|alleged|pursuant|agreement|contract|deposition|payment|receipt|authorization|liability|terminate|indemnif\w*|warrant\w*)\b/i;

export const SIGNAL_LABELS = {
  date: 'date',
  money: 'amount',
  party: 'named party',
  proper_name: 'proper name',
  term: 'key term',
  operative: 'operative term',
};

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordPattern(needle) {
  return new RegExp(`(?<![\\w])${escapeRegExp(needle)}(?![\\w])`, 'i');
}

/**
 * Initials a document defines for a listed party, as chat exports and
 * transcripts do: "Sharon Willis (SW)". A message headed "SW to DO" then names
 * that party even though the surname never appears on the line.
 */
function partyAliases(content, parties) {
  const aliases = new Map();
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+\(([A-Z]{2,4})\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const party = parties.find(p => wordPattern(p).test(m[1]));
    if (party) aliases.set(m[2], party);
  }
  return aliases;
}

/**
 * Prepares the matter's screening criteria for matching. With parties listed,
 * the "named party" signal means one of those parties and nothing else.
 */
function prepareCriteria(criteria = {}, content = '') {
  const parties = (criteria.parties || []).map(p => p.trim()).filter(Boolean);
  const terms = (criteria.terms || []).map(t => t.trim()).filter(Boolean);
  const aliases = parties.length ? partyAliases(content, parties) : new Map();
  return {
    parties: parties.map(p => ({ name: p, re: wordPattern(p) })),
    aliases: [...aliases].map(([initials, party]) => ({ party, re: new RegExp(`\\b${initials}\\b`) })),
    terms: terms.map(t => ({ name: t, re: wordPattern(t) })),
  };
}

/** Distinct listed parties a passage names, directly or by defined initials. */
function partiesNamed(text, prepared) {
  const named = new Set(prepared.parties.filter(p => p.re.test(text)).map(p => p.name));
  prepared.aliases.forEach(a => { if (a.re.test(text)) named.add(a.party); });
  return named;
}

/** One citation per ~40 pages of text, floored at 3 and capped at 25. */
function citationBudget(text) {
  return Math.max(3, Math.min(25, Math.round(text.length / 12000) + 3));
}

/**
 * For chat and email exports, one slot per message (capped at 25), since a
 * file of short messages is short in characters but long in content. Zero for
 * anything else, so ordinary documents keep the character-based budget.
 */
function messageBudget(text, excluded) {
  const lines = text.split('\n');
  const chat = lines.filter((l, i) => !excluded[i] && (CHAT_LINE.test(l) || CHAT_LINE_SIMPLE.test(l))).length;
  if (chat > 0) return Math.min(25, chat);
  const isEmail = headerBlockLength(text) > 0 && lines.some(l => /^\s*(from|sent)\s*:/i.test(l));
  if (!isEmail) return 0;
  const messages = 1 + lines.filter(l => REPLY_BOUNDARY.test(l)).length;
  return Math.min(25, messages);
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
  // Times of day: "6:24 a.m. — SW to DO" is one message, not two fragments.
  'a.m', 'p.m',
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
 * document. Citing a From: line displaces a real finding, so header blocks
 * are skipped for extraction while remaining visible in the viewer.
 */
const HEADER_LINE = /^\s*(from|to|cc|bcc|subject|re|date|sent|reply-to|message-id|importance|attachments?)\s*:/i;

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

// Lines that are never the substance of a document. Each is excluded from
// scoring but stays visible, and selectable, in the viewer.
const REPLY_BOUNDARY = /^\s*(?:-{2,}\s*(?:original|forwarded)\s+message\s*-{2,}|on\b.{3,200}\bwrote:)\s*$/i;
const QUOTED_LINE = /^\s*>/;
const EXPORT_METADATA = /^\s*(device|participants|exported(?:\s+(?:by|on|at|from))?|export\s+date|conversation(?:\s+id)?|chat\s+id|thread\s+id|custodian|message\s+count|backup\s+date)\s*:/i;
const EXECUTION_CLAUSE = /^\s*in\s+witness\s+where(?:of|as)\b/i;
const EXHIBIT_HEADING = /^\s*(exhibit|schedule|annex|appendix|attachment)\b/i;
const SIGNATURE_FIELD = /^\s*(by|name|title|its|signature|signed|print(?:ed)?\s+name|date)\s*:|^\s*\/s\/|^\s*_{4,}/i;
const SIGNATURE_ANCHOR = /^\s*(by|name|title|its|signature|signed|print(?:ed)?\s+name)\s*:|^\s*\/s\/|^\s*_{4,}/i;
const VALEDICTION = /^\s*(sincerely|regards|best regards|kind regards|warm regards|respectfully(?: submitted)?|very truly yours|yours truly|yours sincerely|thanks|thank you|best|cheers)[,.!]?\s*$/i;
const DISCLAIMER = /confidentiality notice|intended (?:only |solely )?for the (?:sole )?(?:use of the )?(?:individual|addressee|named|person|recipient)|if you (?:are not the intended recipient|have received this (?:e-?mail|message|communication|transmission) in error)|(?:this|the information (?:contained )?in this) (?:e-?mail|message|communication|transmission)(?: and any (?:attachments?|files transmitted with it))? (?:is|are|may be|contains?|may contain) (?:confidential|privileged)/i;

/**
 * Marks which lines take no part in scoring: header blocks wherever they
 * occur, reply-chain markers and quoted text, export metadata, execution
 * clauses and the signature page after them, signature blocks and
 * confidentiality disclaimers.
 *
 * A reply-chain marker is a boundary, not a cut. The earlier message beneath
 * it is often the only copy in the collection, so its routing header and any
 * ">" quoted lines are dropped while its own body stays citable.
 */
export function excludedLines(text) {
  const lines = text.split('\n');
  const out = new Array(lines.length).fill(false);
  const blank = i => lines[i].trim() === '';
  const paragraphEnd = i => { let j = i; while (j < lines.length && !blank(j)) j += 1; return j; };
  const paragraphStart = i => { let j = i; while (j > 0 && !blank(j - 1)) j -= 1; return j; };

  // Header blocks: the opening block, any block straight after a reply
  // boundary, and any run of two or more header lines anywhere else.
  const headerRun = (i) => { let j = i; while (j < lines.length && HEADER_LINE.test(lines[j])) j += 1; return j; };
  for (let i = 0; i < lines.length; i++) {
    if (!HEADER_LINE.test(lines[i])) continue;
    const end = headerRun(i);
    const atTop = lines.slice(0, i).every(l => l.trim() === '');
    const afterBoundary = i > 0 && REPLY_BOUNDARY.test(lines[i - 1]);
    if (atTop || afterBoundary || end - i >= 2) for (let k = i; k < end; k++) out[k] = true;
    i = end - 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (REPLY_BOUNDARY.test(line) || QUOTED_LINE.test(line) || EXPORT_METADATA.test(line)) out[i] = true;

    // The execution clause and the signature page after it, up to any exhibit.
    if (EXECUTION_CLAUSE.test(line)) {
      let j = paragraphStart(i);
      while (j < lines.length && !EXHIBIT_HEADING.test(lines[j])) { out[j] = true; j += 1; }
      i = j - 1;
      continue;
    }

    // "By: / Name: / Title: / Date:" runs, anchored by at least one field
    // that only a signature block uses.
    if (SIGNATURE_FIELD.test(line)) {
      let j = i;
      while (j < lines.length && SIGNATURE_FIELD.test(lines[j])) j += 1;
      if (lines.slice(i, j).some(l => SIGNATURE_ANCHOR.test(l))) {
        for (let k = i; k < j; k++) out[k] = true;
        i = j - 1;
      }
      continue;
    }

    // A sign-off and the name, title and contact lines under it.
    if (VALEDICTION.test(line)) {
      const end = Math.min(paragraphEnd(i), i + 7);
      for (let k = i; k < end; k++) out[k] = true;
      continue;
    }

    if (DISCLAIMER.test(line)) {
      for (let k = paragraphStart(i); k < paragraphEnd(i); k++) out[k] = true;
    }
  }
  return out;
}

// A chat export line naming only the sender: "2/18/25 3:12 PM  Luis: ..." or
// "[2/18/25, 3:12 PM] Luis: ...". Kept whole as one passage.
const CHAT_LINE_SIMPLE = /^\s*\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*(?:[—–-]\s*)?[A-Z][\w .'-]{0,40}:/;
// A chat or text-message export line: "8/12/2025 5:48 a.m. — MR to DO: ...".
const CHAT_LINE = /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?\s*[—–-]+\s*([A-Za-z]{1,4})\s+to\s+([A-Za-z]{1,4})\s*:/i;

/**
 * Splits into citable passages while tracking each one's start offset in the
 * source text, so highlights can be anchored precisely. Prose is split into
 * sentences. A chat message is one passage, and a reply joins the message it
 * answers: "Understood." cited alone says nothing, but cited with the message
 * it answers it is the approval it records.
 */
function passagesWithOffsets(text, excluded) {
  const out = [];
  const add = (start, end) => {
    const raw = text.slice(start, end);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 40) out.push({ text: trimmed, offset: start + leading });
  };

  let lineStart = 0;
  let lastChat = null;
  const lines = text.split('\n');
  lines.forEach((line, n) => {
    const start = lineStart;
    const end = start + line.length;
    lineStart = end + 1;
    if (excluded[n]) { lastChat = null; return; }

    const chat = line.match(CHAT_LINE);
    if (chat) {
      const [, date, from, to] = chat;
      const answers = lastChat && lastChat.date === date
        && lastChat.from.toLowerCase() === to.toLowerCase()
        && lastChat.to.toLowerCase() === from.toLowerCase()
        && !lastChat.joined;
      if (answers) {
        const prior = out[out.length - 1];
        prior.text = text.slice(prior.offset, end).trim();
        lastChat = { date, from, to, joined: true };
      } else {
        const before = out.length;
        add(start, end);
        lastChat = out.length > before ? { date, from, to, joined: false } : null;
      }
      return;
    }
    if (line.trim() !== '') lastChat = null;
    if (CHAT_LINE_SIMPLE.test(line)) { add(start, end); return; }

    let cursor = start;
    for (let i = start; i < end; i++) {
      const ch = text[i];
      if (ch === '!' || ch === '?' || (ch === '.' && endsSentence(text, i))) {
        add(cursor, i + 1);
        cursor = i + 1;
      }
    }
    add(cursor, end);
  });
  return out;
}

/**
 * Every passage the extractor would consider, before scoring: the same
 * sentence and chat-message splitting, with the same headers, signature
 * blocks, disclaimers, quoted replies and export metadata left out. Local
 * search indexes exactly these, so it can only return a passage that could
 * also have been cited.
 */
export function citablePassages(content) {
  if (!content || !content.trim()) return [];
  return passagesWithOffsets(content, excludedLines(content));
}

/**
 * The signals a passage carries. These are observable facts about the text, so
 * they are reported the same way whether the extractor surfaced the passage or
 * the attorney selected it by hand.
 */
export function detectSignals(text, criteria = {}, content = text, offset = null) {
  const inferred = offset !== null
    && extractDates(content).some(d => d.inferred && d.offset >= offset && d.offset < offset + text.length);
  return scorePassage(text, prepareCriteria(criteria, content), inferred).signals;
}

/**
 * Scores one passage. With parties listed, "named party" means one of them,
 * and a passage naming two of them (a communication between the parties,
 * say) outranks one naming a single party. Counsel's key terms add a smaller
 * signal of their own. A date without a year counts as a date only when the
 * document gives a year to infer.
 */
// Counsel's key terms rank below the parties: one listed party plus a key
// term (2 + 0.75) stays below a passage naming two listed parties (3).
const KEY_TERM_WEIGHT = 0.75;

function scorePassage(text, prepared, hasInferredDate = false) {
  const signals = [];
  let score = 0;
  if (DATE_PATTERN.test(text) || hasInferredDate) { signals.push('date'); score += 3; }
  if (MONEY_PATTERN.test(text)) { signals.push('money'); score += 3; }
  if (prepared.parties.length) {
    const named = partiesNamed(text, prepared);
    if (named.size > 0) { signals.push('party'); score += 2 + Math.min(named.size - 1, 1); }
  } else if (PROPER_NAME_PATTERN.test(text)) {
    signals.push('proper_name'); score += 2;
  }
  if (prepared.terms?.some(t => t.re.test(text))) { signals.push('term'); score += KEY_TERM_WEIGHT; }
  if (OPERATIVE_PATTERN.test(text)) { signals.push('operative'); score += 2; }
  score += Math.min(text.length / 100, 1.5);
  return { signals, score };
}

/** Builds a citation from a passage the attorney selected in the viewer. */
export function buildUserCitation({ id, content, excerpt, offset, fileName, tags = [], criteria = {} }) {
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
    signals: detectSignals(excerpt, criteria, content, offset),
    source: fileName,
    origin: 'user',
    tags,
  };
}

/**
 * @param criteria the matter's screening criteria, { parties }. With parties
 *                 listed, only they count as named parties; with none, two
 *                 capitalised words count as a proper name.
 */
export function extractCitations(content, fileName, criteria = {}) {
  if (!content || !content.trim()) return [];

  // Routing headers, signature blocks, disclaimers, quoted text and export
  // metadata are skipped so none of them can displace a real finding.
  const prepared = prepareCriteria(criteria, content);
  const excluded = excludedLines(content);
  const inferredAt = extractDates(content).filter(d => d.inferred).map(d => d.offset);
  const scored = passagesWithOffsets(content, excluded).map((s, i) => {
    const hasInferred = inferredAt.some(o => o >= s.offset && o < s.offset + s.text.length);
    return { ...s, index: i, ...scorePassage(s.text, prepared, hasInferred) };
  });

  // Only passages that carry at least one real signal are worth citing.
  const candidates = scored.filter(s => s.signals.length > 0);
  const top = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(citationBudget(content), messageBudget(content, excluded)))
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
