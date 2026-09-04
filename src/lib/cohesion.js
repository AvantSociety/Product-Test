// ==========================================
// SET COHESION
// ==========================================
//
// Answers one narrow question: do these documents look like they came from the
// same matter?
//
// It does this by comparing what documents talk about — the parties, places,
// identifiers and distinctive vocabulary they share. Documents from one matter
// overlap heavily on those; documents from unrelated matters barely overlap at
// all.
//
// What this deliberately does NOT claim: it cannot decide whether a document is
// responsive to a request for production, or relevant to the claims and
// defenses. Those are legal judgments against the actual discovery requests,
// which this tool never sees. A low cohesion score means "this looks like it
// came from somewhere else, please look at it" — never "this is irrelevant."

// Common English plus the connective tissue that appears in every legal
// document. Stripping legal boilerplate matters: without it every contract
// resembles every other contract and genuine outliers stop standing out.
const STOPWORDS = new Set(`
a about above after again against all also am an and any are aren as at be because been before being
below between both but by can cannot could couldn did didn do does doesn doing don down during each few
for from further had hadn has hasn have haven having he her here hers herself him himself his how however
i if in into is isn it its itself just me more most must mustn my myself no nor not now of off on once
only or other ought our ours ourselves out over own same shan she should shouldn so some such than that
the their theirs them themselves then there these they this those through to too under until up very was
wasn we were weren what when where which while who whom why will with won would wouldn you your yours
yourself yourselves
agreement agreements party parties shall hereby herein hereto hereof thereof whereas pursuant
document documents dated date section clause paragraph term terms condition conditions
company corporation inc llc ltd sub subsection page exhibit attachment
`.trim().split(/\s+/));

/** Terms below this length carry little discriminating signal. */
const MIN_TERM_LENGTH = 4;
/** Cap per document so one long file cannot dominate a comparison. */
const MAX_TERMS = 200;

/**
 * A document shares less than this with its nearest neighbour in the set → it
 * looks like it belongs to a different matter.
 */
export const MIN_AFFINITY = 0.06;
/**
 * Typical pair in the set shares less than this → the set as a whole has no
 * common thread, which usually means the wrong folder was uploaded.
 */
export const MIN_SET_COHESION = 0.04;
/** Below this many documents there is nothing meaningful to compare. */
export const MIN_SET_SIZE = 2;

function topN(counts, n) {
  return new Set(
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([term]) => term)
  );
}

/**
 * Splits a document into the two vocabularies used for comparison:
 * proper nouns (parties, places, identifiers) and distinctive general terms.
 */
export function documentSignature(content) {
  const text = String(content || '');
  const entityCounts = new Map();
  const termCounts = new Map();

  // Proper nouns: capitalised words not sitting at the start of a sentence,
  // which keeps ordinary sentence-initial words out of the entity set.
  const properPattern = /(?<![.!?]\s|^)\b([A-Z][a-zA-Z]{2,})\b/gm;
  let match;
  while ((match = properPattern.exec(text)) !== null) {
    const token = match[1].toLowerCase();
    if (STOPWORDS.has(token)) continue;
    entityCounts.set(token, (entityCounts.get(token) || 0) + 1);
  }

  // Identifiers — account, docket and matter numbers — are strong evidence that
  // two documents belong together.
  const idPattern = /\b(?:[A-Z]{2,}[-\s]?\d{2,}|\d{2,}-[A-Z]{2,}[-\d]*|\d{6,})\b/g;
  while ((match = idPattern.exec(text)) !== null) {
    const token = match[0].toLowerCase().replace(/\s/g, '');
    entityCounts.set(token, (entityCounts.get(token) || 0) + 2);
  }

  for (const raw of text.toLowerCase().match(/\b[a-z]{2,}\b/g) || []) {
    if (raw.length < MIN_TERM_LENGTH || STOPWORDS.has(raw)) continue;
    termCounts.set(raw, (termCounts.get(raw) || 0) + 1);
  }

  return {
    entities: topN(entityCounts, MAX_TERMS),
    terms: topN(termCounts, MAX_TERMS),
  };
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const value of small) if (large.has(value)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Weighted toward shared proper nouns: two documents naming the same people
 *  and companies are far better evidence of a common matter than two documents
 *  using the same ordinary words. */
export function similarity(sigA, sigB) {
  return 0.65 * jaccard(sigA.entities, sigB.entities)
       + 0.35 * jaccard(sigA.terms, sigB.terms);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @returns null when the set is too small to judge, otherwise
 *   {
 *     affinity:     name -> strongest similarity to any other document (0-1)
 *     nearest:      name -> the document it most resembles
 *     outliers:     names whose affinity falls below MIN_AFFINITY
 *     setCohesion:  median pairwise similarity across the set
 *     incoherent:   true when the set as a whole has no common thread
 *   }
 */
export function analyzeCohesion(files) {
  if (!files || files.length < MIN_SET_SIZE) return null;

  const readable = files.filter(f => (f.content || '').trim().length > 0);
  if (readable.length < MIN_SET_SIZE) return null;

  const signatures = new Map(readable.map(f => [f.name, documentSignature(f.content)]));
  const affinity = {};
  const nearest = {};
  const pairScores = [];

  readable.forEach((a, i) => {
    let best = 0;
    let bestName = null;
    readable.forEach((b, j) => {
      if (i === j) return;
      const score = similarity(signatures.get(a.name), signatures.get(b.name));
      if (j > i) pairScores.push(score);
      if (score > best) { best = score; bestName = b.name; }
    });
    affinity[a.name] = best;
    nearest[a.name] = bestName;
  });

  const setCohesion = median(pairScores);
  // When nothing in the set relates to anything else, the problem is the set,
  // not any one document — flagging every file individually would be noise.
  const incoherent = readable.length >= MIN_SET_SIZE && setCohesion < MIN_SET_COHESION;

  const outliers = incoherent
    ? []
    : readable.filter(f => affinity[f.name] < MIN_AFFINITY).map(f => f.name);

  return {
    affinity,
    nearest,
    outliers,
    setCohesion,
    incoherent,
    compared: readable.length,
  };
}
