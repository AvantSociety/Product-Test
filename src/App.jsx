import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderDown,
  UploadCloud,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  FileText,
  Edit3,
  Archive,
  Trophy,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Check,
  Layers,
  Download,
  DollarSign,
  Clock,
  Keyboard,
  Menu,
  X,
  Search,
  Sparkles,
  Sun,
  Moon,
  Plus,
  Trash2,
  Activity,
  Circle,
  Lock,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  EyeOff,
  ScrollText,
  UserRound,
  StickyNote,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';

import { readDocument, manifestHash, ACCEPTED_EXTENSIONS } from './lib/documents.js';
import {
  extractCitations,
  formatCitation,
  parseEventDate,
  formatEventDate,
  buildUserCitation,
  SIGNAL_LABELS,
  DATE_PATTERN,
} from './lib/citations.js';
import { computeIntegrityReport, RECOLLECT_RATIO } from './lib/integrity.js';
import { MIN_SET_COHESION } from './lib/cohesion.js';
import {
  screenDocuments,
  parseCriteriaList,
  hasCriteria,
  RELEVANCE_CATEGORIES,
} from './lib/relevance.js';
import { saveMatter, loadMatter, clearMatter } from './lib/persistence.js';
import {
  buildPrivilegeLog,
  buildProductionIndex,
  buildBrief,
  buildAuditLog,
  buildExceptionsReport,
  triggerDownload,
  triggerBlobDownload,
  renderTextPdf,
  byteLabel,
} from './lib/exports.js';

// ==========================================
// STATUS VISUALIZERS
// ==========================================

const MicroStatusVisualizer = ({ active, isDarkMode }) => (
  <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
    <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-700 ${active ? 'border-indigo-500/30 animate-spin' : 'border-slate-500/10'}`} style={{ animationDuration: '30s' }} />
    <div className="w-20 h-20 rounded-full border border-slate-300 bg-white flex items-center justify-center relative z-10">
      {active ? <Activity className="w-8 h-8 text-indigo-500 animate-pulse" /> : <ShieldCheck className="w-8 h-8 text-slate-500" />}
    </div>
  </div>
);

/**
 * Renders the chronology assembled in Stage 04. Every dated event gets its own
 * point: events close together in time would otherwise draw on top of one
 * another, so colliding points are stacked into lanes above the axis. Hovering
 * a point shows the document it came from.
 */
const TimelineStrip = ({ timeline, isDarkMode, bates = {}, onOpen }) => {
  const plotRef = useRef(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    observer.observe(el);
    setPlotWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [timeline]);

  if (!timeline || timeline.length === 0) {
    return (
      <div className={`w-full rounded-xl border border-dashed p-6 text-center ${isDarkMode ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
        <p className="text-[10px] font-mono font-bold">NO DATED EVENTS FOUND</p>
        <p className="text-[9px] font-mono mt-1 opacity-60">None of the selected documents contain a recognizable date</p>
      </div>
    );
  }

  const times = timeline.map(e => e.time);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(max - min, 1);
  const sourceCount = new Set(timeline.map(e => e.source)).size;

  const DOT = 9;        // rendered point diameter including ring, in px
  const LANE_H = 12;    // vertical step between stacked lanes, in px
  // Two points collide when they are closer than one dot width. Measured from
  // the real plot width so the packing holds at any viewport size.
  const minGapPct = plotWidth ? ((DOT + 2) / plotWidth) * 100 : 2.4;

  const laneLastX = [];
  const points = [...timeline]
    .sort((a, b) => a.time - b.time)
    .map((event, i) => {
      const x = max === min ? 50 : ((event.time - min) / span) * 92 + 4;
      let lane = 0;
      while (laneLastX[lane] !== undefined && x - laneLastX[lane] < minGapPct) lane += 1;
      laneLastX[lane] = x;
      return { ...event, x, lane, key: `${event.source}::${event.time}::${i}` };
    });

  const laneCount = Math.max(laneLastX.length, 1);
  const plotHeight = 14 + laneCount * LANE_H;

  return (
    <div className={`relative w-full rounded-xl border p-4 ${isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-start mb-3 gap-3">
        <div>
          <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase font-bold">Case Chronology</span>
          <h4 className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {timeline.length} dated event{timeline.length === 1 ? '' : 's'} across {sourceCount} document{sourceCount === 1 ? '' : 's'}
          </h4>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono border shrink-0 ${
          isDarkMode ? 'bg-white/[0.05] text-slate-400 border-white/[0.06]' : 'bg-slate-100 text-slate-500 border-slate-200'
        }`}>
          {new Date(min).getFullYear()}&ndash;{new Date(max).getFullYear()}
        </span>
      </div>

      <div ref={plotRef} className="relative" style={{ height: plotHeight }}>
        <div className={`absolute left-0 right-0 bottom-0 h-px ${isDarkMode ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />

        {points.map((point) => {
          const isHovered = hovered === point.key;
          // Keep the hover card inside the panel at either end of the axis.
          const align = point.x < 20
            ? 'left-0'
            : point.x > 80
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2';
          return (
            <div
              key={point.key}
              className="absolute"
              style={{ left: `${point.x}%`, bottom: `${point.lane * LANE_H + 4}px`, transform: 'translateX(-50%)' }}
            >
              <button
                type="button"
                aria-label={`${formatEventDate(point.time)} — ${point.source}. Open document.`}
                onMouseEnter={() => setHovered(point.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(point.key)}
                onBlur={() => setHovered(null)}
                onClick={() => onOpen?.(point.source)}
                className="block p-0 border-0 bg-transparent cursor-pointer"
              >
                <span
                  className={`block rounded-full transition-transform duration-150 ${
                    isHovered
                      ? 'bg-indigo-300 ring-2 ring-indigo-400/50 scale-150'
                      : 'bg-indigo-500 ring-2 ring-indigo-500/20'
                  }`}
                  style={{ width: DOT - 2, height: DOT - 2 }}
                />
              </button>

              {isHovered && (
                <div className={`absolute z-30 bottom-full mb-2 w-max max-w-[240px] pointer-events-none rounded-lg border px-2.5 py-1.5 shadow-xl ${align} ${
                  isDarkMode ? 'bg-[#1B1D27] border-white/[0.1]' : 'bg-white border-slate-200'
                }`}>
                  <p className="text-[10px] font-mono font-bold text-indigo-400">
                    {formatEventDate(point.time)}
                  </p>
                  <p className={`text-[11px] font-semibold mt-0.5 truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {point.source}
                  </p>
                  <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                    {bates[point.source] ? `${bates[point.source]} · ` : ''}matched &ldquo;{point.label}&rdquo;
                  </p>
                  <p className="text-[9px] font-mono text-indigo-400 mt-1">Click to open this document</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1.5 gap-2">
        <span className="shrink-0">{formatEventDate(min)}</span>
        <span className="text-slate-600 text-center truncate">
          numeric dates read as month/day/year &middot; click a point to open its document
        </span>
        <span className="shrink-0">{formatEventDate(max)}</span>
      </div>
    </div>
  );
};

// ==========================================
// STEPS & DATA DEFINITIONS
// ==========================================

const STEPS = [
  { id: 0, title: 'Orientation Hub', actor: 'System', icon: Sparkles, description: 'Quick framework orientation and landing' },
  { id: 1, title: 'Discovery Ingest', actor: 'Source', icon: FolderDown, description: 'Upload and index client documents' },
  { id: 2, title: 'Review & Designate', actor: 'Attorney', icon: EyeOff, description: 'Privilege review and production selection' },
  { id: 3, title: 'Integrity Check', actor: 'System', icon: CheckCircle2, description: 'Bates sequencing & manifest validation' },
  { id: 4, title: 'Deep Analysis', actor: 'Processor', icon: Cpu, description: 'Cross-document chronological matching' },
  { id: 5, title: 'Citation Matrix', actor: 'Trust Layer', icon: ShieldCheck, description: 'Record citations traced to source' },
  { id: 6, title: 'Interactive Review', actor: 'Attorney', icon: FileText, description: 'Strategic brief drafted from findings' },
  { id: 7, title: 'Override & Refine', actor: 'Attorney', icon: Edit3, description: 'Matter parameters, Bates numbering & approval' },
  { id: 8, title: 'Package Ready', actor: 'Deliverables', icon: Archive, description: 'Preview and export production deliverables' },
  { id: 9, title: 'Completion Check', actor: 'Archived', icon: Trophy, description: 'Completion checklist and matter summary' },
];

// What "complete" means for a production, as a checklist the attorney can see.
// Each item is satisfied by a stage's real state, not by having visited it.
const COMPLETION_ITEMS = [
  { stage: 1, label: 'Documents ingested and hashed' },
  { stage: 2, label: 'Every document designated, with a complete privilege log entry for each one withheld' },
  { stage: 3, label: 'Readiness check run against the production set' },
  { stage: 4, label: 'Chronology built from the producible documents' },
  { stage: 5, label: 'Findings annotated by counsel' },
  { stage: 6, label: 'Brief reviewed and edited, not left as a scaffold' },
  { stage: 7, label: 'Package approved by a named attorney' },
  { stage: 8, label: 'Deliverables exported' },
];

// The eight steps a production needs, as the matter bar shows them. Labels are
// verbs so the bar reads as a sequence of work rather than a list of screens.
const METER = [
  { id: 1, label: 'Ingest' },
  { id: 2, label: 'Designate' },
  { id: 3, label: 'Check' },
  { id: 4, label: 'Analyze' },
  { id: 5, label: 'Cite' },
  { id: 6, label: 'Draft' },
  { id: 7, label: 'Approve' },
  { id: 8, label: 'Export' },
];

/**
 * Eases a number toward its new value, so counts visibly move when work lands
 * rather than jumping. Honours reduced-motion: those users get the value at once.
 */
function useAnimatedNumber(value, duration = 650) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      setShown(value);
      fromRef.current = value;
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); fromRef.current = value; };
  }, [value, duration]);
  return shown;
}

/** One figure in the matter bar. Defined outside App so it never remounts. */
const MatterStat = ({ label, value, isDarkMode, tone }) => (
  <div className="min-w-0">
    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">{label}</span>
    <span className={`text-lg font-bold tabular-nums leading-tight block ${
      tone || (isDarkMode ? 'text-white' : 'text-slate-900')
    }`} style={{ fontFamily: 'var(--font-serif)' }}>
      {value}
    </span>
  </div>
);

const ACTOR_STYLES = {
  System: { border: 'border-indigo-500/20', text: 'text-indigo-400', bg: 'bg-indigo-500/5' },
  Source: { border: 'border-slate-500/20', text: 'text-slate-400', bg: 'bg-slate-500/5' },
  Attorney: { border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/5' },
  Processor: { border: 'border-purple-500/20', text: 'text-purple-400', bg: 'bg-purple-500/5' },
  'Trust Layer': { border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/5' },
  Deliverables: { border: 'border-indigo-500/20', text: 'text-indigo-400', bg: 'bg-indigo-500/5' },
  Archived: { border: 'border-slate-500/20', text: 'text-slate-300', bg: 'bg-white/[0.04]' },
};

const ADVISOR_TIPS = {
  0: 'Start at Discovery Ingest to upload the documents for this matter. Everything downstream is built from what you load there.',
  1: 'Upload client documents from your computer. PDF, DOCX, email and plain-text formats are read directly; scanned PDFs are flagged as needing OCR.',
  2: 'Set the matter name and Bates numbering here — the integrity check stamps documents in Stage 03, so this is your last chance to change them. Then designate each document; anything withheld as privileged is excluded downstream and recorded on the privilege log.',
  3: 'Run the readiness check. Documents with defects that make them unsafe to produce are held back onto an exceptions list; the rest proceed clean. Duplicates and missing dates are advisory and never block.',
  4: 'Dates are extracted from each document and assembled into a case chronology. Progress reflects documents actually processed.',
  5: 'Select a finding to highlight the exact passage it was drawn from. Notes you add are attached to that passage in that document.',
  6: 'The brief is drafted from the findings you extracted. Edit it directly — your changes are kept and exported.',
  7: 'Set the Bates prefix and starting number before the integrity check assigns numbers, then record the attorney approving the package. Changing a designation afterwards voids that approval.',
  8: 'Preview each deliverable before you download it. The brief and privilege log also render as paginated PDFs; the index and audit log stay CSV for loading into a review platform.',
  9: 'A checklist of what a finished production requires, each item checked against real matter state. Resetting clears every document and annotation from this browser.',
};

const PRIVILEGE_BASES = ['Attorney-Client', 'Work Product', 'Common Interest', 'Other'];

const DISPOSITIONS = {
  produce: { label: 'Produce', tone: 'emerald' },
  redact: { label: 'Redact', tone: 'amber' },
  withhold: { label: 'Withhold', tone: 'red' },
};

const DEFAULT_MEMO =
  'Draft the strategic evaluation here, or generate a first pass from the findings extracted in the Citation Matrix.';

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The Advisor is a full-screen overlay below lg, so opening it by default on
  // a phone would bury the stage and its navigation. Desktop keeps it open.
  // The Advisor starts closed. Open, it took 330px from the workspace on every
  // stage while mostly repeating guidance a returning user has already read.
  const [copilotOpen, setCopilotOpen] = useState(false);
  // The stage rail can collapse to icons. A per-viewer preference, so it lives
  // in browser storage, which can be unavailable — hence the guards.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('ci.railCollapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('ci.railCollapsed', sidebarCollapsed ? '1' : '0'); } catch { /* storage blocked */ }
  }, [sidebarCollapsed]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- Matter state (persisted) ---
  const [documents, setDocuments] = useState([]);
  const [citations, setCitations] = useState({});
  const [privilege, setPrivilege] = useState({});
  const [selectedForReview, setSelectedForReview] = useState([]);
  const [notes, setNotes] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [caseTitle, setCaseTitle] = useState('In Re Jones Litigation');
  const [batesPrefix, setBatesPrefix] = useState('VLM');
  const [batesStart, setBatesStart] = useState(1);
  const [batesAssignments, setBatesAssignments] = useState({});
  // Content hashes of documents counsel has confirmed belong to this matter,
  // clearing the "does not appear to belong" hold. Keyed by hash so editing or
  // replacing a document re-raises the question.
  const [confirmedRelated, setConfirmedRelated] = useState([]);
  // Content-set keys for collections counsel has confirmed are the right
  // documents. Changing the selection changes the key, so the question returns.
  const [confirmedCollections, setConfirmedCollections] = useState([]);
  const [isFlaggedForReview, setIsFlaggedForReview] = useState(false);
  const [memoText, setMemoText] = useState(DEFAULT_MEMO);
  // A generated listing is not work product until counsel has worked on it.
  const [memoEdited, setMemoEdited] = useState(false);
  // Who approved the package for service, and when. FRCP 26(g) requires a
  // signature from an attorney of record; an unattributed "approved" event is
  // worth nothing if the production is later challenged.
  const [approval, setApproval] = useState(null);
  const [approverDraft, setApproverDraft] = useState('');
  const [previewKey, setPreviewKey] = useState(null);
  const [trustOpen, setTrustOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [pdfPending, setPdfPending] = useState(null);

  // --- Ingest ---
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('ALL');
  const [relevanceFilter, setRelevanceFilter] = useState('ALL');
  // Open while the matter has no criteria: collapsed, it reads as optional and
  // first-time users walk straight past the most useful control on the page.
  const [criteriaOpen, setCriteriaOpen] = useState(true);

  // Screening criteria are supplied by counsel, not inferred. Relevance is a
  // judgment against the claims and defenses; the tool only reports hits.
  const [criteriaParties, setCriteriaParties] = useState('');
  const [criteriaTerms, setCriteriaTerms] = useState('');
  const [criteriaFrom, setCriteriaFrom] = useState('');
  const [criteriaTo, setCriteriaTo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadNotices, setUploadNotices] = useState([]);

  // --- Review & designate ---
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSort, setReviewSort] = useState('name');

  // --- Integrity ---
  const [isRunningIntegrityCheck, setIsRunningIntegrityCheck] = useState(false);
  const [integrityReport, setIntegrityReport] = useState(null);
  // Set when a completed check is invalidated by a later edit, so the warning
  // appears where the change was made rather than only where the result lived.
  const [voidedCheck, setVoidedCheck] = useState(null);
  const [manifestSha, setManifestSha] = useState(null);

  // --- Analysis ---
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState('Waiting to start...');
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [docAnalysis, setDocAnalysis] = useState({});

  // Document opened in the full-screen reader (by name), or null.
  const [openDocument, setOpenDocument] = useState(null);

  // --- Citation matrix ---
  const [selectedDocSource, setSelectedDocSource] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(0);
  const [activeNoteInput, setActiveNoteInput] = useState('');
  const [copiedCitation, setCopiedCitation] = useState(false);
  // Citations, tags and the note previously stacked in one narrow column and
  // pushed the tag editor below the fold. The editors now share a tab.
  const [sidePane, setSidePane] = useState('note');
  // A passage the attorney has highlighted in the viewer, awaiting confirmation
  // before it becomes a citation.
  const [pendingSelection, setPendingSelection] = useState(null);
  const [pendingTags, setPendingTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');

  // --- Advisor ---
  const [messages, setMessages] = useState([]);
  const [userQueryText, setUserQueryText] = useState('');

  const rightPanelRef = useRef(null);
  // Stage 05 viewer: scrolls the highlighted passage to the top when a finding
  // is selected, so it is never left off-screen in a long document.
  const viewerRef = useRef(null);
  const markRef = useRef(null);
  // Wraps only the document body, so selection offsets are measured against the
  // document text and not the surrounding chrome.
  const docTextRef = useRef(null);
  const hydrated = useRef(false);
  // Mirrors `documents` so ingest can check for duplicates synchronously,
  // without reading a flag set inside a state updater.
  const documentsRef = useRef([]);
  useEffect(() => { documentsRef.current = documents; }, [documents]);

  const appendAudit = useCallback((action, target) => {
    setAuditLog(prev => [
      ...prev,
      { ts: new Date().toISOString(), actor: 'Attorney', action, target: target || '' },
    ]);
  }, []);

  const handleStepChange = useCallback((stepId) => {
    setActiveStep(stepId);
    setSidebarOpen(false);
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0;
  }, []);

  // ---------- Persistence ----------

  useEffect(() => {
    let cancelled = false;
    loadMatter().then(saved => {
      if (cancelled || !saved) { hydrated.current = true; return; }
      setDocuments(saved.documents || []);
      setCitations(saved.citations || {});
      setPrivilege(saved.privilege || {});
      setSelectedForReview(saved.selectedForReview || []);
      setNotes(saved.notes || {});
      setAuditLog(saved.auditLog || []);
      setCaseTitle(saved.caseTitle ?? 'In Re Jones Litigation');
      setBatesPrefix(saved.batesPrefix ?? 'VLM');
      setBatesStart(saved.batesStart ?? 1);
      setBatesAssignments(saved.batesAssignments || {});
      setIsFlaggedForReview(!!saved.isFlaggedForReview);
      setMemoText(saved.memoText ?? DEFAULT_MEMO);
      setConfirmedRelated(saved.confirmedRelated || []);
      setConfirmedCollections(saved.confirmedCollections || []);
      setCriteriaParties(saved.criteriaParties || '');
      setCriteriaTerms(saved.criteriaTerms || '');
      setCriteriaFrom(saved.criteriaFrom || '');
      setCriteriaTo(saved.criteriaTo || '');
      setMemoEdited(!!saved.memoEdited);
      setApproval(saved.approval || null);
      hydrated.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const handle = setTimeout(() => {
      saveMatter({
        documents, citations, privilege, selectedForReview, notes, auditLog,
        caseTitle, batesPrefix, batesStart, batesAssignments, isFlaggedForReview, memoText,
        confirmedRelated, confirmedCollections,
        criteriaParties, criteriaTerms, criteriaFrom, criteriaTo,
        memoEdited, approval,
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [documents, citations, privilege, selectedForReview, notes, auditLog,
      caseTitle, batesPrefix, batesStart, batesAssignments, isFlaggedForReview, memoText,
      confirmedRelated, confirmedCollections,
      criteriaParties, criteriaTerms, criteriaFrom, criteriaTo, memoEdited, approval]);

  // ---------- Derived ----------

  const relevanceCriteria = useMemo(() => ({
    parties: parseCriteriaList(criteriaParties),
    terms: parseCriteriaList(criteriaTerms),
    from: criteriaFrom,
    to: criteriaTo,
  }), [criteriaParties, criteriaTerms, criteriaFrom, criteriaTo]);

  const screeningActive = hasCriteria(relevanceCriteria);

  const { results: relevanceResults, counts: relevanceCounts } = useMemo(
    () => screenDocuments(documents, relevanceCriteria),
    [documents, relevanceCriteria]
  );

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = fileFilter === 'ALL' || doc.type === fileFilter;
    const matchesRelevance = relevanceFilter === 'ALL'
      || relevanceResults[doc.name]?.category === relevanceFilter;
    return matchesSearch && matchesType && matchesRelevance;
  });

  const documentTypes = ['ALL', ...Array.from(new Set(documents.map(d => d.type)))];

  // Screened-out documents sort to the top of the designation list: they are
  // the ones needing a decision, and burying them is how an irrelevant document
  // ends up produced.
  const RELEVANCE_ORDER = { none: 0, out_of_period: 1, possible: 2, strong: 3, unscreened: 3 };
  const reviewDocuments = documents
    .filter(doc => doc.name.toLowerCase().includes(reviewSearch.toLowerCase()))
    .sort((a, b) => {
      if (reviewSort === 'pages') return b.pages - a.pages;
      if (reviewSort === 'type') return a.type.localeCompare(b.type);
      if (reviewSort === 'relevance' || screeningActive) {
        const ra = RELEVANCE_ORDER[relevanceResults[a.name]?.category ?? 'unscreened'];
        const rb = RELEVANCE_ORDER[relevanceResults[b.name]?.category ?? 'unscreened'];
        if (ra !== rb) return ra - rb;
      }
      return a.name.localeCompare(b.name);
    });

  const dispositionOf = (name) => privilege[name]?.status || 'produce';

  // Withheld documents never reach analysis, citations, or the brief.
  // Documents the readiness check held back. They stay in the matter and on the
  // exceptions report, but never reach analysis, citations or the brief.
  const quarantinedNames = integrityReport
    ? (integrityReport.setHold
        ? selectedForReview.slice()
        : integrityReport.exceptions.map(e => e.name))
    : [];
  const producibleNames = selectedForReview.filter(
    name => dispositionOf(name) !== 'withhold' && !quarantinedNames.includes(name)
  );
  const selectedDocs = selectedForReview
    .map(name => documents.find(d => d.name === name))
    .filter(Boolean);
  const producibleDocs = producibleNames
    .map(name => documents.find(d => d.name === name))
    .filter(Boolean);

  const totalPages = selectedDocs.reduce((sum, d) => sum + (d.pages || 0), 0);
  const pagesEstimated = selectedDocs.some(d => !d.pagesExact);
  const withheldCount = selectedForReview.filter(n => dispositionOf(n) === 'withhold').length;

  // "Ready" mixed two questions: a withheld document is not defective but is
  // also not going out. These split them so the three numbers sum to the set.
  const withheldReadyCount = integrityReport
    ? integrityReport.ready.filter(n => dispositionOf(n) === 'withhold').length : 0;
  const producingCount = integrityReport
    ? integrityReport.ready.length - withheldReadyCount : 0;

  // A privilege log entry without a basis and description is incomplete under
  // FRCP 26(b)(5) and invites a motion to compel.
  const incompletePrivilege = selectedForReview.filter(name => {
    if (dispositionOf(name) === 'produce') return false;
    const record = privilege[name] || {};
    return !record.basis || !record.description?.trim();
  });

  const activeCitations = selectedDocSource ? (citations[selectedDocSource] || []) : [];
  const activeCitation = activeCitations.find(c => c.id === selectedFinding) || null;
  const noteKey = selectedDocSource ? `${selectedDocSource}::${selectedFinding}` : null;

  const allProducibleCitations = producibleDocs.flatMap(d => citations[d.name] || []);

  // ---------- Stage progress ----------
  //
  // The stepper used to show only where you were standing, which tells an
  // attorney picking the matter back up nothing about what is left. Each stage
  // reports one of four states, derived from real matter state:
  //   done     — the work this stage exists for has actually been done
  //   blocked  — an earlier stage has not produced what this one needs
  //   todo     — reachable, not yet done
  // A stage is never marked done because you merely visited it.
  const deliverableDownloaded = auditLog.some(e => e.action === 'Downloaded deliverable');

  const baseProgress = useMemo(() => {
    const ingested = documents.length > 0;
    const selected = selectedForReview.length > 0;
    const producible = producibleNames.length > 0;
    const cited = allProducibleCitations.length > 0;
    // Annotation is the attorney's own work on the record: a note, a tag, or a
    // citation they wrote themselves.
    const annotated = Object.values(notes).some(n => n?.trim())
      || allProducibleCitations.some(c => (c.tags || []).length > 0 || c.origin === 'user');

    const state = (done, blockedWhen, blockedHint, todoHint, doneHint) =>
      done ? { state: 'done', hint: doneHint }
        : blockedWhen ? { state: 'blocked', hint: blockedHint }
        : { state: 'todo', hint: todoHint };

    return {
      0: state(ingested, false, '', 'Read the orientation', 'Orientation read'),
      1: state(ingested, false, '', 'No documents ingested', `${documents.length} ingested`),
      2: state(selected && incompletePrivilege.length === 0, !ingested,
          'Ingest documents first',
          incompletePrivilege.length > 0
            ? `${incompletePrivilege.length} privilege entr${incompletePrivilege.length === 1 ? 'y' : 'ies'} incomplete`
            : 'Nothing designated',
          `${producibleNames.length} producing, ${withheldCount} withheld`),
      3: state(integrityReport?.state === 'ready', !producible, 'Designate documents first',
          integrityReport ? (integrityReport.stateMeta?.label || 'Not ready').toLowerCase() : 'Check not run',
          `${integrityReport?.ready.length ?? 0} ready to produce`),
      4: state(analysisComplete, !producible, 'Designate documents first', 'Analysis not run',
          `${timeline.length} dated event${timeline.length === 1 ? '' : 's'}`),
      5: state(annotated, !cited, 'No citations to work from', 'No notes or tags yet',
          `${allProducibleCitations.length} citations on the record`),
      6: state(memoEdited, !cited, 'No citations to draft from', 'Draft not yet edited',
          'Draft edited by counsel'),
      7: state(!!approval, !producible, 'Nothing to approve', 'No approver recorded',
          `Approved by ${approval?.by || ''}`),
      8: state(deliverableDownloaded, !producible, 'Nothing to package', 'Nothing downloaded yet',
          'Deliverables downloaded'),
      9: { state: 'todo', hint: '' },
    };
  }, [documents.length, selectedForReview.length, producibleNames.length, withheldCount,
      incompletePrivilege.length, integrityReport, analysisComplete, timeline.length,
      allProducibleCitations, notes, memoEdited, approval, deliverableDownloaded]);

  const completionOutstanding = COMPLETION_ITEMS.filter(
    item => baseProgress[item.stage].state !== 'done'
  );

  // Stage 09 is not a stage you do; it is done exactly when everything else is.
  const stageProgress = {
    ...baseProgress,
    9: completionOutstanding.length === 0
      ? { state: 'done', hint: 'Production complete' }
      : { state: 'todo', hint: `${completionOutstanding.length} step${completionOutstanding.length === 1 ? '' : 's'} outstanding` },
  };

  const stepsDone = COMPLETION_ITEMS.length - completionOutstanding.length;
  const readinessPct = Math.round((stepsDone / COMPLETION_ITEMS.length) * 100);
  const shownDocs = useAnimatedNumber(documents.length);
  const shownProducing = useAnimatedNumber(producibleNames.length);
  const shownCitations = useAnimatedNumber(allProducibleCitations.length);
  const shownEvents = useAnimatedNumber(auditLog.length);
  const shownPct = useAnimatedNumber(readinessPct);
  const hasMatter = documents.length > 0 || auditLog.length > 0;


  // Every tag used anywhere in the matter, so tagging stays consistent across
  // documents instead of drifting into near-duplicates.
  // Notes on the open document, resolved back to the citation each is attached
  // to and ordered by position in the document.
  const documentNotes = selectedDocSource
    ? Object.entries(notes)
        .filter(([key]) => key.startsWith(`${selectedDocSource}::`))
        .map(([key, text]) => {
          const id = key.slice(selectedDocSource.length + 2);
          return {
            key,
            text,
            citation: activeCitations.find(c => String(c.id) === id) || null,
          };
        })
        .sort((a, b) => (a.citation?.offset ?? Infinity) - (b.citation?.offset ?? Infinity))
    : [];

  // Tags that actually carry producible citations, with their counts, so the
  // drafting stage can offer them as sections.
  const tagSections = Array.from(
    allProducibleCitations.reduce((map, c) => {
      (c.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1));
      return map;
    }, new Map())
  ).sort((a, b) => b[1] - a[1]);

  const knownTags = Array.from(
    new Set(Object.values(citations).flat().flatMap(c => c.tags || []))
  ).sort();

  // ---------- Effects ----------

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTyping) return;
      if (e.metaKey && e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveStep(prev => Math.min(prev + 1, 9));
      } else if (e.metaKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveStep(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTyping]);

  // Keep the citation selection valid when the source document changes.
  useEffect(() => {
    const first = (citations[selectedDocSource] || [])[0];
    setSelectedFinding(first ? first.id : 0);
    setPendingSelection(null);
  }, [selectedDocSource]);

  useEffect(() => {
    setActiveNoteInput(noteKey ? (notes[noteKey] || '') : '');
  }, [noteKey, notes]);

  // Escape closes the document reader and the deliverable preview.
  useEffect(() => {
    if (!openDocument && !previewKey && !ledgerOpen && !confirmClear) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpenDocument(null);
      setPreviewKey(null);
      setLedgerOpen(false);
      setConfirmClear(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDocument, previewKey, ledgerOpen, confirmClear]);

  // Bring the highlighted passage to the top of the viewer whenever the
  // selected finding or document changes. Runs before paint so the reader
  // never sees the document jump.
  useLayoutEffect(() => {
    if (activeStep !== 5) return;
    const container = viewerRef.current;
    const mark = markRef.current;
    if (!container || !mark) return;
    const delta = mark.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTop += delta - 16;
  }, [activeStep, selectedFinding, selectedDocSource]);

  // Default the matrix to the first producible document that yielded findings.
  useEffect(() => {
    if (selectedDocSource && producibleNames.includes(selectedDocSource)) return;
    const firstWithFindings = producibleNames.find(n => (citations[n] || []).length > 0);
    setSelectedDocSource(firstWithFindings || producibleNames[0] || null);
  }, [producibleNames.join('|'), citations]);

  // A change to the selection or its designations invalidates the check.
  const hadReportRef = useRef(null);
  useEffect(() => { hadReportRef.current = integrityReport; }, [integrityReport]);

  useEffect(() => {
    if (hadReportRef.current) {
      setVoidedCheck({ at: new Date(), ready: hadReportRef.current.ready.length });
    }
    setIntegrityReport(null);
    setManifestSha(null);
    setIsRunningIntegrityCheck(false);
    // An approval covers the set that was approved. Change the set and the
    // approval no longer describes what would go out.
    setApproval(null);
  }, [selectedForReview.join('|'), JSON.stringify(privilege), confirmedRelated.join('|'),
      confirmedCollections.join('|')]);

  // Deep Analysis: real per-document date extraction driving real progress.
  useEffect(() => {
    if (activeStep !== 4) return;
    if (producibleDocs.length === 0) {
      setAnalysisProgress(0);
      setAnalysisPhase('No producible documents selected.');
      setAnalysisComplete(false);
      setTimeline([]);
      return;
    }

    let cancelled = false;
    setAnalysisProgress(0);
    setAnalysisComplete(false);
    setTimeline([]);
    setDocAnalysis({});
    setAnalysisPhase('Extracting dates...');

    const events = [];
    let index = 0;

    const step = () => {
      if (cancelled) return;
      const doc = producibleDocs[index];
      if (doc) {
        const re = new RegExp(DATE_PATTERN.source, 'gi');
        let match;
        let found = 0;
        while ((match = re.exec(doc.content || '')) !== null) {
          const time = parseEventDate(match[0]);
          if (time !== null) { events.push({ time, label: match[0], source: doc.name }); found += 1; }
        }
        setDocAnalysis(prev => ({ ...prev, [doc.name]: { events: found, done: true } }));
      }
      index += 1;
      const pct = Math.round((index / producibleDocs.length) * 100);
      setAnalysisProgress(pct);
      setAnalysisPhase(`Extracting dates — ${index} of ${producibleDocs.length} documents`);

      if (index >= producibleDocs.length) {
        events.sort((a, b) => a.time - b.time);
        setTimeline(events);
        setAnalysisPhase(
          events.length
            ? `Chronology assembled — ${events.length} dated event${events.length === 1 ? '' : 's'}`
            : 'Analysis complete — no dated events found'
        );
        setAnalysisComplete(true);
        appendAudit('Ran deep analysis', `${producibleDocs.length} documents`);
        return;
      }
      setTimeout(step, 120);
    };

    const kickoff = setTimeout(step, 200);
    return () => { cancelled = true; clearTimeout(kickoff); };
  }, [activeStep, producibleNames.join('|')]);

  // ---------- Handlers ----------

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadNotices([]);

    const notices = [];
    const accepted = [];
    // Seeded from current state so duplicates are caught both against what is
    // already ingested and against others in this same batch.
    const seenHashes = new Set(documentsRef.current.map(d => d.hash));
    const usedNames = new Set(documentsRef.current.map(d => d.name));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const doc = await readDocument(file);

        if (seenHashes.has(doc.hash)) {
          notices.push({ tone: 'warn', text: `${file.name} was already ingested — skipped.` });
        } else {
          if (usedNames.has(doc.name)) {
            const ext = doc.name.match(/\.[^.]+$/)?.[0] || '';
            const stem = ext ? doc.name.slice(0, -ext.length) : doc.name;
            let n = 2;
            while (usedNames.has(`${stem} (${n})${ext}`)) n += 1;
            doc.name = `${stem} (${n})${ext}`;
          }
          seenHashes.add(doc.hash);
          usedNames.add(doc.name);
          accepted.push(doc);
          if (doc.needsOcr) {
            notices.push({ tone: 'warn', text: `${doc.name} appears to be a scanned image — it needs OCR before it can be cited.` });
          }
        }
      } catch (err) {
        notices.push({ tone: 'error', text: `${file.name}: ${err.message}` });
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (accepted.length > 0) {
      setDocuments(prev => [...prev, ...accepted]);
      setCitations(prev => {
        const next = { ...prev };
        accepted.forEach(doc => { next[doc.name] = extractCitations(doc.content, doc.name); });
        return next;
      });
      setPrivilege(prev => {
        const next = { ...prev };
        accepted.forEach(doc => {
          if (!next[doc.name]) next[doc.name] = { status: 'produce', basis: '', description: '' };
        });
        return next;
      });
      setAuditLog(prev => [
        ...prev,
        ...accepted.map(doc => ({
          ts: new Date().toISOString(), actor: 'Attorney', action: 'Ingested document', target: doc.name,
        })),
      ]);
    }

    setUploadNotices(notices);
    setIsUploading(false);
  };

  const removeDocument = (name) => {
    if (!window.confirm(`Remove ${name} from this matter? Its annotations will be deleted.`)) return;
    setDocuments(prev => prev.filter(d => d.name !== name));
    setCitations(prev => { const next = { ...prev }; delete next[name]; return next; });
    setPrivilege(prev => { const next = { ...prev }; delete next[name]; return next; });
    setSelectedForReview(prev => prev.filter(n => n !== name));
    setBatesAssignments(prev => { const next = { ...prev }; delete next[name]; return next; });
    setNotes(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${name}::`)) delete next[k]; });
      return next;
    });
    appendAudit('Removed document', name);
  };

  const toggleSelection = (name) => {
    setSelectedForReview(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const setDisposition = (name, status) => {
    setPrivilege(prev => ({
      ...prev,
      [name]: { ...(prev[name] || { basis: '', description: '' }), status },
    }));
    appendAudit(`Designated ${DISPOSITIONS[status].label.toLowerCase()}`, name);
  };

  const setPrivilegeField = (name, field, value) => {
    setPrivilege(prev => ({
      ...prev,
      [name]: { ...(prev[name] || { status: 'produce', basis: '', description: '' }), [field]: value },
    }));
  };

  const handleRunIntegrityCheck = async () => {
    if (selectedDocs.length === 0 || isRunningIntegrityCheck) return;
    setIsRunningIntegrityCheck(true);
    setIntegrityReport(null);

    // Stamp first, so the readiness check can see the numbers it is validating
    // for collisions. Bates numbers are immutable once assigned.
    const assignments = { ...batesAssignments };
    let counter = batesStart + Object.keys(assignments).length;
    selectedDocs.forEach(doc => {
      if (!assignments[doc.name]) {
        assignments[doc.name] = `${batesPrefix}-${String(counter).padStart(6, '0')}`;
        counter += 1;
      }
    });

    const report = computeIntegrityReport(
      selectedDocs, citations, privilege, assignments,
      new Set(confirmedRelated), confirmedCollections.includes(collectionKey)
    );
    const sha = await manifestHash(selectedDocs.map(d => d.hash));

    setBatesAssignments(assignments);
    setManifestSha(sha);
    setIntegrityReport(report);
    setVoidedCheck(null); setApproval(null); setApproverDraft(''); setPreviewKey(null);
    setIsRunningIntegrityCheck(false);
    appendAudit(
      `Ran readiness check — ${report.ready.length} of ${report.total} ready`
        + (report.exceptions.length ? `, ${report.exceptions.length} held back` : ''),
      `${selectedDocs.length} documents`
    );
  };

  // Identifies this exact set of documents; changing the selection changes it.
  const collectionKey = selectedDocs.map(d => d.hash).sort().join('|');

  const confirmCollection = () => {
    setConfirmedCollections(prev => (prev.includes(collectionKey) ? prev : [...prev, collectionKey]));
    appendAudit('Confirmed collection is the correct document set', `${selectedDocs.length} documents`);
  };

  const confirmDocumentRelated = (name, hash) => {
    if (!hash) return;
    setConfirmedRelated(prev => (prev.includes(hash) ? prev : [...prev, hash]));
    appendAudit('Confirmed document belongs to this matter', name);
  };

  const handleUpdateNote = () => {
    if (!noteKey) return;
    setNotes(prev => {
      const next = { ...prev };
      if (activeNoteInput.trim()) next[noteKey] = activeNoteInput.trim();
      else delete next[noteKey];
      return next;
    });
    appendAudit('Annotated finding', noteKey);
  };

  /**
   * Character offset of a range start within a container, by walking its text
   * nodes. Needed because the viewer splits the body around the highlight mark,
   * so the range's own offset is relative to a fragment, not the document.
   */
  const offsetWithin = (container, node, nodeOffset) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let total = 0;
    let current;
    while ((current = walker.nextNode())) {
      if (current === node) return total + nodeOffset;
      total += current.textContent.length;
    }
    return -1;
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    const container = docTextRef.current;
    if (!selection || selection.isCollapsed || !container) { setPendingSelection(null); return; }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

    const excerpt = selection.toString().trim();
    if (excerpt.length < 8) { setPendingSelection(null); return; }

    const rawOffset = offsetWithin(container, range.startContainer, range.startOffset);
    if (rawOffset < 0) return;

    // Selection may lead with whitespace the trim removed; realign so the
    // stored offset points at the first character actually cited.
    const content = documents.find(d => d.name === selectedDocSource)?.content || '';
    const leading = selection.toString().length - selection.toString().trimStart().length;
    const offset = rawOffset + leading;
    if (content.slice(offset, offset + excerpt.length) !== excerpt) return;

    setPendingSelection({ excerpt, offset });
    setPendingTags([]);
    setTagDraft('');
  };

  const addPendingTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    setPendingTags(prev => (prev.includes(clean) ? prev : [...prev, clean]));
    setTagDraft('');
  };

  const commitUserCitation = () => {
    if (!pendingSelection || !selectedDocSource) return;
    const content = documents.find(d => d.name === selectedDocSource)?.content || '';
    const citation = buildUserCitation({
      id: `u-${Date.now().toString(36)}`,
      content,
      excerpt: pendingSelection.excerpt,
      offset: pendingSelection.offset,
      fileName: selectedDocSource,
      tags: pendingTags,
    });
    setCitations(prev => {
      const next = [...(prev[selectedDocSource] || []), citation];
      next.sort((a, b) => a.offset - b.offset);
      return { ...prev, [selectedDocSource]: next };
    });
    setSelectedFinding(citation.id);
    setPendingSelection(null);
    setPendingTags([]);
    window.getSelection()?.removeAllRanges();
    appendAudit('Added citation', `${selectedDocSource} line ${citation.line}`);
  };

  const updateCitationTags = (citationId, updater) => {
    setCitations(prev => ({
      ...prev,
      [selectedDocSource]: (prev[selectedDocSource] || []).map(c =>
        c.id === citationId ? { ...c, tags: updater(c.tags || []) } : c
      ),
    }));
  };

  const removeUserCitation = (citationId) => {
    const target = activeCitations.find(c => c.id === citationId);
    setCitations(prev => ({
      ...prev,
      [selectedDocSource]: (prev[selectedDocSource] || []).filter(c => c.id !== citationId),
    }));
    setNotes(prev => {
      const next = { ...prev };
      delete next[`${selectedDocSource}::${citationId}`];
      return next;
    });
    if (selectedFinding === citationId) {
      const remaining = activeCitations.filter(c => c.id !== citationId);
      setSelectedFinding(remaining[0] ? remaining[0].id : 0);
    }
    appendAudit('Removed citation', `${selectedDocSource} line ${target?.line ?? '?'}`);
  };

  const handleCopyCitation = () => {
    if (!activeCitation) return;
    const text = `${formatCitation(activeCitation, batesAssignments[activeCitation.source])}: "${activeCitation.excerpt}"`;
    navigator.clipboard?.writeText(text);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 1600);
  };

  const generateMemo = () => {
    if (allProducibleCitations.length === 0) {
      setMemoText('No findings have been extracted yet. Run the pipeline through the Citation Matrix first.');
      return;
    }
    const bySource = producibleDocs
      .map(doc => {
        const found = citations[doc.name] || [];
        if (found.length === 0) return null;
        const lead = found[0];
        return `${doc.name} (${batesAssignments[doc.name] || 'Bates not assigned'}) contributes ${found.length} record citation${found.length === 1 ? '' : 's'}. The first reads: "${lead.excerpt}"`;
      })
      .filter(Boolean);

    setMemoText([
      `This evaluation is drawn from ${producibleDocs.length} document${producibleDocs.length === 1 ? '' : 's'} designated for production in ${caseTitle}, yielding ${allProducibleCitations.length} record citation${allProducibleCitations.length === 1 ? '' : 's'}.`,
      '',
      ...bySource.map((line, i) => `${i + 1}. ${line}`),
      '',
      withheldCount > 0
        ? `${withheldCount} document${withheldCount === 1 ? ' was' : 's were'} withheld as privileged and ${withheldCount === 1 ? 'is' : 'are'} recorded on the privilege log rather than discussed here.`
        : 'No documents in this set were withheld as privileged.',
    ].join('\n'));
    setMemoEdited(false);
    appendAudit('Generated strategic brief draft', `${allProducibleCitations.length} citations`);
  };

  /**
   * Inserts every citation carrying a tag as a block under a heading, so the
   * tags applied in Stage 05 become the outline of the brief rather than
   * labels that go nowhere.
   */
  const insertTagSection = (tag, heading) => {
    const matching = allProducibleCitations.filter(c => (c.tags || []).includes(tag));
    if (matching.length === 0) return;
    const block = [
      `${heading || tag.toUpperCase()}`,
      '',
      ...matching.map((c, i) => {
        const note = notes[`${c.source}::${c.id}`];
        return [
          `${i + 1}. ${formatCitation(c, batesAssignments[c.source])}`,
          `   "${c.excerpt}"`,
          note ? `   Attorney note: ${note}` : null,
        ].filter(Boolean).join('\n');
      }),
    ].join('\n');
    setMemoText(prev => (prev === DEFAULT_MEMO ? block : `${prev.trimEnd()}\n\n${block}`));
    setMemoEdited(true);
    appendAudit('Inserted tagged citations into the brief', `${tag} (${matching.length})`);
  };

  const handleAdvisorSubmit = (e) => {
    e.preventDefault();
    const query = userQueryText.trim();
    if (!query) return;
    setMessages(prev => [...prev, { sender: 'user', text: query }]);
    setUserQueryText('');

    // Real keyword retrieval across ingested text — no fabricated answer.
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const hits = documents
      .map(doc => {
        const haystack = (doc.content || '').toLowerCase();
        const matched = terms.filter(t => haystack.includes(t));
        return { doc, matched };
      })
      .filter(h => h.matched.length > 0)
      .sort((a, b) => b.matched.length - a.matched.length)
      .slice(0, 5);

    const reply = documents.length === 0
      ? 'No documents have been ingested yet. Upload files in Discovery Ingest and I can search their contents.'
      : hits.length === 0
        ? `No ingested document contains ${terms.map(t => `"${t}"`).join(' or ')}.`
        : `Found in ${hits.length} document${hits.length === 1 ? '' : 's'}:\n${hits.map(h => `• ${h.doc.name} (matched: ${h.matched.join(', ')})`).join('\n')}`;

    setMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
  };

  const deliverables = () => {
    const args = { caseTitle, documents: selectedDocs, privilege, bates: batesAssignments };
    // The production index covers only what is actually going out: documents
    // that passed the readiness check and are designated for production.
    const readySet = new Set(integrityReport ? integrityReport.ready : selectedDocs.map(d => d.name));
    const indexArgs = { ...args, documents: selectedDocs.filter(d => readySet.has(d.name)) };
    const exceptions = integrityReport ? integrityReport.exceptions : [];
    return [
      {
        key: 'brief',
        icon: FileText,
        tone: 'emerald',
        title: 'Strategic Brief',
        blurb: 'The evaluation text with every record citation traced to its source document and Bates number.',
        build: () => buildBrief({ caseTitle, memoText, citations: allProducibleCitations, bates: batesAssignments, notes, approval }),
      },
      {
        key: 'privilege',
        icon: EyeOff,
        tone: 'amber',
        title: 'Privilege Log',
        blurb: 'FRCP 26(b)(5) log of every document withheld or redacted, with basis and description.',
        build: () => buildPrivilegeLog(args),
      },
      {
        key: 'index',
        icon: Layers,
        tone: 'indigo',
        title: 'Production Index',
        blurb: 'Bates range, type, page count and SHA-256 for each document being produced.',
        build: () => buildProductionIndex(indexArgs),
      },
      ...(exceptions.length > 0 ? [{
        key: 'exceptions',
        icon: AlertTriangle,
        tone: 'red',
        title: 'Exceptions Report',
        blurb: 'Documents held back from production, the defect in each, and the action required to cure it.',
        build: () => buildExceptionsReport({ caseTitle, exceptions }),
      }] : []),
      {
        key: 'audit',
        icon: ScrollText,
        tone: 'slate',
        title: 'Audit Log',
        blurb: 'Append-only record of every action taken on this matter, with timestamps.',
        build: () => buildAuditLog({ caseTitle, auditLog }),
      },
    ];
  };

  const handleReanalyze = () => {
                      // Re-extract from current document contents, without
                      // discarding the attorney's work. Citations counsel wrote
                      // are kept verbatim; tags and notes are re-attached by
                      // content anchor, because re-extraction renumbers the
                      // generated citations and an id-based remap would move a
                      // note onto a different passage.
                      const rebuilt = {};
                      const noteRemap = {};
                      documents.forEach(d => {
                        const prior = citations[d.name] || [];
                        const anchorOf = c => `${c.offset}::${c.excerpt}`;
                        const priorByAnchor = new Map(prior.map(c => [anchorOf(c), c]));
                        const fresh = extractCitations(d.content, d.name).map(c => {
                          const match = priorByAnchor.get(anchorOf(c));
                          if (match && match.id !== c.id) {
                            noteRemap[`${d.name}::${match.id}`] = `${d.name}::${c.id}`;
                          }
                          return { ...c, tags: match?.tags || [] };
                        });
                        const userCitations = prior.filter(c => c.origin === 'user');
                        rebuilt[d.name] = [...fresh, ...userCitations].sort((a, b) => a.offset - b.offset);
                      });
                      setCitations(rebuilt);
                      setNotes(prev => {
                        const next = {};
                        Object.entries(prev).forEach(([key, value]) => {
                          next[noteRemap[key] || key] = value;
                        });
                        return next;
                      });
                      appendAudit('Re-extracted citations', `${documents.length} documents`);
                      handleStepChange(4);
                    };

  const handleDownload = (item) => {
    const file = item.build();
    triggerDownload(file.filename, file.content, file.mime);
    appendAudit('Downloaded deliverable', file.filename);
  };

  // PDF is rendered on demand: jsPDF is a large dependency and most sessions
  // never leave with one.
  const handleDownloadPdf = async (item) => {
    const file = item.build();
    if (!file.printable) return;
    setPdfPending(item.key);
    try {
      const blob = await renderTextPdf({
        title: file.caption,
        caption: file.caption,
        body: file.printable,
      });
      triggerBlobDownload(file.pdfFilename, blob);
      appendAudit('Downloaded deliverable', file.pdfFilename);
    } catch {
      window.alert('The PDF could not be rendered. The text and CSV versions are still available.');
    } finally {
      setPdfPending(null);
    }
  };

  const handleReset = () => setConfirmClear(true);

  const performClear = async () => {
    setConfirmClear(false);
    await clearMatter();
    // These four were missing, so a cleared matter kept its approval, and a
    // fresh untouched draft kept the "attorney work product" header that is
    // only meant to appear once counsel has edited it.
    setApproval(null); setApproverDraft(''); setMemoEdited(false);
    setPreviewKey(null); setLedgerOpen(false); setTrustOpen(false);
    setDocuments([]); setCitations({}); setPrivilege({}); setSelectedForReview([]);
    setNotes({}); setAuditLog([]); setBatesAssignments({}); setIntegrityReport(null);
    setVoidedCheck(null);
    setConfirmedRelated([]); setConfirmedCollections([]);
    setCriteriaParties(''); setCriteriaTerms(''); setCriteriaFrom(''); setCriteriaTo('');
    setRelevanceFilter('ALL');
    setManifestSha(null); setTimeline([]); setAnalysisComplete(false); setAnalysisProgress(0);
    setSelectedDocSource(null); setSelectedFinding(0); setMemoText(DEFAULT_MEMO);
    setPendingSelection(null); setPendingTags([]); setTagDraft('');
    setIsFlaggedForReview(false); setCaseTitle('In Re Jones Litigation');
    setBatesPrefix('VLM'); setBatesStart(1); setUploadNotices([]); setMessages([]);
    handleStepChange(0);
  };

  // ---------- Shared bits ----------

  // Marks the dates the analysis pass extracts, so opening a document shows
  // what Stage 04 actually found in it.
  const renderWithDates = (text) => {
    const re = new RegExp(DATE_PATTERN.source, 'gi');
    const parts = [];
    let last = 0;
    let match;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) parts.push(text.slice(last, match.index));
      parts.push(
        <mark key={key++} className="bg-indigo-100 text-indigo-950 rounded px-0.5 font-semibold">
          {match[0]}
        </mark>
      );
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  const toneClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    slate: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  };

  const primaryButton = isDarkMode
    ? 'bg-white text-slate-950 hover:bg-slate-100'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';

  const panelClass = isDarkMode
    ? 'bg-[#111218] border-white/[0.04]'
    : 'bg-white border-slate-200 shadow-sm';

  // Plain render function, not a nested component: a component defined inside
  // App gets a fresh identity every render, which would remount these inputs
  // and drop focus on each keystroke.
  const renderMatterFields = (showBates) => {
    const stamped = Object.keys(batesAssignments).length;
    return (
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">Matter Name</label>
          <input
            type="text"
            value={caseTitle}
            onChange={(e) => setCaseTitle(e.target.value)}
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
            className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
              isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />
        </div>

        {showBates && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">Bates Prefix</label>
                <input
                  type="text"
                  value={batesPrefix}
                  onChange={(e) => setBatesPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  disabled={stamped > 0}
                  className={`w-full border rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">Start Number</label>
                <input
                  type="number"
                  min="1"
                  value={batesStart}
                  onChange={(e) => setBatesStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  disabled={stamped > 0}
                  className={`w-full border rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <p className={`text-[10px] leading-relaxed ${stamped > 0 ? 'text-amber-500' : 'text-slate-500'}`}>
              {stamped > 0
                ? `${stamped} document${stamped === 1 ? ' has' : 's have'} already been stamped ${batesPrefix}-… Bates numbers are immutable once assigned — clear the matter in Stage 09 to renumber.`
                : `Documents will be stamped ${batesPrefix}-${String(batesStart).padStart(6, '0')} onward when the integrity check runs in Stage 03. Set this before then.`}
            </p>
          </>
        )}
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, title, hint }) => (
    <div className={`flex flex-col items-center justify-center py-14 rounded-xl border border-dashed ${
      isDarkMode ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'
    }`}>
      <Icon size={28} className="mb-3 opacity-40" />
      <p className="text-xs font-mono font-semibold">{title}</p>
      <p className="text-[10px] font-mono mt-1 opacity-60 text-center px-4">{hint}</p>
    </div>
  );

  return (
    <div data-theme={isDarkMode ? 'dark' : 'light'} className={`flex h-screen w-full overflow-hidden font-sans transition-colors duration-500 ${
      isDarkMode ? 'bg-[#08090C] text-slate-200' : 'bg-slate-50 text-slate-900'
    }`}>

      {/* MOBILE TOP BAR */}
      <div className={`lg:hidden fixed top-0 inset-x-0 h-14 z-50 flex items-center justify-between px-4 border-b ${
        isDarkMode ? 'bg-[#0E0F14] border-white/[0.04]' : 'bg-white border-slate-200'
      }`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`p-2 rounded-xl border ${isDarkMode ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-100 border-slate-200'}`}
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-500">
          {STEPS[activeStep].title}
        </span>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label={isDarkMode ? 'Switch to the light theme' : 'Switch to the dark theme'}
          className={`p-2 rounded-xl border ${isDarkMode ? 'bg-white/[0.04] border-white/[0.06] text-amber-400' : 'bg-slate-100 border-slate-200 text-indigo-600'}`}
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* LEFT SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 w-[310px] sm:w-[340px] h-full border-r flex flex-col z-40 transition-all duration-300 ease-out lg:static lg:translate-x-0 shrink-0
        ${sidebarCollapsed ? 'lg:w-[76px]' : ''}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isDarkMode ? 'bg-[#0E0F14] border-r-white/[0.04]' : 'bg-white border-slate-200'}
      `}>
        <div className={`p-6 border-b flex flex-col gap-1.5 transition-colors ${sidebarCollapsed ? 'lg:px-0 lg:py-5 lg:items-center' : ''} ${
          isDarkMode ? 'bg-[#0A0B0E] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
        }`}>
          {/* Monogram, shown only when the rail is collapsed. */}
          <div className={`hidden ${sidebarCollapsed ? 'lg:flex' : ''} w-9 h-9 items-center justify-center rounded-md bg-indigo-600 text-white text-[11px] font-bold tracking-wider mb-1`}
               style={{ fontFamily: 'var(--font-serif)' }}>
            AS
          </div>
          <div className={`flex items-center justify-between ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <div className="leading-tight">
                <h1 className={`text-[11px] font-bold tracking-[0.18em] uppercase ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                  Avant Society
                </h1>
                <p className={`text-[9px] font-mono tracking-wider uppercase mt-0.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  Case Intelligence
                </p>
              </div>
            </div>
            <div className={`hidden lg:flex items-center gap-1.5 ${sidebarCollapsed ? 'lg:flex-col' : ''}`}>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                aria-label={isDarkMode ? 'Switch to the light theme' : 'Switch to the dark theme'}
                className={`p-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 ${
                  isDarkMode ? 'bg-white/[0.04] border-white/[0.06] text-amber-400' : 'bg-slate-100 border-slate-200 text-indigo-600'
                }`}
              >
                {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
              </button>
              <button
                onClick={() => setSidebarCollapsed(v => !v)}
                aria-label={sidebarCollapsed ? 'Expand the stage list' : 'Collapse the stage list'}
                title={sidebarCollapsed ? 'Expand the stage list' : 'Collapse to icons for more working space'}
                className={`p-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 ${
                  isDarkMode ? 'bg-white/[0.04] border-white/[0.06] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
              </button>
            </div>
          </div>
          <p className={`text-xs font-bold tracking-tight transition-colors ${sidebarCollapsed ? 'lg:hidden' : ''} ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {caseTitle}
          </p>
        </div>

        <div className={`flex-1 overflow-y-auto p-4 space-y-1 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          {STEPS.map((step) => {
            const isActive = activeStep === step.id;
            const styleToken = ACTOR_STYLES[step.actor] || { border: 'border-white/10', text: 'text-slate-400', bg: 'bg-white/5' };
            const StepIcon = step.icon;
            const progress = stageProgress[step.id];
            const StatusIcon = progress.state === 'done' ? CheckCircle2
              : progress.state === 'blocked' ? Lock
              : Circle;
            const statusColor = progress.state === 'done' ? 'text-emerald-500'
              : progress.state === 'blocked' ? 'text-slate-600'
              : 'text-amber-500';

            return (
              <button
                key={step.id}
                onClick={() => handleStepChange(step.id)}
                title={sidebarCollapsed ? `Stage 0${step.id} · ${step.title} — ${progress.hint}` : undefined}
                aria-label={`Stage 0${step.id}: ${step.title}. ${progress.hint}`}
                className={`w-full text-left p-3 rounded-xl flex gap-3.5 items-center transition-all duration-200 relative border cursor-pointer ${sidebarCollapsed ? 'lg:justify-center lg:p-2' : ''} ${
                  isActive
                    ? isDarkMode
                      ? 'bg-white/[0.04] border-white/[0.08] text-white'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    : 'bg-transparent border-transparent hover:bg-white/[0.02] text-slate-400'
                }`}
              >
                {isActive && (
                  <div className="absolute left-1.5 top-3.5 bottom-3.5 w-[3px] bg-indigo-600" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all relative ${
                  isActive
                    ? isDarkMode ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-indigo-100 border-indigo-300 text-indigo-600'
                    : progress.state === 'done'
                      ? isDarkMode ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : isDarkMode ? 'bg-[#14151C] border-white/[0.04] text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}>
                  <StepIcon size={14} />
                  <span className={`hidden ${sidebarCollapsed ? 'lg:block' : ''} absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 ${
                    isDarkMode ? 'border-[#0E0F14]' : 'border-white'
                  } ${progress.state === 'done' ? 'bg-emerald-500' : progress.state === 'blocked' ? 'bg-slate-300' : 'bg-amber-400'}`} />
                </div>
                <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-[9px] font-mono font-bold ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                      STAGE 0{step.id}
                    </span>
                    <span className={`text-[8px] tracking-widest font-bold font-mono px-1.5 py-0.5 rounded border ${styleToken.bg} ${styleToken.border} ${styleToken.text}`}>
                      {step.actor}
                    </span>
                  </div>
                  <h3 className={`text-xs font-semibold mt-0.5 truncate transition-colors ${
                    isActive
                      ? isDarkMode ? 'text-white' : 'text-slate-800'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                    {step.title}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <StatusIcon size={9} className={`shrink-0 ${statusColor}`} />
                    <span className={`text-[9px] font-mono truncate ${statusColor}`}>{progress.hint}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={`px-5 py-3 border-t flex items-center gap-2 text-[9px] font-mono ${sidebarCollapsed ? 'lg:hidden' : ''} ${
          isDarkMode ? 'bg-[#090A0F] border-white/[0.04] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <Keyboard size={12} className="shrink-0" />
          <span>&#8984;&larr; / &#8984;&rarr; to move between stages</span>
        </div>

        <div className={`p-5 border-t text-[10px] flex justify-between items-center transition-colors ${
          isDarkMode ? 'bg-[#090A0F] border-white/[0.04] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? 'lg:mx-auto' : ''}`} title="Stored in this browser">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className={`font-semibold ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Stored in this browser</span>
          </div>
          <span className={`font-mono text-slate-600 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>v5.1.0</span>
        </div>
      </div>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-30 lg:hidden" />
      )}

      {/* CENTRAL WORKSPACE */}
      <div ref={rightPanelRef} className="flex-1 h-full overflow-y-auto flex flex-col transition-all duration-300 pt-14 lg:pt-0">

        {/* MATTER BAR — the matter at a glance: what it is, how far through it
            is, and the figures that matter. Every number here is live, and the
            readiness track is the same state the completion check uses, so the
            bar can never claim progress the checklist would not. */}
        <div className={`w-full px-6 sm:px-10 py-4 border-b transition-colors ${
          isDarkMode ? 'bg-[#0B0C11] border-white/[0.04]' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-10">
            <div className="min-w-0 xl:w-60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Matter</span>
                {isFlaggedForReview && (
                  <span className="text-[8px] font-mono font-bold text-amber-600 border border-amber-500/30 bg-amber-500/10 px-1.5 py-px rounded">
                    SENIOR COUNSEL
                  </span>
                )}
              </div>
              <span className={`text-base font-bold truncate block leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                    style={{ fontFamily: 'var(--font-serif)' }}>
                {caseTitle}
              </span>
              <span className="text-[9px] font-mono text-slate-500 truncate block mt-0.5">
                {manifestSha ? `Manifest ${manifestSha.slice(0, 16)}…` : 'Manifest not yet computed'}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Production readiness</span>
                <span className="text-[10px] font-mono text-slate-500">
                  <span className={`font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stepsDone}</span>
                  {' '}of {COMPLETION_ITEMS.length} steps
                  <span className={`ml-2 font-bold tabular-nums ${stepsDone === COMPLETION_ITEMS.length ? 'text-emerald-600' : 'text-indigo-600'}`}>
                    {shownPct}%
                  </span>
                </span>
              </div>
              <div className="flex gap-1.5 items-end">
                {METER.map(m => {
                  const state = stageProgress[m.id].state;
                  const current = activeStep === m.id;
                  const fill = state === 'done' ? 'bg-indigo-600'
                    : state === 'blocked' ? (isDarkMode ? 'bg-white/[0.07]' : 'bg-slate-200')
                    : (isDarkMode ? 'bg-amber-400/50' : 'bg-amber-300');
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleStepChange(m.id)}
                      title={`${STEPS[m.id].title} — ${stageProgress[m.id].hint}`}
                      aria-label={`Go to ${STEPS[m.id].title}: ${stageProgress[m.id].hint}`}
                      className="group flex-1 min-w-0 text-left focus:outline-none"
                    >
                      <span className={`block w-full rounded-full transition-all duration-700 ease-out ${fill} ${
                        current ? 'h-2.5' : 'h-1.5 group-hover:h-2'
                      } ${current ? 'ring-2 ring-indigo-500/25 ring-offset-1' : ''}`} />
                      <span className={`hidden md:block text-[9px] font-mono mt-1.5 truncate transition-colors ${
                        current ? (isDarkMode ? 'text-white font-bold' : 'text-slate-900 font-bold')
                          : state === 'done' ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'
                      }`}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-5 xl:gap-7 shrink-0">
              <MatterStat label="Documents" value={shownDocs} isDarkMode={isDarkMode} />
              <MatterStat label="Producing" value={shownProducing} isDarkMode={isDarkMode} />
              <MatterStat label="Citations" value={shownCitations} isDarkMode={isDarkMode} />
              <MatterStat label="Ledger" value={shownEvents} isDarkMode={isDarkMode} tone="text-indigo-600" />
            </div>
          </div>
        </div>

        {/* HEADER CONSOLE — pinned so stage navigation stays reachable while
            reading long stages. The telemetry bar above it scrolls away, which
            keeps the fixed chrome to just the controls. */}
        <div className={`sticky top-0 z-20 w-full border-b px-6 sm:px-10 py-3 sm:py-3.5 flex flex-col sm:flex-row gap-2.5 sm:gap-4 sm:items-center justify-between shrink-0 transition-colors duration-500 ${
          isDarkMode ? 'bg-[#0E0F14]/95 border-white/[0.04]' : 'bg-white/95 border-slate-200'
        } backdrop-blur`}>
          <div
            className="absolute left-0 -bottom-px h-[2px] bg-indigo-600 transition-all duration-700 ease-out"
            style={{ width: `${readinessPct}%` }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            {/* Breadcrumb is redundant on mobile — the fixed top bar already
                names the stage — so it is dropped there to keep the pinned
                header shallow on a phone. */}
            <div className={`hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase font-bold ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <span>CASE INTELLIGENCE</span>
              <span>/</span>
              <span className="text-indigo-500 font-semibold">{STEPS[activeStep].title}</span>
            </div>
            <h2 className={`text-sm sm:text-lg font-bold tracking-tight sm:mt-0.5 leading-snug truncate transition-colors ${
              isDarkMode ? 'text-white' : 'text-slate-800'
            }`}>
              {STEPS[activeStep].description}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Clearing is reachable from every stage — between prospect demos
                especially — but always goes through a confirmation that says
                exactly what will be lost, because nothing is kept anywhere else. */}
            <button
              onClick={handleReset}
              disabled={!hasMatter}
              title={hasMatter ? 'Clear this matter from the browser' : 'Nothing to clear yet'}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                isDarkMode
                  ? 'bg-white/[0.02] border-white/[0.06] text-slate-400 enabled:hover:text-red-400 enabled:hover:border-red-500/30'
                  : 'bg-white border-slate-200 text-slate-500 shadow-sm enabled:hover:text-red-600 enabled:hover:border-red-200'
              }`}
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Clear</span>
            </button>
            {/* The review ledger is a compliance artifact, not an export. A firm
                evidencing its own supervision needs to be able to see it at any
                point in the matter, so it is reachable from every stage. */}
            <button
              onClick={() => setLedgerOpen(true)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 active:scale-95 ${
                isDarkMode ? 'bg-white/[0.02] border-white/[0.06] text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
              }`}
              title="Every action taken on this matter, in order"
            >
              <ScrollText size={13} />
              <span className="hidden sm:inline">Ledger</span>
              <span className="font-mono text-[10px] text-indigo-400 font-bold">{auditLog.length}</span>
            </button>
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 active:scale-95 ${
                copilotOpen ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : isDarkMode ? 'bg-white/[0.02] border-white/[0.06] text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
              }`}
            >
              <Sparkles size={13} className={copilotOpen ? 'animate-pulse' : ''} />
              <span>Advisor</span>
            </button>

            {activeStep > 0 && (
              <button
                onClick={() => handleStepChange(activeStep - 1)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-xl border transition-all active:scale-95 ${
                  isDarkMode ? 'border-white/[0.06] text-slate-300 bg-white/[0.02]' : 'border-slate-200 text-slate-600 bg-white shadow-sm'
                }`}
              >
                Back
              </button>
            )}
            {activeStep < 9 ? (
              <button
                onClick={() => handleStepChange(activeStep + 1)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                Next <ArrowRight size={13} />
              </button>
            ) : (
              <span className={`text-xs font-bold border px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                completionOutstanding.length === 0
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
              }`}>
                {completionOutstanding.length === 0
                  ? <><Check size={13} className="stroke-[3]" /> Complete</>
                  : <><AlertTriangle size={13} /> {completionOutstanding.length} outstanding</>}
              </span>
            )}
          </div>
        </div>

        {/* STAGE ROUTER */}
        <div className="flex-1 p-6 sm:p-10 max-w-6xl w-full mx-auto animate-fadeIn">

          {/* ============ STAGE 0: ORIENTATION ============ */}
          {activeStep === 0 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="max-w-2xl">
                <span className="text-xs font-mono uppercase tracking-widest text-indigo-500 font-bold">Orientation</span>
                <h3 className="serif-title text-2xl sm:text-4xl font-bold tracking-tight mt-2 leading-tight">
                  Avant Society Case Intelligence
                </h3>
                <p className="text-sm text-slate-500 mt-4 leading-relaxed">
                  A document analysis workspace for small litigation teams: ingest a client's documents, designate them
                  for production or privilege, verify their integrity, and draft a brief whose every citation traces
                  back to a specific passage in a specific document.
                </p>
              </div>

              {/* The confidentiality position is the first question a litigator
                  asks about a tool that touches client files, so it is answered
                  here rather than left for them to find in Stage 01. */}
              <div className={`rounded-2xl border p-5 flex gap-4 items-start ${
                isDarkMode ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <ShieldCheck className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 font-mono">
                    Your documents never leave this browser
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Every file you upload is read, hashed, analyzed and cited on this device. Nothing is sent to a
                    server, and no third party ever sees the text &mdash; which is what lets you use this on a live
                    matter without a Model Rule 1.6 problem or a vendor agreement. The matter is stored in this
                    browser's own database so you can close the tab and come back; you can erase it at any time from
                    Stage&nbsp;09.
                  </p>
                  <button
                    onClick={() => setTrustOpen(v => !v)}
                    className="mt-2.5 text-[10px] font-mono font-bold text-emerald-500 hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                  >
                    <ChevronRight size={11} className={`transition-transform ${trustOpen ? 'rotate-90' : ''}`} />
                    {trustOpen ? 'Hide the detail' : 'Where does my data actually go?'}
                  </button>
                </div>
              </div>

              {/* The data-handling detail, in product rather than in a PDF nobody
                  opens. This is the page a partner is shown when they ask where
                  their client's privileged production physically lives. */}
              {trustOpen && (
                <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 animate-fadeIn ${panelClass}`}>
                  <div>
                    <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Data handling, in full
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Everything below is a property of how this software is built, not a policy we promise to follow.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        q: 'Where do the documents live?',
                        a: 'In this browser, on this computer. They are read from the disk you selected them from and held in the browser\u2019s own local database. No copy is created anywhere else.',
                      },
                      {
                        q: 'What is transmitted?',
                        a: 'Nothing. The application itself is downloaded once, the way any web page is. After that, no document text, file name, search term or result is sent anywhere.',
                      },
                      {
                        q: 'Who can see the contents?',
                        a: 'Whoever can use this computer and this browser profile. Not us \u2014 we have no server receiving it, so there is nothing for us to look at, hand over or lose.',
                      },
                      {
                        q: 'Who are the subprocessors?',
                        a: 'There are none. No analytics, no error reporting, no model provider, no cloud storage. Nothing about your matter reaches a third party.',
                      },
                      {
                        q: 'How long is it retained?',
                        a: 'Until you delete it. There is no expiry and no background cleanup, because there is no service managing it \u2014 only this browser\u2019s storage.',
                      },
                      {
                        q: 'How is it deleted?',
                        a: 'Stage\u00a009, \u201cClear Matter From This Browser\u201d, erases every document, note, tag and result. Clearing site data in your browser settings does the same.',
                      },
                    ].map(item => (
                      <div key={item.q} className={`p-3.5 rounded-xl border ${
                        isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {item.q}
                        </span>
                        <span className="text-[10px] text-slate-400 leading-relaxed block mt-1">{item.a}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block mb-2.5">
                      The whole data flow
                    </span>
                    <div className={`p-4 rounded-xl border font-mono text-[10px] leading-relaxed ${
                      isDarkMode ? 'bg-[#0B0C11] border-white/[0.05] text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-emerald-400">your disk</span>
                        <span className="text-slate-600">&rarr;</span>
                        <span className="text-emerald-400">this browser tab</span>
                        <span className="text-slate-600">&rarr;</span>
                        <span className="text-emerald-400">this browser&rsquo;s local database</span>
                        <span className="text-slate-600">&rarr;</span>
                        <span className="text-emerald-400">files you download</span>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] text-slate-500">
                        There is no step in that sequence that leaves this machine. That is the entire diagram &mdash;
                        not a simplification of one.
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed border-t border-white/[0.04] pt-4">
                    <strong className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>One limit, stated plainly:</strong>{' '}
                    because the matter lives in this browser, it is not backed up, does not sync to your other devices,
                    and will be lost if you clear your browser data. Keep your original documents wherever you keep
                    them now. This is a workspace, not a document management system.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {[
                  { n: 'STAGE 01', t: 'Ingest', d: 'Upload PDF, Word, email or text files from your computer. Each is hashed, typed and indexed on arrival.' },
                  { n: 'STAGE 02', t: 'Designate', d: 'Mark each document produce, redact or withhold. Withheld documents are excluded downstream and logged.' },
                  { n: 'STAGE 05', t: 'Cite', d: 'Every finding highlights the exact passage it came from, with a Bates number and line reference.' },
                ].map(card => (
                  <div key={card.n} className={`p-5 rounded-2xl border transition-all hover:-translate-y-1 ${panelClass}`}>
                    <span className="text-indigo-400 font-mono text-xs font-bold block">{card.n}</span>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mt-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{card.t}</h4>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{card.d}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/[0.04]">
                <button
                  onClick={() => handleStepChange(1)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all inline-flex items-center gap-2"
                >
                  Begin at Discovery Ingest <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* ============ STAGE 1: DISCOVERY INGEST ============ */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className={`border rounded-2xl p-4 flex gap-4 items-start ${
                isDarkMode ? 'bg-amber-500/[0.02] border-amber-500/20' : 'bg-amber-500/[0.04] border-amber-500/30'
              }`}>
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 font-mono">Ingested &mdash; not yet indexed</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Documents loaded here are hashed and searchable but carry no Bates numbers until they pass the
                    integrity check in Stage&nbsp;03. Nothing leaves your browser.
                  </p>
                </div>
              </div>

              {/* Upload */}
              <div className={`rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
                isUploading
                  ? 'border-indigo-500/50 bg-indigo-500/[0.03]'
                  : isDarkMode ? 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12]' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center text-indigo-500 shrink-0 ${
                      isDarkMode ? 'bg-[#151620] border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                      <UploadCloud size={20} className={isUploading ? 'animate-bounce' : ''} />
                    </div>
                    <div>
                      <h3 className={`text-xs sm:text-sm font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Upload Client Documents
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        PDF, Word (.docx), email (.eml), CSV, JSON and plain text.
                      </p>
                    </div>
                  </div>

                  {!isUploading && (
                    <label className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 cursor-pointer shrink-0 ${primaryButton}`}>
                      <Plus size={14} />
                      Choose Files
                      <input
                        type="file"
                        multiple
                        accept={ACCEPTED_EXTENSIONS}
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  )}
                </div>

                {isUploading && (
                  <div className="mt-5 space-y-2.5 max-w-xs mx-auto">
                    <div className={`w-full h-1.5 rounded-full overflow-hidden border ${
                      isDarkMode ? 'bg-[#121319] border-white/[0.05]' : 'bg-slate-200 border-slate-300'
                    }`}>
                      <div className="bg-indigo-600 h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span className="font-semibold">Reading and indexing...</span>
                      <span className="font-bold text-indigo-500">{uploadProgress}%</span>
                    </div>
                  </div>
                )}
              </div>

              {uploadNotices.length > 0 && (
                <div className="space-y-1.5 animate-fadeIn">
                  {uploadNotices.map((notice, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${
                        notice.tone === 'error'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                      }`}
                    >
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>{notice.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Relevance screening criteria — supplied by counsel */}
              <div className={`rounded-2xl border ${panelClass}`}>
                <button
                  onClick={() => setCriteriaOpen(!criteriaOpen)}
                  className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Filter size={14} className="text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Relevance Screening Criteria
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {screeningActive
                          ? `${relevanceCriteria.parties.length} part${relevanceCriteria.parties.length === 1 ? 'y' : 'ies'}, ${relevanceCriteria.terms.length} key term${relevanceCriteria.terms.length === 1 ? '' : 's'}${criteriaFrom || criteriaTo ? ', date range set' : ''}`
                          : 'Not set — documents are unscreened until you define the matter'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`text-slate-500 shrink-0 transition-transform ${criteriaOpen ? 'rotate-90' : ''}`} />
                </button>

                {criteriaOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-white/[0.04] pt-4 animate-fadeIn">
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      Relevance is measured against the claims and defenses of your case, which no tool can read out of
                      a file. State the criteria here and every document is screened against them &mdash; the judgment
                      stays yours, the matching is automated. Separate entries with commas.
                    </p>

                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                        Parties &amp; custodians
                      </label>
                      <input
                        type="text"
                        placeholder="Acme Holdings, Jane Doe, Meridian Partners"
                        value={criteriaParties}
                        onChange={(e) => setCriteriaParties(e.target.value)}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                        Key terms
                      </label>
                      <input
                        type="text"
                        placeholder="escrow, wire transfer, account 4471-882"
                        value={criteriaTerms}
                        onChange={(e) => setCriteriaTerms(e.target.value)}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                          Period from
                        </label>
                        <input
                          type="date"
                          value={criteriaFrom}
                          onChange={(e) => setCriteriaFrom(e.target.value)}
                          onFocus={() => setIsTyping(true)}
                          onBlur={() => setIsTyping(false)}
                          className={`w-full border rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                          Period to
                        </label>
                        <input
                          type="date"
                          value={criteriaTo}
                          onChange={(e) => setCriteriaTo(e.target.value)}
                          onFocus={() => setIsTyping(true)}
                          onBlur={() => setIsTyping(false)}
                          className={`w-full border rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-[10px] leading-relaxed text-slate-500 pt-1">
                      Keyword screening both over- and under-includes &mdash; a responsive document that happens to use
                      none of your terms will read as no match. Treat these results as a review queue, not a
                      determination.
                    </p>
                  </div>
                )}
              </div>

              {/* Screening summary — the indicator that something is out of scope */}
              {screeningActive && documents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setRelevanceFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold border transition-all ${
                      relevanceFilter === 'ALL'
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : isDarkMode ? 'bg-[#151622] border-white/[0.04] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    ALL {documents.length}
                  </button>
                  {['strong', 'possible', 'out_of_period', 'none'].map(key => {
                    const meta = RELEVANCE_CATEGORIES[key];
                    const count = relevanceCounts[key];
                    if (count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setRelevanceFilter(relevanceFilter === key ? 'ALL' : key)}
                        title={meta.blurb}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold border transition-all ${
                          relevanceFilter === key ? toneClasses[meta.tone] + ' ring-1 ring-current' : toneClasses[meta.tone] + ' opacity-70 hover:opacity-100'
                        }`}
                      >
                        {meta.short} {count}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Out-of-scope banner */}
              {screeningActive && (relevanceCounts.none > 0 || relevanceCounts.out_of_period > 0) && (
                <div className={`border rounded-2xl p-4 flex gap-3 items-start ${
                  isDarkMode ? 'bg-red-500/[0.04] border-red-500/20' : 'bg-red-50 border-red-200'
                }`}>
                  <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-400 font-mono">
                      {relevanceCounts.none > 0 && `${relevanceCounts.none} document${relevanceCounts.none === 1 ? '' : 's'} with no connection to this matter`}
                      {relevanceCounts.none > 0 && relevanceCounts.out_of_period > 0 && ' · '}
                      {relevanceCounts.out_of_period > 0 && `${relevanceCounts.out_of_period} outside the relevant period`}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      These matched none of your parties or key terms, or fall wholly outside the period you set. Review
                      them before Stage&nbsp;02 &mdash; anything genuinely out of scope should not be selected for
                      production.
                    </p>
                  </div>
                </div>
              )}

              {/* Search & filter */}
              <div className={`p-4 rounded-2xl border transition-colors flex flex-col md:flex-row gap-3 items-center justify-between ${
                isDarkMode ? 'bg-[#111219] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <div className="relative w-full md:w-72">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={14} /></span>
                  <input
                    type="text"
                    placeholder="Search document names..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                      isDarkMode ? 'bg-[#151622] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                  {documentTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setFileFilter(type)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold border transition-all shrink-0 ${
                        fileFilter === type ? 'bg-indigo-600 border-indigo-600 text-white' : isDarkMode ? 'bg-[#151622] border-white/[0.04] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document grid */}
              {filteredDocuments.length === 0 ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title={documents.length === 0 ? 'NO DOCUMENTS INGESTED' : 'NO MATCHES'}
                  hint={documents.length === 0 ? 'Use Choose Files above to load documents from your computer' : 'Adjust the search or filter'}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.name}
                      className={`border rounded-xl p-3 flex items-start justify-between gap-2 transition-all group ${
                        screeningActive && relevanceResults[doc.name]?.category === 'none'
                          ? isDarkMode ? 'bg-red-500/[0.03] border-red-500/20' : 'bg-red-50/60 border-red-200'
                          : isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:border-white/[0.08]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                          doc.needsOcr ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                        }`}>
                          <FileText size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`} title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {doc.size} &middot; {doc.pages}p{doc.pagesExact ? '' : ' est'} &middot; {doc.type}
                          </p>
                          <p className="text-[9px] text-slate-600 font-mono mt-0.5 truncate">
                            {(citations[doc.name] || []).length} citation{(citations[doc.name] || []).length === 1 ? '' : 's'}
                            {batesAssignments[doc.name] ? ` · ${batesAssignments[doc.name]}` : ''}
                          </p>
                          {screeningActive && relevanceResults[doc.name] && (() => {
                            const result = relevanceResults[doc.name];
                            const meta = RELEVANCE_CATEGORIES[result.category];
                            return (
                              <div className="mt-1.5">
                                <span
                                  title={meta.blurb}
                                  className={`text-[8px] font-mono border px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${toneClasses[meta.tone]}`}
                                >
                                  {meta.short}
                                </span>
                                {result.reason && (
                                  <p className={`text-[9px] mt-1 leading-snug ${
                                    result.category === 'none' ? 'text-red-400'
                                      : result.category === 'out_of_period' ? 'text-amber-500' : 'text-slate-500'
                                  }`}>
                                    {result.reason}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {doc.needsOcr && (
                          <span className="text-[8px] font-mono border px-1.5 py-0.5 rounded font-bold bg-amber-500/10 border-amber-500/20 text-amber-500">
                            NEEDS OCR
                          </span>
                        )}
                        <button
                          onClick={() => removeDocument(doc.name)}
                          title={`Remove ${doc.name}`}
                          className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-8 border-t border-white/[0.04] text-center">
                <MicroStatusVisualizer active={documents.length > 0} isDarkMode={isDarkMode} />
                <p className="text-xs font-mono text-slate-500 mt-2">
                  Ingestion queue: <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                    {documents.length > 0
                      ? `${documents.length} document${documents.length === 1 ? '' : 's'} ready for review`
                      : 'awaiting upload'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* ============ STAGE 2: REVIEW & DESIGNATE ============ */}
          {activeStep === 2 && (
            <div className="space-y-6 max-w-3xl mx-auto py-4 animate-fadeIn">
              {/* Matter details belong here, ahead of the Stage 03 stamping run. */}
              <div className={`border rounded-2xl p-5 ${panelClass}`}>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-indigo-500 font-bold mb-4 pb-3 border-b border-white/[0.04]">
                  Matter Details
                </h4>
                {renderMatterFields(true)}
              </div>

              <div className={`border rounded-2xl p-4 flex gap-4 items-start ${
                isDarkMode ? 'bg-indigo-500/[0.02] border-indigo-500/20' : 'bg-indigo-500/[0.04] border-indigo-500/30'
              }`}>
                <EyeOff className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Privilege review</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Select the documents in scope, then designate each one. Anything marked <strong>Withhold</strong> is
                    excluded from analysis, the citation matrix and the brief, and appears instead on the privilege log
                    required by FRCP&nbsp;26(b)(5).
                  </p>
                </div>
              </div>

              {documents.length === 0 ? (
                <EmptyState
                  icon={UploadCloud}
                  title="NO INGESTED DOCUMENTS"
                  hint="Return to Discovery Ingest (Stage 01) to upload files"
                />
              ) : (
                <>
                  <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row gap-2.5 items-center ${
                    isDarkMode ? 'bg-[#111219] border-white/[0.04]' : 'bg-white border-slate-200'
                  }`}>
                    <div className="relative flex-1 w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={13} /></span>
                      <input
                        type="text"
                        placeholder="Filter documents..."
                        value={reviewSearch}
                        onChange={(e) => setReviewSearch(e.target.value)}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          isDarkMode ? 'bg-[#151622] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                    <select
                      value={reviewSort}
                      onChange={(e) => setReviewSort(e.target.value)}
                      className={`text-[11px] font-mono rounded-xl border px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isDarkMode ? 'bg-[#151622] border-white/[0.06] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <option value="name">Sort: Name</option>
                      <option value="relevance">Sort: Relevance</option>
                      <option value="pages">Sort: Pages</option>
                      <option value="type">Sort: Type</option>
                    </select>
                    <button
                      onClick={() => {
                        // "Select relevant" deliberately excludes no-match and
                        // out-of-period documents rather than sweeping them in.
                        const eligible = documents
                          .filter(d => !screeningActive
                            || !['none', 'out_of_period'].includes(relevanceResults[d.name]?.category))
                          .map(d => d.name);
                        const alreadyAll = eligible.every(n => selectedForReview.includes(n))
                          && selectedForReview.length >= eligible.length;
                        setSelectedForReview(alreadyAll ? [] : eligible);
                      }}
                      className="text-[11px] font-mono font-bold text-indigo-400 hover:text-indigo-300 px-2 shrink-0 text-right"
                    >
                      {selectedForReview.length > 0 ? 'Deselect All' : (screeningActive ? 'Select relevant' : 'Select All')}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {reviewDocuments.map((doc) => {
                      const isSelected = selectedForReview.includes(doc.name);
                      const disposition = dispositionOf(doc.name);
                      const record = privilege[doc.name] || {};
                      return (
                        <div
                          key={doc.name}
                          className={`rounded-xl border transition-all ${
                            isSelected
                              ? isDarkMode ? 'bg-indigo-500/[0.06] border-indigo-500/30' : 'bg-indigo-50/60 border-indigo-200'
                              : isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          <div className="p-3 flex items-center justify-between gap-3">
                            <button
                              onClick={() => toggleSelection(doc.name)}
                              className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-indigo-600 border-indigo-600' : isDarkMode ? 'border-white/[0.15]' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check size={11} className="text-white stroke-[3]" />}
                              </div>
                              <FileText size={14} className="text-indigo-500 shrink-0" />
                              <span className={`font-mono text-xs font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {doc.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono shrink-0 hidden sm:inline">
                                {doc.pages}p &middot; {doc.type}
                              </span>
                              {screeningActive && relevanceResults[doc.name] && (() => {
                                const meta = RELEVANCE_CATEGORIES[relevanceResults[doc.name].category];
                                return (
                                  <span
                                    title={relevanceResults[doc.name].reason || meta.blurb}
                                    className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${toneClasses[meta.tone]}`}
                                  >
                                    {meta.short}
                                  </span>
                                );
                              })()}
                            </button>

                            {isSelected && (
                              <div className="flex gap-1 shrink-0">
                                {Object.entries(DISPOSITIONS).map(([key, meta]) => (
                                  <button
                                    key={key}
                                    onClick={() => setDisposition(doc.name, key)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-mono font-bold border transition-all ${
                                      disposition === key
                                        ? toneClasses[meta.tone]
                                        : isDarkMode ? 'border-white/[0.06] text-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    {meta.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {isSelected && screeningActive
                            && ['none', 'out_of_period'].includes(relevanceResults[doc.name]?.category)
                            && disposition === 'produce' && (
                            <p className="px-3 pb-2.5 -mt-1 text-[10px] leading-snug text-red-400">
                              Screening found no connection between this document and your matter, yet it is set to
                              produce. {relevanceResults[doc.name]?.reason}
                            </p>
                          )}

                          {isSelected && disposition !== 'produce' && (
                            <div className={`px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t ${
                              isDarkMode ? 'border-white/[0.04]' : 'border-slate-100'
                            }`}>
                              <select
                                value={record.basis || ''}
                                onChange={(e) => setPrivilegeField(doc.name, 'basis', e.target.value)}
                                className={`text-[11px] rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  isDarkMode ? 'bg-[#151620] border-white/[0.06] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              >
                                <option value="">Basis required…</option>
                                {PRIVILEGE_BASES.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                              <input
                                type="text"
                                placeholder="Description for the log"
                                value={record.description || ''}
                                onChange={(e) => setPrivilegeField(doc.name, 'description', e.target.value)}
                                onFocus={() => setIsTyping(true)}
                                onBlur={() => setIsTyping(false)}
                                className={`sm:col-span-2 text-[11px] rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  isDarkMode ? 'bg-[#151620] border-white/[0.06] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {voidedCheck && (
                    <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-500 text-[11px] flex items-start gap-2 animate-fadeIn">
                      <RefreshCw size={13} className="shrink-0 mt-0.5" />
                      <span>
                        This change voided the readiness check you ran at{' '}
                        {voidedCheck.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' '}({voidedCheck.ready} document{voidedCheck.ready === 1 ? '' : 's'} were cleared to produce).
                        Run it again in Stage\u00A003 before packaging.
                      </span>
                    </div>
                  )}

                  {incompletePrivilege.length > 0 && (
                    <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-500 text-[11px] flex items-start gap-2 animate-fadeIn">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>{incompletePrivilege.length} withheld or redacted document{incompletePrivilege.length === 1 ? '' : 's'}</strong> still
                        {incompletePrivilege.length === 1 ? ' needs' : ' need'} a basis and description. A privilege log
                        entry without both is incomplete under FRCP&nbsp;26(b)(5): {incompletePrivilege.join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] font-mono text-slate-500">
                      {selectedForReview.length} selected &middot; {producibleNames.length} producible
                      {withheldCount > 0 && ` · ${withheldCount} withheld`}
                    </p>
                    <button
                      onClick={() => handleStepChange(3)}
                      disabled={selectedForReview.length === 0}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 ${
                        selectedForReview.length === 0
                          ? 'bg-slate-500/10 text-slate-500 cursor-not-allowed'
                          : primaryButton
                      }`}
                    >
                      Send to Integrity Check
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ STAGE 3: INTEGRITY CHECK ============ */}
          {activeStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto animate-fadeIn">
              <div className={`rounded-2xl border overflow-hidden ${
                isDarkMode ? 'bg-[#111219]/70 border-white/[0.06]' : 'bg-white border-slate-200 shadow-md'
              }`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center gap-3 ${
                  isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500" />
                    <h3 className={`text-xs font-bold tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Production Readiness
                    </h3>
                  </div>
                  <span className={`text-[9px] font-mono border px-2.5 py-0.5 rounded font-bold shrink-0 ${
                    integrityReport ? toneClasses[integrityReport.stateMeta.tone] : toneClasses.slate
                  }`}>
                    {integrityReport ? integrityReport.stateMeta.label : 'NOT YET RUN'}
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Matter</span>
                      <p className={`text-xs font-bold mt-1 font-mono truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{caseTitle}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Volume</span>
                      <p className={`text-xs font-bold mt-1 font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {totalPages} page{totalPages === 1 ? '' : 's'}{pagesEstimated ? ' (est.)' : ''}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">{selectedDocs.length} documents</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Bates Range</span>
                      <p className="text-xs font-mono font-bold text-amber-500 mt-1 truncate">
                        {(() => {
                          const assigned = selectedDocs.map(d => batesAssignments[d.name]).filter(Boolean).sort();
                          if (assigned.length === 0) return 'Assigned on check';
                          return assigned.length === 1 ? assigned[0] : `${assigned[0]} – ${assigned[assigned.length - 1]}`;
                        })()}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Manifest SHA-256</span>
                      <p className={`text-[10px] font-mono mt-1 truncate ${manifestSha ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {manifestSha ? `${manifestSha.slice(0, 24)}…` : 'Computed when the check runs'}
                      </p>
                    </div>
                  </div>

                  {selectedDocs.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono text-center py-2">
                      No documents were selected in Review &amp; Designate. Return to Stage&nbsp;02 to choose files.
                    </p>
                  ) : (
                    <div className="pt-2 space-y-4">
                      {isRunningIntegrityCheck ? (
                        <div className="flex flex-col items-center gap-2.5 py-3">
                          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[11px] font-mono text-indigo-400">Hashing documents and validating the manifest...</span>
                        </div>
                      ) : integrityReport ? (
                        <div className="space-y-5 py-2 animate-fadeIn">
                          {/* Headline: a count of problems, zero being the common path */}
                          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                            <div className="shrink-0 text-center">
                              <div className={`text-5xl font-black font-mono leading-none ${
                                integrityReport.stateMeta.tone === 'emerald' ? 'text-emerald-500'
                                  : integrityReport.stateMeta.tone === 'amber' ? 'text-amber-500' : 'text-red-400'
                              }`}>
                                {integrityReport.setHold ? 0 : producingCount}
                                <span className="text-lg text-slate-500">/{integrityReport.total}</span>
                              </div>
                              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold mt-1.5">
                                producing
                              </p>
                            </div>
                            <div className="text-center sm:text-left">
                              <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {integrityReport.setHold
                                  ? 'Nothing can be produced from this set yet'
                                  : integrityReport.exceptions.length === 0
                                    ? `All ${integrityReport.total} document${integrityReport.total === 1 ? '' : 's'} cleared`
                                    : `${integrityReport.exceptions.length} document${integrityReport.exceptions.length === 1 ? '' : 's'} need${integrityReport.exceptions.length === 1 ? 's' : ''} attention`}
                              </p>
                              <p className={`text-xs leading-relaxed mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {integrityReport.stateMeta.verdict}
                              </p>
                              {integrityReport.setHold ? (
                                <p className="text-[10px] font-mono text-slate-500 mt-1.5">
                                  Held pending confirmation that this is the right collection
                                </p>
                              ) : (
                                <p className="text-[10px] font-mono text-slate-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                  <span><b className="text-emerald-500">{producingCount}</b> producing</span>
                                  <span><b className="text-slate-400">{withheldReadyCount}</b> withheld</span>
                                  <span><b className="text-amber-500">{integrityReport.exceptions.length}</b> held back</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* The set as a whole does not look like one matter */}
                          {integrityReport.state === 'incoherent' && (
                            <div className="p-4 rounded-xl border bg-red-500/[0.07] border-red-500/25">
                              <div className="flex items-start gap-2.5">
                                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-400 font-mono">
                                    These documents do not look like one matter
                                  </p>
                                  <p className={`text-[11px] leading-relaxed mt-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Across {integrityReport.cohesion.compared} readable documents, the typical pair shares
                                    almost no parties, identifiers or distinctive vocabulary
                                    (cohesion {integrityReport.cohesion.setCohesion.toFixed(3)}, below the{' '}
                                    {MIN_SET_COHESION} floor). In a real matter these documents would name the same
                                    people, entities and account or docket numbers.
                                  </p>
                                  <p className="text-[10px] leading-relaxed mt-2 text-slate-500">
                                    The usual cause is the wrong folder being uploaded. Producing documents from another
                                    client's matter is a confidentiality breach, so nothing here goes out until you
                                    confirm this is the right collection.
                                  </p>
                                  <button
                                    onClick={confirmCollection}
                                    className="mt-3 px-3 py-1.5 text-[10px] font-bold rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-all inline-flex items-center gap-1.5"
                                  >
                                    <Check size={11} /> I have checked &mdash; this is the correct collection
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Blocking defects: what is held back and how to cure it */}
                          {integrityReport.exceptions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-mono uppercase tracking-widest text-amber-500 font-bold">
                                Held back from production &mdash; cure required
                              </p>
                              {integrityReport.exceptions.map((item) => (
                                <div key={item.name} className="p-3 rounded-xl border bg-amber-500/[0.06] border-amber-500/20">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[11px] font-mono font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                                      {item.name}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                      {item.bates || 'Bates pending'}
                                    </span>
                                  </div>
                                  {item.defects.map((defect) => (
                                    <div key={defect.code} className="mt-2 pl-2 border-l border-amber-500/30">
                                      <p className="text-[11px] font-semibold text-amber-500">{defect.label}</p>
                                      <p className={`text-[10px] leading-relaxed mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {defect.cure}
                                      </p>
                                      {defect.code === 'unrelated' && (
                                        <>
                                          <p className="text-[10px] font-mono text-slate-500 mt-1">
                                            Shares {(item.affinity * 100).toFixed(1)}% of its vocabulary with its closest
                                            neighbour{item.nearest ? ` (${item.nearest})` : ''} — the rest of this set
                                            averages {(integrityReport.cohesion.setCohesion * 100).toFixed(1)}%.
                                          </p>
                                          <button
                                            onClick={() => confirmDocumentRelated(item.name, item.hash)}
                                            className="mt-2 px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all inline-flex items-center gap-1.5"
                                          >
                                            <Check size={11} /> This document belongs to the matter
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Advisory: informs review effort, never blocks */}
                          {integrityReport.advisories.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold">
                                Advisory &mdash; does not block production
                              </p>
                              {integrityReport.advisories.map((advisory) => (
                                <div
                                  key={advisory.key}
                                  className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                      {advisory.label}
                                    </span>
                                    {advisory.elevated && (
                                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/20 text-amber-500 shrink-0">
                                        WORTH ADDRESSING
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{advisory.detail}</p>
                                  <p className="text-[10px] mt-1 leading-relaxed text-slate-500">{advisory.why}</p>
                                  <p className="text-[10px] mt-1 font-mono text-slate-500 break-words opacity-80">
                                    {advisory.names.join(', ')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* What this check cannot tell you */}
                          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.05]' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-1">
                              Scope of this check
                            </p>
                            <p className="text-[10px] leading-relaxed text-slate-500">
                              This confirms the documents you loaded are intact, uniquely numbered and safe to produce.
                              It cannot tell you whether the collection itself was complete &mdash; whether every
                              responsive custodian, date range and source was captured. That judgment, and the
                              FRCP&nbsp;26(g) certification that rests on it, remains counsel's.
                            </p>
                          </div>

                          <div className="flex justify-center">
                            <button
                              onClick={handleRunIntegrityCheck}
                              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 ${
                                isDarkMode ? 'bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08]' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                              }`}
                            >
                              <RefreshCw size={13} />
                              Re-run Readiness Check
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center py-2">
                          <button
                            onClick={handleRunIntegrityCheck}
                            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 ${primaryButton}`}
                          >
                            <CheckCircle2 size={14} />
                            Run Readiness Check
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center pt-2">
                <MicroStatusVisualizer active={!!integrityReport} isDarkMode={isDarkMode} />
                <p className="text-xs font-mono text-slate-500 mt-2">
                  Manifest state: <span className={`font-bold ${integrityReport ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {integrityReport ? 'VERIFIED' : 'AWAITING VERIFICATION'}
                  </span>
                </p>

                {integrityReport && (
                  <div className="mt-4 space-y-2">
                    {integrityReport.state === 'not-reviewable' && (
                      <p className="text-[11px] text-red-400 max-w-md mx-auto leading-relaxed">
                        {Math.round((integrityReport.unreadableCount / integrityReport.total) * 100)}% of this set is
                        unreadable, above the {Math.round(RECOLLECT_RATIO * 100)}% mark where the collection itself is
                        usually the problem. Re-collecting is likely faster than repairing these individually.
                      </p>
                    )}

                    {/* The gate is on having a clean set, not on a score. Documents
                        with blocking defects are held back rather than stopping the matter. */}
                    <button
                      onClick={() => handleStepChange(4)}
                      disabled={integrityReport.setHold || integrityReport.ready.length === 0}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 ${
                        integrityReport.setHold || integrityReport.ready.length === 0
                          ? 'bg-slate-500/10 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-500'
                      }`}
                    >
                      {integrityReport.setHold
                        ? 'Proceed to Deep Analysis'
                        : integrityReport.exceptions.length > 0
                          ? `Proceed with ${producingCount} document${producingCount === 1 ? '' : 's'}`
                          : 'Proceed to Deep Analysis'}
                      <ChevronRight size={14} />
                    </button>

                    {integrityReport.setHold ? (
                      <p className="text-[11px] text-red-400 max-w-md mx-auto leading-relaxed">
                        Nothing proceeds until you confirm this is the right collection, using the button above.
                      </p>
                    ) : integrityReport.ready.length === 0 ? (
                      <p className="text-[11px] text-amber-500 max-w-md mx-auto leading-relaxed">
                        No document in this set can be produced as it stands. Cure the defects listed above, or return
                        to Stage&nbsp;02 and select different documents.
                      </p>
                    ) : integrityReport.exceptions.length > 0 && (
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                        {integrityReport.exceptions.length === 1
                          ? 'The held-back document stays in the matter and appears'
                          : `The ${integrityReport.exceptions.length} held-back documents stay in the matter and appear`}
                        {' '}on the exceptions report in Stage&nbsp;08, and are excluded from analysis, citations and
                        the brief until cured.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ STAGE 4: DEEP ANALYSIS ============ */}
          {activeStep === 4 && producibleDocs.length === 0 && (
            <div className="max-w-2xl mx-auto py-8 animate-fadeIn">
              <EmptyState
                icon={Cpu}
                title="NOTHING TO ANALYZE"
                hint="Select documents in Review & Designate (Stage 02), then run the readiness check in Stage 03"
              />
              <div className="flex justify-center mt-5">
                <button
                  onClick={() => handleStepChange(2)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 ${primaryButton}`}
                >
                  Go to Review &amp; Designate
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {activeStep === 4 && producibleDocs.length > 0 && (
            <div className="space-y-6 max-w-2xl mx-auto py-8 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className={`w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-2 ${analysisComplete ? '' : 'animate-pulse'}`}>
                  {analysisComplete ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Activity className="text-indigo-500" size={24} />}
                </div>
                <h3 className={`text-md font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {analysisComplete ? 'Analysis Complete' : 'Building Case Chronology'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {analysisComplete
                    ? 'Dates were extracted from each producible document and ordered into a chronology. Findings are ready in the Citation Matrix.'
                    : 'Reading each producible document and extracting dated events.'}
                </p>
              </div>

              <div className="space-y-3">
                <div className={`w-full h-3 rounded-full p-0.5 overflow-hidden border ${
                  isDarkMode ? 'bg-[#13141C] border-white/[0.05]' : 'bg-slate-200 border-slate-300'
                }`}>
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${analysisComplete ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className={`truncate ${analysisComplete ? 'text-emerald-500' : 'text-indigo-500'}`}>{analysisPhase}</span>
                  <span className={`font-bold self-end sm:self-auto ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{analysisProgress}%</span>
                </div>
              </div>

              {/* Documents in this analysis pass */}
              {producibleDocs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold">
                      Documents in this pass
                    </p>
                    <p className="text-[9px] font-mono text-slate-500">
                      {Object.keys(docAnalysis).length} of {producibleDocs.length} processed
                    </p>
                  </div>

                  {producibleDocs.map((doc) => {
                    const result = docAnalysis[doc.name];
                    return (
                      <div
                        key={doc.name}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          result
                            ? isDarkMode ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'
                            : isDarkMode ? 'bg-white/[0.01] border-white/[0.03] opacity-60' : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {result
                            ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            : <div className="w-3.5 h-3.5 border-2 border-slate-500/40 border-t-indigo-500 rounded-full animate-spin shrink-0" />}
                          <div className="min-w-0">
                            <p className={`text-xs font-mono font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {doc.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {batesAssignments[doc.name] || 'Bates pending'} &middot; {doc.pages}p &middot; {doc.type}
                              {result && ` · ${result.events} dated event${result.events === 1 ? '' : 's'}`}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setOpenDocument(doc.name)}
                          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all shrink-0 inline-flex items-center gap-1.5 ${
                            isDarkMode ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <FileText size={11} /> Open
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <TimelineStrip
                timeline={timeline}
                isDarkMode={isDarkMode}
                bates={batesAssignments}
                onOpen={(name) => setOpenDocument(name)}
              />

              {analysisComplete && (
                <div className="flex justify-center pt-2 animate-fadeIn">
                  <button
                    onClick={() => handleStepChange(5)}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 size={14} />
                    Continue to Citation Matrix
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============ STAGE 5: CITATION MATRIX ============ */}
          {activeStep === 5 && (
            <div className="space-y-5 animate-fadeIn">
              <div className={`border rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                isDarkMode ? 'bg-emerald-500/[0.01] border-emerald-500/15' : 'bg-emerald-50/50 border-emerald-200'
              }`}>
                <p className={`text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  <strong>Citation Viewer:</strong> select a finding to highlight the exact passage it was drawn from.
                </p>

                {producibleNames.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Document:</span>
                    <select
                      value={selectedDocSource || ''}
                      onChange={(e) => setSelectedDocSource(e.target.value)}
                      className={`rounded-lg px-2 py-1 text-xs font-mono focus:outline-none border max-w-[220px] ${
                        isDarkMode ? 'bg-[#111219] border-white/[0.08] text-indigo-400' : 'bg-white border-slate-200 text-indigo-600'
                      }`}
                    >
                      {producibleNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {producibleNames.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="NO PRODUCIBLE DOCUMENTS"
                  hint="Select documents in Stage 02 and designate them Produce or Redact"
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:h-[480px]">
                  {/* Findings */}
                  <div className="lg:col-span-2 space-y-2.5 overflow-y-auto max-h-[280px] lg:max-h-full pr-1.5">
                    {activeCitations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-mono text-slate-500 pb-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded-sm border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">tag</span>
                          found by the tool
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400 inline-flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-amber-400" />tag
                          </span>
                          added by you
                        </span>
                      </div>
                    )}
                    {activeCitations.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center py-10 rounded-xl border border-dashed text-center ${
                        isDarkMode ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'
                      }`}>
                        <ShieldCheck size={22} className="mb-2 opacity-30" />
                        <p className="text-[10px] font-mono font-bold">NO CITATIONS EXTRACTED</p>
                        <p className="text-[9px] font-mono mt-1 opacity-60 px-3">
                          No passage in this document carried a date, amount, party or operative term
                        </p>
                      </div>
                    ) : (
                      activeCitations.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedFinding(item.id)}
                          className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                            selectedFinding === item.id
                              ? isDarkMode ? 'bg-[#181924] border-indigo-500/50 shadow-lg ring-1 ring-indigo-500/30' : 'bg-indigo-50/50 border-indigo-300 shadow-md'
                              : isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:bg-[#13141e]' : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5 gap-2">
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 truncate">
                              {batesAssignments[item.source] || 'Bates pending'} &middot; Line {item.line}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              {notes[`${item.source}::${item.id}`] && (
                                <span
                                  title={`Note attached: "${notes[`${item.source}::${item.id}`]}"`}
                                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border bg-sky-500/10 border-sky-500/30 text-sky-400 inline-flex items-center gap-1"
                                >
                                  <StickyNote size={9} /> NOTE
                                </span>
                              )}
                              {item.origin === 'user' && (
                                <span
                                  title="You created this citation by selecting the passage"
                                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-400 inline-flex items-center gap-1"
                                >
                                  <UserRound size={9} /> YOURS
                                </span>
                              )}
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed font-sans font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            {item.finding}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {/* Tool tags: observable signals the extractor found in the text.
                                Square, indigo, not removable. */}
                            {item.signals.map(sig => (
                              <span
                                key={`sig-${sig}`}
                                title="Detected by the tool"
                                className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm border bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                              >
                                {SIGNAL_LABELS[sig]}
                              </span>
                            ))}
                            {/* Your tags: pill-shaped, amber, dot-prefixed. */}
                            {(item.tags || []).map(tag => (
                              <span
                                key={`tag-${tag}`}
                                title="Your tag"
                                className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400 inline-flex items-center gap-1"
                              >
                                <span className="w-1 h-1 rounded-full bg-amber-400" />{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Editors for the selected citation, tabbed to keep the
                        citation list readable in a narrow column. */}
                    {activeCitation && (
                      <div className={`rounded-xl border ${panelClass}`}>
                        <div className={`flex items-stretch border-b ${isDarkMode ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                          {[
                            ['note', 'Note', notes[noteKey] ? 1 : 0],
                            ['tags', 'Tags', (activeCitation.tags || []).length],
                          ].map(([key, label, count]) => (
                            <button
                              key={key}
                              onClick={() => setSidePane(key)}
                              className={`flex-1 px-3 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                                sidePane === key
                                  ? 'text-indigo-400 border-b-2 border-indigo-500 -mb-px'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {label}{count > 0 ? ` (${count})` : ''}
                            </button>
                          ))}
                        </div>

                        <div className="p-4" hidden={sidePane !== 'tags'}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                            Your tags
                          </label>
                          {activeCitation.origin === 'user' && (
                            <button
                              onClick={() => removeUserCitation(activeCitation.id)}
                              className="text-[9px] font-mono text-slate-500 hover:text-red-400 transition-colors inline-flex items-center gap-1"
                            >
                              <Trash2 size={10} /> Delete citation
                            </button>
                          )}
                        </div>

                        {(activeCitation.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2.5">
                            {activeCitation.tags.map(tag => (
                              <button
                                key={tag}
                                onClick={() => updateCitationTags(activeCitation.id, t => t.filter(x => x !== tag))}
                                title="Remove this tag"
                                className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400 inline-flex items-center gap-1 hover:bg-amber-500/20"
                              >
                                <span className="w-1 h-1 rounded-full bg-amber-400" />{tag}
                                <X size={9} />
                              </button>
                            ))}
                          </div>
                        )}

                        {knownTags.filter(t => !(activeCitation.tags || []).includes(t)).length > 0 && (
                          <div className="mb-2.5">
                            <p className="text-[9px] font-mono text-slate-500 mb-1">Reuse a tag</p>
                            <div className="flex flex-wrap gap-1">
                              {knownTags
                                .filter(t => !(activeCitation.tags || []).includes(t))
                                .map(tag => (
                                  <button
                                    key={tag}
                                    onClick={() => updateCitationTags(activeCitation.id, t => [...t, tag])}
                                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                                      isDarkMode
                                        ? 'border-white/[0.08] text-slate-400 hover:border-amber-500/40 hover:text-amber-400'
                                        : 'border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600'
                                    }`}
                                  >
                                    + {tag}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const clean = tagDraft.trim();
                            if (!clean) return;
                            updateCitationTags(activeCitation.id, t => (t.includes(clean) ? t : [...t, clean]));
                            setTagDraft('');
                          }}
                          className="flex gap-1.5"
                        >
                          <input
                            type="text"
                            placeholder="New tag…"
                            value={tagDraft}
                            onChange={(e) => { setTagDraft(e.target.value); setIsTyping(true); }}
                            onBlur={() => setIsTyping(false)}
                            className={`flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                              isDarkMode ? 'bg-[#151620] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all shrink-0"
                          >
                            Add
                          </button>
                        </form>
                        </div>

                        <div className="p-4" hidden={sidePane !== 'note'}>
                      <label className="text-[10px] font-mono font-bold tracking-wider text-slate-500 block mb-2 uppercase">
                        Note on this passage
                      </label>
                      <textarea
                        placeholder={activeCitation ? 'Add a note about this specific passage...' : 'Select a finding first'}
                        value={activeNoteInput}
                        disabled={!activeCitation}
                        onChange={(e) => { setActiveNoteInput(e.target.value); setIsTyping(true); }}
                        onBlur={() => setIsTyping(false)}
                        rows={3}
                        className={`w-full text-xs p-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50 ${
                          isDarkMode ? 'bg-[#151620] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                      <div className="mt-2.5 flex justify-between items-center gap-2">
                        <button
                          onClick={handleCopyCitation}
                          disabled={!activeCitation}
                          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all disabled:opacity-40 ${
                            isDarkMode ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {copiedCitation ? 'Copied' : 'Copy citation'}
                        </button>
                        <button
                          onClick={handleUpdateNote}
                          disabled={!activeCitation}
                          className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all disabled:opacity-40"
                        >
                          Save Note
                        </button>
                      </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Viewer */}
                  <div className="lg:col-span-3 relative bg-white rounded-2xl border border-[#D1D5DB] flex flex-col overflow-hidden text-slate-900 shadow-2xl min-h-[300px]">
                    <div className="bg-[#E5E7EB] px-4 py-2 border-b border-[#D1D5DB] flex justify-between items-center text-[10px] text-slate-500 font-mono font-bold gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <FileText size={13} className="text-slate-500 shrink-0" />
                        <span className="truncate">{selectedDocSource || 'No document'}</span>
                      </span>
                      <span className="shrink-0">
                        {pendingSelection ? 'Selection ready' : 'Select text to cite it'}
                      </span>
                    </div>

                    <div
                      ref={viewerRef}
                      onMouseUp={captureSelection}
                      className="flex-1 p-6 font-serif text-[12.5px] leading-relaxed overflow-y-auto bg-[#F9FAFB] select-text">
                      <div className="border border-slate-200/60 p-6 bg-white min-h-full shadow-sm rounded-xl">
                        <p className="text-[9px] text-slate-400 font-mono mb-4 pb-1.5 border-b border-slate-100 uppercase tracking-widest font-bold">
                          {dispositionOf(selectedDocSource) === 'redact' ? 'Client document — produced in redacted form' : 'Client document'}
                        </p>
                        {(() => {
                          const doc = documents.find(d => d.name === selectedDocSource);
                          const content = doc?.content || '';
                          if (!content) {
                            return <p className="text-slate-400 font-mono text-[11px]">No readable content in this document.</p>;
                          }
                          if (!activeCitation) {
                            return <p ref={docTextRef} className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{content}</p>;
                          }
                          // Anchored by stored offset, so repeated phrases highlight the right one.
                          const start = activeCitation.offset;
                          const end = start + activeCitation.excerpt.length;
                          return (
                            <p ref={docTextRef} className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                              {content.slice(0, start)}
                              <mark ref={markRef} className="bg-amber-100 font-bold px-0.5 rounded border-b-2 border-amber-500 text-slate-950 shadow-sm">
                                {content.slice(start, end)}
                              </mark>
                              {content.slice(end)}
                            </p>
                          );
                        })()}

                        {noteKey && notes[noteKey] && (
                          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg animate-fadeIn">
                            <p className="text-[9px] font-mono tracking-widest text-indigo-700 uppercase font-bold">Attorney note</p>
                            <p className="text-xs text-indigo-950 font-sans italic mt-1 leading-relaxed">"{notes[noteKey]}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prompt for a passage the attorney highlighted, shown over
                        the viewer so it appears where they are already looking. */}
                    {pendingSelection && (
                      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-amber-500/40 bg-[#161821] p-3.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] animate-fadeIn">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-400">
                              Add this passage as your citation
                            </p>
                            <p className={`text-[11px] mt-1 leading-snug line-clamp-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              &ldquo;{pendingSelection.excerpt.length > 160
                                ? `${pendingSelection.excerpt.slice(0, 160)}…`
                                : pendingSelection.excerpt}&rdquo;
                            </p>
                          </div>
                          <button
                            onClick={() => { setPendingSelection(null); window.getSelection()?.removeAllRanges(); }}
                            className="p-1 rounded-lg border border-white/[0.08] text-slate-400 hover:bg-white/[0.05] shrink-0"
                            aria-label="Discard selection"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div className="mt-2.5">
                          <p className="text-[9px] font-mono text-slate-500 mb-1.5">
                            Tag it {knownTags.length > 0 ? '— reuse one of yours or write a new one' : '— write your own label'}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {pendingTags.map(tag => (
                              <button
                                key={tag}
                                onClick={() => setPendingTags(prev => prev.filter(t => t !== tag))}
                                className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/40 text-amber-300 inline-flex items-center gap-1"
                              >
                                <span className="w-1 h-1 rounded-full bg-amber-400" />{tag}<X size={9} />
                              </button>
                            ))}
                            {knownTags.filter(t => !pendingTags.includes(t)).map(tag => (
                              <button
                                key={tag}
                                onClick={() => addPendingTag(tag)}
                                className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-white/[0.1] text-slate-400 hover:border-amber-500/40 hover:text-amber-400 transition-colors"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="New tag…"
                              value={tagDraft}
                              onChange={(e) => { setTagDraft(e.target.value); setIsTyping(true); }}
                              onBlur={() => setIsTyping(false)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); addPendingTag(tagDraft); }
                              }}
                              className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg border bg-[#101119] border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              onClick={() => addPendingTag(tagDraft)}
                              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 shrink-0"
                            >
                              Add tag
                            </button>
                            <button
                              onClick={commitUserCitation}
                              className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 shrink-0"
                            >
                              Save citation
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* All notes on the open document */}
              {producibleNames.length > 0 && (
                <div className={`rounded-2xl border ${panelClass}`}>
                  <div className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
                    isDarkMode ? 'border-white/[0.04]' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <StickyNote size={14} className="text-sky-400 shrink-0" />
                      <h4 className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Notes in this document
                      </h4>
                      <span className="text-[10px] font-mono text-slate-500 truncate">
                        {selectedDocSource}
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                      documentNotes.length > 0 ? toneClasses.indigo : toneClasses.slate
                    }`}>
                      {documentNotes.length}
                    </span>
                  </div>

                  {documentNotes.length === 0 ? (
                    <p className="px-5 py-6 text-[11px] text-slate-500 text-center">
                      No notes on this document yet. Select a citation above and write one in
                      &ldquo;Note on this passage&rdquo;.
                    </p>
                  ) : (
                    <div className="p-3 space-y-2">
                      {documentNotes.map(({ key, text, citation }) => (
                        <div
                          key={key}
                          onClick={() => citation && setSelectedFinding(citation.id)}
                          className={`p-3 rounded-xl border transition-all ${
                            citation ? 'cursor-pointer' : ''
                          } ${
                            citation && selectedFinding === citation.id
                              ? isDarkMode ? 'bg-[#181924] border-indigo-500/50 ring-1 ring-indigo-500/30' : 'bg-indigo-50/50 border-indigo-300'
                              : isDarkMode ? 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]' : 'bg-slate-50 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            {citation ? (
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 truncate">
                                {batesAssignments[citation.source] || 'Bates pending'} &middot; Line {citation.line}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                Citation no longer exists
                              </span>
                            )}
                            <span className="flex items-center gap-1 shrink-0">
                              {citation?.origin === 'user' && (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-400 inline-flex items-center gap-1">
                                  <UserRound size={9} /> YOURS
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNotes(prev => { const next = { ...prev }; delete next[key]; return next; });
                                  appendAudit('Deleted note', key);
                                }}
                                title="Delete this note"
                                className="p-1 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 size={11} />
                              </button>
                            </span>
                          </div>

                          {/* The passage the note is attached to */}
                          {citation && (
                            <p className="text-[10px] text-slate-500 leading-snug italic mb-1.5 line-clamp-2">
                              on: &ldquo;{citation.finding}&rdquo;
                            </p>
                          )}

                          <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============ STAGE 6: INTERACTIVE REVIEW ============ */}
          {activeStep === 6 && (
            <div className="space-y-4 max-w-3xl mx-auto animate-fadeIn">
              <div className={`border rounded-2xl p-6 sm:p-8 shadow-2xl transition-colors ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 pb-4 border-b border-white/[0.04]">
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest font-mono ${memoEdited ? 'text-indigo-500' : 'text-amber-500'}`}>
                      {memoEdited ? 'Privileged & Confidential' : 'Draft scaffold — not yet reviewed'}
                    </h3>
                    <p className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {memoEdited
                        ? `Attorney work product — ${caseTitle}`
                        : `Machine-assembled from findings — ${caseTitle}`}
                    </p>
                  </div>
                  <button
                    onClick={generateMemo}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all shrink-0 inline-flex items-center gap-1.5 ${
                      isDarkMode ? 'border-white/[0.08] text-slate-200 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <RefreshCw size={12} />
                    Draft from findings
                  </button>
                </div>

                {/* Build the argument from the tags applied in Stage 05 */}
                <div className={`mb-5 p-3.5 rounded-xl border ${
                  isDarkMode ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-2">
                    Insert a section from your tags
                  </p>
                  {tagSections.length === 0 ? (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Tag citations in the Citation Matrix and they appear here as sections you can drop into the
                      draft under a heading of your choosing.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tagSections.map(([tag, count]) => (
                        <button
                          key={tag}
                          onClick={() => {
                            const heading = window.prompt(
                              `Heading for the "${tag}" section (${count} citation${count === 1 ? '' : 's'})`,
                              tag.toUpperCase()
                            );
                            if (heading !== null) insertTagSection(tag, heading.trim());
                          }}
                          className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span className="w-1 h-1 rounded-full bg-amber-400" />{tag}
                          <span className="opacity-70">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <textarea
                  value={memoText}
                  onChange={(e) => { setMemoText(e.target.value); setMemoEdited(true); setIsTyping(true); }}
                  onBlur={() => setIsTyping(false)}
                  rows={14}
                  className={`w-full text-[13px] leading-relaxed p-4 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y font-sans ${
                    isDarkMode ? 'bg-[#151620] border-white/[0.06] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />

                <div className="mt-5 pt-4 border-t border-white/[0.04]">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-2.5">
                    Record citations ({allProducibleCitations.length})
                  </p>
                  {allProducibleCitations.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No findings yet. Work through the Citation Matrix in Stage&nbsp;05 first.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {allProducibleCitations.map((c, i) => (
                        <div key={`${c.source}-${c.id}`} className={`p-2.5 rounded-lg border text-[11px] ${
                          isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <span className="font-mono font-bold text-emerald-500 text-[10px]">
                            {i + 1}. {formatCitation(c, batesAssignments[c.source])}
                          </span>
                          <p className={`mt-1 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            "{c.finding}"
                          </p>
                          {notes[`${c.source}::${c.id}`] && (
                            <p className="mt-1 text-[10px] italic text-indigo-400">
                              Note: {notes[`${c.source}::${c.id}`]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============ STAGE 7: OVERRIDE & REFINE ============ */}
          {activeStep === 7 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className={`border rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl transition-colors ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 font-mono border-b border-white/[0.04] pb-3">
                  Matter Parameters
                </h3>

                <div className="space-y-4">
                  {renderMatterFields(true)}

                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 mt-4 ${
                    isDarkMode ? 'bg-[#16171F] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <span className={`text-xs font-semibold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        Flag Package For Senior Counsel
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Marks the header, the package and the audit log for supervising review.
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !isFlaggedForReview;
                        setIsFlaggedForReview(next);
                        appendAudit(next ? 'Flagged for senior counsel' : 'Cleared senior counsel flag', caseTitle);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none self-end sm:self-auto shrink-0 cursor-pointer ${
                        isFlaggedForReview ? 'bg-indigo-600' : 'bg-slate-400/30'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-md ${isFlaggedForReview ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-5 border-t border-white/[0.04] space-y-3">
                  <div>
                    <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Approval for packaging
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      FRCP 26(g) requires an attorney of record to sign the response. The name you enter is
                      written to the audit log and printed on the brief &mdash; it is the record of who
                      authorized this package, so enter your own.
                    </p>
                  </div>

                  {approval ? (
                    <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 text-[11px] flex items-start gap-2.5">
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                      <span>
                        Approved by <strong>{approval.by}</strong> on {new Date(approval.at).toLocaleString()},
                        covering {approval.producing} document{approval.producing === 1 ? '' : 's'} designated
                        for production. Changing a designation voids this approval.
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={approverDraft}
                      onChange={(e) => setApproverDraft(e.target.value)}
                      placeholder="Approving attorney (e.g. Dana Ruiz, Bar No. 118204)"
                      className={`w-full px-3 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                        isDarkMode ? 'bg-[#151620] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  )}
                </div>

                <div className="pt-5 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between gap-3">
                  <button
                    onClick={handleReanalyze}
                    className={`w-full sm:w-auto px-4 py-2 text-xs font-semibold border rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      isDarkMode ? 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <RefreshCw size={12} /> Re-analyze Documents
                  </button>
                  {approval ? (
                    <button
                      onClick={() => handleStepChange(8)}
                      className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg text-center ${primaryButton}`}
                    >
                      Go to Package
                    </button>
                  ) : (
                    <button
                      disabled={approverDraft.trim().length < 2}
                      onClick={() => {
                        const by = approverDraft.trim();
                        const record = { by, at: new Date().toISOString(), producing: producibleNames.length };
                        setApproval(record);
                        appendAudit('Approved package for service', `${by} — ${caseTitle}`);
                        handleStepChange(8);
                      }}
                      className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg text-center ${
                        approverDraft.trim().length < 2
                          ? 'bg-slate-500/20 text-slate-500 cursor-not-allowed'
                          : primaryButton
                      }`}
                    >
                      Approve and Package
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============ STAGE 8: PACKAGE READY ============ */}
          {activeStep === 8 && (
            <div className="space-y-6 animate-fadeIn">
              {selectedDocs.length === 0 ? (
                <EmptyState
                  icon={Archive}
                  title="NOTHING TO PACKAGE"
                  hint="Select and designate documents in Stage 02 first"
                />
              ) : (
                <>
                  <div className={`p-3.5 rounded-xl border text-[11px] flex items-start gap-2.5 ${
                    approval
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                  }`}>
                    {approval ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                    <span>
                      {approval
                        ? `Approved by ${approval.by} on ${new Date(approval.at).toLocaleString()}. That name is written to the audit log and printed on the brief.`
                        : 'No one has approved this package. Record an approving attorney in Stage 07 before these files are served.'}
                    </span>
                  </div>

                  {incompletePrivilege.length > 0 && (
                    <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-500 text-[11px] flex items-start gap-2.5">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        The privilege log will export with {incompletePrivilege.length} incomplete
                        entr{incompletePrivilege.length === 1 ? 'y' : 'ies'} ({incompletePrivilege.join(', ')}).
                        Add a basis and description in Stage&nbsp;02 before serving it.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {deliverables().map((item) => {
                      const file = item.build();
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.key}
                          className={`border rounded-2xl p-5 flex flex-col justify-between min-h-[176px] shadow-xl transition-all duration-300 ${
                            isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:border-indigo-500/30' : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div>
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${toneClasses[item.tone]}`}>
                              <Icon size={15} />
                            </div>
                            <h4 className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.title}</h4>
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">{item.blurb}</p>
                          </div>
                          <div className="mt-3 space-y-2">
                            <span className="text-[9px] font-mono text-slate-500 font-bold uppercase block">
                              {file.count} entr{file.count === 1 ? 'y' : 'ies'} &middot; {byteLabel(file.content)}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                onClick={() => setPreviewKey(item.key)}
                                className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all inline-flex items-center gap-1.5 ${
                                  isDarkMode ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <Eye size={12} /> Preview
                              </button>
                              <button
                                onClick={() => handleDownload(item)}
                                className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-all inline-flex items-center gap-1.5 shrink-0"
                              >
                                <Download size={12} /> {file.mime === 'text/csv' ? 'CSV' : 'Text'}
                              </button>
                              {file.printable && (
                                <button
                                  onClick={() => handleDownloadPdf(item)}
                                  disabled={pdfPending === item.key}
                                  className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 transition-all inline-flex items-center gap-1.5 shrink-0"
                                >
                                  <Download size={12} /> {pdfPending === item.key ? 'Rendering…' : 'PDF'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Effort estimate, with its assumptions visible */}
                  <div className={`rounded-2xl p-5 border ${
                    isDarkMode ? 'bg-indigo-500/[0.02] border-indigo-500/15' : 'bg-indigo-50 border-indigo-100'
                  }`}>
                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest font-mono">Review Effort Estimate</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      Estimated at 50 pages reviewed per hour, the common planning figure for linear attorney review.
                      Adjust against your own rate before quoting this to a client.
                    </p>
                    <div className="space-y-1.5 mt-4">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="flex items-center gap-1.5 text-slate-400"><Layers size={11} /> PAGES IN SCOPE</span>
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {totalPages}{pagesEstimated ? ' (est.)' : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="flex items-center gap-1.5 text-slate-400"><Clock size={11} /> LINEAR REVIEW TIME</span>
                        <span className="text-emerald-500 font-bold">~{(totalPages / 50).toFixed(1)} hrs</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="flex items-center gap-1.5 text-slate-400"><DollarSign size={11} /> AT $250/HR</span>
                        <span className="text-emerald-500 font-bold">
                          ${((totalPages / 50) * 250).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ STAGE 9: PIPELINE COMPLETE ============ */}
          {activeStep === 9 && (
            <div className="space-y-6 max-w-xl mx-auto text-center py-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl scale-125" />
                <MicroStatusVisualizer active={completionOutstanding.length === 0} isDarkMode={isDarkMode} />
              </div>

              <div className="space-y-2 mt-4">
                <h3 className={`text-md sm:text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {completionOutstanding.length === 0 ? 'Production Complete' : 'Production Not Yet Complete'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {completionOutstanding.length === 0
                    ? `${caseTitle} — every step below is done. ${producibleNames.length} document${producibleNames.length === 1 ? '' : 's'} designated for production, ${withheldCount} withheld as privileged.`
                    : `${completionOutstanding.length} step${completionOutstanding.length === 1 ? '' : 's'} still outstanding. This matter is not ready to serve.`}
                </p>
              </div>

              {/* The checklist. Reaching this screen is not the same as finishing
                  the work, so each item is checked against real matter state and
                  links back to the stage that satisfies it. */}
              <div className={`border rounded-2xl p-2 text-left shadow-2xl ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                {COMPLETION_ITEMS.map(item => {
                  const progress = stageProgress[item.stage];
                  const done = progress.state === 'done';
                  return (
                    <button
                      key={item.stage}
                      onClick={() => handleStepChange(item.stage)}
                      className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all ${
                        isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                      }`}
                    >
                      {done
                        ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                        : <Circle size={15} className="text-amber-500 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <span className={`text-[11px] font-semibold block ${
                          done ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-amber-500'
                        }`}>
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5 truncate">
                          Stage 0{item.stage} &middot; {progress.hint}
                        </span>
                      </div>
                      <ChevronRight size={13} className="text-slate-600 shrink-0 mt-0.5" />
                    </button>
                  );
                })}
              </div>

              <div className={`border rounded-2xl p-5 grid grid-cols-2 gap-4 text-left shadow-2xl ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Record Citations</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">{allProducibleCitations.length}</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Audit Events</span>
                  <span className="text-sm font-bold text-indigo-500 font-mono mt-0.5 block">{auditLog.length}</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Readiness</span>
                  <span className={`text-[11px] font-bold font-mono mt-1 block leading-snug ${
                    integrityReport?.state === 'ready' ? 'text-emerald-400'
                      : integrityReport ? 'text-amber-500' : 'text-slate-500'
                  }`}>
                    {integrityReport ? integrityReport.stateMeta.label : 'CHECK NOT RUN'}
                  </span>
                </div>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Approved By</span>
                  <span className={`text-sm font-bold font-mono mt-0.5 block truncate ${approval ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {approval ? approval.by : 'No one'}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-mono">
                Manifest {manifestSha ? `${manifestSha.slice(0, 16)}…` : 'not generated'}
              </p>

              <button
                onClick={handleReset}
                className={`mt-6 px-4 py-2 text-xs font-semibold border transition-all inline-flex items-center gap-1.5 rounded-xl ${
                  isDarkMode
                    ? 'text-red-400 hover:text-red-300 bg-red-500/[0.06] hover:bg-red-500/[0.12] border-red-500/20'
                    : 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                }`}
              >
                <Trash2 size={13} /> Clear Matter From This Browser
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ADVISOR DRAWER */}
      {copilotOpen && (
        <div className={`w-full lg:w-[330px] shrink-0 border-l flex flex-col fixed top-14 bottom-0 right-0 lg:top-0 z-40 transition-all duration-300 shadow-2xl lg:static lg:translate-x-0 ${
          isDarkMode ? 'bg-[#0E0F14] border-white/[0.04]' : 'bg-white border-slate-200'
        }`}>
          <div className={`p-5 border-b flex justify-between items-center ${isDarkMode ? 'border-white/[0.04]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Sparkles className="text-indigo-500" size={15} />
              <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Advisor</h3>
            </div>
            <button
              onClick={() => setCopilotOpen(false)}
              className={`p-1 rounded-lg border transition-all ${isDarkMode ? 'border-white/[0.05] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-100'}`}
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-500">Guidance for this stage</span>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{ADVISOR_TIPS[activeStep]}</p>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/[0.04]">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                Search ingested documents
              </span>

              <div className="space-y-2 h-44 overflow-y-auto pr-1">
                {messages.length === 0 && (
                  <p className="text-[11px] text-slate-600 leading-relaxed py-2">
                    Type a term to find which ingested documents contain it. This searches the actual text of your
                    documents &mdash; it does not generate answers.
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`p-2.5 rounded-lg text-xs leading-relaxed animate-fadeIn whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-white/[0.03] border border-white/[0.04] ml-6 text-slate-300'
                      : 'bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 mr-6'
                  }`}>
                    <p className="font-semibold text-[10px] uppercase font-mono tracking-widest opacity-60 mb-0.5">
                      {msg.sender === 'user' ? 'you' : 'results'}
                    </p>
                    <p>{msg.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAdvisorSubmit} className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  placeholder="Search document text..."
                  value={userQueryText}
                  onChange={(e) => { setUserQueryText(e.target.value); setIsTyping(true); }}
                  onBlur={() => setIsTyping(false)}
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all min-w-0 ${
                    isDarkMode ? 'bg-[#151620] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shrink-0"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR CONFIRMATION */}
      {confirmClear && (() => {
        const citationTotal = Object.values(citations).reduce((n, list) => n + (list?.length || 0), 0);
        const noteTotal = Object.values(notes).filter(n => n?.trim()).length;
        const losing = [
          [documents.length, 'document'],
          [citationTotal, 'citation'],
          [noteTotal, 'note'],
          [auditLog.length, 'ledger event'],
        ].filter(([n]) => n > 0);
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fadeIn"
            onClick={() => setConfirmClear(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="clear-title"
              aria-describedby="clear-body"
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-lg border p-6 shadow-2xl ${
                isDarkMode ? 'bg-[#111218] border-white/[0.08]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                  <RotateCcw size={16} />
                </div>
                <div className="min-w-0">
                  <h3 id="clear-title" className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Clear this matter?
                  </h3>
                  <div id="clear-body" className="text-xs text-slate-500 mt-2 leading-relaxed space-y-2">
                    <p>
                      Everything about <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{caseTitle}</strong> is
                      removed from this browser
                      {losing.length > 0 && <>: {losing.map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`).join(', ')}</>}.
                    </p>
                    <p>
                      There is no copy anywhere else, so this cannot be undone. If you need the brief, the
                      privilege log or the ledger, export them from Stage&nbsp;08 first.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  autoFocus
                  onClick={() => setConfirmClear(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    isDarkMode ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Keep working
                </button>
                <button
                  onClick={performClear}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Clear matter
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REVIEW LEDGER */}
      {ledgerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setLedgerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-full rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${
              isDarkMode ? 'bg-[#111218] border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <div className={`px-5 py-4 border-b flex justify-between items-start gap-3 shrink-0 ${
              isDarkMode ? 'border-white/[0.06]' : 'border-slate-200'
            }`}>
              <div className="min-w-0">
                <h3 className={`text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-800'
                }`}>
                  <ScrollText size={14} className="text-indigo-500" /> Review Ledger
                </h3>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  Every action taken on this matter, in order, with the time it happened. Entries are appended and
                  never edited or removed &mdash; which is what makes this usable as evidence that the review
                  actually took place.
                </p>
              </div>
              <button
                onClick={() => setLedgerOpen(false)}
                className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                  isDarkMode ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
                aria-label="Close ledger"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-5">
              {auditLog.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-8 leading-relaxed">
                  Nothing has happened on this matter yet.<br />
                  The ledger fills as you work.
                </p>
              ) : (
                <div className="space-y-1">
                  {[...auditLog].reverse().map((entry, i) => (
                    <div
                      key={`${entry.ts}-${i}`}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                        isDarkMode ? 'bg-white/[0.01] border-white/[0.03]' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <span className="text-[9px] font-mono text-slate-500 shrink-0 w-20 pt-0.5">
                        {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`text-[11px] font-semibold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {entry.action}
                        </span>
                        {entry.target && (
                          <span className="text-[10px] text-slate-500 font-mono block truncate">{entry.target}</span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-slate-600 shrink-0 pt-0.5">{entry.actor}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              isDarkMode ? 'border-white/[0.06] bg-white/[0.01]' : 'border-slate-200 bg-slate-50'
            }`}>
              <span className="text-[10px] font-mono text-slate-500">
                {auditLog.length} event{auditLog.length === 1 ? '' : 's'} &middot; append-only
              </span>
              <button
                onClick={() => {
                  const file = buildAuditLog({ caseTitle, auditLog });
                  triggerDownload(file.filename, file.content, file.mime);
                }}
                disabled={auditLog.length === 0}
                className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-all inline-flex items-center gap-1.5"
              >
                <Download size={12} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERABLE PREVIEW */}
      {previewKey && (() => {
        const item = deliverables().find(d => d.key === previewKey);
        if (!item) return null;
        const file = item.build();
        const shown = file.printable || file.content;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm animate-fadeIn"
            onClick={() => setPreviewKey(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-full bg-white rounded-2xl border border-[#D1D5DB] flex flex-col overflow-hidden text-slate-900 shadow-2xl"
            >
              <div className="bg-[#E5E7EB] px-4 py-2.5 border-b border-[#D1D5DB] flex justify-between items-center gap-3 shrink-0">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono font-bold text-slate-700 truncate flex items-center gap-1.5">
                    <FileText size={13} className="shrink-0" /> {item.title}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                    {file.count} entr{file.count === 1 ? 'y' : 'ies'} &middot; {byteLabel(shown)}
                    {file.printable ? ' · print layout' : ' · CSV source'}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewKey(null)}
                  className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-200 transition-all shrink-0"
                  aria-label="Close preview"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 select-text min-h-0">
                <div className="border border-slate-200/60 p-6 bg-white shadow-sm rounded-xl">
                  <pre className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{shown}</pre>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t border-[#D1D5DB] bg-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] font-mono text-slate-500">
                  This is the exact content that will download. Press Esc to close.
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleDownload(item)}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-all inline-flex items-center gap-1.5"
                  >
                    <Download size={12} /> {file.mime === 'text/csv' ? 'CSV' : 'Text'}
                  </button>
                  {file.printable && (
                    <button
                      onClick={() => handleDownloadPdf(item)}
                      disabled={pdfPending === item.key}
                      className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 transition-all inline-flex items-center gap-1.5"
                    >
                      <Download size={12} /> {pdfPending === item.key ? 'Rendering…' : 'PDF'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DOCUMENT READER */}
      {openDocument && (() => {
        const doc = documents.find(d => d.name === openDocument);
        if (!doc) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm animate-fadeIn"
            onClick={() => setOpenDocument(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-full bg-white rounded-2xl border border-[#D1D5DB] flex flex-col overflow-hidden text-slate-900 shadow-2xl"
            >
              <div className="bg-[#E5E7EB] px-4 py-2.5 border-b border-[#D1D5DB] flex justify-between items-center gap-3 shrink-0">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono font-bold text-slate-700 truncate flex items-center gap-1.5">
                    <FileText size={13} className="shrink-0" /> {doc.name}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                    {batesAssignments[doc.name] || 'Bates pending'} &middot; {doc.pages} page{doc.pages === 1 ? '' : 's'}
                    {doc.pagesExact ? '' : ' (est.)'} &middot; {doc.type}
                    {docAnalysis[doc.name] && ` · ${docAnalysis[doc.name].events} dated event${docAnalysis[doc.name].events === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button
                  onClick={() => setOpenDocument(null)}
                  className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-200 transition-all shrink-0"
                  aria-label="Close document"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 select-text min-h-0">
                <div className="border border-slate-200/60 p-6 bg-white shadow-sm rounded-xl">
                  {doc.needsOcr && (
                    <p className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                      This document is a scanned image with no text layer. It needs OCR before it can be searched or cited.
                    </p>
                  )}
                  <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                    {renderWithDates(doc.content || '')}
                  </p>
                </div>
              </div>

              <div className="px-4 py-2 border-t border-[#D1D5DB] bg-[#E5E7EB] text-[10px] font-mono text-slate-500 shrink-0">
                Dates found by the analysis pass are highlighted. Press Esc to close.
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
