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
  File,
  ArrowRight,
  RefreshCw,
  Check,
  Layers,
  ExternalLink,
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
  FileSpreadsheet
} from 'lucide-react';


// ==========================================
// PREMIUM APPLE-STYLE STATUS VISUALIZERS
// ==========================================

const MicroStatusVisualizer = ({ active, isDarkMode }) => (
  <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
    <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-700 ${active ? 'border-indigo-500/30 animate-spin' : 'border-slate-500/10'}`} style={{ animationDuration: '30s' }} />
    <div className="w-20 h-20 rounded-full bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/[0.1] flex items-center justify-center backdrop-blur-md shadow-2xl relative z-10">
      {active ? <Activity className="w-8 h-8 text-indigo-500 animate-pulse" /> : <ShieldCheck className="w-8 h-8 text-slate-500" />}
    </div>
  </div>
);

const PremiumCircuitMap = () => (
  <div className="relative w-full h-36 bg-[#111218] rounded-xl border border-white/[0.04] p-4 overflow-hidden flex flex-col justify-between">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:10px_20px]" />
    <div className="relative z-10 flex justify-between items-start">
      <div>
        <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase font-bold">Spectral Waveform</span>
        <h4 className="text-[11px] font-bold text-white mt-0.5">Chronology Signal Indexer</h4>
      </div>
      <span className="px-1.5 py-0.2 rounded bg-white/[0.05] text-[8px] font-mono text-slate-300 border border-white/[0.06]">Signal Lock</span>
    </div>
    <div className="relative z-10 flex gap-1 items-end h-12">
      {Array.from({ length: 24 }).map((_, idx) => (
        <div
          key={idx}
          className="flex-1 rounded-t bg-gradient-to-t from-indigo-600 via-purple-500 to-indigo-400"
          style={{
            height: `${Math.floor(Math.random() * 35) + 5}px`,
            animation: `pulseHeight 1.5s ease-in-out infinite alternate`,
            animationDelay: `${idx * 0.05}s`
          }}
        />
      ))}
    </div>
  </div>
);

// ==========================================
// STEPS & COMPILATION DATA DEFINITIONS
// ==========================================

const STEPS = [
  { id: 0, title: 'Orientation Hub', actor: 'System', icon: Sparkles, description: 'Quick framework orientation and landing' },
  { id: 1, title: 'Discovery Ingest', actor: 'Source', icon: FolderDown, description: 'Raw, unstructured client assets' },
  { id: 2, title: 'Secure Transfer', actor: 'Attorney', icon: UploadCloud, description: 'Secure folder upload and file parsing' },
  { id: 3, title: 'Integrity Check', actor: 'System', icon: CheckCircle2, description: 'Bates sequencing & manifest validation' },
  { id: 4, title: 'Deep Analysis', actor: 'Processor', icon: Cpu, description: 'Cross-document chronological matching' },
  { id: 5, title: 'Citation Matrix', actor: 'Trust Layer', icon: ShieldCheck, description: 'Multi-tenant verification matches' },
  { id: 6, title: 'Interactive Review', actor: 'Attorney', icon: FileText, description: 'Typographic trial brief interface' },
  { id: 7, title: 'Override & Refine', actor: 'Attorney', icon: Edit3, description: 'Parameter updates & audit triggers' },
  { id: 8, title: 'Package Ready', actor: 'Deliverables', icon: Archive, description: 'Production-ready legal packages' },
  { id: 9, title: 'Pipeline Complete', actor: 'Archived', icon: Trophy, description: 'Verified court package locked' },
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
  0: "Welcome to the Orientation Hub. Use this section to review the layout zones before proceeding with discovery.",
  1: "You are reviewing unindexed, unstructured data. Use the live filtering tool below to locate potential anomalies.",
  2: "Drag and drop actual client documentation files (.txt, .csv, .json) to index and view them inside downstream matrix viewports.",
  3: "Integrity validation checks complete. Cryptographic manifests are certified and ready for processing.",
  4: "Automated chronology analysis runs inside sandboxed enclaves. Verify spectral signals as indexing continues.",
  5: "Select individual findings from the left directory to pinpoint highlighted citation areas on the interactive paper template.",
  6: "Draft legal briefs with automatic citation links. Click highlighted regions to show specific metadata properties.",
  7: "Override global case parameters to train indexing models. Flag custom scopes for secondary partner review.",
  8: "All deliverables are packaged into secure production directory models. Keynote and PDF files are ready.",
  9: "Framework pipeline discharged and finalized. Reset simulation parameters to test with alternative data sets."
};


export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Discovery / Upload File States
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('ALL');
  const [customUploadedFiles, setCustomUploadedFiles] = useState([]);

  // Custom Drag / Ingestion Progress
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Analysis Pipeline States
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState('Initializing pipeline...');

  // Per-file citation findings generated from uploaded content
  const [uploadedFileCitations, setUploadedFileCitations] = useState({});

  // Interactive Citations
  const [selectedFinding, setSelectedFinding] = useState(0);
  const [selectedDocSource, setSelectedDocSource] = useState('DEFAULT_VLM');
  const [customNotes, setCustomNotes] = useState({
    0: "Seattle travel matches expense schedules verified in audit step.",
    1: "Unscheduled outgoing transfer intersects precisely with target wire timeline.",
    2: "Executive deposition contradicts underlying logs. Add to deposition review sheets."
  });
  const [activeNoteInput, setActiveNoteInput] = useState('');

  // Active Override & Strategic Review States (Fixed: added activeMemoMetadata state)
  const [activeMemoMetadata, setActiveMemoMetadata] = useState(null);
  const [caseTitle, setCaseTitle] = useState('In Re Jones Litigation');
  const [batesOverride, setBatesOverride] = useState('VLM-001-VLM-015');
  const [isFlaggedForReview, setIsFlaggedForReview] = useState(false);

  // Custom User Queries in Copilot
  const [messages, setMessages] = useState([]);
  const [userQueryText, setUserQueryText] = useState('');

  const rightPanelRef = useRef(null);


  // Step Switch Handler
  const handleStepChange = useCallback((stepId) => {
    setActiveStep(stepId);
    setSidebarOpen(false);
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTop = 0;
    }
  }, []);

  // Stage 1 Original Unstructured Documents Data Setup
  const rawFilesData = [];

  const filteredRawFiles = rawFilesData.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = fileFilter === 'ALL' || file.type === fileFilter;
    return matchesSearch && matchesType;
  });

  // Hotkey navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTyping) return;
      if (e.metaKey && e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveStep((prev) => Math.min(prev + 1, 9));
      } else if (e.metaKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveStep((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTyping]);

  // AI Pipeline Progress simulation
  useEffect(() => {
    let interval;
    if (activeStep === 4) {
      setAnalysisProgress(0);
      interval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          const next = prev + 2;
          if (next < 30) setAnalysisPhase('Re-indexing raw structural schemas...');
          else if (next < 65) setAnalysisPhase('Extracting timeline chronology anchors...');
          else if (next < 90) setAnalysisPhase('Compiling confidence interval matching algorithms...');
          else setAnalysisPhase('Completing secure bundle locks...');
          return next;
        });
      }, 60);
    } else {
      setAnalysisProgress(0);
    }
    return () => clearInterval(interval);
  }, [activeStep]);

  // Interactive Upload Parsing Engine
  // Extract the top 2–3 citation-worthy sentences from raw text
  const parseCitationsFromText = (content, fileName) => {
    const sentences = content
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 40);

    const scored = sentences.map((s, i) => {
      let score = 0;
      if (/\d{4}/.test(s)) score += 2;
      if (/\$[\d,]+/.test(s)) score += 3;
      if (/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/.test(s)) score += 2;
      if (/\b(wire|transfer|account|unauthorized|denied|confirmed|executed|breach|alleged|pursuant|agreement|contract|deposition|payment|receipt|authorization|liability)\b/i.test(s)) score += 2;
      score += Math.min(s.length / 80, 2);
      return { sentence: s, score, index: i };
    });

    const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 3);
    top.sort((a, b) => a.index - b.index);

    const prefix = fileName.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 8);
    return top.map((item, i) => ({
      id: i,
      bates: `${prefix}-${String(i + 1).padStart(3, '0')}`,
      finding: item.sentence.length > 130 ? item.sentence.slice(0, 130) + '…' : item.sentence,
      excerpt: item.sentence,
      confidence: `${Math.min(97, 74 + Math.round(item.score) * 3)}%`,
    }));
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target.result;
              const fileObj = {
                name: file.name,
                size: `${(file.size / 1024).toFixed(1)} KB`,
                type: file.name.endsWith('.csv') ? 'LEDGER' : file.name.endsWith('.json') ? 'SYSTEM' : 'TRANSCRIPT',
                content: text,
                isFlagged: false
              };
              setCustomUploadedFiles(prevFiles => [...prevFiles, fileObj]);
              const citations = parseCitationsFromText(text, file.name);
              setUploadedFileCitations(prev => ({ ...prev, [file.name]: citations }));
            };
            reader.readAsText(file);
          });
          setTimeout(() => {
            setIsUploading(false);
            handleStepChange(3);
          }, 600);
          return 100;
        }
        return prev + 10;
      });
    }, 50);
  };

  const handleClaudeQuerySubmit = (e) => {
    e.preventDefault();
    if (!userQueryText.trim()) return;
    const userMsg = { sender: 'user', text: userQueryText };
    setMessages(prev => [...prev, userMsg]);
    setUserQueryText('');

    setTimeout(() => {
      const assistantMsg = {
        sender: 'assistant',
        text: `Analysis complete for step "${STEPS[activeStep].title}". Custom model verifies no indexing discrepancies outside current parameters.`
      };
      setMessages(prev => [...prev, assistantMsg]);
    }, 1000);
  };

  const handleUpdateNote = () => {
    if (!activeNoteInput.trim()) return;
    setCustomNotes(prev => ({
      ...prev,
      [selectedFinding]: activeNoteInput
    }));
    setActiveNoteInput('');
  };


  return (
    <div className={`w-full h-screen flex overflow-hidden selection:bg-indigo-500/20 selection:text-indigo-400 transition-colors duration-500 ${
      isDarkMode ? 'bg-[#090A0F] text-[#F3F4F6]' : 'bg-[#F9FAFC] text-slate-800'
    }`} style={{ fontFamily: '"Open Sans", sans-serif' }}>

      {/* GOOGLE FONTS INJECT */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Open+Sans:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

        .serif-title {
          font-family: 'Playfair Display', serif;
        }
        .mono-font {
          font-family: 'JetBrains Mono', monospace;
        }
        @keyframes pulseHeight {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
        .apple-shadow {
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.05);
        }
      `}</style>

      {/* MOBILE APPLICATION HEADER */}
      <div className={`lg:hidden w-full h-14 border-b flex items-center justify-between px-4 fixed top-0 left-0 z-30 transition-colors duration-500 ${
        isDarkMode ? 'bg-[#111219]/90 border-white/[0.04] backdrop-blur-md' : 'bg-white/95 border-slate-200'
      }`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`p-2 rounded-xl border transition-all active:scale-95 ${
            isDarkMode ? 'text-slate-300 bg-white/[0.04] border-white/[0.06]' : 'text-slate-600 bg-slate-100 border-slate-200'
          }`}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-slate-400">
          Stage 0{activeStep}
        </span>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-2 rounded-full border transition-all ${
            isDarkMode ? 'bg-white/[0.04] border-white/[0.06] text-amber-400' : 'bg-slate-100 border-slate-200 text-indigo-600'
          }`}
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* LEFT SIDEBAR PANEL */}
      <div className={`
        fixed inset-y-0 left-0 w-[310px] sm:w-[340px] h-full border-r flex flex-col z-40 transition-all duration-300 ease-out lg:static lg:translate-x-0 shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isDarkMode ? 'bg-[#0E0F14] border-r-white/[0.04]' : 'bg-white border-slate-200'}
      `}>
        {/* Workspace Title */}
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
            Workspace Architect v4
          </p>
        </div>

        {/* Stepper Steps List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {STEPS.map((step) => {
            const isActive = activeStep === step.id;
            const styleToken = ACTOR_STYLES[step.actor] || { border: 'border-white/10', text: 'text-slate-400', bg: 'bg-white/5' };
            const StepIcon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => handleStepChange(step.id)}
                className={`w-full text-left p-3 rounded-xl flex gap-3.5 items-center transition-all duration-200 relative border ${
                  isActive
                    ? isDarkMode
                      ? 'bg-gradient-to-r from-white/[0.05] to-white/[0.01] border-white/[0.08] shadow-lg translate-x-1 text-white'
                      : 'bg-gradient-to-r from-indigo-50/70 to-transparent border-indigo-100 shadow-md translate-x-1 text-indigo-950'
                    : 'bg-transparent border-transparent hover:bg-white/[0.02] text-slate-400'
                }`}
                style={{ cursor: 'pointer' }}
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

        {/* Telemetry diagnostics */}
        <div className={`p-5 border-t text-[10px] flex justify-between items-center transition-colors ${
          isDarkMode ? 'bg-[#090A0F] border-white/[0.04] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-semibold">Local Enclave Online</span>
          </div>
          <span className="font-mono text-slate-600">v4.12.0</span>
        </div>
      </div>

      {/* MOBILE SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-30 lg:hidden" />
      )}

      {/* CENTRAL AREA: LIVE WORKSPACE SIMULATOR */}
      <div ref={rightPanelRef} className="flex-1 h-full overflow-y-auto flex flex-col transition-all duration-300 pt-14 lg:pt-0">

        {/* TOP DIAGNOSTICS & TELEMETRY STATUS BAR */}
        <div className={`w-full px-6 sm:px-12 py-3 border-b flex items-center justify-between transition-colors ${
          isDarkMode ? 'bg-[#0E0F14] border-white/[0.04]' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-6 overflow-x-auto py-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">HARDWARE CORE STATUS: SECURED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">MEMORY INDEX:</span>
              <span className="text-[10px] font-mono text-indigo-400 font-bold">{15 + customUploadedFiles.length} FILES</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">ACTIVE REGION:</span>
              <span className="text-[10px] font-mono text-slate-300">EAST ENCLAVE IV</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span>AUDIT ID:</span>
            <span className="text-slate-300 font-bold uppercase">DF_99X_LOCK</span>
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
              <span>DISCOVERY FRAMEWORK ARRAY</span>
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
              <span>Copilot Drawer</span>
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
                Next <ArrowRight size={13}/>
              </button>
            ) : (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Check size={13} className="stroke-[3]"/> Locked & Verified
              </span>
            )}
          </div>
        </div>

        {/* WORKFLOW CONTENT SWITCH ROUTER */}
        <div className="flex-1 p-6 sm:p-12 max-w-5xl w-full mx-auto animate-fadeIn">

          {/* ==================================================
              STAGE 0: WELCOME & HIGH LEGIBILITY HUB
             ================================================== */}
          {activeStep === 0 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="max-w-2xl">
                <span className="text-xs font-mono uppercase tracking-widest text-indigo-500 font-bold">Orientation Index</span>
                <h3 className="serif-title text-2xl sm:text-4xl font-bold tracking-tight mt-2 leading-tight">
                  Welcome to the Discovery Framework
                </h3>
                <p className="text-sm text-slate-400 mt-4 leading-relaxed font-light">
                  A high-fidelity sandbox modeling the lifecycle of privileged legal assets. Designed for attorneys, developers, and compliance officers to manage, verify, and lock chain-of-custody metadata indexes.
                </p>
              </div>

              {/* Dynamic spotlight indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className={`p-5 rounded-2xl border transition-all hover:-translate-y-1 ${
                  isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <span className="text-indigo-400 font-mono text-xs font-bold block">FOCUS #1</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mt-2">The Stepper Index</h4>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Navigate step-by-step using the left sidebar. Each step represents a state changes of custody parameters.
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border transition-all hover:-translate-y-1 ${
                  isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <span className="text-indigo-400 font-mono text-xs font-bold block">FOCUS #2</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mt-2">Dynamic Ingestions</h4>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Drop your custom documentation files in Step 2 to parse text and check live citation highlighting downstream.
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border transition-all hover:-translate-y-1 ${
                  isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <span className="text-indigo-400 font-mono text-xs font-bold block">FOCUS #3</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mt-2">Trust Layer Matrices</h4>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Select findings in Step 5 to pinpoint the coordinates highlighted in source documents within milliseconds.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-white/[0.04]">
                <button
                  onClick={() => handleStepChange(1)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
                >
                  Initiate Discovery Run
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              STAGE 1: DISCOVERY INGEST (UNSTRUCTURED PREVIOUS DUMP)
             ================================================== */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className={`border rounded-2xl p-4 flex gap-4 items-start ${
                isDarkMode ? 'bg-amber-500/[0.02] border-amber-500/20' : 'bg-amber-500/[0.04] border-amber-500/30'
              }`}>
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 font-mono">Unstructured Raw Dump Checked</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    These 15 original, unstructured files have zero systemic indexation. Bates bounds are unassigned. Use the real-time search engine to locate target CSV structures.
                  </p>
                </div>
              </div>

              {/* Real-time search tools */}
              <div className={`p-4 rounded-2xl border transition-colors flex flex-col md:flex-row gap-3 items-center justify-between ${
                isDarkMode ? 'bg-[#111219] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <div className="relative w-full md:w-72">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={14}/></span>
                  <input
                    type="text"
                    placeholder="Query file name index..."
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
                  {['ALL', 'LEDGER', 'SYSTEM', 'TRANSCRIPT'].map(type => (
                    <button
                      key={type}
                      onClick={() => setFileFilter(type)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold border transition-all ${
                        fileFilter === type ? 'bg-indigo-600 border-indigo-600 text-white' : isDarkMode ? 'bg-[#151622] border-white/[0.04] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unindexed Files list */}
              {filteredRawFiles.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-14 rounded-xl border border-dashed ${
                  isDarkMode ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'
                }`}>
                  <FileSpreadsheet size={28} className="mb-3 opacity-40" />
                  <p className="text-xs font-mono font-semibold">NO FILES INGESTED</p>
                  <p className="text-[10px] font-mono mt-1 opacity-60">Awaiting discovery ingest trigger</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-fadeIn">
                  {filteredRawFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-xl p-3 flex items-center justify-between gap-3 transition-all ${
                        isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:border-white/[0.08]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 border ${
                          file.isFlagged ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                        }`}>
                          <FileSpreadsheet size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{file.size} // {file.type}</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-mono border px-1.5 py-0.5 rounded font-bold ${
                        file.isFlagged ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      }`}>
                        {file.isFlagged ? 'ANOMALY' : 'UNINDEXED'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-8 border-t border-white/[0.04] text-center">
                <MicroStatusVisualizer active={false} isDarkMode={isDarkMode} />
                <p className="text-xs font-mono text-slate-500 mt-2">
                  Framework Ingestion Queue: <span className="font-bold text-slate-300">AWAITING SYSTEM TRIGGER</span>
                </p>
              </div>
            </div>
          )}

          {/* ==================================================
              STAGE 2: SECURE TRANSFER (UPLOAD DIRECTORIES)
             ================================================== */}
          {activeStep === 2 && (
            <div className="space-y-6 max-w-xl mx-auto py-4 animate-fadeIn">
              <div className={`rounded-3xl p-8 sm:p-14 text-center border transition-all duration-300 ${
                isUploading
                  ? 'border-indigo-500/50 bg-indigo-500/[0.02] shadow-[0_0_35px_rgba(99,102,241,0.15)]'
                  : isDarkMode ? 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12]' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}>
                <div className="relative w-16 h-16 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 animate-ping opacity-25" />
                  <div className={`relative w-16 h-16 rounded-2xl border flex items-center justify-center text-indigo-500 ${
                    isDarkMode ? 'bg-[#151620] border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <UploadCloud size={24} className={isUploading ? 'animate-bounce' : ''} />
                  </div>
                </div>

                <h3 className={`text-sm sm:text-md font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Custom Secure Document Upload
                </h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                  Drop your actual client documentation (.txt, .csv, .json) directly. We will parse and highlight matches in downstream citation matrices.
                </p>

                {isUploading ? (
                  <div className="mt-8 space-y-2.5 max-w-xs mx-auto">
                    <div className={`w-full h-1.5 rounded-full overflow-hidden border ${
                      isDarkMode ? 'bg-[#121319] border-white/[0.05]' : 'bg-slate-200 border-slate-300'
                    }`}>
                      <div className="bg-indigo-600 h-full transition-all duration-75" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span className="font-semibold">Decrypting Ingestion Tunnel...</span>
                      <span className="font-bold text-indigo-500">{uploadProgress}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center">
                    <label className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 inline-flex items-center gap-2 cursor-pointer ${
                      isDarkMode ? 'bg-white text-slate-950 hover:bg-slate-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}>
                      <Plus size={14} />
                      Choose Legal Document
                      <input
                        type="file"
                        multiple
                        accept=".txt,.csv,.json,.log,.conf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Display custom uploaded items */}
              {customUploadedFiles.length > 0 && (
                <div className="space-y-2 mt-4 animate-fadeIn">
                  <h4 className="text-[10px] font-mono tracking-widest text-slate-500 font-bold uppercase">Custom Uploaded Custody Manifest</h4>
                  <div className="space-y-1.5">
                    {customUploadedFiles.map((file, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-indigo-500" />
                          <span className="font-mono font-bold text-slate-200">{file.name}</span>
                          <span className="text-slate-500">({file.size})</span>
                        </div>
                        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">Ingested</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              STAGE 3: INTEGRITY CHECK (METADATA LOCK)
             ================================================== */}
          {activeStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto animate-fadeIn">
              <div className={`rounded-2xl border overflow-hidden ${
                isDarkMode ? 'bg-[#111219]/70 border-white/[0.06] apple-shadow' : 'bg-white border-slate-200 shadow-md'
              }`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center ${
                  isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500" />
                    <h3 className={`text-xs font-bold tracking-widest uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Manifest Certified</h3>
                  </div>
                  <span className="text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2.5 py-0.5 rounded font-bold">
                    PASSED INTEGRITY
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Case Key</span>
                      <p className={`text-xs font-bold mt-1 font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{caseTitle}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Volume Scale</span>
                      <p className={`text-xs font-bold mt-1 font-mono ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{15 + customUploadedFiles.length} Documents Indexed</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Bates Base Index</span>
                      <p className="text-xs font-mono font-bold text-amber-500 mt-1">{batesOverride}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold">Security Lock SHA</span>
                      <p className="text-[10px] font-mono text-emerald-400 mt-1 truncate">SHA-256 // 42e88b0b1cc9...</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center pt-2">
                <MicroStatusVisualizer active={false} isDarkMode={isDarkMode} />
                <p className="text-xs font-mono text-slate-500 mt-2">
                  Secure Enclave state: <span className="text-emerald-500 font-bold">INDEX COMPLETE</span>
                </p>
              </div>
            </div>
          )}

          {/* ==================================================
              STAGE 4: DEEP ANALYSIS (WAVEFORM VISUALIZER)
             ================================================== */}
          {activeStep === 4 && (
            <div className="space-y-6 max-w-xl mx-auto py-8 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-2 animate-pulse">
                  <Activity className="text-indigo-500" size={24} />
                </div>
                <h3 className={`text-md font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Reconstructing Chronology Timelines</h3>
                <p className="text-xs text-slate-400">Extracting chronological matching nodes inside secure enclave space...</p>
              </div>

              <div className="space-y-3">
                <div className={`w-full h-3 rounded-full p-0.5 overflow-hidden border ${
                  isDarkMode ? 'bg-[#13141C] border-white/[0.05]' : 'bg-slate-200 border-slate-300'
                }`}>
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-75" style={{ width: `${analysisProgress}%` }} />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="text-indigo-500 animate-pulse truncate">{analysisPhase}</span>
                  <span className="font-bold text-white self-end sm:self-auto">{analysisProgress}%</span>
                </div>
              </div>

              <PremiumCircuitMap />
            </div>
          )}

          {/* ==================================================
              STAGE 5: CITATION MATRIX (INTERACTIVE SPLIT)
             ================================================== */}
          {activeStep === 5 && (
            <div className="space-y-5 animate-fadeIn">
              <div className={`border rounded-xl p-3 flex justify-between items-center gap-3 ${
                isDarkMode ? 'bg-emerald-500/[0.01] border-emerald-500/15' : 'bg-emerald-50/[0.5] border-emerald-200'
              }`}>
                <p className={`text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  <strong>Interactive Citation Viewer:</strong> Choose legal findings or select custom uploaded files to view coordinates highlighted directly inside our paper reader model.
                </p>

                {/* Custom File Selector inside Step 5 */}
                {customUploadedFiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Source Document:</span>
                    <select
                      value={selectedDocSource}
                      onChange={(e) => setSelectedDocSource(e.target.value)}
                      className="bg-[#111219] border border-white/[0.08] rounded-lg px-2 py-1 text-xs font-mono text-indigo-400 focus:outline-none"
                    >
                      <option value="DEFAULT_VLM">Default (SOURCE_TRANSCRIPT)</option>
                      {customUploadedFiles.map((file, i) => (
                        <option key={i} value={file.name}>{file.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {(() => {
                const defaultFindings = [
                  { id: 0, bates: 'VLM-002, Line 14', finding: 'Defendant explicitly confirmed physical presence in Seattle hub on Oct 12.', confidence: '100%' },
                  { id: 1, bates: 'VLM-005, Line 88', finding: 'Corporate financial account records unscheduled wire allocation outward.', confidence: '100%' },
                  { id: 2, bates: 'VLM-011, Line 4', finding: 'Internal message vectors contradict executive deposition metadata.', confidence: '100%' }
                ];
                const activeFindings = selectedDocSource === 'DEFAULT_VLM'
                  ? defaultFindings
                  : (uploadedFileCitations[selectedDocSource] || []);
                return (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:h-[480px]">
                {/* Findings Index Column */}
                <div className="lg:col-span-2 space-y-2.5 overflow-y-auto max-h-[250px] lg:max-h-full pr-1.5">
                  {activeFindings.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-10 rounded-xl border border-dashed text-center ${isDarkMode ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                      <ShieldCheck size={22} className="mb-2 opacity-30" />
                      <p className="text-[10px] font-mono font-bold">NO CITATIONS EXTRACTED</p>
                      <p className="text-[9px] font-mono mt-1 opacity-60">Document content may be too short to parse</p>
                    </div>
                  ) : (
                    activeFindings.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedFinding(item.id);
                        setActiveNoteInput(customNotes[item.id] || '');
                      }}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                        selectedFinding === item.id
                          ? isDarkMode ? 'bg-[#181924] border-indigo-500/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)] ring-1 ring-indigo-500/30' : 'bg-indigo-50/50 border-indigo-300 shadow-md ring-1'
                          : isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:bg-[#13141e]' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {item.bates}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono font-bold">Match: {item.confidence}</span>
                      </div>
                      <p className={`text-[11px] leading-relaxed font-sans font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.finding}</p>
                    </div>
                  ))
                  )}

                  {/* Stateful Custom Annotation Board */}
                  <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#111218] border-white/[0.05]' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <label className="text-[10px] font-mono font-bold tracking-wider text-slate-500 block mb-2 uppercase">
                      Local Annotation Layer
                    </label>
                    <textarea
                      placeholder="Add custom annotations or notes..."
                      value={activeNoteInput || (customNotes[selectedFinding] || '')}
                      onChange={(e) => {
                        setActiveNoteInput(e.target.value);
                        setIsTyping(true);
                      }}
                      onBlur={() => setIsTyping(false)}
                      rows={3}
                      className={`w-full text-xs p-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none ${
                        isDarkMode ? 'bg-[#151620] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={handleUpdateNote}
                        className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all"
                      >
                        Update Note
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulated Document Viewer Canvas */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-[#D1D5DB] flex flex-col overflow-hidden text-slate-900 shadow-2xl min-h-[300px]">
                  <div className="bg-[#E5E7EB] px-4 py-2 border-b border-[#D1D5DB] flex justify-between items-center text-[10px] text-slate-500 font-mono font-bold">
                    <span className="flex items-center gap-1.5"><FileText size={13} className="text-slate-500"/> {selectedDocSource === 'DEFAULT_VLM' ? 'SOURCE_TRANSCRIPT_VLM.pdf' : selectedDocSource}</span>
                    <span>Page 1 of 1</span>
                  </div>

                  <div className="flex-1 p-6 font-serif text-[12.5px] leading-relaxed overflow-y-auto bg-[#F9FAFB] select-text">
                    <div className="border border-slate-200/60 p-6 bg-white min-h-full shadow-sm rounded-xl">

                      {selectedDocSource === 'DEFAULT_VLM' ? (
                        <>
                          <p className="text-[9px] text-slate-400 font-mono mb-4 pb-1.5 border-b border-slate-100 uppercase tracking-widest font-bold">CONFIDENTIAL CASE RECORDS ATTACHMENT</p>
                          <p className="mb-3 text-slate-600">
                            ...pursuant to standard processing protocols, the corporate executive steering committee authorized a structural review of infrastructure assets.
                          </p>
                          <p className="mb-3 text-slate-600">
                            {selectedFinding === 0 ? (
                              <mark className="bg-amber-100 font-bold px-1 rounded border-b-2 border-amber-500 text-slate-950 transition-all duration-300 shadow-sm">
                                "The operating manager accompanied the executive staff to Seattle, WA on October 12, 2024, confirming physical presence at the central node location."
                              </mark>
                            ) : (
                              `"The operating manager accompanied the executive staff to Seattle, WA on October 12, 2024, confirming physical presence at the central node location."`
                            )}
                          </p>
                          <p className="mb-3 text-slate-600">
                            {selectedFinding === 1 ? (
                              <mark className="bg-amber-100 font-bold px-1 rounded border-b-2 border-amber-500 text-slate-950 transition-all duration-300 shadow-sm">
                                "A secondary electronic wire framework executed a clearing sweep of general capitalization metrics to foreign accounting branches immediately thereafter."
                              </mark>
                            ) : (
                              `"A secondary electronic wire framework executed a clearing sweep of general capitalization metrics to foreign accounting branches immediately thereafter."`
                            )}
                          </p>
                          <p className="text-slate-600 mb-4">
                            {selectedFinding === 2 ? (
                              <mark className="bg-amber-100 font-bold px-1 rounded border-b-2 border-amber-500 text-slate-950 transition-all duration-300 shadow-sm">
                                "Discrepancies in explicit communications during the active timeline are under active evaluation by external validation teams."
                              </mark>
                            ) : (
                              `"Discrepancies in explicit communications during the active timeline are under active evaluation by external validation teams."`
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[9px] text-slate-400 font-mono mb-4 pb-1.5 border-b border-slate-100 uppercase tracking-widest font-bold">CLIENT DOCUMENT — CITATION ANALYSIS</p>
                          {(() => {
                            const fileContent = customUploadedFiles.find(f => f.name === selectedDocSource)?.content || '';
                            const fileCitations = uploadedFileCitations[selectedDocSource] || [];
                            const activeCitation = fileCitations[selectedFinding];
                            if (!fileContent) return <p className="text-slate-400 font-mono text-[11px]">Error reading file contents.</p>;
                            if (!activeCitation) {
                              return <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{fileContent}</p>;
                            }
                            const excerpt = activeCitation.excerpt;
                            const splitIdx = fileContent.indexOf(excerpt);
                            if (splitIdx === -1) {
                              return <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{fileContent}</p>;
                            }
                            const before = fileContent.slice(0, splitIdx);
                            const after = fileContent.slice(splitIdx + excerpt.length);
                            return (
                              <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                                {before}
                                <mark className="bg-amber-100 font-bold px-0.5 rounded border-b-2 border-amber-500 text-slate-950 transition-all duration-300 shadow-sm">
                                  {excerpt}
                                </mark>
                                {after}
                              </p>
                            );
                          })()}
                        </>
                      )}

                      {/* Display custom overlay annotation */}
                      {customNotes[selectedFinding] && (
                        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg animate-fadeIn">
                          <p className="text-[9px] font-mono tracking-widest text-indigo-700 uppercase font-bold">Attorney Overlay Annotation</p>
                          <p className="text-xs text-indigo-950 font-sans italic mt-1 leading-relaxed">
                            "{customNotes[selectedFinding]}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
                );
              })()}
            </div>
          )}

          {/* ==================================================
              STAGE 6: INTERACTIVE REVIEW (STRATEGIC TRIAL MEMO)
             ================================================== */}
          {activeStep === 6 && (
            <div className="space-y-4 max-w-3xl mx-auto animate-fadeIn">
              <div className={`border rounded-2xl p-6 sm:p-8 relative shadow-2xl transition-colors ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/[0.04]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 font-mono">Privileged Strategic Evaluation</h3>
                    <p className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Trial Brief Chronology Drafts</p>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-md shrink-0 font-bold">
                    Draft Review Stage
                  </span>
                </div>

                <div className={`space-y-4 text-xs sm:text-[13px] leading-relaxed font-sans font-semibold ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <p>
                    Based on machine processing parameters executed against raw fileset components, external litigation analysts identified several core elements for inclusion in the strategic roadmap.
                  </p>

                  <p>
                    First, a structural review reveals clear discrepancies regarding physical location parameters.{' '}
                    <span
                      onClick={() => setActiveMemoMetadata({
                        title: 'Location Inconsistency Mapping',
                        confidence: '98.6%',
                        batesScope: 'VLM-002 - VLM-004',
                        note: customNotes[0] || 'Corroborated by airline travel log ledger entries.'
                      })}
                      className="bg-indigo-500/10 border-b border-dashed border-indigo-500 hover:bg-indigo-500/20 text-indigo-500 px-1.5 py-0.5 rounded cursor-pointer font-bold inline-block my-1 sm:my-0 transition-all"
                    >
                      [Inspect Location Highlight]
                    </span>{' '}
                    This directly impacts initial witness testimony framing frameworks.
                  </p>

                  <p>
                    Furthermore, the chronological matrix indicates financial asset shifts matching core discovery windows.{' '}
                    <span
                      onClick={() => setActiveMemoMetadata({
                        title: 'Financial Discrepancy Matrix',
                        confidence: '94.1%',
                        batesScope: 'VLM-007',
                        note: customNotes[1] || 'Identified out-of-cycle internal authorization tags matching target ledger items.'
                      })}
                      className="bg-indigo-500/10 border-b border-dashed border-indigo-500 hover:bg-indigo-500/20 text-indigo-500 px-1.5 py-0.5 rounded cursor-pointer font-bold inline-block my-1 sm:my-0 transition-all"
                    >
                      [Inspect Transaction Audit]
                    </span>{' '}
                    Counsel should cross-examine financial directors on these precise boundaries.
                  </p>
                </div>

                {/* Floating Apple Metadata Insight */}
                {activeMemoMetadata && (
                  <div className={`mt-6 border rounded-xl p-4.5 relative animate-fadeIn apple-shadow transition-colors ${
                    isDarkMode ? 'bg-[#16171F] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <button
                      onClick={() => setActiveMemoMetadata(null)}
                      className="absolute right-3.5 top-3.5 text-xs font-mono text-slate-500 hover:text-indigo-500 cursor-pointer font-bold"
                    >
                      ✕ Close
                    </button>
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 font-mono font-bold">
                      <ShieldCheck size={12}/> Citations Custody Overlay
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 pt-3 border-t border-white/[0.04] text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-bold">Element Group</span>
                        <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{activeMemoMetadata.title}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-bold">Match Confidence</span>
                        <span className="text-emerald-500 font-mono font-bold">{activeMemoMetadata.confidence}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-bold">Bates Address</span>
                        <span className={`font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{activeMemoMetadata.batesScope}</span>
                      </div>
                    </div>
                    <p className={`text-[11px] mt-3 p-2.5 rounded-lg border ${
                      isDarkMode ? 'bg-white/[0.02] border-white/[0.04] text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <strong>Audit Annotation:</strong> {activeMemoMetadata.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================
              STAGE 7: OVERRIDE & REFINE (SETTINGS VALUES)
             ================================================== */}
          {activeStep === 7 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className={`border rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl transition-colors ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 font-mono border-b border-white/[0.04] pb-3">Override Control Board</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">Case Identifier String</label>
                    <input
                      type="text"
                      value={caseTitle}
                      onChange={(e) => setCaseTitle(e.target.value)}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                        isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1.5">Bates Prefix Sequence</label>
                    <input
                      type="text"
                      value={batesOverride}
                      onChange={(e) => setBatesOverride(e.target.value)}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      className={`w-full border rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                        isDarkMode ? 'bg-[#16171F] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 mt-4 ${
                    isDarkMode ? 'bg-[#16171F] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <span className={`text-xs font-semibold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Flag Package For Senior Counsel</span>
                      <span className="text-[10px] text-slate-500 font-medium">Bypasses default queues to prioritize active deposition boards.</span>
                    </div>
                    {/* Apple Style Toggle Switch */}
                    <button
                      onClick={() => setIsFlaggedForReview(!isFlaggedForReview)}
                      className={`w-11 h-6.5 rounded-full transition-colors relative focus:outline-none self-end sm:self-auto shrink-0 ${
                        isFlaggedForReview ? 'bg-indigo-600' : 'bg-slate-400/30'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={`w-5.5 h-5.5 bg-white rounded-full absolute top-0.5 transition-all ${isFlaggedForReview ? 'left-5.2' : 'left-0.5'} shadow-md`} />
                    </button>
                  </div>
                </div>

                <div className="pt-5 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between gap-3">
                  <button
                    onClick={() => handleStepChange(4)}
                    className={`w-full sm:w-auto px-4 py-2 text-xs font-semibold border rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                      isDarkMode ? 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <RefreshCw size={12}/> Rerun Neural Pass
                  </button>
                  <button
                    onClick={() => handleStepChange(8)}
                    className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg text-center ${
                      isDarkMode ? 'bg-white text-slate-950 hover:bg-slate-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    Approve and Package
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================
              STAGE 8: PACKAGE READY (DELIVERABLES DOWNLOAD)
             ================================================== */}
          {activeStep === 8 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">

                {/* Brief PDF */}
                <div className={`border rounded-2xl p-5 flex flex-col justify-between h-44 shadow-xl transition-all duration-300 relative group ${
                  isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:border-indigo-500/30' : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}>
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <ExternalLink size={14}/>
                  </div>
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                      <FileText size={15} />
                    </div>
                    <h4 className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Compiled Strategic Brief</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">Contains embedded, validated Bates highlights linking to source transcript documents.</p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 font-bold block mt-2 uppercase">
                    Format: PDF // size: 244 KB
                  </span>
                </div>

                {/* Slides Keynote */}
                <div className={`border rounded-2xl p-5 flex flex-col justify-between h-44 shadow-xl transition-all duration-300 relative group ${
                  isDarkMode ? 'bg-[#111218] border-white/[0.04] hover:border-indigo-500/30' : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}>
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <ExternalLink size={14}/>
                  </div>
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-3">
                      <Layers size={15} />
                    </div>
                    <h4 className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Deposition Chronology Deck</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">High-resolution slide projection mapping financial entries against timelines.</p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 font-bold block mt-2 uppercase">
                    Format: KEYNOTE // Size: 1.4 MB
                  </span>
                </div>

                {/* Efficiency Widget */}
                <div className={`rounded-2xl p-5 flex flex-col justify-between h-44 shadow-xl sm:col-span-2 md:col-span-1 ${
                  isDarkMode ? 'bg-indigo-500/[0.02] border-indigo-500/15' : 'bg-indigo-50 border-indigo-100'
                }`}>
                  <div>
                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest font-mono">Enclave Optimization</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5">Calculated efficiency parameters comparing neural indexing against manual discovery rates.</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="flex items-center gap-1.5 text-slate-400"><Clock size={11}/> HOURS PRESERVED</span>
                      <span className="text-emerald-500 font-bold">~18.5 Hrs</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="flex items-center gap-1.5 text-slate-400"><DollarSign size={11}/> RETAINER CONSERVED</span>
                      <span className="text-emerald-500 font-bold">$7,400.00</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================================================
              STAGE 9: PIPELINE COMPLETE (ARCHIVED & SECURE)
             ================================================== */}
          {activeStep === 9 && (
            <div className="space-y-6 max-w-xl mx-auto text-center py-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl scale-125" />
                <MicroStatusVisualizer active={false} isDarkMode={isDarkMode} />
              </div>

              <div className="space-y-2 mt-4">
                <h3 className={`text-md sm:text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Verification Complete</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  The analytical artifacts are compiled, verified, and locked inside target secure directories. Your litigation timeline layer is operational.
                </p>
              </div>

              <div className={`border rounded-2xl p-5 grid grid-cols-2 gap-4 text-left shadow-2xl ${
                isDarkMode ? 'bg-[#111218] border-white/[0.04]' : 'bg-white border-slate-200'
              }`}>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Production Delta</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">+92.4% Optimal</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Security Key Spec</span>
                  <span className="text-sm font-bold text-indigo-500 font-mono mt-0.5 block truncate">AES-GCM // LCK_9A</span>
                </div>
              </div>

              <button
                onClick={() => handleStepChange(0)}
                className={`mt-6 px-4 py-2 text-xs font-semibold border transition-all inline-flex items-center gap-1.5 rounded-xl ${
                  isDarkMode
                    ? 'text-slate-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06]'
                    : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                }`}
              >
                Reset Prototype Experience
              </button>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT DRAWER PANEL: COPILOT PANEL */}
      {copilotOpen && (
        <div className={`w-full lg:w-[330px] shrink-0 border-l flex flex-col fixed inset-y-0 right-0 z-40 transition-all duration-300 shadow-2xl lg:static lg:translate-x-0 ${
          isDarkMode ? 'bg-[#0E0F14] border-white/[0.04]' : 'bg-white border-slate-200'
        }`}>
          {/* Header */}
          <div className={`p-5 border-b flex justify-between items-center ${
            isDarkMode ? 'border-white/[0.04]' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="text-indigo-500 animate-pulse" size={15} />
              <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Advisor</h3>
            </div>
            <button
              onClick={() => setCopilotOpen(false)}
              className={`p-1 rounded-lg border transition-all ${
                isDarkMode ? 'border-white/[0.05] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-100'
              }`}
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Context Tips Card */}
            <div className={`p-4 rounded-xl border ${
              isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50 border-slate-100'
            }`}>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-500">Workspace Diagnostic Tips</span>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {ADVISOR_TIPS[activeStep]}
              </p>
            </div>

            {/* Simulated Q&A Chat window logs */}
            <div className="space-y-2 pt-4 border-t border-white/[0.04]">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">Interactive Logs</span>

              <div className="space-y-2 h-44 overflow-y-auto pr-1">
                {messages.map((msg, i) => (
                  <div key={i} className={`p-2.5 rounded-lg text-xs leading-relaxed animate-fadeIn ${
                    msg.sender === 'user'
                      ? 'bg-white/[0.03] border border-white/[0.04] ml-6 text-slate-300'
                      : 'bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 mr-6'
                  }`}>
                    <p className="font-semibold text-[10px] uppercase font-mono tracking-widest opacity-60 mb-0.5">{msg.sender}</p>
                    <p>{msg.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleClaudeQuerySubmit} className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  placeholder="Query discovery engine..."
                  value={userQueryText}
                  onChange={(e) => {
                    setUserQueryText(e.target.value);
                    setIsTyping(true);
                  }}
                  onBlur={() => setIsTyping(false)}
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                    isDarkMode ? 'bg-[#151620] border-white/[0.06] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
