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
