import React from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  FileQuestion,
  Layers,
  NotebookPen,
  Play,
  RotateCw,
  Target,
  Timer,
  X,
} from "lucide-react";
import { SUBJECTS, type SubjectId } from "@workspace/cbse-content";
import { PageShell, PageHeader, Panel, EmptyState } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Chip, IconBadge, ProgressBar, Spinner, Stat } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";
import { cn } from "@/lib/utils";
import { useScopedRoute } from "@/hooks/use-study-scope";
import { usePreferences } from "@/hooks/use-preferences";
import { useXpEvent } from "@/hooks/use-xp-event";
import { recordMasteryBatch, useMastery } from "@/hooks/use-mastery";
import { chapterKey, topicKey } from "@/lib/mastery";
import { recordRecent } from "@/hooks/use-recents";
import { generateQuiz, type GeneratedQuizQuestion } from "@/lib/study-content";
import { errorMessage } from "@/lib/api";
import { scopeToSearch } from "@/lib/scope";
import {
  FORMAT_LABELS,
  MODE_INFO,
  QUIZ_FORMATS,
  QUIZ_MODES,
  RAPID_SECONDS,
  abandonQuizSession,
  answerQuestion,
  finishQuizSession,
  formatDuration,
  goToQuestion,
  startQuizSession,
  useQuizStore,
  type QuizConfig,
  type QuizFormat,
  type QuizMode,
} from "@/hooks/use-quiz-session";

/**
 * The quiz.
 *
 * Not a redirect, not a prompt prefix, not five MCQs generated on mount and
 * thrown away. A student chooses what to be tested on and how, sits the quiz
 * with real state behind it, and gets a result that tells them which concepts
 * to go back to — which is then the thing "practise your weak areas" acts on.
 *
 * The three screens are one route on purpose. `/quiz?subject=science&chapter=
 * electricity` is a shareable, refreshable location, and refreshing mid-quiz
 * resumes rather than restarts, because the session is persisted.
 */

const COUNTS = [5, 10, 15, 20] as const;
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const;

type Screen = "setup" | "playing" | "results" | "review";

export default function Quiz() {
  const { scope, setScope } = useScopedRoute("/quiz");
  const { inProgress, active } = useQuizStore();
  const [screen, setScreen] = React.useState<Screen>(() => (inProgress ? "playing" : "setup"));

  // A finished session means the results are what should be on screen — this
  // is what makes a refresh on the results page keep showing the result.
  React.useEffect(() => {
    if (active?.finishedAt && screen === "playing") setScreen("results");
  }, [active?.finishedAt, screen]);

  return (
    <>
      <SeoHead
        title="Quiz yourself — CBSE practice questions | StudyFilter"
        description="Build a CBSE quiz your own way: pick the chapter, the number of questions, the difficulty and the question types, then sit it with a timer or without."
        canonical="/quiz"
      />
      {screen === "setup" && (
        <QuizSetup
          scope={scope}
          setScope={setScope}
          onStarted={() => setScreen("playing")}
          resumable={!!inProgress}
          onResume={() => setScreen("playing")}
        />
      )}
      {screen === "playing" && <QuizPlayer onFinish={() => setScreen("results")} onQuit={() => setScreen("setup")} />}
      {screen === "results" && (
        <QuizResults onReview={() => setScreen("review")} onNewQuiz={() => setScreen("setup")} />
      )}
      {screen === "review" && <QuizReview onBack={() => setScreen("results")} />}
    </>
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

function QuizSetup({
  scope,
  setScope,
  onStarted,
  resumable,
  onResume,
}: {
  scope: ReturnType<typeof useScopedRoute>["scope"];
  setScope: ReturnType<typeof useScopedRoute>["setScope"];
  onStarted: () => void;
  resumable: boolean;
  onResume: () => void;
}) {
  const { prefs } = usePreferences();
  const { weakTopics } = useQuizStore();
  const mastery = useMastery();

  const [count, setCount] = React.useState<number>(prefs.quizCount);
  const [customCount, setCustomCount] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<string>(
    prefs.quizDifficulty === "adaptive" ? "mixed" : prefs.quizDifficulty,
  );
  const [formats, setFormats] = React.useState<QuizFormat[]>(["mcq"]);
  const [mode, setMode] = React.useState<QuizMode>("practice");
  const [timed, setTimed] = React.useState(prefs.quizTimer);
  const [focusWeak, setFocusWeak] = React.useState(false);

  const weak = weakTopics(6);

  /*
   * "Adaptive" is a real setting, not a label. It reads the mastery this
   * student has actually built in this chapter and picks the level up from it,
   * so someone strong here gets hard questions and someone new gets easy ones.
   */
  const resolvedDifficulty = React.useMemo(() => {
    if (prefs.quizDifficulty !== "adaptive") return difficulty;
    if (!scope.subjectId || !scope.chapterId) return "medium";
    const record = mastery.get(chapterKey(scope.subjectId, scope.chapterId));
    if (!record || record.attempts < 5) return "easy";
    if (record.recent >= 0.8) return "hard";
    if (record.recent >= 0.55) return "medium";
    return "easy";
  }, [prefs.quizDifficulty, difficulty, scope.subjectId, scope.chapterId, mastery]);

  const generate = useMutation({
    mutationFn: async () => {
      const config: QuizConfig = {
        classLevel: scope.classLevel,
        subjectId: scope.subjectId,
        subjectName: scope.subject?.name ?? "Mixed",
        chapterId: scope.chapterId,
        chapterTitle: scope.chapter?.title ?? "",
        topic: scope.topic,
        count,
        difficulty: resolvedDifficulty,
        formats,
        mode,
        timeLimitSec: mode === "rapid" ? 0 : timed ? count * 60 : 0,
        instantFeedback: mode === "practice" && prefs.quizExplanations === "immediate",
      };

      const result = await generateQuiz({
        classLevel: config.classLevel,
        ...(scope.subject ? { subject: scope.subject.name } : {}),
        ...(scope.chapter ? { chapter: scope.chapter.title } : {}),
        ...(scope.topic ? { topic: scope.topic } : {}),
        difficulty: config.difficulty,
        count: config.count,
        formats: config.formats,
        ...(focusWeak && weak.length > 0 ? { focus: weak } : {}),
      });

      const questions = (result.questions ?? []).filter(
        (q): q is GeneratedQuizQuestion => !!q?.question && Array.isArray(q.options),
      );
      if (questions.length === 0) throw new Error("No questions came back");

      startQuizSession({ ...config, count: questions.length }, questions);
      recordRecent({
        kind: "quiz",
        title: `${config.chapterTitle || config.subjectName} quiz`,
        subtitle: `${questions.length} questions · ${config.difficulty}`,
        href: `/quiz${scopeToSearch(scope)}`,
        ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
        ...(scope.chapterId ? { chapterId: scope.chapterId } : {}),
        progress: 0,
      });
    },
    onSuccess: onStarted,
  });

  function toggleFormat(format: QuizFormat) {
    setFormats((prev) => {
      const next = prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format];
      // At least one format has to be on, or there is nothing to generate.
      return next.length === 0 ? ["mcq"] : next;
    });
  }

  return (
    <PageShell width="content">
      <PageHeader
        icon={FileQuestion}
        title="Quiz yourself"
        eyebrow={scope.hasChapter ? scope.label : `Class ${scope.classLevel} · CBSE`}
        description="Build the quiz you actually need. Everything below changes the questions you get."
      />

      {resumable && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm">
            You have a quiz in progress. Pick up where you left off?
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onResume}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Resume
            </Button>
            <Button size="sm" variant="ghost" onClick={abandonQuizSession}>
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Panel title="What to test" icon={Target}>
          <div className="space-y-4">
            <Field label="Subject">
              <div className="rail py-0.5">
                <Chip active={!scope.subjectId} onClick={() => setScope({ subjectId: null, chapterId: null })}>
                  Mixed
                </Chip>
                {SUBJECTS.map((subject) => (
                  <Chip
                    key={subject.id}
                    active={scope.subjectId === subject.id}
                    onClick={() => setScope({ subjectId: subject.id, chapterId: null })}
                  >
                    {subject.shortName}
                  </Chip>
                ))}
              </div>
            </Field>

            {scope.subject && (
              <Field label="Chapter" hint="Leave on “Whole subject” to mix chapters.">
                <select
                  value={scope.chapterId ?? ""}
                  onChange={(e) => setScope({ chapterId: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  aria-label="Chapter"
                >
                  <option value="">Whole subject</option>
                  {scope.subject.chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.number}. {chapter.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {scope.hasChapter && (
              <Field label="Topic" hint="Optional — narrows the quiz to one idea in the chapter.">
                <input
                  type="text"
                  value={scope.topic ?? ""}
                  onChange={(e) => setScope({ topic: e.target.value || null }, { replace: true })}
                  placeholder="e.g. Ohm's law"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </Field>
            )}

            {weak.length > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
                <input
                  type="checkbox"
                  checked={focusWeak}
                  onChange={(e) => setFocusWeak(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Target my weak concepts</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    From your recent quizzes: {weak.slice(0, 4).join(", ")}
                    {weak.length > 4 ? "…" : ""}
                  </span>
                </span>
              </label>
            )}
          </div>
        </Panel>

        <Panel title="How many, and how hard" icon={Layers}>
          <div className="space-y-4">
            <Field label="Questions">
              <div className="flex flex-wrap items-center gap-2">
                {COUNTS.map((n) => (
                  <Chip key={n} active={count === n && !customCount} onClick={() => { setCount(n); setCustomCount(""); }}>
                    {n}
                  </Chip>
                ))}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customCount}
                  onChange={(e) => {
                    setCustomCount(e.target.value);
                    const parsed = parseInt(e.target.value, 10);
                    if (Number.isFinite(parsed)) setCount(Math.max(1, Math.min(30, parsed)));
                  }}
                  placeholder="Custom"
                  aria-label="Custom number of questions"
                  className="h-8 w-24 rounded-full border border-input bg-background px-3 text-xs"
                />
              </div>
            </Field>

            <Field
              label="Difficulty"
              hint={
                prefs.quizDifficulty === "adaptive"
                  ? `Adaptive is on in your settings — this chapter is being set to ${resolvedDifficulty}.`
                  : undefined
              }
            >
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Chip
                    key={d}
                    active={resolvedDifficulty === d}
                    onClick={() => setDifficulty(d)}
                    className={prefs.quizDifficulty === "adaptive" ? "opacity-70" : undefined}
                  >
                    {d[0]!.toUpperCase() + d.slice(1)}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Question types" hint="Pick more than one for a mixed paper.">
              <div className="flex flex-wrap gap-2">
                {QUIZ_FORMATS.map((format) => (
                  <Chip key={format} active={formats.includes(format)} onClick={() => toggleFormat(format)}>
                    {FORMAT_LABELS[format]}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        </Panel>

        <Panel title="How you want to sit it" icon={Timer}>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {QUIZ_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors duration-150",
                    mode === m ? "border-primary bg-primary/8" : "border-border hover:bg-muted/50",
                  )}
                >
                  <p className="text-sm font-semibold">{MODE_INFO[m].label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{MODE_INFO[m].hint}</p>
                </button>
              ))}
            </div>

            {mode !== "rapid" && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3">
                <span>
                  <span className="block text-sm font-medium">Timer</span>
                  <span className="text-xs text-muted-foreground">
                    {timed ? `${count} minutes for ${count} questions` : "No clock"}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={timed}
                  onChange={(e) => setTimed(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
              </label>
            )}
            {mode === "rapid" && (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Rapid fire gives you {RAPID_SECONDS} seconds per question. Running out counts as a skip.
              </p>
            )}
          </div>
        </Panel>

        {generate.isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">We couldn&rsquo;t prepare this quiz.</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {errorMessage(generate.error, "The question generator didn't respond.")}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => generate.mutate()}>
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </Button>
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          data-testid="button-start-quiz"
        >
          {generate.isPending ? (
            <>
              <Spinner /> Writing {count} questions…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" aria-hidden="true" />
              Start the quiz
            </>
          )}
        </Button>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-eyebrow mb-1.5 text-muted-foreground">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Player ───────────────────────────────────────────────────────────────────

function QuizPlayer({ onFinish, onQuit }: { onFinish: () => void; onQuit: () => void }) {
  const { inProgress } = useQuizStore();
  const recordXp = useXpEvent();
  const startedRef = React.useRef(Date.now());
  const [revealed, setRevealed] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const session = inProgress;
  const question = session?.questions[session.index];

  // Reset the per-question clock whenever the question changes.
  React.useEffect(() => {
    startedRef.current = Date.now();
    setRevealed(false);
  }, [session?.index]);

  // One ticking clock, used by both the whole-quiz limit and rapid fire.
  React.useEffect(() => {
    const id = window.setInterval(() => setElapsed(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  void elapsed;

  const submit = React.useCallback(() => {
    const attempt = finishQuizSession();
    if (attempt) {
      void recordXp({
        type: "quiz_completed",
        source: "quiz",
        subject: attempt.config.subjectName,
        chapter: attempt.config.chapterTitle || attempt.config.subjectName,
        totalQuestions: attempt.total,
        correctAnswers: attempt.score,
      });

      // Mastery: the chapter as a whole, plus each concept the quiz named.
      const entries: Parameters<typeof recordMasteryBatch>[0] = [];
      if (attempt.config.subjectId && attempt.config.chapterId) {
        entries.push({
          target: {
            key: chapterKey(attempt.config.subjectId, attempt.config.chapterId),
            domain: "chapter",
            label: attempt.config.chapterTitle,
            subjectId: attempt.config.subjectId,
            chapterId: attempt.config.chapterId,
          },
          correct: attempt.score,
          total: attempt.total,
        });
        for (const topic of attempt.weakTopics) {
          entries.push({
            target: {
              key: topicKey(attempt.config.subjectId, attempt.config.chapterId, topic),
              domain: "topic",
              label: topic,
              subjectId: attempt.config.subjectId,
              chapterId: attempt.config.chapterId,
            },
            correct: 0,
            total: 1,
          });
        }
        for (const topic of attempt.strongTopics) {
          entries.push({
            target: {
              key: topicKey(attempt.config.subjectId, attempt.config.chapterId, topic),
              domain: "topic",
              label: topic,
              subjectId: attempt.config.subjectId,
              chapterId: attempt.config.chapterId,
            },
            correct: 1,
            total: 1,
          });
        }
      }
      recordMasteryBatch(entries);
    }
    onFinish();
  }, [recordXp, onFinish]);

  const answered = session ? Object.keys(session.answers).length : 0;

  const choose = React.useCallback(
    (option: string) => {
      if (!session || !question) return;
      const existing = session.answers[question.id];
      // In exam mode an answer can be changed until submission; in practice
      // mode the first answer stands, because the explanation has been shown.
      if (existing && session.config.mode !== "exam") return;
      answerQuestion(question.id, option, Date.now() - startedRef.current);
      if (session.config.instantFeedback) setRevealed(true);
    },
    [session, question],
  );

  const advance = React.useCallback(() => {
    if (!session) return;
    if (session.index + 1 >= session.questions.length) {
      submit();
      return;
    }
    goToQuestion(session.index + 1);
  }, [session, submit]);

  /*
   * Running out of time submits. In an effect, not in render: submitting
   * writes to the store, and a store write during render is exactly the sort
   * of thing that produces an infinite loop the first time someone leaves a
   * timed quiz open in a background tab.
   */
  const timeLimitSec = session?.config.timeLimitSec ?? 0;
  const startedAt = session?.startedAt ?? 0;
  React.useEffect(() => {
    if (!timeLimitSec) return;
    const remaining = timeLimitSec * 1000 - (Date.now() - startedAt);
    if (remaining <= 0) {
      submit();
      return;
    }
    const id = window.setTimeout(submit, remaining);
    return () => window.clearTimeout(id);
  }, [timeLimitSec, startedAt, submit]);

  // Rapid fire: a hard per-question limit, enforced here rather than described.
  React.useEffect(() => {
    if (!session || session.config.mode !== "rapid" || !question) return;
    const id = window.setTimeout(() => {
      if (!session.answers[question.id]) {
        answerQuestion(question.id, null, RAPID_SECONDS * 1000);
      }
      advance();
    }, RAPID_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, [session, question, advance]);

  if (!session || !question) {
    return (
      <PageShell width="content">
        <EmptyState
          icon={FileQuestion}
          title="No quiz in progress"
          description="Set one up and it will appear here."
          action={<Button onClick={onQuit}>Build a quiz</Button>}
        />
      </PageShell>
    );
  }

  const current = session.answers[question.id];
  const showFeedback = session.config.instantFeedback && (revealed || !!current);
  const remainingSec =
    session.config.timeLimitSec > 0
      ? Math.max(0, session.config.timeLimitSec - Math.round((Date.now() - session.startedAt) / 1000))
      : null;

  return (
    <PageShell width="content">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-eyebrow text-muted-foreground">
            {session.config.chapterTitle || session.config.subjectName} ·{" "}
            {MODE_INFO[session.config.mode].label}
          </p>
          <h1 className="text-page-title mt-0.5">
            Question {session.index + 1}
            <span className="text-xl font-normal text-muted-foreground">
              {" "}
              / {session.questions.length}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {remainingSec !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums",
                remainingSec < 60 ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground",
              )}
              role="timer"
              aria-live="off"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              abandonQuizSession();
              onQuit();
            }}
          >
            Quit
          </Button>
        </div>
      </div>

      <ProgressBar
        value={(answered / session.questions.length) * 100}
        label={`${answered} of ${session.questions.length} answered`}
        className="mb-5"
      />

      <div className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
        {question.format && question.format !== "mcq" && (
          <p className="text-eyebrow mb-2 text-muted-foreground">
            {FORMAT_LABELS[question.format as QuizFormat] ?? question.format}
          </p>
        )}
        <p className="text-[0.9375rem] font-medium leading-snug">{question.question}</p>

        <div
          className="mt-4 space-y-2"
          role="group"
          aria-label={`Options for question ${session.index + 1}`}
        >
          {question.options.map((option) => {
            const chosen = current?.chosen === option;
            const isCorrect = option === question.correctAnswer;
            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={chosen}
                disabled={showFeedback && !!current}
                className={cn(
                  // 44px minimum: these are the main targets on a phone.
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors duration-150",
                  showFeedback
                    ? isCorrect
                      ? "border-success/45 bg-success-soft"
                      : chosen
                        ? "border-destructive/45 bg-destructive-soft"
                        : "border-border text-muted-foreground"
                    : chosen
                      ? "border-primary bg-primary/8 font-medium"
                      : "border-border hover:border-primary/40 hover:bg-muted/60",
                )}
              >
                <span className="min-w-0">{option}</span>
                {showFeedback && isCorrect ? (
                  <Check className="h-4 w-4 shrink-0 text-success" aria-label="Correct answer" />
                ) : showFeedback && chosen ? (
                  <X className="h-4 w-4 shrink-0 text-destructive" aria-label="Your answer, wrong" />
                ) : null}
              </button>
            );
          })}
        </div>

        {showFeedback && question.explanation && (
          <p className="mt-3.5 rounded-lg bg-muted px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
            {question.explanation}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => goToQuestion(session.index - 1)}
          disabled={session.index === 0 || session.config.mode === "rapid"}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <div className="flex gap-2">
          {!current && session.config.mode !== "rapid" && (
            <Button
              variant="outline"
              onClick={() => {
                answerQuestion(question.id, null, Date.now() - startedRef.current);
                advance();
              }}
            >
              Skip
            </Button>
          )}
          <Button onClick={advance} data-testid="button-quiz-next">
            {session.index + 1 >= session.questions.length ? "Finish" : "Next"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Question palette — jump anywhere, see what is left. Hidden in rapid
          fire, where going back would defeat the mode. */}
      {session.config.mode !== "rapid" && (
        <nav className="mt-6" aria-label="Question palette">
          <p className="text-eyebrow mb-2 text-muted-foreground">All questions</p>
          <div className="flex flex-wrap gap-1.5">
            {session.questions.map((q, i) => {
              const answer = session.answers[q.id];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goToQuestion(i)}
                  aria-label={`Question ${i + 1}${answer ? (answer.chosen ? ", answered" : ", skipped") : ", not answered"}`}
                  aria-current={i === session.index ? "true" : undefined}
                  className={cn(
                    "h-9 w-9 rounded-lg border text-xs font-semibold tabular-nums transition-colors",
                    i === session.index && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                    answer?.chosen
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : answer
                        ? "border-warning/40 bg-warning-soft text-warning"
                        : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <div className="mt-5">
        <Button variant="outline" className="w-full" onClick={submit}>
          Submit and see my score
        </Button>
      </div>
    </PageShell>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────

function QuizResults({ onReview, onNewQuiz }: { onReview: () => void; onNewQuiz: () => void }) {
  const { active, attempts } = useQuizStore();
  const [, navigate] = useLocation();
  const attempt = attempts[0];

  if (!active || !attempt) {
    return (
      <PageShell width="content">
        <EmptyState
          icon={FileQuestion}
          title="No result to show"
          description="Finish a quiz and your score appears here."
          action={<Button onClick={onNewQuiz}>Build a quiz</Button>}
        />
      </PageShell>
    );
  }

  const pct = Math.round((attempt.score / attempt.total) * 100);
  const wrongCount = attempt.total - attempt.score;
  const scopeSearch = scopeToSearch({
    subjectId: (attempt.config.subjectId as SubjectId | null) ?? null,
    chapterId: attempt.config.chapterId,
  });

  /*
   * What to offer next depends on how it went. A student who scored 9/10 does
   * not need "revise the basics", and one who scored 3/10 should not be pushed
   * straight into a harder set — that is the difference between a suggestion
   * and a menu.
   */
  const nextActions =
    pct >= 80
      ? [
          { label: "Harder quiz on this", onClick: onNewQuiz, icon: Target },
          { label: "Revise before you forget", href: `/revise${scopeSearch}`, icon: NotebookPen },
        ]
      : pct >= 50
        ? [
            { label: `Review the ${wrongCount} you missed`, onClick: onReview, icon: RotateCw },
            { label: "Quick revision", href: `/revise${scopeSearch}`, icon: NotebookPen },
            { label: "Make flashcards", href: `/flashcards${scopeSearch}`, icon: Layers },
          ]
        : [
            { label: `Review the ${wrongCount} you missed`, onClick: onReview, icon: RotateCw },
            { label: "Read the chapter summary", href: `/revise${scopeSearch}`, icon: NotebookPen },
            { label: "Try an easier set", onClick: onNewQuiz, icon: Play },
          ];

  return (
    <PageShell width="content">
      <PageHeader
        title={`${attempt.score} out of ${attempt.total}`}
        eyebrow={attempt.config.chapterTitle || attempt.config.subjectName}
        description={
          pct >= 80
            ? "That chapter is in good shape."
            : pct >= 50
              ? "Solid — the misses are worth a look."
              : "Worth another pass before you test yourself again."
        }
      />

      <ProgressBar
        value={pct}
        tone={pct >= 80 ? "success" : pct >= 50 ? "primary" : "warning"}
        label={`Scored ${attempt.score} out of ${attempt.total}`}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Accuracy" value={`${pct}%`} />
        <Stat label="Time taken" value={formatDuration(attempt.ms)} hint={`${Math.round(attempt.ms / attempt.total / 1000)}s a question`} />
        <Stat
          label="Skipped"
          value={
            Object.values(active.answers).filter((a) => a.chosen === null).length
          }
        />
      </div>

      {(attempt.weakTopics.length > 0 || attempt.strongTopics.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {attempt.strongTopics.length > 0 && (
            <Panel title="Solid" icon={Check}>
              <ul className="flex flex-wrap gap-1.5">
                {attempt.strongTopics.map((topic) => (
                  <li
                    key={topic}
                    className="rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-medium text-success"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {attempt.weakTopics.length > 0 && (
            <Panel title="Go back to these" icon={AlertTriangle}>
              <ul className="flex flex-wrap gap-1.5">
                {attempt.weakTopics.map((topic) => (
                  <li key={topic}>
                    <Link
                      href={`/explain${scopeSearch}${scopeSearch ? "&" : "?"}topic=${encodeURIComponent(topic)}`}
                      className="inline-block rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
                    >
                      {topic}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Tap one to have it explained.
              </p>
            </Panel>
          )}
        </div>
      )}

      <div className="mt-5">
        <p className="text-eyebrow mb-2 text-muted-foreground">What next</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {nextActions.map((action) => {
            const Icon = action.icon;
            const content = (
              <>
                <IconBadge icon={Icon} size="sm" />
                <span className="text-sm font-medium">{action.label}</span>
              </>
            );
            const className =
              "flex items-center gap-2.5 rounded-xl border border-card-border bg-card p-3.5 text-left transition-colors hover:border-primary/35 hover:bg-muted/40";
            return "href" in action && action.href ? (
              <Link key={action.label} href={action.href} className={className}>
                {content}
              </Link>
            ) : (
              <button key={action.label} type="button" onClick={action.onClick} className={className}>
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onReview}>
          Review every question
        </Button>
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          See my progress
        </Button>
      </div>
    </PageShell>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────

function QuizReview({ onBack }: { onBack: () => void }) {
  const { active } = useQuizStore();
  const [onlyWrong, setOnlyWrong] = React.useState(true);

  if (!active) {
    return (
      <PageShell width="content">
        <EmptyState icon={FileQuestion} title="Nothing to review" action={<Button onClick={onBack}>Back</Button>} />
      </PageShell>
    );
  }

  const shown = active.questions.filter((q) =>
    onlyWrong ? !active.answers[q.id]?.correct : true,
  );

  return (
    <PageShell width="content">
      <PageHeader
        title="Review"
        eyebrow={active.config.chapterTitle || active.config.subjectName}
        description="The answer, why it is the answer, and what you chose."
        actions={
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to result
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <Chip active={onlyWrong} onClick={() => setOnlyWrong(true)}>
          Only what I missed
        </Chip>
        <Chip active={!onlyWrong} onClick={() => setOnlyWrong(false)}>
          Every question
        </Chip>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Check}
          title="Nothing missed"
          description="You got every question right."
          action={<Button onClick={onBack}>Back to result</Button>}
        />
      ) : (
        <ol className="space-y-3">
          {shown.map((question) => {
            const answer = active.answers[question.id];
            return (
              <li key={question.id} className="rounded-xl border border-card-border bg-card p-4">
                <p className="font-medium leading-snug">{question.question}</p>
                {question.topic && (
                  <p className="mt-1 text-xs text-muted-foreground">Concept: {question.topic}</p>
                )}
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">You said</dt>
                    <dd className={answer?.correct ? "text-success" : "text-destructive"}>
                      {answer?.chosen ?? "Skipped"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">Answer</dt>
                    <dd className="font-medium">{question.correctAnswer}</dd>
                  </div>
                </dl>
                {question.explanation && (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                    {question.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </PageShell>
  );
}
