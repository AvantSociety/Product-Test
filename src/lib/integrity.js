// ==========================================
// INTEGRITY CHECK SCORING ENGINE
// ==========================================
//
// Grades a document set 0-100 across five weighted checks. Every point is
// traceable to a named check with a plain-English explanation, so the grade can
// be justified to a client rather than asserted.

import { DATE_PATTERN } from './citations.js';

export const PROCEED_THRESHOLD = 60;

export const INTEGRITY_BANDS = [
  {
    min: 85,
    label: 'READY TO PRODUCE',
    tone: 'emerald',
    verdict: 'This set is clean. Every document is readable, dated, and citable — it can move to analysis and be produced without further remediation.',
  },
  {
    min: PROCEED_THRESHOLD,
    label: 'PROCEED WITH REVIEW',
    tone: 'amber',
    verdict: 'This set is usable, but some documents have gaps that will weaken them as exhibits. Review the flagged checks below before relying on this material at deposition.',
  },
  {
    min: 0,
    label: 'NOT PRODUCTION READY',
    tone: 'red',
    verdict: 'This set has defects serious enough that analysis results would be unreliable. Re-collect or re-export the flagged documents before proceeding.',
  },
];

export const getIntegrityBand = (score) =>
  INTEGRITY_BANDS.find(b => score >= b.min) || INTEGRITY_BANDS[INTEGRITY_BANDS.length - 1];

export function computeIntegrityReport(files, citationsByFile) {
  if (!files || files.length === 0) return null;
  const total = files.length;
  const checks = [];

  // 1. Readability & Encoding — 25 pts
  const unreadable = files.filter(
    f => !f.content || !f.content.trim() || f.content.includes('�') || f.needsOcr
  );
  checks.push({
    key: 'readability',
    label: 'Readability & Encoding',
    max: 25,
    points: Math.round(25 * (1 - unreadable.length / total)),
    detail: unreadable.length === 0
      ? `All ${total} document${total === 1 ? '' : 's'} opened cleanly as readable text.`
      : `${unreadable.length} of ${total} could not be read as text (empty, corrupted, or a scanned image needing OCR).`,
    why: 'A document the system cannot read cannot be searched, cited, or produced. These normally need to be re-exported from the original source or put through OCR.',
    offenders: unreadable.map(f => f.name),
  });

  // 2. Content Completeness — 20 pts
  const thin = files.filter(f => (f.content || '').trim().length < 200);
  checks.push({
    key: 'completeness',
    label: 'Content Completeness',
    max: 20,
    points: Math.round(20 * (1 - thin.length / total)),
    detail: thin.length === 0
      ? 'No document appears truncated or near-empty.'
      : `${thin.length} of ${total} contain very little text and may be truncated or partial exports.`,
    why: 'Short or truncated files are a common sign of a failed export. Producing a partial document invites a completeness challenge under FRCP 34 and may require a re-production.',
    offenders: thin.map(f => f.name),
  });

  // 3. Chronology Anchors — 20 pts
  const undated = files.filter(f => !DATE_PATTERN.test(f.content || ''));
  checks.push({
    key: 'chronology',
    label: 'Chronology Anchors',
    max: 20,
    points: Math.round(20 * (1 - undated.length / total)),
    detail: undated.length === 0
      ? 'Every document contains at least one recognizable date.'
      : `${undated.length} of ${total} contain no recognizable date.`,
    why: 'Dates are what let the analysis stage place a document on the case timeline. An undated document can still be cited, but it cannot be sequenced against other evidence.',
    offenders: undated.map(f => f.name),
  });

  // 4. Citation Extractability — 20 pts
  const uncitable = files.filter(f => !(citationsByFile?.[f.name]?.length));
  checks.push({
    key: 'citations',
    label: 'Citation Extractability',
    max: 20,
    points: Math.round(20 * (1 - uncitable.length / total)),
    detail: uncitable.length === 0
      ? 'Quotable passages were extracted from every document.'
      : `${uncitable.length} of ${total} yielded no quotable passage.`,
    why: 'These are the passages that become record citations in the brief. A document with none will still be produced, but it will not generate findings in the Citation Matrix.',
    offenders: uncitable.map(f => f.name),
  });

  // 5. Duplicate Detection — 15 pts
  const seen = new Set();
  const duplicates = [];
  files.forEach(f => {
    if (!f.hash) return;
    if (seen.has(f.hash)) duplicates.push(f.name);
    else seen.add(f.hash);
  });
  checks.push({
    key: 'duplicates',
    label: 'Duplicate Detection',
    max: 15,
    points: Math.round(15 * (1 - Math.min(duplicates.length / total, 1))),
    detail: duplicates.length === 0
      ? 'No duplicate documents in this set.'
      : `${duplicates.length} exact duplicate${duplicates.length === 1 ? '' : 's'} found.`,
    why: 'Duplicates inflate the production volume, cost review time, and can produce two different Bates numbers for the same document — which opposing counsel will notice.',
    offenders: duplicates,
  });

  const score = Math.max(0, Math.min(100, checks.reduce((sum, c) => sum + c.points, 0)));
  return { score, checks, fileCount: total, band: getIntegrityBand(score) };
}
