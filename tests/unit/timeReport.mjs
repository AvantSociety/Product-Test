// Time attribution and quote-accuracy arithmetic for the Time Report.
// Run: node tests/unit/timeReport.mjs
import { activeTime, quoteReview, stageOfAction, buildTimeReport, IDLE_LIMIT_MINUTES } from '../../src/lib/timeReport.js';

let failures = 0;
const check = (c, msg) => { if (!c) failures += 1; console.log((c ? 'PASS ' : 'FAIL ') + msg); };
const t0 = Date.parse('2026-10-01T10:00:00Z');
const at = (min, actor, action) => ({ ts: new Date(t0 + min * 60000).toISOString(), actor, action, target: '' });
const MIN = 60000;

// --- Active time ---
{
  const log = [
    at(0, 'System', 'Ingested document'),
    at(1, 'User', 'Loaded sample matter (fictional)'),       // 1 min → stage 1
    at(4, 'User', 'Designated withhold'),                     // 3 min → stage 2
    at(6, 'System', 'Ran readiness check — 5 of 6 ready'),    // System: no counsel time
    at(9, 'Dana Ruiz', 'Acknowledged 1 held-back document'),  // 3 min since the check → stage 3
    at(40, 'Dana Ruiz', 'Kept extracted quote'),              // 31 min gap: a break
    at(43, 'Dana Ruiz', 'Edited brief'),                      // 3 min → stage 6
    at(44, 'Dana Ruiz', 'Something unmapped'),                // 1 min → other
  ];
  const t = activeTime(log);
  check(t.byStage[1] === 1 * MIN && t.byStage[2] === 3 * MIN && t.byStage[3] === 3 * MIN && t.byStage[6] === 3 * MIN,
    'time before each counsel action counts toward that action\'s stage');
  check(t.byStage[5] === 0 && t.breaks === 1, `a gap over ${IDLE_LIMIT_MINUTES} minutes is a break, not work`);
  check(t.byStage.other === 1 * MIN, 'unmapped actions are counted as "other", not dropped');
  check(t.total === 11 * MIN, 'total is the sum of counted gaps (11 min)');
  check(t.actions === 6, 'System entries are not counsel actions');
}

// --- Every logged action maps to a stage ---
{
  const actions = ['Ingested document', 'Selected for production (Produce)', 'Set privilege basis', 'Ran readiness check — x',
    'Rebuilt chronology after the producible set changed', 'Kept extracted quote', 'Dismissed extracted quote', 'Added citation',
    'Edited brief', 'Inserted a generated digest draft at the cursor', 'Approved package for service', 'Downloaded deliverable',
    'Exported time report', 'Retired Bates number', 'Changed screening criteria: parties'];
  const unmapped = actions.filter(a => stageOfAction(a) === null);
  check(unmapped.length === 0, `known actions all map to a stage${unmapped.length ? ': ' + unmapped.join(', ') : ''}`);
}

// --- Quote review ---
{
  const citations = {
    'a.txt': [
      { id: 0, review: 'kept' },
      { id: 1, review: 'dismissed' },
      { id: 2, tags: ['delay'] },          // a tag is an implicit keep
      { id: 3 },                           // a note is an implicit keep
      { id: 4 },                           // unreviewed
      { id: 'u-1', origin: 'user' },       // added by hand
    ],
    'withheld.txt': [{ id: 0, review: 'kept' }, { id: 'u-2', origin: 'user' }],
  };
  const r = quoteReview(citations, ['a.txt'], { 'a.txt::3': 'Key admission' });
  check(r.extracted === 5 && r.kept === 3 && r.dismissed === 1 && r.unreviewed === 1 && r.added === 1,
    'kept, dismissed, unreviewed and hand-added quotes counted');
  check(r.keptRate === 0.75 && r.foundRate === 0.75, 'kept rate 3/4 and found rate 3/(3+1)');
  check(quoteReview({}, [], {}).keptRate === null, 'no verdicts yet: rates are not invented');
  const report = buildTimeReport({ caseTitle: 'X v. Y', auditLog: [], review: r, outputs: [['Quotes extracted with their locators', 5]], firm: 'Morrow & Pike LLP' });
  check(/^Morrow & Pike LLP — Time Report \(internal\)/.test(report.content) && /time spent with the tool, not time saved/.test(report.content),
    'report is headed with the firm and says it measures time spent, not time saved');
  check(/Added by hand \(passages the tool missed\): 1/.test(report.content) && /found by the tool: 75% \(3 of 4\)/.test(report.content), 'report carries the accuracy figures');
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
