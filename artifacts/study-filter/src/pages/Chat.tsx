import React, { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, BookOpen, AlertCircle, Sparkles, GraduationCap, Copy, CheckCircle2, ChevronRight, XCircle, Camera, X, ScanText, History, Clock, Trash2, Globe, ExternalLink, Bookmark, BookmarkCheck, ArrowUp } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { useXpEvent } from "@/hooks/use-xp-event";
import { useHistory } from "@/hooks/use-history";
import { useGrade } from "@/hooks/use-grade";

import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAskStudyFilter, useSearchWebAndAnswer, useAddActivity, useGetLocalQuestions, useExtractTextFromImage, useGetRecentActivity } from "@workspace/api-client-react";
import type { StudyAnswer, AnswerVariantResponse } from "@workspace/api-client-react";
import { useGetAnswerVariant } from "@workspace/api-client-react";
import { BoardAnswerControls } from "@/components/hub/BoardAnswerControls";
import type { ContentLevel } from "@/components/hub/BoardAnswerControls";
import { LoadingBlock, Spinner } from "@/components/ui/primitives";
import { Kbd } from "@/components/ui/kbd";
import { SeoHead } from "@/components/SeoHead";

const formSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters"),
});

type WebSource = NonNullable<StudyAnswer["webSources"]>[number];

function usableWebSources(sources: StudyAnswer["webSources"]): WebSource[] {
  const seen = new Set<string>();
  return (sources ?? []).filter((source) => {
    if (source.status !== "ok" || !source.url) return false;
    let key = source.url;
    try {
      const parsed = new URL(source.url);
      parsed.hash = "";
      key = parsed.toString();
    } catch {
      key = `${source.domain}|${source.title}`;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function Chat() {
  const sessionId = useSession();
  const { history, addEntry, clearHistory } = useHistory();
  const { grade } = useGrade();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { toast } = useToast();
  const [focusMode, setFocusMode] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [quizStatus, setQuizStatus] = useState<"correct" | "incorrect" | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Board exam format controls — in-place variant update
  const [selectedMarks, setSelectedMarks] = useState<number | "auto">("auto");
  const [selectedLevel, setSelectedLevel] = useState<ContentLevel>("moderate");
  const [isVariantUpdating, setIsVariantUpdating] = useState(false);
  const [displayOverride, setDisplayOverride] = useState<Pick<AnswerVariantResponse,
    "examReadyAnswer" | "answerPoints" | "introduction" | "body" | "conclusion" | "workingSteps" | "finalAnswer" | "resolvedMarks"
  > | null>(null);

  const variantCacheRef = useRef<Map<string, AnswerVariantResponse>>(new Map());
  const requestCounterRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrHint, setOcrHint] = useState<string | null>(null);

  const askMutation = useAskStudyFilter();
  const webSearchMutation = useSearchWebAndAnswer();
  const recordXp = useXpEvent();
  const addActivityMutation = useAddActivity();
  const localQuestionsQuery = useGetLocalQuestions();
  const ocrMutation = useExtractTextFromImage();
  const variantMutation = useGetAnswerVariant();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
    },
  });

  const classLevel = grade ? parseInt(grade, 10) : 10;
  const visibleWebSources = answer ? usableWebSources(answer.webSources) : [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuestion = params.get("q");
    if (initialQuestion) {
      form.setValue("question", initialQuestion);
    }
  }, [form]);

  const resetAnswerState = () => {
    setAnswer(null);
    setSelectedQuizOption(null);
    setQuizStatus(null);
    setShowConfetti(false);
    setDisplayOverride(null);
    setSelectedMarks("auto");
    setSelectedLevel("moderate");
    setIsVariantUpdating(false);
    variantCacheRef.current.clear();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const requireGrade = () => {
    if (!grade) {
      toast({
        title: "Pick your class first",
        description: "Choose your class to get answers tailored to your syllabus.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!requireGrade()) return;
    resetAnswerState();
    setActiveQuestion(values.question);

    askMutation.mutate(
      { data: { classLevel, question: values.question, sessionId } },
      {
        onSuccess: (data) => {
          setAnswer(data);
          addEntry({
            question: values.question,
            classLevel: String(classLevel),
            subject: "",
            chapter: "",
            answer: data,
          });
          addActivityMutation.mutate({
            data: {
              sessionId,
              question: values.question,
              subject: "General",
              classLevel,
              answerSource: data.answerSource,
            },
          });
          void recordXp({ type: "doubt_answered", subject: "General" });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to get an answer. Please try again.",
            variant: "destructive",
          });
        },
      }
    );

    webSearchMutation.mutate(
      { data: { classLevel, question: values.question, sessionId } },
      {
        onSuccess: (webData) => {
          setAnswer((prev) =>
            prev
              ? {
                  ...prev,
                  webSources: [
                    ...(prev.webSources ?? []),
                    ...(webData.webSources ?? []),
                  ],
                }
              : webData
          );
        },
      }
    );
  };

  const restoreEntry = (entryId: string) => {
    const entry = history.find((h) => h.id === entryId);
    if (!entry) return;
    form.setValue("question", entry.question);
    setActiveQuestion(entry.question);
    setSelectedQuizOption(null);
    setQuizStatus(null);
    setShowConfetti(false);
    setAnswer(entry.answer);
  };

  const handleQuizSubmit = (option: string) => {
    if (!answer || quizStatus) return;
    
    setSelectedQuizOption(option);
    
    if (option === answer.quickQuiz.correctAnswer) {
      setQuizStatus("correct");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      
      // The follow-up check is a one-question quiz — priced as such.
      void recordXp({
        type: "quiz_completed",
        source: "doubt_followup",
        subject: "General",
        totalQuestions: 1,
        correctAnswers: 1,
      });
      
      toast({
        title: "Correct!",
        description: "Great job! Your progress has been saved.",
      });
    } else {
      setQuizStatus("incorrect");
      // Recorded too, so accuracy reflects misses rather than only successes.
      void recordXp({
        type: "quiz_completed",
        source: "doubt_followup",
        subject: "General",
        totalQuestions: 1,
        correctAnswers: 0,
      });
    }
  };

  const applyVariantOverride = (v: AnswerVariantResponse) => {
    setDisplayOverride({
      examReadyAnswer: v.examReadyAnswer ?? "",
      answerPoints: v.answerPoints ?? undefined,
      introduction: v.introduction ?? undefined,
      body: v.body ?? undefined,
      conclusion: v.conclusion ?? undefined,
      workingSteps: v.workingSteps ?? undefined,
      finalAnswer: v.finalAnswer ?? undefined,
      resolvedMarks: v.resolvedMarks,
    });
  };

  const triggerVariantUpdate = useCallback(
    (marks: number | "auto", level: ContentLevel) => {
      const currentAnswer = answer;
      if (!currentAnswer?.answerId || !currentAnswer.questionAnalysis) return;
      const resolvedMarks =
        marks === "auto" ? currentAnswer.questionAnalysis.recommendedMarks : marks;
      const cacheKey = `${currentAnswer.answerId}:${resolvedMarks}:${level}`;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        const cached = variantCacheRef.current.get(cacheKey);
        if (cached) {
          applyVariantOverride(cached);
          return;
        }

        const requestId = ++requestCounterRef.current;
        setIsVariantUpdating(true);

        variantMutation.mutate(
          { data: { answerId: currentAnswer.answerId!, marks: resolvedMarks as 1|2|3|4|5|6, contentLevel: level } },
          {
            onSuccess(data) {
              if (requestCounterRef.current !== requestId) return;
              variantCacheRef.current.set(cacheKey, data);
              applyVariantOverride(data);
              setIsVariantUpdating(false);
            },
            onError() {
              if (requestCounterRef.current !== requestId) return;
              setIsVariantUpdating(false);
            },
          }
        );
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answer]
  );

  const handleMarksChange = (marks: number | "auto") => {
    setSelectedMarks(marks);
    triggerVariantUpdate(marks, selectedLevel);
  };

  const handleLevelChange = (level: ContentLevel) => {
    setSelectedLevel(level);
    triggerVariantUpdate(selectedMarks, level);
  };

  const handleCopy = () => {
    if (answer) {
      navigator.clipboard.writeText(displayOverride?.examReadyAnswer ?? answer.examReadyAnswer);
      toast({
        title: "Copied",
        description: "Exam-ready answer copied to clipboard.",
      });
    }
  };

  const handleBookmark = () => {
    if (!answer || !activeQuestion) return;
    const added = toggleBookmark({
      question: activeQuestion,
      classLevel: String(classLevel),
      answer,
    });
    toast({
      title: added ? "Saved" : "Removed",
      description: added
        ? "Answer saved — find it under Saved."
        : "Answer removed from Saved.",
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = "";
  };

  const clearOcr = () => {
    setOcrPreview(null);
    setOcrHint(null);
    form.setValue("question", "");
  };

  const processImageFile = useCallback((file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Unsupported file", description: "Please paste a JPG, PNG, GIF, or WebP image.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setOcrPreview(dataUrl);
      setOcrHint(null);
      ocrMutation.mutate(
        { data: { imageBase64: base64, mediaType: file.type } },
        {
          onSuccess: (result) => {
            form.setValue("question", result.extractedText);
            setOcrHint(result.hint ?? null);
            toast({ title: "Text extracted!", description: "Review and edit the text, then ask your question." });
          },
          onError: () => {
            toast({ title: "OCR failed", description: "Could not extract text. Please type your question manually.", variant: "destructive" });
          },
        }
      );
    };
    reader.readAsDataURL(file);
  }, [form, ocrMutation, toast]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
          }
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [processImageFile]);

  const statusMessages = [
    "Searching CBSE notes and the web...",
    "Filtering distractions...",
    "Building your exam-ready answer...",
  ];
  const currentStatusIndex = Math.floor((Date.now() / 2000) % statusMessages.length);

  if (focusMode && answer) {
    return (
      <div className="min-h-viewport bg-background p-4 sm:p-8 md:p-12">
        <div className="mx-auto max-w-3xl space-y-7">
          {/*
            Focus mode is for reading, so the chrome is one line: what mode
            you are in, and the way out. It was a filled badge and a full
            button competing with the question underneath.
          */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-eyebrow text-muted-foreground">Focus mode</span>
            <Button variant="ghost" size="sm" onClick={() => setFocusMode(false)}>
              Exit
            </Button>
          </div>

          <h2 className="text-page-title">{activeQuestion}</h2>

          <div className="space-y-6">
            <div className="rounded-xl border border-card-border bg-card p-5 sm:p-6">
              <h3 className="text-eyebrow flex items-center gap-1.5 text-primary">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Exam-ready answer
              </h3>
              <p className="answer-prose measure mt-3 text-foreground/90">
                {answer.examReadyAnswer}
              </p>
            </div>

            {answer.stepByStep.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold mt-0">Step-by-Step Breakdown</h3>
                <div className="space-y-3">
                  {answer.stepByStep.map((step: string, idx: number) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-xl bg-muted/50 dark:bg-card dark:border dark:border-border/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shadow-sm">
                        {idx + 1}
                      </div>
                      <p className="m-0 pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                <h4 className="font-bold text-primary m-0 mb-2">Key Concept</h4>
                <p className="text-sm m-0">{answer.keyConcept}</p>
              </div>
              <div className="p-4 rounded-xl bg-warning-soft border border-warning/30">
                <h4 className="font-bold text-warning m-0 mb-2">Exam Tip</h4>
                <p className="text-sm m-0">{answer.examTip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── recent questions history popover ── */
  const HistoryPanel = (
    <Popover>
      <PopoverTrigger
        type="button"
        className={buttonVariants({ variant: "outline", size: "sm" }) + " h-8 gap-1.5 rounded-full border-border/60 bg-muted/50 text-xs"}
      >
        <History className="h-3.5 w-3.5" />
        Recent
        {history.length > 0 && (
          <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
            {history.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent questions
          </p>
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-5 w-5 opacity-50" />
            Your last 10 questions will appear here.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => restoreEntry(h.id)}
                className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="line-clamp-2 text-sm font-medium">{h.question}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    Class {h.classLevel}
                  </Badge>
                  {h.subject && <span>{h.subject}</span>}
                  {h.chapter && (
                    <>
                      <span className="text-border">•</span>
                      <span className="line-clamp-1">{h.chapter}</span>
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  /* ── shared search form (used in both states) ── */
  const SearchForm = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-3">
        {/* Big search bar — class is set in onboarding; subject/chapter auto-detected */}
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem className="m-0">
              <FormControl>
                {/*
                  The border, the focus ring and the radius live on the
                  wrapper so the whole composer lights up as one control —
                  the same shape as the Study Command Bar on the dashboard.
                  It used to be a 2px-bordered rounded-2xl textarea with a
                  magnifying-glass icon inside it, which read as a *search*
                  box rather than as a place to write a question.
                */}
                <div className="relative rounded-xl border border-border bg-card shadow-xs transition-colors duration-150 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
                  <Textarea
                    placeholder="Ask anything from your CBSE syllabus…"
                    className="min-h-[3.25rem] max-h-[200px] resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-4 py-4 pr-28 text-base shadow-none"
                    rows={1}
                    {...field}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                    onInput={(e) => {
                      const target = e.currentTarget;
                      target.style.height = "auto";
                      target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                    }}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={ocrMutation.isPending}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      aria-label="Scan a question from an image"
                      title="Scan a question from an image"
                    >
                      {ocrMutation.isPending ? <Spinner /> : <Camera className="h-4 w-4" />}
                    </button>
                    {/*
                      An arrow, not the word "Search" next to a globe icon.
                      This does not search the internet on the student's
                      behalf — it asks a question and gets an answer sheet
                      back, and labelling it "Search" set the wrong
                      expectation for the whole product.
                    */}
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Ask StudyFilter"
                      disabled={askMutation.isPending || webSearchMutation.isPending}
                    >
                      {askMutation.isPending || webSearchMutation.isPending ? (
                        <Spinner />
                      ) : (
                        <ArrowUp className="h-4.5 w-4.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* OCR preview */}
        {ocrPreview && (
          <div className="rounded-xl border bg-muted/40 p-3 flex items-start gap-3 animate-in slide-in-from-top-2 duration-200">
            <img src={ocrPreview} alt="Scanned" className="rounded-lg h-16 w-20 object-cover bg-background shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                <ScanText className="h-3.5 w-3.5" />
                {ocrMutation.isPending ? "Extracting text…" : ocrHint ? `Detected: ${ocrHint}` : "Text extracted — review below"}
              </div>
              {ocrMutation.isPending && <div className="h-2 w-24 rounded bg-muted animate-pulse" />}
            </div>
            <button type="button" onClick={clearOcr} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </form>
    </Form>
  );

  const isActive = askMutation.isPending || webSearchMutation.isPending || !!answer;

  return (
    <>
      <SeoHead
        title="Ask StudyFilter — CBSE study help"
        description="Ask a Class 10 CBSE question and receive a clear explanation, exam-ready answer, sources and a quick knowledge check."
        canonical="/chat"
      />
      <div className="min-h-viewport flex flex-col">
      {/*
        Getting the follow-up check right used to fill the screen with a 60px
        🎉. A correct answer deserves acknowledgement, not a takeover — this
        is a small badge near the top, and the toast that already fires does
        the rest.
      */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center">
          <span className="animate-rise inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success-soft px-3 py-1.5 text-sm font-semibold text-success shadow-sm">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Correct
          </span>
        </div>
      )}

      {/* ── EMPTY STATE: centred search ── */}
      {!isActive && (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
          <div className="mb-5">
            <h1 className="text-page-title">What do you want to understand?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Ask in your own words. You&apos;ll get an answer sheet — the exam-ready
              answer, the diagram, and what the examiner is looking for.
            </p>
          </div>

          {SearchForm}

          {/*
            The three capability hints that used to sit above the heading
            ("Scan image · Ctrl+V paste screenshot · Class 8–12 CBSE") were
            chrome a student read once and never again, placed where the
            question should be. The camera is a visible button on the
            composer; the paste shortcut is mentioned once, quietly.
          */}
          <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <ScanText className="h-3.5 w-3.5" aria-hidden="true" />
            Paste a screenshot with <Kbd>Ctrl V</Kbd> to read a question from an image.
          </p>

          {history.length > 0 && <div className="mt-4">{HistoryPanel}</div>}

          {localQuestionsQuery.data && localQuestionsQuery.data.length > 0 && (
            <div className="mt-8">
              <p className="text-eyebrow mb-2 text-muted-foreground">Try one of these</p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-card-border bg-card">
                {localQuestionsQuery.data.slice(0, 5).map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => form.setValue("question", q.question)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1 leading-snug">{q.question}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVE STATE ── */}
      {isActive && (
        <div className="w-full max-w-3xl mx-auto px-4 flex flex-col">
          {/* Sticky top bar — only while loading, shows what's being looked up */}
          {askMutation.isPending && (
            <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm pt-3 pb-3 border-b border-border/40 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <Spinner className="shrink-0 text-primary" />
                <p className="text-sm font-medium truncate flex-1 text-foreground/80">"{activeQuestion}"</p>
                {history.length > 0 && <div className="shrink-0">{HistoryPanel}</div>}
              </div>
            </div>
          )}

          {/* Loading dots */}
          {askMutation.isPending && (
            <div className="animate-in fade-in py-10">
              <LoadingBlock label={statusMessages[currentStatusIndex]} />
            </div>
          )}

          {/* Answer content */}
          {answer && (
            <div className="py-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-44">
              {/* Source / confidence badges */}
              <div className="flex flex-wrap gap-2 items-center pt-2">
            {answer.answerSource === "local_data" && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                <BookOpen className="h-3 w-3 mr-1" /> From StudyFilter saved notes
              </Badge>
            )}
            {answer.answerSource.startsWith("ai_") && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                <Sparkles className="h-3 w-3 mr-1" /> AI explanation — verify with textbook
              </Badge>
            )}
            {answer.answerSource === "web_search" && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                <Globe className="h-3 w-3 mr-1" /> Synthesized from web sources
              </Badge>
            )}
            {answer.answerSource === "no_api_key" && (
              <Badge variant="secondary" className="bg-warning/10 text-warning">
                <AlertCircle className="h-3 w-3 mr-1" /> AI not connected, using local notes
              </Badge>
            )}
            <Badge variant="outline" className={
              answer.confidence === "high" ? "border-success/50 text-success" :
              answer.confidence === "medium" ? "border-warning/50 text-warning" :
              "border-destructive/50 text-destructive"
            }>
              {answer.confidence.charAt(0).toUpperCase() + answer.confidence.slice(1)} Confidence
            </Badge>
          </div>

          {/* Web Sources */}
          {visibleWebSources.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Sources scraped &amp; compared
              </p>
              <div className="flex flex-col gap-1.5">
                {visibleWebSources.map((src) => (
                  <a
                    key={src.url}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-muted"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                    <span className="font-medium text-foreground/80 shrink-0">{src.domain}</span>
                    <span className="text-muted-foreground line-clamp-1 flex-1">{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Answer Format Controls — above the answer */}
          {answer.answerId && answer.questionAnalysis && (
            <TooltipProvider>
              <BoardAnswerControls
                availableMarkOptions={answer.questionAnalysis.availableMarkOptions}
                recommendedMarks={answer.questionAnalysis.recommendedMarks}
                selectedMarks={selectedMarks}
                selectedLevel={selectedLevel}
                isUpdating={isVariantUpdating}
                onMarksChange={handleMarksChange}
                onLevelChange={handleLevelChange}
              />
            </TooltipProvider>
          )}

          {/* Main Answer — same card, updates in place */}
          <Card className={`border-2 border-primary/20 shadow-md overflow-hidden relative dark:border-primary/25 ${answer.answerId && answer.questionAnalysis ? "rounded-t-none border-t-0" : ""}`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent dark:via-primary/40" />
            <div className="bg-primary/5 p-4 border-b border-primary/10 flex justify-between items-center dark:bg-primary/8 dark:border-primary/15">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Exam-Ready Answer
                {displayOverride?.resolvedMarks && (
                  <Badge variant="secondary" className="ml-1 text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                    {displayOverride.resolvedMarks}M
                  </Badge>
                )}
              </h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className={`h-8 w-8 ${isBookmarked(activeQuestion) ? "text-primary" : "text-muted-foreground hover:text-primary"}`} onClick={handleBookmark} title={isBookmarked(activeQuestion) ? "Remove from Saved" : "Save answer"}>
                  {isBookmarked(activeQuestion) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleCopy} title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setFocusMode(true)} title="Focus Mode">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-6 relative">
              {/* IBC structure (English/Hindi long answers) */}
              {displayOverride?.introduction ? (
                <div className="space-y-4 text-base">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Introduction</p>
                    <MarkdownRenderer>{displayOverride.introduction}</MarkdownRenderer>
                  </div>
                  {displayOverride.body && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Body</p>
                      <MarkdownRenderer>{displayOverride.body}</MarkdownRenderer>
                    </div>
                  )}
                  {displayOverride.conclusion && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Conclusion</p>
                      <MarkdownRenderer>{displayOverride.conclusion}</MarkdownRenderer>
                    </div>
                  )}
                </div>
              ) : (
                <MarkdownRenderer className="text-base">
                  {displayOverride?.examReadyAnswer ?? answer.examReadyAnswer}
                </MarkdownRenderer>
              )}
              {/* Updating overlay — keeps existing content visible */}
              {isVariantUpdating && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-b-2xl">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary bg-background/90 border border-primary/20 px-4 py-2 rounded-full shadow-sm">
                    <Spinner />
                    Updating answer…
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Short answer */}
          <div className="p-4 rounded-xl bg-muted/50 border flex gap-4 items-start">
            <div className="p-2 bg-background rounded-lg shadow-sm shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-1">In a nutshell</h4>
              <MarkdownRenderer compact className="font-medium">{answer.shortAnswer}</MarkdownRenderer>
            </div>
          </div>

          {/* Helper cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-primary/10 border-primary/30">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-primary uppercase tracking-wider">Key Concept</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0"><MarkdownRenderer compact>{answer.keyConcept}</MarkdownRenderer></CardContent>
            </Card>
            <Card className="bg-warning-soft border-warning/30">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-warning uppercase tracking-wider">Exam Tip</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0"><MarkdownRenderer compact>{answer.examTip}</MarkdownRenderer></CardContent>
            </Card>
            <Card className="bg-destructive-soft border-destructive/30">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-destructive uppercase tracking-wider">Common Mistake</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0"><MarkdownRenderer compact>{answer.commonMistake}</MarkdownRenderer></CardContent>
            </Card>
            <Card className="bg-success-soft border-success/30">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-success uppercase tracking-wider">Memory Trick</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0"><MarkdownRenderer compact>{answer.memoryTrick}</MarkdownRenderer></CardContent>
            </Card>
          </div>

          {/* Step-by-step / Answer Points */}
          {(displayOverride?.answerPoints?.length
            ? displayOverride.answerPoints
            : displayOverride?.workingSteps?.length
            ? displayOverride.workingSteps
            : answer.stepByStep
          ).length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg font-bold">
                  {displayOverride?.answerPoints?.length
                    ? "Answer Points"
                    : displayOverride?.workingSteps?.length
                    ? "Working Steps"
                    : "Step-by-Step Breakdown"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {(displayOverride?.answerPoints?.length
                    ? displayOverride.answerPoints
                    : displayOverride?.workingSteps?.length
                    ? displayOverride.workingSteps
                    : answer.stepByStep
                  ).map((step: string, idx: number) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                      <div className="text-sm pt-1"><MarkdownRenderer compact>{step}</MarkdownRenderer></div>
                    </div>
                  ))}
                </div>
                {displayOverride?.finalAnswer && (
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Final Answer</p>
                    <MarkdownRenderer compact>{displayOverride.finalAnswer}</MarkdownRenderer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Quiz */}
          <Card className="border-primary/30 shadow-md relative overflow-hidden dark:border-primary/25">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="bg-primary/5 p-4 border-b border-primary/10 dark:bg-primary/8 dark:border-primary/15">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Quick Quiz <Badge className="bg-primary text-primary-foreground">+50 XP</Badge>
              </CardTitle>
              <CardDescription>Test your understanding</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="font-medium text-lg whitespace-normal break-words"><MarkdownRenderer>{answer.quickQuiz.question}</MarkdownRenderer></div>
              <div className="space-y-2">
                {answer.quickQuiz.options.map((option: string, idx: number) => {
                  const isSelected = selectedQuizOption === option;
                  const isCorrect = option === answer.quickQuiz.correctAnswer;
                  let btnClass = "w-full justify-start text-left h-auto py-3 px-4 border ";
                  if (quizStatus) {
                    if (isCorrect) btnClass += "border-success/50 bg-success-soft text-success";
                    else if (isSelected) btnClass += "border-destructive/50 bg-destructive-soft text-destructive";
                    else btnClass += "border-border opacity-50";
                  } else {
                    btnClass += "border-border hover:border-primary/50 hover:bg-primary/5";
                  }
              return (
                <Button key={idx} variant="outline" className={btnClass} onClick={() => handleQuizSubmit(option)} disabled={quizStatus !== null}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-left whitespace-normal break-words flex-1">
                      <MarkdownRenderer compact>{option}</MarkdownRenderer>
                    </span>
                    <span className="shrink-0">
                      {quizStatus && isCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
                      {quizStatus && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" />}
                    </span>
                  </div>
                </Button>
              );
                })}
              </div>
              {quizStatus && (
                <div className={`p-4 rounded-xl mt-2 flex items-start gap-3 animate-in slide-in-from-top-2 ${quizStatus === 'correct' ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive'}`}>
                  {quizStatus === 'correct' ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <XCircle className="h-6 w-6 shrink-0" />}
                  <div>
                    <h4 className="font-bold mb-1">{quizStatus === 'correct' ? 'Correct!' : 'Incorrect'}</h4>
                    <MarkdownRenderer compact className="text-sm">{answer.quickQuiz.explanation}</MarkdownRenderer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

            </div>
          )}
        </div>
      )}

      {/* ── STICKY BOTTOM BAR — appears once answer is ready ── */}
      {answer && (
        <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border/30 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)] animate-in slide-in-from-bottom-3 duration-400">
          <div className="w-full max-w-3xl mx-auto px-4 pt-3 pb-4">
            {/* Follow-up suggestion chips */}
            <div className="flex items-center gap-2 mb-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide shrink-0">Ask more:</span>
              {[
                { label: "Simpler explanation", q: `Explain this more simply: ${activeQuestion}` },
                { label: "Real-life example", q: `Give me a real-life example for: ${activeQuestion}` },
                { label: "Common mistakes", q: `What are common mistakes students make when answering: ${activeQuestion}?` },
                { label: "Exam questions", q: `What are likely exam questions on the topic of: ${activeQuestion}?` },
              ].map(({ label, q }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => form.setValue("question", q)}
                  className="shrink-0 rounded-full border border-border/50 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Reuse the same search form */}
            {SearchForm}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
