import React from "react";
import {
  TimerReset,
  X,
  Trophy,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  Play,
  ClipboardCheck,
  Flag,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileText,
  PenLine,
  Eye,
  EyeOff,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { usePdfViewer } from "@/components/pdf/PdfViewerProvider";
import { useXpEvent } from "@/hooks/use-xp-event";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";

// XP for mocks is priced server-side (see api-server/src/lib/xp.ts) so it
// cannot be inflated from the client; no local constants needed.
const AUTOSAVE_INTERVAL_MS = 30_000;

// ─── Shared paper type ────────────────────────────────────────────────────────

export interface MockPaper {
  id: number;
  year: number;
  subject: string;
  title: string;
  paperType: "PYQ" | "Sample";
  paperUrl: string | null;
  durationMinutes: number;
  maximumMarks: number;
  setName: string | null;
  series: string | null;
}

// ─── Section config ──────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  description: string;
  qStart: number;
  qEnd: number;
  defaultTotalMarks: number;
}

const SECTIONS: Section[] = [
  { id: "A", label: "Section A", description: "MCQ & Assertion-Reason (1 mark each)", qStart: 1, qEnd: 20, defaultTotalMarks: 20 },
  { id: "B", label: "Section B", description: "Very Short Answer (2 marks each)", qStart: 21, qEnd: 26, defaultTotalMarks: 12 },
  { id: "C", label: "Section C", description: "Short Answer (3 marks each)", qStart: 27, qEnd: 33, defaultTotalMarks: 21 },
  { id: "D", label: "Section D", description: "Long Answer (5 marks each)", qStart: 34, qEnd: 36, defaultTotalMarks: 15 },
  { id: "E", label: "Section E", description: "Case-Based Questions (4 marks each)", qStart: 37, qEnd: 39, defaultTotalMarks: 12 },
];
const TOTAL_QUESTIONS = SECTIONS[SECTIONS.length - 1].qEnd;
const TOTAL_MARKS = SECTIONS.reduce((s, sec) => s + sec.defaultTotalMarks, 0);

// ─── Types ───────────────────────────────────────────────────────────────────

type QuestionStatus = "unanswered" | "answered" | "review";
type Phase = "pre-start" | "resume-prompt" | "running" | "score-entry" | "results";
type Palette = Record<number, QuestionStatus>;
type SectionMarks = Record<string, { obtained: string; total: string }>;

interface SavedState {
  year: number;
  subject: string;
  secondsLeft: number;
  elapsed: number;
  palette: Palette;
  savedAt: number;
}

interface ScoreResult {
  sectionMarks: SectionMarks;
  obtained: number;
  total: number;
  writtenAnswers: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function autosaveKey(year: number, subject: string) {
  return `sf_mock_${year}_${subject.replace(/\s+/g, "_").toLowerCase()}`;
}

function loadSavedState(year: number, subject: string): SavedState | null {
  try {
    const raw = localStorage.getItem(autosaveKey(year, subject));
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedState;
    const age = Date.now() - state.savedAt;
    if (age > 4 * 60 * 60 * 1000) {
      localStorage.removeItem(autosaveKey(year, subject));
      return null;
    }
    return state;
  } catch { return null; }
}

function saveState(year: number, subject: string, state: Omit<SavedState, "savedAt" | "year" | "subject">) {
  try {
    const data: SavedState = { ...state, year, subject, savedAt: Date.now() };
    localStorage.setItem(autosaveKey(year, subject), JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

function clearSavedState(year: number, subject: string) {
  try { localStorage.removeItem(autosaveKey(year, subject)); } catch { /* ignore */ }
}

function nextStatus(s: QuestionStatus): QuestionStatus {
  if (s === "unanswered") return "answered";
  if (s === "answered") return "review";
  return "unanswered";
}

function paletteStats(palette: Palette) {
  let answered = 0, review = 0, unanswered = 0;
  for (let q = 1; q <= TOTAL_QUESTIONS; q++) {
    const s = palette[q] ?? "unanswered";
    if (s === "answered") answered++;
    else if (s === "review") review++;
    else unanswered++;
  }
  return { answered, review, unanswered };
}

function defaultSectionMarks(): SectionMarks {
  const marks: SectionMarks = {};
  for (const sec of SECTIONS) {
    marks[sec.id] = { obtained: "", total: String(sec.defaultTotalMarks) };
  }
  return marks;
}

function computeTotal(sectionMarks: SectionMarks) {
  let obtained = 0, total = 0, valid = true;
  for (const sec of SECTIONS) {
    const m = sectionMarks[sec.id];
    const o = parseInt(m?.obtained ?? "", 10);
    const t = parseInt(m?.total ?? "", 10);
    if (isNaN(o) || isNaN(t) || t <= 0 || o < 0 || o > t) { valid = false; continue; }
    obtained += o;
    total += t;
  }
  return { obtained, total, valid };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  paper: MockPaper | null;
  onClose: () => void;
}

export function MockTestOverlay({ paper, onClose }: Props) {
  const sessionId = useSession();
  const recordXp = useXpEvent();
  const { toast } = useToast();

  const [phase, setPhase] = React.useState<Phase>("pre-start");
  const [secondsLeft, setSecondsLeft] = React.useState((paper?.durationMinutes ?? 180) * 60);
  const [elapsed, setElapsed] = React.useState(0);
  const [palette, setPalette] = React.useState<Palette>({});
  const [score, setScore] = React.useState<ScoreResult | null>(null);
  const [startedAt, setStartedAt] = React.useState<Date>(new Date());
  const [savedState, setSavedState] = React.useState<SavedState | null>(null);
  const rewardedRef = React.useRef(false);
  const [awardedXp, setAwardedXp] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!paper) return;
    setPhase("pre-start");
    setSecondsLeft(paper.durationMinutes * 60);
    setElapsed(0);
    setPalette({});
    setScore(null);
    setAwardedXp(null);
    rewardedRef.current = false;

    const saved = loadSavedState(paper.year, paper.subject);
    if (saved) {
      setSavedState(saved);
      setPhase("resume-prompt");
    }
  }, [paper?.year, paper?.subject, paper?.durationMinutes]);

  React.useEffect(() => {
    if (phase !== "running") return;
    if (secondsLeft <= 0) { setPhase("score-entry"); return; }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); setPhase("score-entry"); return 0; }
        return s - 1;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "running" || !paper) return;
    const id = setInterval(() => {
      saveState(paper.year, paper.subject, { secondsLeft, elapsed, palette });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, paper, secondsLeft, elapsed, palette]);

  function startFresh() {
    if (!paper) return;
    clearSavedState(paper.year, paper.subject);
    setSavedState(null);
    setStartedAt(new Date());
    setPhase("running");
  }

  function resumeSaved() {
    if (!savedState) return;
    setSecondsLeft(savedState.secondsLeft);
    setElapsed(savedState.elapsed);
    setPalette(savedState.palette);
    setStartedAt(new Date(Date.now() - savedState.elapsed * 1000));
    setSavedState(null);
    setPhase("running");
  }

  function submitTest() {
    if (paper) clearSavedState(paper.year, paper.subject);
    setPhase("score-entry");
  }

  function finishWithScore(result: ScoreResult | null) {
    if (rewardedRef.current || !sessionId || !paper) return;
    rewardedRef.current = true;
    setScore(result);

    const snap = paletteStats(palette);
    fetch("/api/mock/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        subject: paper.subject,
        year: paper.year,
        paperType: paper.paperType === "PYQ" ? "previous_year" : "sample_paper",
        questionPaperUrl: paper.paperUrl ?? null,
        status: "completed",
        startedAt: startedAt.toISOString(),
        timeTakenSeconds: elapsed,
        totalMarks: result?.total ?? null,
        obtainedMarks: result?.obtained ?? null,
        sectionScores: result?.sectionMarks
          ? Object.fromEntries(
              SECTIONS.map((s) => {
                const m = result.sectionMarks[s.id];
                return [s.id, { obtained: parseInt(m?.obtained ?? "0", 10), total: parseInt(m?.total ?? "0", 10) }];
              }).filter(([, v]) => !isNaN((v as { obtained: number; total: number }).obtained)),
            )
          : null,
        paletteSnapshot: Array.from({ length: TOTAL_QUESTIONS }, (_, i) => palette[i + 1] ?? "unanswered"),
        writtenAnswers: result?.writtenAnswers || null,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((saved) => {
        const attemptId = saved?.attempt?.id;
        if (typeof attemptId === "number") {
          // Priced server-side from the attempt that was actually stored, so
          // the score cannot be inflated by editing the request.
          void recordXp({ type: "mock_submitted", attemptId }).then((r) => {
            if (r) setAwardedXp(r.xpAwarded);
          });
        }
      })
      .catch(() => { /* non-critical */ });

    toast({ title: "Mock test recorded", description: "XP added to your progress." });
    setPhase("results");
  }

  if (!paper) return null;

  const totalSeconds = paper.durationMinutes * 60;
  const progressPct = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  const isLast15 = secondsLeft <= 15 * 60 && phase === "running";
  const isWarning = secondsLeft <= 5 * 60 && phase === "running";

  const timerColor = isWarning
    ? "text-destructive"
    : isLast15
    ? "text-warning"
    : "text-primary";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TimerReset className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-none">{paper.subject} · {paper.year}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {paper.paperType === "PYQ" ? "CBSE Board Exam" : "Official Sample Paper"}
            {paper.setName ? ` · ${paper.setName}` : ""}
          </p>
        </div>

        {phase === "running" && (
          <span className={`font-mono text-xl font-bold tabular-nums shrink-0 ${timerColor}`}>
            {formatTime(secondsLeft)}
          </span>
        )}

        {phase !== "running" && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Timer progress bar */}
      {phase === "running" && (
        <div className="h-1.5 w-full bg-muted">
          <div
            className={`h-full transition-all duration-1000 ${isWarning ? "bg-destructive" : isLast15 ? "bg-warning" : "bg-primary"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {phase === "pre-start" && (
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
            <PreStartScreen paper={paper} onStart={startFresh} />
          </div>
        )}

        {phase === "resume-prompt" && (
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
            <ResumePromptScreen
              paper={paper}
              saved={savedState!}
              onResume={resumeSaved}
              onFresh={startFresh}
            />
          </div>
        )}

        {phase === "running" && (
          <RunningScreen
            paper={paper}
            palette={palette}
            secondsLeft={secondsLeft}
            elapsed={elapsed}
            timerColor={timerColor}
            isLast15={isLast15}
            onToggleQuestion={(qNum) =>
              setPalette((prev) => ({
                ...prev,
                [qNum]: nextStatus(prev[qNum] ?? "unanswered"),
              }))
            }
            onSubmit={submitTest}
          />
        )}

        {phase === "score-entry" && (
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
            <ScoreEntryScreen paper={paper} elapsed={elapsed} onSubmit={finishWithScore} />
          </div>
        )}

        {phase === "results" && (
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
            <ResultsScreen elapsed={elapsed} score={score} awardedXp={awardedXp} onClose={onClose} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pre-start screen ─────────────────────────────────────────────────────────

function PreStartScreen({ paper, onStart }: { paper: MockPaper; onStart: () => void }) {
  const { openPdf } = usePdfViewer();
  return (
    <div className="w-full max-w-md space-y-5 animate-in fade-in">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{paper.subject} · {paper.year}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Full exam conditions.{" "}
          <span className="font-semibold text-foreground">{paper.durationMinutes} minutes</span> on the clock.
        </p>
      </div>

      {paper.paperUrl && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-semibold">Question Paper (PDF)</span>
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">PDF</span>
          </div>
          <p className="text-xs text-muted-foreground">
            The paper will be shown alongside the timer once you start.
          </p>
          <button
            type="button"
            onClick={() => openPdf(paper.paperUrl!, "Question Paper")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview paper
          </button>
        </div>
      )}

      <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <ul className="space-y-1 text-xs text-warning">
            <li>Have rough paper and a pen ready for written answers</li>
            <li>No notes, textbooks, or extra devices during the attempt</li>
            <li>Use the question palette to track your progress</li>
            <li>After submitting, enter your marks and add answer notes</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Paper structure · {TOTAL_MARKS} marks</p>
        <div className="space-y-1.5">
          {SECTIONS.map((sec) => (
            <div key={sec.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">{sec.label}</span>
              <span className="text-muted-foreground">{sec.description}</span>
              <span className="ml-auto shrink-0 font-bold text-primary">{sec.defaultTotalMarks}m</span>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={onStart} size="lg" className="w-full gap-2 rounded-xl">
        <Play className="h-5 w-5" />
        Start Timer · {paper.durationMinutes} min
      </Button>
    </div>
  );
}

// ─── Resume prompt ────────────────────────────────────────────────────────────

function ResumePromptScreen({
  paper,
  saved,
  onResume,
  onFresh,
}: {
  paper: MockPaper;
  saved: SavedState;
  onResume: () => void;
  onFresh: () => void;
}) {
  const savedMinutesAgo = Math.round((Date.now() - saved.savedAt) / 60_000);
  const stats = paletteStats(saved.palette);
  return (
    <div className="w-full max-w-md space-y-5 animate-in fade-in">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning-soft">
          <RotateCcw className="h-7 w-7 text-warning" />
        </div>
        <h2 className="text-2xl font-bold">Resume your test?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have an in-progress attempt for{" "}
          <span className="font-semibold text-foreground">{paper.subject} {paper.year}</span>{" "}
          saved {savedMinutesAgo} minute{savedMinutesAgo !== 1 ? "s" : ""} ago.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-primary">{formatTime(saved.secondsLeft)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Time left</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-success">{stats.answered}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Answered</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-warning">{stats.review}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Flagged</p>
        </div>
      </div>
      <Button onClick={onResume} size="lg" className="w-full gap-2 rounded-xl">
        <RotateCcw className="h-5 w-5" />
        Resume · {formatTime(saved.secondsLeft)} remaining
      </Button>
      <button
        type="button"
        onClick={onFresh}
        className="w-full rounded-xl py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Start fresh (discard saved progress)
      </button>
    </div>
  );
}

// ─── Running screen ───────────────────────────────────────────────────────────

function RunningScreen({
  paper,
  palette,
  secondsLeft,
  elapsed,
  timerColor,
  isLast15,
  onToggleQuestion,
  onSubmit,
}: {
  paper: MockPaper;
  palette: Palette;
  secondsLeft: number;
  elapsed: number;
  timerColor: string;
  isLast15: boolean;
  onToggleQuestion: (q: number) => void;
  onSubmit: () => void;
}) {
  const { openPdf } = usePdfViewer();
  const stats = paletteStats(palette);
  const [showSubmitConfirm, setShowSubmitConfirm] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(true);
  const [showPdf, setShowPdf] = React.useState(!!paper.paperUrl);

  const hasPdf = !!paper.paperUrl;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Stats + controls row */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="font-semibold text-success">{stats.answered}</span>
            <span className="text-muted-foreground">answered</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warning" />
            <span className="font-semibold text-warning">{stats.review}</span>
            <span className="text-muted-foreground">flagged</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="font-semibold">{stats.unanswered}</span>
            <span className="text-muted-foreground hidden sm:inline">not started</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasPdf && (
            <button
              type="button"
              onClick={() => setShowPdf((v) => !v)}
              className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted sm:flex"
            >
              {showPdf ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPdf ? "Hide Paper" : "Show Paper"}
            </button>
          )}
          {hasPdf && (
            <button
              type="button"
              onClick={() => openPdf(paper.paperUrl!, "Question Paper")}
              className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted sm:flex"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full screen
            </button>
          )}
          {!showSubmitConfirm ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg gap-1.5 border-success/50 text-success hover:bg-success-soft"
              onClick={() => setShowSubmitConfirm(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Submit
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-success/50 bg-success-soft px-3 py-1.5">
              <span className="text-xs font-semibold text-success">Sure?</span>
              <button
                type="button"
                onClick={onSubmit}
                className="rounded-md bg-success px-2 py-0.5 text-xs font-bold text-white hover:bg-success"
              >Yes</button>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Main area — split when PDF shown */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* PDF panel */}
        {hasPdf && showPdf && (
          <div className="flex flex-col border-r" style={{ flex: "0 0 55%" }}>
            <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/20">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Question Paper
              </span>
              <button
                type="button"
                onClick={() => openPdf(paper.paperUrl!, "Question Paper")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <Maximize2 className="h-3 w-3" />
                Full screen
              </button>
            </div>
            <PdfViewer
              url={paper.paperUrl!}
              className="min-h-0 flex-1 rounded-none border-0"
            />
          </div>
        )}

        {/* Centre / timer + palette */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Timer + progress */}
          <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-6">
            <div className="text-center">
              <p className={`font-mono text-7xl font-bold tabular-nums tracking-tighter ${timerColor}`}>
                {formatTime(secondsLeft)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {isLast15 ? "⚠ Final 15 minutes — wrap up your answers" : "Time remaining"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <div className="rounded-xl border bg-card p-3 text-center">
                <p className="text-xl font-bold">{formatTime(elapsed)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Elapsed</p>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <p className="text-xl font-bold text-primary">
                  {Math.round((stats.answered / TOTAL_QUESTIONS) * 100)}%
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Done</p>
              </div>
            </div>

            {!hasPdf || !showPdf ? (
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs text-primary max-w-xs w-full">
                Mark each question in the palette on the right as you answer it. Click once to mark{" "}
                <span className="font-bold text-success">Answered</span>, again to flag for{" "}
                <span className="font-bold text-warning">Review</span>.
              </div>
            ) : null}
          </div>

          {/* Question palette */}
          <div className="shrink-0 border-t bg-card">
            <button
              type="button"
              onClick={() => setPaletteOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
            >
              <span>Question Palette</span>
              {paletteOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            {paletteOpen && (
              <div className="max-h-52 overflow-y-auto px-3 pb-3 space-y-3">
                {SECTIONS.map((sec) => (
                  <SectionPalette
                    key={sec.id}
                    section={sec}
                    palette={palette}
                    onToggle={onToggleQuestion}
                  />
                ))}
                <div className="flex gap-4 border-t pt-2">
                  <LegendItem color="bg-muted-foreground/30" label="Not started" />
                  <LegendItem color="bg-success" label="Answered" />
                  <LegendItem color="bg-warning" label="Flagged" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionPalette({ section, palette, onToggle }: { section: Section; palette: Palette; onToggle: (q: number) => void }) {
  const qs = Array.from({ length: section.qEnd - section.qStart + 1 }, (_, i) => section.qStart + i);
  const done = qs.filter((q) => palette[q] === "answered").length;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold">{section.label}</span>
        <span className="text-[10px] text-muted-foreground">{done}/{qs.length}</span>
      </div>
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-13">
        {qs.map((q) => {
          const status = palette[q] ?? "unanswered";
          return (
            <button
              key={q}
              type="button"
              onClick={() => onToggle(q)}
              title={`Q${q}: ${status}`}
              className={[
                "flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold transition-all",
                status === "answered"
                  ? "bg-success text-white shadow-sm"
                  : status === "review"
                  ? "bg-warning text-white shadow-sm"
                  : "border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              ].join(" ")}
            >
              {q}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-3 w-3 shrink-0 rounded ${color}`} />
      {label}
    </div>
  );
}

// ─── Score entry screen ────────────────────────────────────────────────────────

function ScoreEntryScreen({
  paper,
  elapsed,
  onSubmit,
}: {
  paper: MockPaper;
  elapsed: number;
  onSubmit: (result: ScoreResult | null) => void;
}) {
  const [sectionMarks, setSectionMarks] = React.useState<SectionMarks>(defaultSectionMarks);
  const [writtenAnswers, setWrittenAnswers] = React.useState("");
  const { obtained, total, valid } = computeTotal(sectionMarks);
  const pct = valid && total > 0 ? Math.round((obtained / total) * 100) : null;

  function setSection(sectionId: string, field: "obtained" | "total", value: string) {
    setSectionMarks((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], [field]: value },
    }));
  }

  const allFilled = SECTIONS.every((s) => sectionMarks[s.id]?.obtained !== "");

  function handleSave() {
    onSubmit({ sectionMarks, obtained, total, writtenAnswers });
  }

  function handleSkip() {
    onSubmit(null);
  }

  return (
    <div className="w-full max-w-lg space-y-5 animate-in fade-in">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardCheck className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Submit Your Answers</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your section-wise marks and add notes from your written answers.
        </p>
      </div>

      {/* Written answers section */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold">Written Answer Notes</p>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Optional</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Jot down key answers, approaches, or anything you want to review later. Only visible to you.
        </p>
        <textarea
          value={writtenAnswers}
          onChange={(e) => setWrittenAnswers(e.target.value)}
          placeholder="e.g. Q5: Used Pythagoras theorem — a²+b²=c². Q12: Answered part (a) and (b) but skipped (c). Section D: Wrote all 3 but unsure about Q35..."
          rows={5}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
        />
      </div>

      {/* Score entry */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marks by section</p>
        {SECTIONS.map((sec) => {
          const m = sectionMarks[sec.id];
          const t = parseInt(m?.total ?? "", 10);
          const o = parseInt(m?.obtained ?? "", 10);
          const sValid = !isNaN(o) && !isNaN(t) && t > 0 && o >= 0 && o <= t;
          return (
            <div key={sec.id} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <p className="text-sm font-semibold">{sec.label}</p>
                <p className="text-[10px] text-muted-foreground">{sec.description.split("(")[1]?.replace(")", "") ?? ""}</p>
              </div>
              <input
                type="number"
                min="0"
                max={t || sec.defaultTotalMarks}
                value={m?.obtained ?? ""}
                onChange={(e) => setSection(sec.id, "obtained", e.target.value)}
                placeholder="—"
                className="w-16 rounded-lg border bg-background px-2 py-1.5 text-center text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-xs text-muted-foreground">out of</span>
              <input
                type="number"
                min="1"
                value={m?.total ?? ""}
                onChange={(e) => setSection(sec.id, "total", e.target.value)}
                className="w-14 rounded-lg border bg-background px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {sValid && (
                <span className="ml-auto text-xs font-bold text-success">
                  {Math.round((o / t) * 100)}%
                </span>
              )}
            </div>
          );
        })}

        {pct !== null && valid && (
          <div className="rounded-lg bg-primary/5 px-4 py-3 text-center border-t">
            <p className="text-3xl font-bold text-primary">{pct}%</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {obtained}/{total} marks ·{" "}
              {pct >= 90 ? "Outstanding!" : pct >= 75 ? "Great job!" : pct >= 60 ? "Good effort!" : pct >= 40 ? "Keep practising!" : "Don't give up!"}
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Time taken: <span className="font-semibold">{formatTime(elapsed)}</span>
      </p>

      <div className="space-y-2">
        <Button
          onClick={handleSave}
          disabled={allFilled && !valid}
          size="lg"
          className="w-full gap-2 rounded-xl"
        >
          <Zap className="h-5 w-5" />
          Save &amp; Finish
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          className="w-full rounded-xl py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip — I'll check my score later
        </button>
      </div>
    </div>
  );
}

// ─── Results screen ────────────────────────────────────────────────────────────

function ResultsScreen({
  elapsed,
  score,
  awardedXp,
  onClose,
}: {
  elapsed: number;
  score: ScoreResult | null;
  /** What the server actually awarded; null until the event round-trips. */
  awardedXp: number | null;
  onClose: () => void;
}) {
  const pct = score && score.total > 0 ? Math.round((score.obtained / score.total) * 100) : null;
  const timeTakenMins = Math.round(elapsed / 60);

  const gradeLabel = pct === null ? "Attempt recorded!" : pct >= 90 ? "Outstanding! 🏆" : pct >= 75 ? "Great job! 🌟" : pct >= 60 ? "Good effort! 👍" : pct >= 40 ? "Keep practising! 💪" : "Don't give up! 📚";
  const timeComment = timeTakenMins <= 60 ? "You finished well ahead of time." : timeTakenMins <= 150 ? "Good time management." : "You used almost all your time — solid effort!";

  return (
    <div className="w-full max-w-lg space-y-6 animate-in fade-in">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{gradeLabel}</h2>
        <p className="mt-2 text-muted-foreground">{timeComment}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {pct !== null && (
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-primary">{pct}%</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Score</p>
          </div>
        )}
        <div className={`rounded-xl border bg-card p-4 text-center ${pct === null ? "col-span-2" : ""}`}>
          <p className="text-2xl font-bold">{formatTime(elapsed)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Time taken</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {awardedXp === null ? "…" : "+" + awardedXp}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">XP earned</p>
        </div>
      </div>

      {score && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section breakdown</p>
          {SECTIONS.map((sec) => {
            const m = score.sectionMarks[sec.id];
            const o = parseInt(m?.obtained ?? "", 10);
            const t = parseInt(m?.total ?? "", 10);
            if (isNaN(o) || isNaN(t) || t <= 0 || m?.obtained === "") return null;
            const secPct = Math.round((o / t) * 100);
            return (
              <div key={sec.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{sec.label}</span>
                  <span className={secPct >= 60 ? "font-bold text-success" : "font-bold text-destructive"}>
                    {o}/{t} ({secPct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${secPct >= 60 ? "bg-success" : secPct >= 40 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${secPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {score?.writtenAnswers && (
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Answer Notes</p>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{score.writtenAnswers}</p>
        </div>
      )}

      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <p className="text-eyebrow mb-1.5 text-primary">Next steps</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• Review difficult questions in the Subjects hub</li>
          <li>• Try another year's paper when you're ready</li>
          {pct !== null && pct < 60 && <li>• Focus on sections where you scored below 60%</li>}
        </ul>
      </div>

      <Button onClick={onClose} size="lg" className="w-full rounded-xl">Back to Papers</Button>
    </div>
  );
}
