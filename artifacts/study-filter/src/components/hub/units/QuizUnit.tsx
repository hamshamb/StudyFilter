import React from "react";
import { Check, X, RotateCw, FileQuestion } from "lucide-react";
import {
  useGeneratePracticeQuiz,
  type PracticeQuizQuestion,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/primitives";
import { useSession } from "@/hooks/use-session";
import { useXpEvent } from "@/hooks/use-xp-event";
import { useStudyLevel } from "@/hooks/use-study-level";
import { UnitLoading, UnitError, UnitEmpty } from "../UnitState";
import type { StudyContext } from "../types";
import { cn } from "@/lib/utils";

/**
 * The chapter quiz.
 *
 * Two things changed beyond the styling. The score panel used to claim
 * "+{score * 10} XP added to your progress" — a number invented on the client
 * while the server prices the event itself with accuracy and streak bonuses
 * and a daily cap, so the figure shown was frequently just wrong. And the
 * options were fixed emerald/rose Tailwind swatches, which meant a correct
 * answer in dark mode was a light-green wash that no token controlled.
 */
export function QuizUnit({ context }: { context: StudyContext }) {
  const sessionId = useSession();
  const { level } = useStudyLevel();
  const { mutate, data, isPending, isError } = useGeneratePracticeQuiz();
  const recordXp = useXpEvent();

  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const rewarded = React.useRef(false);

  const run = React.useCallback(() => {
    setAnswers({});
    setSubmitted(false);
    rewarded.current = false;
    mutate({
      data: {
        classLevel: context.classLevel,
        subject: context.subjectName,
        chapter: context.chapterTitle,
        topic: context.topic,
        difficulty: level.defaultQuizDifficulty,
        count: level.quizCount,
      },
    });
  }, [
    mutate,
    context.classLevel,
    context.subjectName,
    context.chapterTitle,
    context.topic,
    level.defaultQuizDifficulty,
    level.quizCount,
  ]);

  React.useEffect(() => {
    run();
  }, [run]);

  const questions = data?.questions ?? [];
  const score = questions.reduce(
    (n, q) => (answers[q.id] === q.correctAnswer ? n + 1 : n),
    0,
  );
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const submit = () => {
    setSubmitted(true);
    if (!rewarded.current && sessionId) {
      rewarded.current = true;
      // The server prices this — we only report what happened.
      void recordXp({
        type: "quiz_completed",
        source: "chapter_quiz",
        subject: context.subjectName,
        chapter: context.chapterTitle,
        totalQuestions: questions.length,
        correctAnswers: score,
      });
    }
  };

  if (isPending) return <UnitLoading message="Building your quiz" lines={2} />;
  if (isError || !data)
    return (
      <UnitError
        message="We couldn't build the quiz. Please try again."
        onRetry={run}
        retrying={isPending}
      />
    );
  if (!questions.length)
    return (
      <UnitEmpty
        icon={FileQuestion}
        title="No quiz available"
        message="Nothing was generated for this chapter. Reloading usually fixes it."
        action={
          <Button onClick={run} variant="outline">
            Reload
          </Button>
        }
      />
    );

  const wrong = questions.filter((q) => answers[q.id] !== q.correctAnswer);

  return (
    <div className="space-y-5">
      {/* ── Progress / result ─────────────────────────────────────────── */}
      {submitted ? (
        <QuizResult
          score={score}
          total={questions.length}
          wrongTopics={wrong.map((q) => q.question)}
          onRetry={run}
        />
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Answer all {questions.length} questions, then check your score.
            </p>
            <span className="text-sm font-medium tabular-nums">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <ProgressBar
            value={(answeredCount / questions.length) * 100}
            size="sm"
            className="mt-2"
            label={`${answeredCount} of ${questions.length} answered`}
          />
        </div>
      )}

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <QuizCard
            key={q.id}
            index={i}
            total={questions.length}
            question={q}
            selected={answers[q.id]}
            submitted={submitted}
            onSelect={(opt) =>
              !submitted && setAnswers((a) => ({ ...a, [q.id]: opt }))
            }
          />
        ))}
      </ol>

      {!submitted && (
        <Button onClick={submit} disabled={!allAnswered} className="w-full" size="lg">
          {allAnswered ? "Check my answers" : `${questions.length - answeredCount} left to answer`}
        </Button>
      )}
    </div>
  );
}

/**
 * The result view. A quiet celebration for a clean sweep — a green rule and a
 * sentence, not confetti.
 */
function QuizResult({
  score,
  total,
  wrongTopics,
  onRetry,
}: {
  score: number;
  total: number;
  wrongTopics: string[];
  onRetry: () => void;
}) {
  const perfect = score === total;
  const pct = total > 0 ? (score / total) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5",
        perfect ? "border-success/35 bg-success-soft/50" : "border-card-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-3xl font-bold tabular-nums tracking-tight">
            {score}
            <span className="text-xl font-normal text-muted-foreground"> / {total}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {perfect
              ? "Clean sweep. That chapter is solid."
              : pct >= 60
                ? "Good work — a couple to look at again."
                : "Worth another pass at this chapter."}
          </p>
        </div>
        <Button onClick={onRetry} variant="outline" size="sm" className="shrink-0">
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          New set
        </Button>
      </div>

      <ProgressBar
        value={pct}
        tone={perfect ? "success" : pct >= 60 ? "primary" : "warning"}
        className="mt-3.5"
        label={`Scored ${score} out of ${total}`}
      />

      {wrongTopics.length > 0 && (
        <div className="mt-4 border-t border-border pt-3.5">
          <p className="text-eyebrow text-muted-foreground">Review these</p>
          <ul className="mt-1.5 space-y-1">
            {wrongTopics.slice(0, 3).map((q) => (
              <li key={q} className="flex gap-2 text-sm text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground"
                />
                <span className="line-clamp-1">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuizCard({
  index,
  total,
  question,
  selected,
  submitted,
  onSelect,
}: {
  index: number;
  total: number;
  question: PracticeQuizQuestion;
  selected?: string;
  submitted: boolean;
  onSelect: (opt: string) => void;
}) {
  return (
    <li className="rounded-xl border border-card-border bg-card p-4">
      <p className="text-eyebrow text-muted-foreground">
        Question {index + 1} of {total}
      </p>
      <p className="mt-1.5 font-medium leading-snug">{question.question}</p>

      <div className="mt-3.5 space-y-2" role="group" aria-label={`Options for question ${index + 1}`}>
        {question.options.map((opt) => {
          const isSelected = selected === opt;
          const isCorrect = opt === question.correctAnswer;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              disabled={submitted}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors duration-150",
                submitted
                  ? isCorrect
                    ? "border-success/45 bg-success-soft text-foreground"
                    : isSelected
                      ? "border-destructive/45 bg-destructive-soft text-foreground"
                      : "border-border text-muted-foreground"
                  : isSelected
                    ? "border-primary bg-primary/8 font-medium"
                    : "border-border hover:border-primary/40 hover:bg-muted/60",
              )}
            >
              <span className="min-w-0">{opt}</span>
              {submitted && isCorrect ? (
                <Check className="h-4 w-4 shrink-0 text-success" aria-label="Correct answer" />
              ) : submitted && isSelected ? (
                <X className="h-4 w-4 shrink-0 text-destructive" aria-label="Your answer, incorrect" />
              ) : null}
            </button>
          );
        })}
      </div>

      {submitted && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
          {question.explanation}
        </p>
      )}
    </li>
  );
}
