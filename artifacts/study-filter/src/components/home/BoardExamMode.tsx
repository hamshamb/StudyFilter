import React, { useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Search,
  Edit3,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useAskStudyFilter, useSearchWebAndAnswer } from "@workspace/api-client-react";
import type { StudyAnswer } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useGrade } from "@/hooks/use-grade";
import { useStudyLevel } from "@/hooks/use-study-level";
import { Spinner } from "@/components/ui/primitives";

const FORMATS = [
  { id: "simple",   label: "Simple" },
  { id: "3mark",    label: "3 Mark Answer" },
  { id: "5mark",    label: "5 Mark Answer" },
  { id: "keywords", label: "Keywords" },
  { id: "1mark",    label: "1 Mark Answer" },
  { id: "prev",     label: "Previous Year Style" },
];

const FORMAT_PROMPTS: Record<string, string> = {
  simple:   "Explain in simple language",
  "1mark":  "Give a 1-mark CBSE board exam answer for",
  "3mark":  "Give a 3-mark CBSE board exam answer for",
  "5mark":  "Give a complete 5-mark CBSE board exam answer for",
  keywords: "List the key terms and important keywords examiners look for in the answer to",
  prev:     "Show me a previous year CBSE board exam style answer for",
};

const PLACEHOLDER_Q = "Why is photosynthesis important?";

function pickDisplay(fmt: string, ans: StudyAnswer): string {
  if (fmt === "simple") {
    return ans.shortAnswer || ans.examReadyAnswer;
  }
  if (fmt === "keywords") {
    if (ans.examKeywords?.length) return ans.examKeywords.join(", ");
    return ans.shortAnswer;
  }
  if (ans.answerPoints?.length) {
    return ans.answerPoints.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
  }
  return ans.examReadyAnswer || ans.shortAnswer;
}

export function BoardExamMode() {
  const sessionId = useSession();
  const { grade } = useGrade();
  const { levelId } = useStudyLevel();
  const classLevel = grade ? parseInt(grade, 10) : 10;

  const [activeTab, setActiveTab]     = useState("simple");
  const [userQuestion, setUserQuestion] = useState("");
  const [liveAnswer, setLiveAnswer]   = useState<{ fmt: string; ans: StudyAnswer } | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const askMutation = useAskStudyFilter();
  const webMutation = useSearchWebAndAnswer();

  const isLoading = askMutation.isPending || webMutation.isPending;

  const question = userQuestion.trim() || PLACEHOLDER_Q;
  const fullQuestion = `${FORMAT_PROMPTS[activeTab]}: ${question}`;

  function handleSearch() {
    setError(null);
    setLiveAnswer(null);
    const fmt = activeTab;

    askMutation.mutate(
      { data: { question: fullQuestion, classLevel, sessionId, studyLevel: levelId ?? undefined } },
      {
        onSuccess(data) {
          setLiveAnswer({ fmt, ans: data });
          webMutation.mutate({ data: { question: fullQuestion, classLevel, sessionId, studyLevel: levelId ?? undefined } });
        },
        onError() {
          setError("Could not get an answer right now. Please try again.");
        },
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  const displayText = liveAnswer ? pickDisplay(liveAnswer.fmt, liveAnswer.ans) : null;
  const displayQuestion = liveAnswer ? userQuestion.trim() || PLACEHOLDER_Q : PLACEHOLDER_Q;

  return (
    <section id="board-exam" className="px-6 py-12 bg-muted/20 dark:bg-muted/10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Board Exam Mode
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Turn any answer into the format your teacher expects.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: controls */}
          <div className="flex flex-col justify-center space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FORMATS.map((btn) => (
                <Button
                  key={btn.id}
                  variant={activeTab === btn.id ? "default" : "outline"}
                  onClick={() => setActiveTab(btn.id)}
                  className={[
                    "h-auto py-3 text-sm transition-all duration-150",
                    activeTab === btn.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "dark:border-border/60 dark:hover:border-border",
                  ].join(" ")}
                >
                  {btn.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Edit3 className="h-3.5 w-3.5" /> Your question
              </label>
              <Input
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`e.g. ${PLACEHOLDER_Q}`}
                className="h-11 rounded-xl dark:border-border/60 dark:bg-card/50"
                disabled={isLoading}
              />
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full h-11 rounded-xl gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Getting answer…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Get {FORMATS.find((f) => f.id === activeTab)?.label}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right: preview card */}
          <div className="rounded-xl border bg-card p-6 shadow-sm relative overflow-hidden dark:border-border/60 dark:shadow-none dark:bg-card/70">
            {/* shimmer top */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent dark:via-primary/20" />

            <div className="absolute top-0 right-0 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 dark:bg-primary/15">
              <ShieldCheck className="h-3 w-3" /> Exam Ready
            </div>

            <p className="text-sm font-semibold text-muted-foreground mb-2 pr-24 truncate">
              Q: {displayQuestion}
            </p>

            <div className="min-h-[160px] bg-muted/30 rounded-xl p-4 mt-4 border border-border/50 dark:bg-muted/20 dark:border-border/40 flex flex-col justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground py-4">
                  <Spinner size="lg" className="text-primary" />
                  <span className="text-sm">Getting your {FORMATS.find(f => f.id === activeTab)?.label}…</span>
                </div>
              ) : error ? (
                <div className="flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              ) : displayText ? (
                <MarkdownRenderer compact className="text-sm leading-relaxed">
                  {displayText}
                </MarkdownRenderer>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground italic">
                  Select a format and press Search to see your answer here.
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-4">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {liveAnswer ? "Live answer" : "Matched with trusted sources"}
              </span>
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-primary" />
                {liveAnswer
                  ? `Confidence: ${liveAnswer.ans.confidence ?? "High"}`
                  : "Confidence: High"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
