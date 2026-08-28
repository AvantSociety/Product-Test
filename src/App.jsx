import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  EyeOff,
  ScrollText,
  FileSpreadsheet,
} from 'lucide-react';

import { readDocument, manifestHash, ACCEPTED_EXTENSIONS } from './lib/documents.js';
import { extractCitations, formatCitation, SIGNAL_LABELS, DATE_PATTERN } from './lib/citations.js';
import { computeIntegrityReport, PROCEED_THRESHOLD } from './lib/integrity.js';
import { saveMatter, loadMatter, clearMatter } from './lib/persistence.js';
import {
  buildPrivilegeLog,
  buildProductionIndex,
  buildBrief,
  buildAuditLog,
  triggerDownload,
  byteLabel,
} from './lib/exports.js';

// ==========================================
// STATUS VISUALIZERS
// ==========================================

const MicroStatusVisualizer = ({ active, isDarkMode }) => (
  <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
    <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-700 ${active ? 'border-indigo-500/30 animate-spin' : 'border-slate-500/10'}`} style={{ animationDuration: '30s' }} />
    <div className="w-20 h-20 rounded-full bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/[0.1] flex items-center justify-center backdrop-blur-md shadow-2xl relative z-10">
      {active ? <Activity className="w-8 h-8 text-indigo-500 animate-pulse" /> : <ShieldCheck className="w-8 h-8 text-slate-500" />}
    </div>
  </div>
);

/** Renders the chronology actually assembled in Stage 04 — not a decorative waveform. */
const TimelineStrip = ({ timeline, isDarkMode }) => {
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

  return (
    <div className={`relative w-full rounded-xl border p-4 overflow-hidden ${isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase font-bold">Case Chronology</span>
          <h4 className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {timeline.length} dated event{timeline.length === 1 ? '' : 's'} across {new Set(timeline.map(e => e.source)).size} document{new Set(timeline.map(e => e.source)).size === 1 ? '' : 's'}
          </h4>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[8px] font-mono text-slate-400 border border-white/[0.06] shrink-0">
          {new Date(min).getFullYear()}&ndash;{new Date(max).getFullYear()}
        </span>
      </div>

      <div className="relative h-14">
        <div className={`absolute left-0 right-0 top-6 h-px ${isDarkMode ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />
        {timeline.map((event, i) => (
          <div
            key={i}
            className="absolute top-3 -translate-x-1/2 group"
            style={{ left: `${((event.time - min) / span) * 96 + 2}%` }}
            title={`${event.label} — ${event.source}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20 transition-transform group-hover:scale-150" />
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[9px] font-mono text-slate-500">
        <span>{new Date(min).toLocaleDateString()}</span>
        <span>{new Date(max).toLocaleDateString()}</span>
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
  { id: 7, title: 'Override & Refine', actor: 'Attorney', icon: Edit3, description: 'Matter parameters & Bates numbering' },
  { id: 8, title: 'Package Ready', actor: 'Deliverables', icon: Archive, description: 'Production deliverables and exports' },
  { id: 9, title: 'Pipeline Complete', actor: 'Archived', icon: Trophy, description: 'Matter summary and reset' },
];

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
  2: 'Designate each document before it moves downstream. Anything withheld as privileged is excluded from analysis and recorded on the privilege log.',
  3: 'Run the integrity check to grade the selected set. The score breaks down into five named checks so you can explain it to a client.',
  4: 'Dates are extracted from each document and assembled into a case chronology. Progress reflects documents actually processed.',
  5: 'Select a finding to highlight the exact passage it was drawn from. Notes you add are attached to that passage in that document.',
  6: 'The brief is drafted from the findings you extracted. Edit it directly — your changes are kept and exported.',
  7: 'Set the Bates prefix and starting number before the integrity check assigns numbers. Flagging for senior counsel marks the package.',
  8: 'Download the production deliverables: the brief, the privilege log, the production index, and the audit log.',
  9: 'Matter summary. Resetting clears every document and annotation from this browser.',
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
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

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
  const [isFlaggedForReview, setIsFlaggedForReview] = useState(false);
  const [memoText, setMemoText] = useState(DEFAULT_MEMO);

  // --- Ingest ---
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadNotices, setUploadNotices] = useState([]);

  // --- Review & designate ---
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSort, setReviewSort] = useState('name');

  // --- Integrity ---
  const [isRunningIntegrityCheck, setIsRunningIntegrityCheck] = useState(false);
  const [integrityReport, setIntegrityReport] = useState(null);
  const [manifestSha, setManifestSha] = useState(null);

  // --- Analysis ---
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState('Waiting to start...');
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [timeline, setTimeline] = useState([]);

  // --- Citation matrix ---
  const [selectedDocSource, setSelectedDocSource] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(0);
  const [activeNoteInput, setActiveNoteInput] = useState('');
  const [copiedCitation, setCopiedCitation] = useState(false);

  // --- Advisor ---
  const [messages, setMessages] = useState([]);
  const [userQueryText, setUserQueryText] = useState('');

  const rightPanelRef = useRef(null);
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
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [documents, citations, privilege, selectedForReview, notes, auditLog,
      caseTitle, batesPrefix, batesStart, batesAssignments, isFlaggedForReview, memoText]);

  // ---------- Derived ----------

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = fileFilter === 'ALL' || doc.type === fileFilter;
    return matchesSearch && matchesType;
  });

  const documentTypes = ['ALL', ...Array.from(new Set(documents.map(d => d.type)))];

  const reviewDocuments = documents
    .filter(doc => doc.name.toLowerCase().includes(reviewSearch.toLowerCase()))
    .sort((a, b) => {
      if (reviewSort === 'pages') return b.pages - a.pages;
      if (reviewSort === 'type') return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });

  const dispositionOf = (name) => privilege[name]?.status || 'produce';

  // Withheld documents never reach analysis, citations, or the brief.
  const producibleNames = selectedForReview.filter(name => dispositionOf(name) !== 'withhold');
  const selectedDocs = selectedForReview
    .map(name => documents.find(d => d.name === name))
    .filter(Boolean);
  const producibleDocs = producibleNames
    .map(name => documents.find(d => d.name === name))
    .filter(Boolean);

  const totalPages = selectedDocs.reduce((sum, d) => sum + (d.pages || 0), 0);
  const pagesEstimated = selectedDocs.some(d => !d.pagesExact);
  const withheldCount = selectedForReview.filter(n => dispositionOf(n) === 'withhold').length;

  // A privilege log entry without a basis and description is incomplete under
  // FRCP 26(b)(5) and invites a motion to compel.
  const incompletePrivilege = selectedForReview.filter(name => {
    if (dispositionOf(name) === 'produce') return false;
    const record = privilege[name] || {};
    return !record.basis || !record.description?.trim();
  });

  const activeCitations = selectedDocSource ? (citations[selectedDocSource] || []) : [];
  const activeCitation = activeCitations[selectedFinding] || null;
  const noteKey = selectedDocSource ? `${selectedDocSource}::${selectedFinding}` : null;

  const allProducibleCitations = producibleDocs.flatMap(d => citations[d.name] || []);

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
    setSelectedFinding(0);
  }, [selectedDocSource]);

  useEffect(() => {
    setActiveNoteInput(noteKey ? (notes[noteKey] || '') : '');
  }, [noteKey, notes]);

  // Default the matrix to the first producible document that yielded findings.
  useEffect(() => {
    if (selectedDocSource && producibleNames.includes(selectedDocSource)) return;
    const firstWithFindings = producibleNames.find(n => (citations[n] || []).length > 0);
    setSelectedDocSource(firstWithFindings || producibleNames[0] || null);
  }, [producibleNames.join('|'), citations]);

  // A change to the selection or its designations invalidates the check.
  useEffect(() => {
    setIntegrityReport(null);
    setManifestSha(null);
    setIsRunningIntegrityCheck(false);
  }, [selectedForReview.join('|'), JSON.stringify(privilege)]);

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
    setAnalysisPhase('Extracting dates...');

    const events = [];
    let index = 0;

    const step = () => {
      if (cancelled) return;
      const doc = producibleDocs[index];
      if (doc) {
        const re = new RegExp(DATE_PATTERN.source, 'gi');
        let match;
        while ((match = re.exec(doc.content || '')) !== null) {
          const time = Date.parse(match[0]);
          if (!Number.isNaN(time)) events.push({ time, label: match[0], source: doc.name });
        }
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

    const report = computeIntegrityReport(selectedDocs, citations);
    const sha = await manifestHash(selectedDocs.map(d => d.hash));

    // Assign immutable sequential Bates numbers to anything not already stamped.
    setBatesAssignments(prev => {
      const next = { ...prev };
      let counter = batesStart + Object.keys(prev).length;
      selectedDocs.forEach(doc => {
        if (!next[doc.name]) {
          next[doc.name] = `${batesPrefix}-${String(counter).padStart(6, '0')}`;
          counter += 1;
        }
      });
      return next;
    });

    setManifestSha(sha);
    setIntegrityReport(report);
    setIsRunningIntegrityCheck(false);
    appendAudit(`Ran integrity check — scored ${report.score}/100`, `${selectedDocs.length} documents`);
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
        return `${doc.name} (${batesAssignments[doc.name] || 'Bates not assigned'}) contributes ${found.length} record citation${found.length === 1 ? '' : 's'}. The most significant reads: "${lead.excerpt}"`;
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
    appendAudit('Generated strategic brief draft', `${allProducibleCitations.length} citations`);
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
    return [
      {
        key: 'brief',
        icon: FileText,
        tone: 'emerald',
        title: 'Strategic Brief',
        blurb: 'The evaluation text with every record citation traced to its source document and Bates number.',
        build: () => buildBrief({ caseTitle, memoText, citations: allProducibleCitations, bates: batesAssignments, notes }),
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
        build: () => buildProductionIndex(args),
      },
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

  const handleDownload = (item) => {
    const file = item.build();
    triggerDownload(file.filename, file.content, file.mime);
    appendAudit('Downloaded deliverable', file.filename);
  };

  const handleReset = async () => {
    if (!window.confirm('Clear every document, annotation and result from this browser? This cannot be undone.')) return;
    await clearMatter();
    setDocuments([]); setCitations({}); setPrivilege({}); setSelectedForReview([]);
    setNotes({}); setAuditLog([]); setBatesAssignments({}); setIntegrityReport(null);
    setManifestSha(null); setTimeline([]); setAnalysisComplete(false); setAnalysisProgress(0);
    setSelectedDocSource(null); setSelectedFinding(0); setMemoText(DEFAULT_MEMO);
    setIsFlaggedForReview(false); setCaseTitle('In Re Jones Litigation');
    setBatesPrefix('VLM'); setBatesStart(1); setUploadNotices([]); setMessages([]);
    handleStepChange(0);
  };

  // ---------- Shared bits ----------

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
    <div className={`flex h-screen w-full overflow-hidden font-sans transition-colors duration-500 ${
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
          className={`p-2 rounded-xl border ${isDarkMode ? 'bg-white/[0.04] border-white/[0.06] text-amber-400' : 'bg-slate-100 border-slate-200 text-indigo-600'}`}
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* LEFT SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 w-[310px] sm:w-[340px] h-full border-r flex flex-col z-40 transition-all duration-300 ease-out lg:static lg:translate-x-0 shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isDarkMode ? 'bg-[#0E0F14] border-r-white/[0.04]' : 'bg-white border-slate-200'}
      `}>
        <div className={`p-6 border-b flex flex-col gap-1.5 transition-colors ${
          isDarkMode ? 'bg-[#0A0B0E] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
              <h1 className={`text-[10px] font-bold tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Discovery Framework</h1>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`hidden lg:flex p-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 ${
                isDarkMode ? 'bg-white/[0.04] border-white/[0.06] text-amber-400' : 'bg-slate-100 border-slate-200 text-indigo-600'
              }`}
            >
              {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
          <p className={`text-xs font-bold tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {caseTitle}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {STEPS.map((step) => {
            const isActive = activeStep === step.id;
            const styleToken = ACTOR_STYLES[step.actor] || { border: 'border-white/10', text: 'text-slate-400', bg: 'bg-white/5' };
            const StepIcon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => handleStepChange(step.id)}
                className={`w-full text-left p-3 rounded-xl flex gap-3.5 items-center transition-all duration-200 relative border cursor-pointer ${
                  isActive
                    ? isDarkMode
                      ? 'bg-gradient-to-r from-white/[0.05] to-white/[0.01] border-white/[0.08] shadow-lg translate-x-1 text-white'
                      : 'bg-gradient-to-r from-indigo-50/70 to-transparent border-indigo-100 shadow-md translate-x-1 text-indigo-950'
                    : 'bg-transparent border-transparent hover:bg-white/[0.02] text-slate-400'
                }`}
              >
                {isActive && (
                  <div className="absolute left-1.5 top-3.5 bottom-3.5 w-1 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                  isActive
                    ? isDarkMode ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-indigo-100 border-indigo-300 text-indigo-600'
                    : isDarkMode ? 'bg-[#14151C] border-white/[0.04] text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}>
                  <StepIcon size={14} />
                </div>
                <div className="flex-1 min-w-0">
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
                </div>
              </button>
            );
          })}
        </div>

        <div className={`px-5 py-3 border-t flex items-center gap-2 text-[9px] font-mono ${
          isDarkMode ? 'bg-[#090A0F] border-white/[0.04] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <Keyboard size={12} className="shrink-0" />
          <span>&#8984;&larr; / &#8984;&rarr; to move between stages</span>
        </div>

        <div className={`p-5 border-t text-[10px] flex justify-between items-center transition-colors ${
          isDarkMode ? 'bg-[#090A0F] border-white/[0.04] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-semibold">Stored in this browser</span>
          </div>
          <span className="font-mono text-slate-600">v5.0.0</span>
        </div>
      </div>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-30 lg:hidden" />
      )}

      {/* CENTRAL WORKSPACE */}
      <div ref={rightPanelRef} className="flex-1 h-full overflow-y-auto flex flex-col transition-all duration-300 pt-14 lg:pt-0">

        {/* TELEMETRY BAR */}
        <div className={`w-full px-6 sm:px-12 py-3 border-b flex items-center justify-between transition-colors ${
          isDarkMode ? 'bg-[#0E0F14] border-white/[0.04]' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-6 overflow-x-auto py-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">INGESTED:</span>
              <span className="text-[10px] font-mono text-indigo-400 font-bold">
                {documents.length} DOC{documents.length === 1 ? '' : 'S'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">SELECTED:</span>
              <span className="text-[10px] font-mono text-slate-300 font-bold">{selectedForReview.length}</span>
            </div>
            {withheldCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">WITHHELD:</span>
                <span className="text-[10px] font-mono text-amber-500 font-bold">{withheldCount}</span>
              </div>
            )}
            {isFlaggedForReview && (
              <span className="text-[10px] font-mono font-bold text-amber-500 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded shrink-0">
                FLAGGED FOR SENIOR COUNSEL
              </span>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span>MANIFEST:</span>
            <span className="text-slate-300 font-bold">
              {manifestSha ? `${manifestSha.slice(0, 12)}…` : 'not computed'}
            </span>
          </div>
        </div>

        {/* HEADER CONSOLE */}
        <div className={`w-full border-b px-6 sm:px-12 py-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between shrink-0 transition-colors duration-500 ${
          isDarkMode ? 'bg-[#0E0F14] border-white/[0.04]' : 'bg-white border-slate-200'
        }`}>
          <div>
            <div className={`flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase font-bold ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <span>DISCOVERY FRAMEWORK</span>
              <span>/</span>
              <span className="text-indigo-500 font-semibold">{STEPS[activeStep].title}</span>
            </div>
            <h2 className={`text-md sm:text-xl font-bold tracking-tight mt-1 leading-snug transition-colors ${
              isDarkMode ? 'text-white' : 'text-slate-800'
            }`}>
              {STEPS[activeStep].description}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
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
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                Next <ArrowRight size={13} />
              </button>
            ) : (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Check size={13} className="stroke-[3]" /> Complete
              </span>
            )}
          </div>
        </div>

        {/* STAGE ROUTER */}
        <div className="flex-1 p-6 sm:p-12 max-w-5xl w-full mx-auto animate-fadeIn">

          {/* ============ STAGE 0: ORIENTATION ============ */}
          {activeStep === 0 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="max-w-2xl">
                <span className="text-xs font-mono uppercase tracking-widest text-indigo-500 font-bold">Orientation</span>
                <h3 className="serif-title text-2xl sm:text-4xl font-bold tracking-tight mt-2 leading-tight">
                  Welcome to the Discovery Framework
                </h3>
                <p className="text-sm text-slate-400 mt-4 leading-relaxed font-light">
                  A document analysis workspace for small litigation teams: ingest a client's documents, designate them
                  for production or privilege, verify their integrity, and draft a brief whose every citation traces
                  back to a specific passage in a specific document.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {[
                  { n: 'STAGE 01', t: 'Ingest', d: 'Upload PDF, Word, email or text files from your computer. Each is hashed, typed and indexed on arrival.' },
                  { n: 'STAGE 02', t: 'Designate', d: 'Mark each document produce, redact or withhold. Withheld documents are excluded downstream and logged.' },
                  { n: 'STAGE 05', t: 'Cite', d: 'Every finding highlights the exact passage it came from, with a Bates number and line reference.' },
                ].map(card => (
                  <div key={card.n} className={`p-5 rounded-2xl border transition-all hover:-translate-y-1 ${panelClass}`}>
                    <span className="text-indigo-400 font-mono text-xs font-bold block">{card.n}</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mt-2">{card.t}</h4>
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
                  ? 'border-indigo-500/50 bg-indigo-500/[0.02] shadow-[0_0_35px_rgba(99,102,241,0.12)]'
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-fadeIn">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.name}
                      className={`border rounded-xl p-3 flex items-start justify-between gap-2 transition-all group ${
                        isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:border-white/[0.08]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
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
                  Ingestion queue: <span className="font-bold text-slate-300">
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
                      <option value="pages">Sort: Pages</option>
                      <option value="type">Sort: Type</option>
                    </select>
                    <button
                      onClick={() => setSelectedForReview(
                        selectedForReview.length === documents.length ? [] : documents.map(d => d.name)
                      )}
                      className="text-[11px] font-mono font-bold text-indigo-400 hover:text-indigo-300 px-2 shrink-0"
                    >
                      {selectedForReview.length === documents.length ? 'Deselect All' : 'Select All'}
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
                      {integrityReport ? 'Manifest Verified' : 'Manifest Pending Verification'}
                    </h3>
                  </div>
                  <span className={`text-[9px] font-mono border px-2.5 py-0.5 rounded font-bold shrink-0 ${
                    integrityReport ? toneClasses[integrityReport.band.tone] : toneClasses.slate
                  }`}>
                    {integrityReport ? integrityReport.band.label : 'NOT YET RUN'}
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
                          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                            <div className={`text-5xl font-black font-mono leading-none shrink-0 ${
                              integrityReport.band.tone === 'emerald' ? 'text-emerald-500' : integrityReport.band.tone === 'amber' ? 'text-amber-500' : 'text-red-400'
                            }`}>
                              {integrityReport.score}<span className="text-lg text-slate-500">/100</span>
                            </div>
                            <div className="text-center sm:text-left">
                              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-1">What this grade means</p>
                              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {integrityReport.band.verdict}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold">
                              How the score was calculated
                            </p>
                            {integrityReport.checks.map((check) => {
                              const ratio = check.points / check.max;
                              const tone = ratio === 1 ? 'emerald' : ratio >= 0.5 ? 'amber' : 'red';
                              const barColor = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-400';
                              const textColor = tone === 'emerald' ? 'text-emerald-500' : tone === 'amber' ? 'text-amber-500' : 'text-red-400';
                              return (
                                <div key={check.key} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${barColor}`} />
                                      <span className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                        {check.label}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold shrink-0 ${textColor}`}>
                                      {check.points}/{check.max} pts
                                    </span>
                                  </div>
                                  <div className={`w-full h-1 rounded-full mt-2 overflow-hidden ${isDarkMode ? 'bg-white/[0.05]' : 'bg-slate-200'}`}>
                                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${ratio * 100}%` }} />
                                  </div>
                                  <p className={`text-[11px] mt-2 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {check.detail}
                                  </p>
                                  <p className="text-[10px] mt-1.5 leading-relaxed text-slate-500">
                                    <span className="font-bold uppercase tracking-wide">Why it matters: </span>{check.why}
                                  </p>
                                  {check.offenders.length > 0 && (
                                    <p className="text-[10px] mt-1.5 font-mono text-amber-500/90 break-words">
                                      Affected: {check.offenders.join(', ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-center">
                            <button
                              onClick={handleRunIntegrityCheck}
                              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 ${
                                isDarkMode ? 'bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08]' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                              }`}
                            >
                              <RefreshCw size={13} />
                              Re-run Integrity Check
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
                            Run Integrity Check
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
                  integrityReport.score >= PROCEED_THRESHOLD ? (
                    <button
                      onClick={() => handleStepChange(4)}
                      className="mt-4 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      Proceed to Deep Analysis
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <button
                        disabled
                        className="px-4 py-2 text-xs font-bold rounded-xl inline-flex items-center gap-2 bg-slate-500/10 text-slate-500 cursor-not-allowed"
                      >
                        Proceed to Deep Analysis
                        <ChevronRight size={14} />
                      </button>
                      <p className="text-[11px] text-amber-500 max-w-md mx-auto leading-relaxed">
                        A score of {PROCEED_THRESHOLD} or above is required to proceed. This set scored{' '}
                        {integrityReport.score}. Fix the documents flagged under{' '}
                        {integrityReport.checks
                          .filter(c => c.points < c.max)
                          .map(c => c.label)
                          .join(', ') || 'the checks above'}, then re-run the check.
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ============ STAGE 4: DEEP ANALYSIS ============ */}
          {activeStep === 4 && (
            <div className="space-y-6 max-w-xl mx-auto py-8 animate-fadeIn">
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

              <TimelineStrip timeline={timeline} isDarkMode={isDarkMode} />

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
                          </div>
                          <p className={`text-[11px] leading-relaxed font-sans font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            {item.finding}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.signals.map(sig => (
                              <span key={sig} className="text-[8px] font-mono px-1.5 py-0.5 rounded border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                                {SIGNAL_LABELS[sig]}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Annotation */}
                    <div className={`p-4 rounded-xl border ${panelClass}`}>
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

                  {/* Viewer */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-[#D1D5DB] flex flex-col overflow-hidden text-slate-900 shadow-2xl min-h-[300px]">
                    <div className="bg-[#E5E7EB] px-4 py-2 border-b border-[#D1D5DB] flex justify-between items-center text-[10px] text-slate-500 font-mono font-bold gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <FileText size={13} className="text-slate-500 shrink-0" />
                        <span className="truncate">{selectedDocSource || 'No document'}</span>
                      </span>
                      <span className="shrink-0">
                        {batesAssignments[selectedDocSource] || 'Bates pending'}
                      </span>
                    </div>

                    <div className="flex-1 p-6 font-serif text-[12.5px] leading-relaxed overflow-y-auto bg-[#F9FAFB] select-text">
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
                            return <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{content}</p>;
                          }
                          // Anchored by stored offset, so repeated phrases highlight the right one.
                          const start = activeCitation.offset;
                          const end = start + activeCitation.excerpt.length;
                          return (
                            <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                              {content.slice(0, start)}
                              <mark className="bg-amber-100 font-bold px-0.5 rounded border-b-2 border-amber-500 text-slate-950 shadow-sm">
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
                  </div>
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
                    <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 font-mono">Privileged &amp; Confidential</h3>
                    <p className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Attorney work product &mdash; {caseTitle}
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

                <textarea
                  value={memoText}
                  onChange={(e) => { setMemoText(e.target.value); setIsTyping(true); }}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">Bates Prefix</label>
                      <input
                        type="text"
                        value={batesPrefix}
                        onChange={(e) => setBatesPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        disabled={Object.keys(batesAssignments).length > 0}
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
                        disabled={Object.keys(batesAssignments).length > 0}
                        className={`w-full border rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                          isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  {Object.keys(batesAssignments).length > 0 && (
                    <p className="text-[10px] text-amber-500 leading-relaxed">
                      {Object.keys(batesAssignments).length} document{Object.keys(batesAssignments).length === 1 ? ' has' : 's have'} already
                      been stamped. Bates numbers are immutable once assigned &mdash; clear the matter in Stage&nbsp;09 to renumber.
                    </p>
                  )}

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

                <div className="pt-5 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between gap-3">
                  <button
                    onClick={() => {
                      // Genuinely re-extract from current document contents.
                      const rebuilt = {};
                      documents.forEach(d => { rebuilt[d.name] = extractCitations(d.content, d.name); });
                      setCitations(rebuilt);
                      appendAudit('Re-extracted citations', `${documents.length} documents`);
                      handleStepChange(4);
                    }}
                    className={`w-full sm:w-auto px-4 py-2 text-xs font-semibold border rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      isDarkMode ? 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <RefreshCw size={12} /> Re-analyze Documents
                  </button>
                  <button
                    onClick={() => { appendAudit('Approved package', caseTitle); handleStepChange(8); }}
                    className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg text-center ${primaryButton}`}
                  >
                    Approve and Package
                  </button>
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
                          <div className="flex items-center justify-between gap-2 mt-3">
                            <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                              {file.count} entr{file.count === 1 ? 'y' : 'ies'} &middot; {byteLabel(file.content)}
                            </span>
                            <button
                              onClick={() => handleDownload(item)}
                              className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-all inline-flex items-center gap-1.5 shrink-0"
                            >
                              <Download size={12} /> Download
                            </button>
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
                <MicroStatusVisualizer active={!!integrityReport} isDarkMode={isDarkMode} />
              </div>

              <div className="space-y-2 mt-4">
                <h3 className={`text-md sm:text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Matter Summary
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {caseTitle} &mdash; {documents.length} document{documents.length === 1 ? '' : 's'} ingested,{' '}
                  {producibleNames.length} designated for production, {withheldCount} withheld as privileged.
                </p>
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
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Integrity Grade</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                    {integrityReport ? `${integrityReport.score}/100` : 'Not run'}
                  </span>
                </div>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Manifest</span>
                  <span className="text-sm font-bold text-indigo-500 font-mono mt-0.5 block truncate">
                    {manifestSha ? `${manifestSha.slice(0, 10)}…` : '—'}
                  </span>
                </div>
              </div>

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
        <div className={`w-full lg:w-[330px] shrink-0 border-l flex flex-col fixed inset-y-0 right-0 z-40 transition-all duration-300 shadow-2xl lg:static lg:translate-x-0 ${
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

    </div>
  );
}
