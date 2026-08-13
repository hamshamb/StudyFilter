import React, { useState, useEffect, useRef } from "react";
import { SeoHead } from "@/components/SeoHead";
import { Link } from "wouter";
import {
  Target, CheckCircle2, XCircle, Trophy, Zap,
  RotateCcw, ChevronRight, BookOpen, FlaskConical,
  Calculator, Globe2, Sparkles, Timer, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useGrade } from "@/hooks/use-grade";
import { useStudyLevel } from "@/hooks/use-study-level";
import { useSession } from "@/hooks/use-session";
import { useXpEvent } from "@/hooks/use-xp-event";
import { LoadingBlock } from "@/components/ui/primitives";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject: string;
  chapter: string;
  difficulty: "easy" | "medium" | "hard";
}

interface SessionResult {
  question: QuizQuestion;
  selectedAnswer: string | null;
  isCorrect: boolean;
  timeTaken: number;
}

const SUBJECTS = [
  { label: "Mathematics", value: "Maths", icon: Calculator, color: "text-primary" },
  { label: "Science", value: "Science", icon: FlaskConical, color: "text-success" },
  { label: "Social Science", value: "Social Science", icon: Globe2, color: "text-warning" },
  { label: "English", value: "English", icon: BookOpen, color: "text-primary" },
  { label: "Mixed", value: "Mixed", icon: Sparkles, color: "text-primary" },
];

const DIFFICULTIES = [
/*
 * The `xp` figures that used to live here (10 / 25 / 50) were invented on
 * the client and shown as promises — "+10 XP each", "Correct! +25 XP", and a
 * results tile reading `correct * xp`. The server prices every XP event
 * itself, with accuracy and streak bonuses and a daily cap, so those numbers
 * were routinely wrong. A motivation system that quotes you a figure and then
 * awards a different one is worse than one that quotes nothing.
 *
 * Hard is no longer coloured as an error, either: choosing a hard set is an
 * ambition, not a mistake.
 */
  { label: "Easy", value: "easy", hint: "Warm-up", color: "text-success border-success/50" },
  { label: "Medium", value: "medium", hint: "Exam level", color: "text-warning border-warning/50" },
  { label: "Hard", value: "hard", hint: "Stretch", color: "text-primary border-primary/50" },
];

const QUESTION_COUNTS = [5, 10, 15, 20];

async function fetchQuizQuestions(
  classLevel: number,
  subject: string,
  difficulty: string,
  count: number
): Promise<QuizQuestion[]> {
  const res = await fetch("/api/study/practice-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classLevel, subject, difficulty, count }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Server returned ${res.status}`);
  }
  const data = await res.json();
  if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error("No questions received from server");
  }
  return data.questions as QuizQuestion[];
}

export default function Practice() {
  const { grade } = useGrade();
  const { level } = useStudyLevel();
  const sessionId = useSession();
  const { toast } = useToast();
  const recordXp = useXpEvent();
  /** Guards against reporting the same practice session more than once. */
  const sessionReported = useRef(false);

  const classLevel = grade ? parseInt(grade, 10) : 10;

  const [selectedSubject, setSelectedSubject] = useState("Mixed");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>(level.practiceDifficulty);
  const [questionCount, setQuestionCount] = useState(level.practiceCount);

  const [phase, setPhase] = useState<"setup" | "loading" | "quiz" | "results" | "error">("setup");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  // Keep the setup defaults aligned with the chosen study level until the
  // student starts a session (after which their manual picks stay put).
  useEffect(() => {
    if (phase !== "setup") return;
    setSelectedDifficulty(level.practiceDifficulty);
    setQuestionCount(level.practiceCount);
  }, [level.practiceDifficulty, level.practiceCount, phase]);

  const startQuiz = async () => {
    if (!grade) {
      toast({ title: "Pick your class first", description: "Choose your class from the top bar.", variant: "destructive" });
      return;
    }
    setPhase("loading");
    setErrorMessage("");
    try {
      const qs = await fetchQuizQuestions(classLevel, selectedSubject, selectedDifficulty, questionCount);
      setQuestions(qs);
      setCurrentIndex(0);
      setResults([]);
      sessionReported.current = false;
      setSelectedAnswer(null);
      setAnswered(false);
      setElapsedSeconds(0);
      setQuestionStartTime(Date.now());
      setTimerActive(true);
      setPhase("quiz");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMessage(msg);
      setPhase("error");
    }
  };

  const handleAnswer = (option: string) => {
    if (answered) return;
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    const q = questions[currentIndex];
    const isCorrect = option === q.correctAnswer;

    setSelectedAnswer(option);
    setAnswered(true);
    setTimerActive(false);

    setResults((prev) => [...prev, { question: q, selectedAnswer: option, isCorrect, timeTaken }]);

    // XP is awarded once for the whole session (see the results phase), not
    // per question — one event per attempt is far easier to price and audit.
  };

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      setTimerActive(false);
      setPhase("results");
      // Report the finished session once. Sent at the end rather than per
      // question so the whole attempt is one auditable, server-priced event.
      if (!sessionReported.current) {
        sessionReported.current = true;
        // handleAnswer has already committed the final result by the time the
        // student advances, so results is complete here.
        const correct = results.filter((r) => r.isCorrect).length;
        void recordXp({
          type: "quiz_completed",
          source: "practice",
          subject: selectedSubject,
          difficulty: selectedDifficulty,
          totalQuestions: questions.length,
          correctAnswers: Math.min(correct, questions.length),
        });
      }
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedAnswer(null);
    setAnswered(false);
    setElapsedSeconds(0);
    setQuestionStartTime(Date.now());
    setTimerActive(true);
  };

  const restart = () => {
    setPhase("setup");
    setQuestions([]);
    setResults([]);
    sessionReported.current = false;
    setSelectedAnswer(null);
    setAnswered(false);
    setCurrentIndex(0);
    setElapsedSeconds(0);
    setTimerActive(false);
    setErrorMessage("");
  };

  // ── ERROR SCREEN ─────────────────────────────────────────────
  if (phase === "error") {
    const isApiKeyError = errorMessage.toLowerCase().includes("api_key") ||
                          errorMessage.toLowerCase().includes("openai");
    return (
      <div className="min-h-viewport flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive-soft flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Couldn't load quiz</h2>
              <p className="text-sm text-muted-foreground">
                {isApiKeyError
                  ? "The server isn't configured for full answers yet. Try the local CBSE questions instead."
                  : errorMessage}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={restart} className="rounded-full">Try again</Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/chat">Ask a question instead</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── SETUP SCREEN ─────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <>
      <SeoHead
        title="Practice Quiz — CBSE MCQs | StudyFilter"
        description="Practice CBSE multiple-choice questions for Class 8–12. Earn XP, build streaks, and sharpen exam readiness across Maths, Science, Social Science and English."
        canonical="/practice"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "CBSE Practice Quiz",
          description:
            "Practice CBSE multiple-choice questions for Class 8–12 and earn XP for every correct answer.",
          url: "/practice",
          isPartOf: {
            "@type": "WebSite",
            name: "StudyFilter",
            url: "/",
          },
        }}
      />
      <div className="min-h-viewport flex flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Target className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Practice Mode</h1>
            <p className="text-muted-foreground text-base max-w-md mx-auto">
              Test your CBSE knowledge with practice quizzes. Earn XP for every correct answer.
            </p>
          </div>

          {!grade && (
            <Card className="border-warning/30 bg-warning-soft">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  Please pick your class from the top bar before starting practice.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Subject</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SUBJECTS.map(({ label, value, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setSelectedSubject(value)}
                  className={[
                    "flex items-center gap-2.5 rounded-xl border-2 p-3 text-left text-sm font-medium transition-all",
                    selectedSubject === value
                      ? `border-primary bg-primary/5 ${color} dark:bg-primary/8 dark:border-primary/60`
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 dark:border-border/40 dark:bg-card dark:hover:border-border/70",
                  ].join(" ")}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${selectedSubject === value ? color : ""}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</h2>
            <div className="flex gap-2">
              {DIFFICULTIES.map(({ label, value, hint, color }) => (
                <button
                  key={value}
                  onClick={() => setSelectedDifficulty(value)}
                  className={[
                    "flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all",
                    selectedDifficulty === value ? color + " bg-muted/30 dark:bg-card" : "border-border/50 text-muted-foreground hover:border-border dark:border-border/40 dark:hover:border-border/70",
                  ].join(" ")}
                >
                  {label}
                  <span className="block text-xs font-normal opacity-70 mt-0.5">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Number of Questions</h2>
            <div className="flex gap-2">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={[
                    "flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all",
                    questionCount === n
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border/50 text-muted-foreground hover:border-border",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={startQuiz} disabled={!grade} size="lg" className="w-full h-13 rounded-xl text-base font-semibold gap-2">
            <Zap className="h-5 w-5" /> Start Practice Session
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Class {grade ?? "?"} • {selectedSubject} • {selectedDifficulty} • {questionCount} questions
          </p>
        </div>
      </div>
      </>
    );
  }

  // ── LOADING ──────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-viewport flex flex-col items-center justify-center gap-6 px-4">
        <LoadingBlock label="Generating your quiz questions…" />
        <p className="text-xs text-muted-foreground">Class {classLevel} • {selectedSubject} • {selectedDifficulty}</p>
      </div>
    );
  }

  // ── QUIZ ─────────────────────────────────────────────────────
  if (phase === "quiz" && questions.length > 0) {
    const q = questions[currentIndex];
    const progress = (currentIndex / questions.length) * 100;
    const diffConfig = DIFFICULTIES.find((d) => d.value === selectedDifficulty);
    const correctSoFar = results.filter((r) => r.isCorrect).length;

    return (
      <div className="min-h-viewport flex flex-col">
        <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 py-3">
          <div className="max-w-2xl mx-auto space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">
                Question {currentIndex + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1">
                  <Trophy className="h-3 w-3 text-warning" />
                  {correctSoFar} correct
                </Badge>
                <Badge variant="outline" className={`gap-1 ${timerActive && elapsedSeconds > 30 ? "text-destructive border-destructive/50" : ""}`}>
                  <Timer className="h-3 w-3" />
                  {elapsedSeconds}s
                </Badge>
              </div>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 py-8">
          <div className="w-full max-w-2xl space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{q.subject}</Badge>
              {q.chapter && <Badge variant="outline" className="text-xs text-muted-foreground">{q.chapter}</Badge>}
              <Badge variant="outline" className={`text-xs ${diffConfig?.color}`}>{q.difficulty}</Badge>
            </div>

            <h2 className="text-xl md:text-2xl font-bold leading-snug">{q.question}</h2>

            <div className="space-y-2.5">
              {q.options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === q.correctAnswer;
                let cls = "w-full text-left rounded-xl border-2 px-4 py-3.5 text-sm font-medium transition-all ";
                if (!answered) {
                  cls += "border-border/60 hover:border-primary/50 hover:bg-primary/5 cursor-pointer";
                } else if (isCorrect) {
                  cls += "border-success/50 bg-success-soft text-success";
                } else if (isSelected) {
                  cls += "border-destructive/50 bg-destructive-soft text-destructive";
                } else {
                  cls += "border-border/40 opacity-40 cursor-not-allowed";
                }

                return (
                  <button key={idx} className={cls} onClick={() => handleAnswer(option)} disabled={answered}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current/30 flex items-center justify-center text-xs font-bold opacity-60">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {option}
                      </span>
                      {answered && isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                      {answered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className={`rounded-xl p-4 flex gap-3 items-start animate-in slide-in-from-top-2 duration-200 ${selectedAnswer === q.correctAnswer ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}>
                {selectedAnswer === q.correctAnswer
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  : <XCircle className="h-5 w-5 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold text-sm mb-1">
                    {selectedAnswer === q.correctAnswer ? "Correct" : "Not quite"}
                  </p>
                  <p className="text-sm">{q.explanation}</p>
                </div>
              </div>
            )}

            {answered && (
              <Button onClick={nextQuestion} className="w-full h-12 rounded-xl gap-2 text-base" size="lg">
                {currentIndex + 1 >= questions.length ? (
                  <><Trophy className="h-5 w-5" /> See Results</>
                ) : (
                  <>Next Question <ChevronRight className="h-5 w-5" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────
  if (phase === "results") {
    const correct = results.filter((r) => r.isCorrect).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const totalTime = results.reduce((s, r) => s + r.timeTaken, 0);
    const avgSeconds = total > 0 ? Math.round(totalTime / total) : 0;

    const gradeLabel =
      pct >= 90 ? "Outstanding! 🏆" :
      pct >= 75 ? "Great Job! 🌟" :
      pct >= 60 ? "Good Effort! 👍" :
      pct >= 40 ? "Keep Practising! 💪" : "Don't Give Up! 📚";

    return (
      <div className="min-h-viewport flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6 animate-in fade-in duration-500">
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-full bg-primary/10 mb-2">
              <Trophy className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">{gradeLabel}</h1>
            <div className="text-6xl font-bold text-primary">{pct}%</div>
            <p className="text-muted-foreground">{correct} out of {total} correct</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{correct}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Correct</div>
              </CardContent>
            </Card>
            {/*
              This tile read "+{correct * xp} XP Earned" from a client-side
              rate. XP is priced on the server, so the figure was often not
              the one that landed in the ledger. Average time per question is
              something the client genuinely knows, and it is the number that
              actually matters in a timed board paper.
            */}
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold tabular-nums">{avgSeconds}s</div>
                <div className="text-xs text-muted-foreground mt-0.5">Avg per question</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold tabular-nums">{totalTime}s</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total time</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Review Answers</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {results.map((r, idx) => (
                <div key={idx} className={`rounded-xl border p-3 text-sm ${r.isCorrect ? "border-success/30 bg-success-soft" : "border-destructive/30 bg-destructive-soft"}`}>
                  <div className="flex items-start gap-2">
                    {r.isCorrect
                      ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium leading-snug">{r.question.question}</p>
                      {!r.isCorrect && (
                        <p className="text-xs mt-1 text-success">
                          ✓ Correct: {r.question.correctAnswer}
                        </p>
                      )}
                      <p className="text-xs mt-1 text-muted-foreground">{r.question.explanation}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{r.timeTaken}s</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={restart} variant="outline" className="flex-1 rounded-xl gap-2">
              <RotateCcw className="h-4 w-4" /> New Quiz
            </Button>
            <Button onClick={startQuiz} className="flex-1 rounded-xl gap-2">
              <Zap className="h-4 w-4" /> Retry Same Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
