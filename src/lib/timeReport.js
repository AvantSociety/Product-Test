// ==========================================
// TIME AND ACCURACY REPORT
// ==========================================
//
// Measures what a matter actually took, from the audit log the app already
// keeps, and how often the tool's quotes were right, from counsel's own
// verdicts. Nothing here is estimated or leaves the browser.
//
// Time is counsel's active time: the gap before each of counsel's logged
// actions, counted toward that action's stage. Reading and thinking between
// actions is included; a gap longer than the idle limit is treated as a break
// and left out. Automatic processing (ingest, checks, analysis) is not
// counsel's time and is reported as output instead.
//
// This is time spent, not time saved. Time saved needs a baseline: how long
// the same work took without the tool, which only the firm can supply.

/** A gap between actions longer than this is a break, not work. */
export const IDLE_LIMIT_MINUTES = 10;

export const STAGE_NAMES = {
  1: 'Ingest and screening',
  2: 'Review and designation',
  3: 'Readiness check',
  4: 'Chronology',
  5: 'Citations',
  6: 'Drafting',
  7: 'Approval',
  8: 'Export',
};

// The stage each logged action belongs to, by the action's wording.
const STAGE_OF = [
  [/^(Ingested document|Loaded sample|Removed document|Changed screening criteria|Re-extracted citations|Requested persistent)/, 1],
  [/^(Selected for production|Deselected|Designated|Cleared not-responsive|Set privilege basis|Edited privilege description|Renamed matter|Changed Bates|Changed firm name|Retired Bates number)/, 2],
  [/^(Ran readiness check|Confirmed|Acknowledged|Readiness check voided)/, 3],
  [/^(Ran deep analysis|Rebuilt chronology)/, 4],
  [/^(Annotated finding|Deleted note|Added citation|Removed citation|Tagged finding|Removed tag|Kept extracted quote|Dismissed extracted quote|Restored dismissed quote)/, 5],
  [/^(Edited brief|Generated citation digest|Inserted|Replaced the edited brief)/, 6],
  [/^(Approved package|Approval voided|Flagged for senior|Cleared senior|Turned (on|off) the deliverable footer)/, 7],
  [/^(Downloaded deliverable|Exported audit log|Exported time report|Changed estimate|Checked the audit log)/, 8],
];

export function stageOfAction(action) {
  const hit = STAGE_OF.find(([re]) => re.test(action || ''));
  return hit ? hit[1] : null;
}

/**
 * Counsel's active time by stage, in milliseconds, from the audit log.
 * Returns { byStage, total, breaks, actions, firstAt, lastAt }.
 */
export function activeTime(auditLog, idleLimitMinutes = IDLE_LIMIT_MINUTES) {
  const limit = idleLimitMinutes * 60 * 1000;
  const byStage = {};
  Object.keys(STAGE_NAMES).forEach(k => { byStage[k] = 0; });
  byStage.other = 0;
  let total = 0;
  let breaks = 0;
  let actions = 0;
  let prev = null;
  for (const entry of auditLog) {
    const at = Date.parse(entry.ts);
    if (Number.isNaN(at)) continue;
    if (entry.actor !== 'System') {
      actions += 1;
      if (prev !== null) {
        const gap = at - prev;
        if (gap > limit) breaks += 1;
        else if (gap > 0) {
          byStage[stageOfAction(entry.action) ?? 'other'] += gap;
          total += gap;
        }
      }
    }
    prev = at;
  }
  const stamps = auditLog.map(e => Date.parse(e.ts)).filter(n => !Number.isNaN(n));
  return {
    byStage, total, breaks, actions,
    firstAt: stamps.length ? Math.min(...stamps) : null,
    lastAt: stamps.length ? Math.max(...stamps) : null,
  };
}

/**
 * Counsel's verdict on the tool's quotes, across the documents being produced.
 *   kept       marked Keep, or annotated with a note or tag and not dismissed
 *   dismissed  marked Dismiss
 *   added      quotes counsel selected by hand: passages the tool missed
 */
export function quoteReview(citationsByDoc, producibleNames, notes = {}) {
  let kept = 0; let dismissed = 0; let unreviewed = 0; let added = 0;
  producibleNames.forEach(name => {
    (citationsByDoc[name] || []).forEach(c => {
      if (c.origin === 'user') { added += 1; return; }
      const annotated = (c.tags || []).length > 0 || Boolean(notes[`${name}::${c.id}`]?.trim());
      if (c.review === 'dismissed') dismissed += 1;
      else if (c.review === 'kept' || annotated) kept += 1;
      else unreviewed += 1;
    });
  });
  const extracted = kept + dismissed + unreviewed;
  return {
    extracted, kept, dismissed, unreviewed, added,
    // Of the quotes counsel judged, the share worth keeping.
    keptRate: kept + dismissed > 0 ? kept / (kept + dismissed) : null,
    // Of the quotes counsel wanted, the share the tool found on its own.
    foundRate: kept + added > 0 ? kept / (kept + added) : null,
  };
}

export function formatDuration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return ms > 0 ? 'under 1 min' : '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

const pctText = (r) => (r === null ? 'not yet measured' : `${Math.round(r * 100)}%`);

/**
 * The internal Time Report: what the matter took, what the tool produced, and
 * how its quotes fared. For the firm's own use and, if it chooses, to share.
 */
export function buildTimeReport({ caseTitle, auditLog, review, outputs, firm = '' }) {
  const t = activeTime(auditLog);
  const lines = [
    `${(firm || '').trim() || '[Firm name not set]'} — Time Report (internal)`,
    caseTitle,
    `Generated ${new Date().toLocaleString()}`,
    '',
    'HOW THIS IS MEASURED',
    `Counsel's active time is read from the audit log timestamps. The time before each of counsel's actions counts toward that action's stage, which includes reading and thinking between actions. Gaps longer than ${IDLE_LIMIT_MINUTES} minutes are treated as breaks and left out (${t.breaks} on this matter). Work done outside the app is not measured.`,
    'This is time spent with the tool, not time saved. To state time saved, compare it with how long the same work took the firm without the tool.',
    '',
    'COUNSEL ACTIVE TIME',
    ...Object.entries(STAGE_NAMES).map(([k, name]) => `  ${name}: ${formatDuration(t.byStage[k])}`),
    ...(t.byStage.other ? [`  Other: ${formatDuration(t.byStage.other)}`] : []),
    `  Total: ${formatDuration(t.total)} across ${t.actions} logged actions`,
    t.firstAt ? `  Matter opened ${new Date(t.firstAt).toLocaleString()}; last action ${new Date(t.lastAt).toLocaleString()}` : '',
    '',
    'PRODUCED BY THE TOOL',
    ...outputs.map(([label, value]) => `  ${label}: ${value}`),
    '',
    'QUOTE ACCURACY (counsel\'s verdicts on the documents being produced)',
    `  Quotes extracted by the tool: ${review.extracted}`,
    `  Kept (marked Keep, or given a note or tag): ${review.kept}`,
    `  Dismissed: ${review.dismissed}`,
    `  Not yet reviewed: ${review.unreviewed}`,
    `  Added by hand (passages the tool missed): ${review.added}`,
    `  Of the quotes counsel judged, kept: ${pctText(review.keptRate)} (${review.kept} of ${review.kept + review.dismissed})`,
    `  Of the quotes counsel wanted, found by the tool: ${pctText(review.foundRate)} (${review.kept} of ${review.kept + review.added})`,
    '  Small counts make these rates unreliable; quote them only from matters with enough reviewed quotes.',
  ];
  const content = lines.join('\n');
  return {
    filename: `${(caseTitle || 'matter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-time-report.txt`,
    mime: 'text/plain',
    content,
    count: t.actions,
  };
}
