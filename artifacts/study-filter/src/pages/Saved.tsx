import React, { useState } from "react";
import { Link } from "wouter";
import {
  Bookmark,
  Trash2,
  GraduationCap,
  Sparkles,
  BookOpen,
  Lightbulb,
  ArrowRight,
  X,
  Target,
  AlertCircle,
  ScrollText,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useBookmarks,
  type Bookmark as BookmarkType,
} from "@/hooks/use-bookmarks";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader, EmptyState } from "@/components/layout/PageShell";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { SeoHead } from "@/components/SeoHead";

function inferSubject(question: string, answer: any): string {
  const detected = answer?.detectedSubject;
  if (detected) return detected;
  const q = question.toLowerCase();
  if (/math|equation|algebra|polynom|geomet|trigono/i.test(q)) return "Maths";
  if (/scien|physics|chemi|bio|photosynth|electric|reactio/i.test(q))
    return "Science";
  if (/history|civic|geography|econom|national|political/i.test(q))
    return "Social Science";
  if (/english|grammar|literat|writing/i.test(q)) return "English";
  if (/hindi|vyakaran/i.test(q)) return "Hindi";
  return "General";
}

export default function Saved() {
  const { bookmarks, removeBookmark, clearBookmarks } = useBookmarks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const selected = bookmarks.find((b) => b.id === selectedId);

  const handleRemove = (id: string) => {
    removeBookmark(id);
    if (selectedId === id) setSelectedId(null);
    toast({ title: "Removed", description: "Answer removed from Saved." });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Answer copied to clipboard." });
  };

  return (
    <>
      <SeoHead
        title="Saved answers — StudyFilter"
        description="Review the CBSE explanations and exam-ready answers you saved in StudyFilter."
        canonical="/saved"
      />
      <PageShell>
      <PageHeader
        icon={Bookmark}
        title="Saved Answers"
        description={
          bookmarks.length > 0
            ? `${bookmarks.length} saved answer${bookmarks.length === 1 ? "" : "s"} — tap any card to read the full answer.`
            : "Your bookmarked answers — perfect for last-minute revision."
        }
        actions={
          bookmarks.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearBookmarks}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Clear all
            </Button>
          ) : null
        }
      />

      {bookmarks.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved answers yet"
          description="Tap the bookmark icon on any answer to keep it here for quick revision later."
          action={
            <Button asChild>
              <Link href="/chat">
                Ask a question <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookmarks.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className="group text-left rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-border/60 dark:hover:border-primary/30"
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    Class {b.classLevel}
                  </Badge>
                </div>
              </div>

              <p className="font-medium leading-snug line-clamp-3 mb-3 min-h-[3.6em]">
                {b.question}
              </p>

              <div className="text-xs text-muted-foreground line-clamp-2 mb-4">
                <MarkdownRenderer compact>
                  {b.answer.shortAnswer || b.answer.examReadyAnswer?.slice(0, 100)}
                </MarkdownRenderer>
              </div>

              <div className="flex items-center justify-between border-t pt-3 mt-auto">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {inferSubject(b.question, b.answer)}
                  </Badge>
                  <span>{new Date(b.timestamp).toLocaleDateString()}</span>
                </div>
                <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Open →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Dialog with full answer */}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0 dark:border-border/60">
          {selected && (
            <SavedAnswerView
              bookmark={selected}
              onClose={() => setSelectedId(null)}
              onRemove={() => handleRemove(selected.id)}
              onCopy={() => handleCopy(selected.answer.examReadyAnswer)}
            />
          )}
        </DialogContent>
      </Dialog>
      </PageShell>
    </>
  );
}

function SavedAnswerView({
  bookmark,
  onClose,
  onRemove,
  onCopy,
}: {
  bookmark: BookmarkType;
  onClose: () => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const a = bookmark.answer as any;

  return (
    <div className="flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="secondary" className="h-5 text-[10px]">
              Class {bookmark.classLevel}
            </Badge>
            <Badge variant="outline" className="h-5 text-[10px]">
              {inferSubject(bookmark.question, a)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Saved {new Date(bookmark.timestamp).toLocaleDateString()}
            </span>
          </div>
          <h2 className="text-lg md:text-xl font-bold leading-snug">
            {bookmark.question}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 h-9 w-9"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Body */}
      <div className="px-6 py-6 space-y-5">
        {/* Exam-ready Answer */}
        <Card className="border-2 border-primary/20 shadow-md overflow-hidden">
          <div className="bg-primary/5 p-4 border-b border-primary/10 flex justify-between items-center">
            <h3 className="font-bold text-primary flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4" /> Exam-Ready Answer
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopy}
              className="gap-1.5 h-8 text-xs"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <CardContent className="p-5">
            <MarkdownRenderer>{a.examReadyAnswer}</MarkdownRenderer>
          </CardContent>
        </Card>

        {/* Short Answer */}
        {a.shortAnswer && (
          <div className="p-4 rounded-xl bg-muted/50 border flex gap-3 items-start">
            <div className="p-2 bg-background rounded-lg shadow-sm shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                In a nutshell
              </h4>
              <MarkdownRenderer compact className="font-medium text-sm">
                {a.shortAnswer}
              </MarkdownRenderer>
            </div>
          </div>
        )}

        {/* Helper cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a.keyConcept && (
            <HelperCard
              label="Key Concept"
              content={a.keyConcept}
              icon={BookOpen}
              bg="bg-primary/10"
              border="border-primary/30"
              text="text-primary"
            />
          )}
          {a.examTip && (
            <HelperCard
              label="Exam Tip"
              content={a.examTip}
              icon={Target}
              bg="bg-warning-soft"
              border="border-warning/30"
              text="text-warning"
            />
          )}
          {a.commonMistake && (
            <HelperCard
              label="Common Mistake"
              content={a.commonMistake}
              icon={AlertCircle}
              bg="bg-destructive-soft"
              border="border-destructive/30"
              text="text-destructive"
            />
          )}
          {a.memoryTrick && (
            <HelperCard
              label="Memory Trick"
              content={a.memoryTrick}
              icon={Lightbulb}
              bg="bg-success-soft"
              border="border-success/30"
              text="text-success"
            />
          )}
        </div>

        {/* Step-by-step */}
        {a.stepByStep && a.stepByStep.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-primary" /> Step-by-Step
                Breakdown
              </h3>
              <div className="space-y-2.5">
                {a.stepByStep.map((step: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex gap-3 p-3 rounded-lg bg-muted/40"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 text-sm leading-relaxed">
                      <MarkdownRenderer compact>{step}</MarkdownRenderer>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Quiz */}
        {a.quickQuiz?.question && a.quickQuiz.options?.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Quick Quiz
              </h3>
              <div className="font-medium text-sm mb-3">
                <MarkdownRenderer compact>{a.quickQuiz.question}</MarkdownRenderer>
              </div>
              <div className="space-y-1.5 mb-3">
                {a.quickQuiz.options.map((opt: string, idx: number) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg border text-sm ${
                      opt === a.quickQuiz.correctAnswer
                        ? "border-success/50 bg-success-soft text-success font-medium"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <span className="inline-block w-5 text-xs font-bold opacity-60">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <span className="inline">
                      <MarkdownRenderer compact>{opt}</MarkdownRenderer>
                    </span>
                    {opt === a.quickQuiz.correctAnswer && (
                      <CheckCircle2 className="inline h-3.5 w-3.5 ml-2 text-success" />
                    )}
                  </div>
                ))}
              </div>
              {a.quickQuiz.explanation && (
                <div className="text-xs text-muted-foreground italic border-t pt-2">
                  <MarkdownRenderer compact>{a.quickQuiz.explanation}</MarkdownRenderer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-2 border-t">
          <Button
            variant="ghost"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive gap-1.5"
          >
            <Trash2 className="h-4 w-4" /> Remove from Saved
          </Button>
          <Button asChild variant="outline" className="rounded-full gap-1.5">
            <Link href={`/chat?q=${encodeURIComponent(bookmark.question)}`}>
              Ask again <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function HelperCard({
  label,
  content,
  icon: Icon,
  bg,
  border,
  text,
}: {
  label: string;
  content: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${bg} ${border}`}>
      <p
        className={`mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${text}`}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <MarkdownRenderer compact className="text-sm">{content}</MarkdownRenderer>
    </div>
  );
}
