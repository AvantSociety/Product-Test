// ==========================================
// PRODUCTION READINESS CHECK
// ==========================================
//
// This is deliberately not a weighted average. Averaging lets a good score on
// one criterion offset a document that cannot be produced at all, which is the
// wrong operation for discovery: an unreadable document is a defect to cure,
// not a deduction to absorb.
//
// Instead every document is either production-ready or it carries a blocking
// defect. Blocking defects quarantine that document onto an exceptions list;
// the remaining set proceeds clean. Everything else — duplicates, missing
// dates, documents that yield no citation — is advisory and never blocks,
// because none of it makes a document unsafe to produce.

import { DATE_PATTERN } from './citations.js';
import { analyzeCohesion } from './cohesion.js';

/** Share of unreadable documents above which the collection itself looks wrong. */
export const RECOLLECT_RATIO = 0.25;
/** Share of duplicates worth deduplicating before review time is spent. */
export const DEDUPE_RATIO = 0.10;
/** Documents shorter than this may be truncated exports. Advisory only — a
 *  one-line receipt is legitimately short. */
const SHORT_DOCUMENT_CHARS = 200;

export const READINESS_STATES = {
  ready: {
    label: 'READY TO PRODUCE',
    tone: 'emerald',
    verdict: 'Every document in this set is intact, accounted for, and safe to produce.',
  },
  cure: {
    label: 'CURE REQUIRED',
    tone: 'amber',
    verdict: 'Some documents cannot be produced as they stand. Cure them, or produce the ready set now and resolve the exceptions separately.',
  },
  'not-reviewable': {
    label: 'RE-COLLECTION ADVISED',
    tone: 'red',
    verdict: 'More than a quarter of this set is unreadable. That usually points at a bad collection or a failed export rather than individual documents — re-collect rather than repairing these one by one.',
  },
  incoherent: {
    label: 'SET DOES NOT COHERE',
    tone: 'red',
    verdict: 'These documents share almost no parties, identifiers or vocabulary with one another. They do not look like one matter — the most common cause is the wrong folder being uploaded. Confirm this is the right collection before producing any of it.',
  },
};

const DEFECTS = {
  empty: {
    label: 'No readable text',
    cure: 'Re-export this document from its original source.',
  },
  needs_ocr: {
    label: 'Scanned image with no text layer',
    cure: 'Run OCR on this document, then re-ingest it.',
  },
  corrupt: {
    label: 'Corrupted character encoding',
    cure: 'Re-export this document — the text came through damaged.',
  },
  privilege_incomplete: {
    label: 'Withheld without a complete log entry',
    cure: 'Add a privilege basis and description in Stage 02. FRCP 26(b)(5) requires both.',
  },
  bates_collision: {
    label: 'Bates number assigned to more than one document',
    cure: 'Clear the matter in Stage 09 and re-stamp so every document has a unique number.',
  },
  unrelated: {
    label: 'Does not appear to belong to this matter',
    cure: 'Check this is the right document. If it belongs here, confirm it and it will be released for production.',
    // A statistical signal, not a certain defect, so counsel can clear it.
    // Held back by default because producing another client's document is a
    // confidentiality breach, not merely a quality problem.
    dismissible: true,
  },
};

/**
 * Grades a document set by production readiness.
 *
 * @param files      documents in scope
 * @param citations  extracted citations keyed by document name (advisory only)
 * @param privilege  designations keyed by document name
 * @param bates      assigned Bates numbers keyed by document name
 */
export function computeIntegrityReport(
  files,
  citations,
  privilege = {},
  bates = {},
  confirmedRelated = new Set(),
  collectionConfirmed = false
) {
  if (!files || files.length === 0) return null;
  const total = files.length;

  // Does this set look like one matter?
  const cohesion = analyzeCohesion(files);
  const unrelatedNames = new Set(
    (cohesion?.outliers || []).filter(name => {
      const file = files.find(f => f.name === name);
      return !(file && confirmedRelated.has(file.hash));
    })
  );

  // --- Bates collisions, computed across the set before per-document checks ---
  const batesOwners = {};
  files.forEach(f => {
    const number = bates[f.name];
    if (!number) return;
    (batesOwners[number] = batesOwners[number] || []).push(f.name);
  });
  const collided = new Set(
    Object.values(batesOwners).filter(names => names.length > 1).flat()
  );

  // --- Duplicates, by content hash ---
  const seenHashes = new Set();
  const duplicateNames = [];
  files.forEach(f => {
    if (!f.hash) return;
    if (seenHashes.has(f.hash)) duplicateNames.push(f.name);
    else seenHashes.add(f.hash);
  });

  // --- Per-document blocking defects ---
  const exceptions = [];
  const ready = [];
  let unreadableCount = 0;

  files.forEach(file => {
    const defects = [];
    const content = file.content || '';

    if (!content.trim()) {
      defects.push(file.needsOcr ? 'needs_ocr' : 'empty');
      unreadableCount += 1;
    } else if (file.needsOcr) {
      defects.push('needs_ocr');
      unreadableCount += 1;
    } else if (content.includes('�')) {
      defects.push('corrupt');
      unreadableCount += 1;
    }

    const designation = privilege[file.name]?.status || 'produce';
    if (designation !== 'produce') {
      const record = privilege[file.name] || {};
      if (!record.basis || !record.description?.trim()) defects.push('privilege_incomplete');
    }

    if (collided.has(file.name)) defects.push('bates_collision');

    if (unrelatedNames.has(file.name)) defects.push('unrelated');

    if (defects.length > 0) {
      exceptions.push({
        name: file.name,
        hash: file.hash,
        bates: bates[file.name] || null,
        affinity: cohesion?.affinity?.[file.name] ?? null,
        nearest: cohesion?.nearest?.[file.name] ?? null,
        defects: defects.map(code => ({ code, ...DEFECTS[code] })),
      });
    } else {
      ready.push(file.name);
    }
  });

  // --- Advisory signals. None of these block production. ---
  const advisories = [];
  const readySet = new Set(ready);
  const readyFiles = files.filter(f => readySet.has(f.name));

  if (duplicateNames.length > 0) {
    advisories.push({
      key: 'duplicates',
      label: 'Duplicate documents',
      detail: `${duplicateNames.length} of ${total} are exact duplicates of another document in this set.`,
      why: 'Duplicates inflate production volume and review cost, and can put two Bates numbers on the same document.',
      names: duplicateNames,
      elevated: duplicateNames.length / total > DEDUPE_RATIO,
    });
  }

  const short = readyFiles.filter(f => f.content.trim().length < SHORT_DOCUMENT_CHARS);
  if (short.length > 0) {
    advisories.push({
      key: 'short',
      label: 'Very short documents',
      detail: `${short.length} contain little text and may be partial exports.`,
      why: 'Often a sign of a failed export, though a short document can be perfectly legitimate. Worth eyeballing before production.',
      names: short.map(f => f.name),
      elevated: false,
    });
  }

  const undated = readyFiles.filter(f => !DATE_PATTERN.test(f.content));
  if (undated.length > 0) {
    advisories.push({
      key: 'undated',
      label: 'No date found',
      detail: `${undated.length} contain no recognizable date.`,
      why: 'These are produced normally but cannot be placed on the case chronology in Stage 04.',
      names: undated.map(f => f.name),
      elevated: false,
    });
  }

  const uncitable = readyFiles.filter(f => !(citations?.[f.name]?.length));
  if (uncitable.length > 0) {
    advisories.push({
      key: 'uncitable',
      label: 'No quotable passage extracted',
      detail: `${uncitable.length} yielded no citation.`,
      why: 'These are produced normally. It reflects what the extractor found, not a defect in the document.',
      names: uncitable.map(f => f.name),
      elevated: false,
    });
  }

  if (cohesion?.incoherent && collectionConfirmed) {
    advisories.unshift({
      key: 'cohesion_override',
      label: 'Collection confirmed over a cohesion warning',
      detail: `These documents share little with one another (cohesion ${cohesion.setCohesion.toFixed(3)}), and counsel confirmed the collection is correct.`,
      why: 'Recorded here and in the audit log so the decision is traceable if the production is later questioned.',
      names: [],
      elevated: true,
    });
  }

  const unreadableRatio = unreadableCount / total;
  const state = (cohesion?.incoherent && !collectionConfirmed)
    ? 'incoherent'
    : unreadableRatio > RECOLLECT_RATIO
      ? 'not-reviewable'
      : exceptions.length === 0 ? 'ready' : 'cure';

  return {
    total,
    ready,
    exceptions,
    advisories,
    unreadableCount,
    // Coverage, not a quality average: the share of the set that is
    // production-ready. "94 of 100 documents are ready" is actionable in a way
    // that "78 out of 100 points" is not.
    coverage: Math.round((ready.length / total) * 100),
    state,
    stateMeta: READINESS_STATES[state],
    cohesion,
    // An incoherent set is a question about the whole collection, not about any
    // one document, so it holds everything with a single confirmation to clear
    // rather than flagging every file separately.
    setHold: Boolean(cohesion?.incoherent) && !collectionConfirmed,
  };
}
