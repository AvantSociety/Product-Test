// ==========================================
// RELEVANCE SCREENING
// ==========================================
//
// Relevance under FRCP 26(b)(1) is measured against the claims and defenses of
// the case. Nothing inside a document tells you that, so this module does not
// try to decide it. Instead counsel states the criteria — the parties, the key
// terms and the relevant period — and every document is screened against them.
// The legal judgment stays with the attorney; the tool does the matching.
//
// This mirrors how culling actually works in practice: search terms negotiated
// at the Rule 26(f) conference and run across the collection. Courts have long
// noted that keyword screening both over- and under-includes, so the output
// here is a screening result to review, never a determination.
//
// The categories are rule-based rather than a weighted score on purpose. An
// attorney has to be able to say why a document was set aside, and "it names no
// party to this matter and none of our search terms" is defensible in a way
// that "it scored 0.31" is not.

import { parseEventDate, DATE_PATTERN } from './citations.js';

export const RELEVANCE_CATEGORIES = {
  unscreened: {
    key: 'unscreened',
    label: 'Unscreened',
    short: 'UNSCREENED',
    tone: 'slate',
    blurb: 'No screening criteria have been set for this matter yet.',
  },
  strong: {
    key: 'strong',
    label: 'Likely relevant',
    short: 'LIKELY',
    tone: 'emerald',
    blurb: 'Names a party to the matter and hits at least one key term.',
  },
  possible: {
    key: 'possible',
    label: 'Possibly relevant',
    short: 'POSSIBLE',
    tone: 'indigo',
    blurb: 'Hits some criteria but not both a party and a key term — needs a human read.',
  },
  out_of_period: {
    key: 'out_of_period',
    label: 'Outside the relevant period',
    short: 'OUT OF PERIOD',
    tone: 'amber',
    blurb: 'Connects to the matter, but every date in it falls outside the period you set.',
  },
  none: {
    key: 'none',
    label: 'No connection found',
    short: 'NO MATCH',
    tone: 'red',
    blurb: 'Names no party and hits no key term. Nothing in it connects to this matter.',
  },
};

export const EMPTY_CRITERIA = { terms: [], parties: [], from: '', to: '' };

export function hasCriteria(criteria) {
  if (!criteria) return false;
  return (criteria.terms?.length > 0)
      || (criteria.parties?.length > 0)
      || Boolean(criteria.from)
      || Boolean(criteria.to);
}

/** Splits a comma or newline separated field into trimmed, de-duplicated entries. */
export function parseCriteriaList(raw) {
  return Array.from(new Set(
    String(raw || '')
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
  ));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word match so "Ace" does not hit "placement", with support for
 * multi-word phrases like "escrow account".
 */
function mentions(content, needle) {
  const pattern = new RegExp(`(?<![\\w])${escapeRegExp(needle)}(?![\\w])`, 'i');
  return pattern.test(content);
}

function datesIn(content) {
  const re = new RegExp(DATE_PATTERN.source, 'gi');
  const found = [];
  let match;
  while ((match = re.exec(content)) !== null) {
    const time = parseEventDate(match[0]);
    if (time !== null) found.push(time);
  }
  return found;
}

/**
 * Screens one document against the matter criteria.
 *
 * Category order reflects how strong each signal is:
 *   1. no criteria            → unscreened, nothing to say
 *   2. no party and no term   → none. The clearest evidence a document does not
 *                               belong to this matter, so it outranks dates.
 *   3. dates all out of range → out_of_period. It connects to the matter but
 *                               sits outside the window, which is a judgment
 *                               call (it may be relevant background) rather
 *                               than an exclusion.
 *   4. a party AND a term     → strong
 *   5. otherwise              → possible
 */
export function assessRelevance(doc, criteria) {
  if (!hasCriteria(criteria)) {
    return { category: 'unscreened', partyHits: [], termHits: [], dateStatus: null, reason: '' };
  }

  const content = doc.content || '';
  const partyHits = (criteria.parties || []).filter(p => mentions(content, p));
  const termHits = (criteria.terms || []).filter(t => mentions(content, t));

  // Date window, evaluated only when one was actually set.
  const from = criteria.from ? Date.parse(`${criteria.from}T00:00:00`) : null;
  const to = criteria.to ? Date.parse(`${criteria.to}T23:59:59`) : null;
  const windowSet = Number.isFinite(from) || Number.isFinite(to);

  let dateStatus = null;
  if (windowSet) {
    const times = datesIn(content);
    if (times.length === 0) {
      dateStatus = 'undated';
    } else {
      const inRange = times.filter(t =>
        (!Number.isFinite(from) || t >= from) && (!Number.isFinite(to) || t <= to)
      );
      dateStatus = inRange.length > 0 ? 'in_range' : 'out_of_range';
    }
  }

  const contentHits = partyHits.length + termHits.length;

  if (contentHits === 0) {
    return {
      category: 'none',
      partyHits,
      termHits,
      dateStatus,
      reason: 'Names no party to this matter and hits none of the key terms.',
    };
  }

  if (dateStatus === 'out_of_range') {
    return {
      category: 'out_of_period',
      partyHits,
      termHits,
      dateStatus,
      reason: 'Matches the matter, but every date in it falls outside the period you set.',
    };
  }

  if (partyHits.length > 0 && termHits.length > 0) {
    return {
      category: 'strong',
      partyHits,
      termHits,
      dateStatus,
      reason: `Names ${partyHits.length} part${partyHits.length === 1 ? 'y' : 'ies'} and hits ${termHits.length} key term${termHits.length === 1 ? '' : 's'}.`,
    };
  }

  return {
    category: 'possible',
    partyHits,
    termHits,
    dateStatus,
    reason: partyHits.length > 0
      ? 'Names a party but hits none of the key terms.'
      : 'Hits a key term but names no party to this matter.',
  };
}

/** Screens a whole set, returning results keyed by document name plus tallies. */
export function screenDocuments(documents, criteria) {
  const results = {};
  const counts = { unscreened: 0, strong: 0, possible: 0, out_of_period: 0, none: 0 };
  (documents || []).forEach(doc => {
    const result = assessRelevance(doc, criteria);
    results[doc.name] = result;
    counts[result.category] += 1;
  });
  return { results, counts };
}
