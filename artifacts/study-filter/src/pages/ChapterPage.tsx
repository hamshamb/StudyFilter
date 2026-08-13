import React from "react";
import { Link, useParams } from "wouter";
import {
  ChevronRight,
  ArrowLeft,
  BookText,
  BookOpenCheck,
  Target,
  FileQuestion,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { SUBJECTS, GRADE } from "@workspace/cbse-content";
import { getAccent } from "@/components/hub/accents";
import { Footer } from "@/components/layout/Footer";
import NotFound from "@/pages/not-found";
import type { UnitAction } from "@/components/hub/units/actions";
import type { StudyContext } from "@/components/hub/types";
import { SummaryUnit } from "@/components/hub/units/SummaryUnit";
import { NcertAnswersUnit } from "@/components/hub/units/NcertAnswersUnit";
import { ImportantQuestionsUnit } from "@/components/hub/units/ImportantQuestionsUnit";
import { QuizUnit } from "@/components/hub/units/QuizUnit";
import { RevisionNotesUnit } from "@/components/hub/units/RevisionNotesUnit";
import { ExplainerUnit } from "@/components/hub/units/ExplainerUnit";
import { PageShell } from "@/components/layout/PageShell";
import { StudyCommandBar } from "@/components/study/StudyCommandBar";
import { ProgressBar } from "@/components/ui/primitives";
import { useChapterProgress, CHAPTER_UNIT_COUNT } from "@/hooks/use-chapter-progress";
import { SeoHead } from "@/components/SeoHead";
import { cn } from "@/lib/utils";
import { useRememberScope } from "@/hooks/use-study-scope";
import { useRecordRecent } from "@/hooks/use-recents";

/**
 * A chapter, as a study hub.
 *
 * The six tools are grouped into the order a chapter is actually worked
 * through — learn it, practise it, test it, revise it. They used to be a flat
 * 2×3 grid in feature-launch order, so "Visual explainer" sat next to "Quick
 * quiz" with nothing to say which comes first; a student had to decide the
 * pedagogy themselves before they could start.
 *
 * Opening a tool is recorded locally, which is what makes "continue where you
 * left off" and the chapter progress counts real rather than decorative.
 */

interface UnitSpec {
  action: UnitAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface UnitStage {
  /** The verb, not a feature name. */
  stage: string;
  units: UnitSpec[];
}

const STAGES: UnitStage[] = [
  {
    stage: "Learn",
    units: [
      {
        action: "summary",
        label: "Chapter summary",
        description: "A clear, exam-ready overview of the whole chapter",
        icon: BookText,
      },
      {
        action: "explainer",
        label: "Visual explainer",
        description: "Watch the core idea play out, step by step",
        icon: Sparkles,
      },
    ],
  },
  {
    stage: "Practise",
    units: [
      {
        action: "ncert",
        label: "NCERT answers",
        description: "Model answers to the textbook questions",
        icon: BookOpenCheck,
      },
      {
        action: "important",
        label: "Important questions",
        description: "The most-asked board questions, with hints",
        icon: Target,
      },
    ],
  },
  {
    stage: "Test & revise",
    units: [
      {
        action: "quiz",
        label: "Quick quiz",
        description: "Check your understanding with MCQs",
        icon: FileQuestion,
      },
      {
        action: "notes",
        label: "Easy-to-revise notes",
        description: "One-click notes built for last-minute revision",
        icon: NotebookPen,
      },
    ],
  },
];

const ALL_UNITS: UnitSpec[] = STAGES.flatMap((s) => s.units);

export default function ChapterPage() {
  const params = useParams<{ subjectId: string; chapterId: string }>();
  const { recordVisit, forChapter } = useChapterProgress();

  // Allows deep links such as /subjects/science/ch1?unit=summary, which is how
  // the PDF reader jumps straight from an NCERT chapter into its summary.
  const requestedUnit = React.useMemo<UnitAction | null>(() => {
    const raw = new URLSearchParams(window.location.search).get("unit");
    return ALL_UNITS.some((u) => u.action === raw) ? (raw as UnitAction) : null;
  }, [params.subjectId, params.chapterId]);

  const [activeUnit, setActiveUnit] = React.useState<UnitAction | null>(requestedUnit);

  const subject = SUBJECTS.find((s) => s.id === params.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === params.chapterId);

  React.useEffect(() => {
    setActiveUnit(requestedUnit);
  }, [params.subjectId, params.chapterId, requestedUnit]);

  /*
   * Recorded on every visit, and again with the unit whenever one is opened.
   * Landing on a chapter counts as "you were here"; opening a tool counts as
   * work done. The hook debounces repeat writes so re-renders don't churn.
   */
  React.useEffect(() => {
    if (!subject || !chapter) return;
    recordVisit({
      subjectId: subject.id,
      subjectName: subject.name,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      unit: activeUnit,
    });
  }, [subject, chapter, activeUnit, recordVisit]);

  /*
   * This page *is* a scope. Recording it is what lets every feature opened
   * afterwards — the quiz builder, revision, Explain, the command bar's five
   * modes — know which chapter is meant without being told again.
   */
  useRememberScope({
    subjectId: subject?.id ?? null,
    chapterId: chapter?.id ?? null,
  });

  useRecordRecent(
    subject && chapter
      ? {
          kind: "chapter",
          title: chapter.title,
          subtitle: `${subject.name} · Chapter ${chapter.number}`,
          href: `/subjects/${subject.id}/${chapter.id}`,
          subjectId: subject.id,
          chapterId: chapter.id,
        }
      : null,
  );

  if (!subject || !chapter) return <NotFound />;

  const accent = getAccent(subject.accent);
  const context: StudyContext = {
    classLevel: GRADE,
    subjectId: subject.id,
    subjectName: subject.name,
    chapterTitle: chapter.title,
  };
  const activeDetails = ALL_UNITS.find(({ action }) => action === activeUnit);
  const record = forChapter(subject.id, chapter.id);
  const done = Math.min(record?.units.length ?? 0, CHAPTER_UNIT_COUNT);

  return (
    <div className="flex min-h-viewport flex-col bg-background">
      <SeoHead
        title={`${chapter.title} — Class ${GRADE} ${subject.name} | StudyFilter`}
        description={`Class ${GRADE} CBSE ${subject.name}, Chapter ${chapter.number}: ${chapter.title}. Summary, NCERT answers, important questions, quiz and revision notes.`}
        canonical={`/subjects/${subject.id}/${chapter.id}`}
      />
      <div className="flex-1">
        <PageShell width="content">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/subjects" className="transition-colors hover:text-foreground">
              Subjects
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <Link
              href={`/subjects/${subject.id}`}
              className="transition-colors hover:text-foreground"
            >
              {subject.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate font-medium text-foreground">{chapter.title}</span>
          </nav>

          {/* ── Chapter header ──────────────────────────────────────────── */}
          <header>
            <p className="text-eyebrow text-muted-foreground">
              <span className={accent.text}>{subject.name}</span>
              {chapter.unit ? ` · ${chapter.unit}` : ""} · Chapter {chapter.number}
            </p>
            <h1 className="text-page-title mt-1.5">{chapter.title}</h1>

            {done > 0 && (
              <div className="mt-3 max-w-xs">
                <ProgressBar
                  value={(done / CHAPTER_UNIT_COUNT) * 100}
                  size="sm"
                  tone={done >= CHAPTER_UNIT_COUNT ? "success" : "primary"}
                  label={`${done} of ${CHAPTER_UNIT_COUNT} sections opened`}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {done} of {CHAPTER_UNIT_COUNT} sections opened
                </p>
              </div>
            )}
          </header>

          {activeUnit ? (
            <div className="mt-6 space-y-5">
              <button
                type="button"
                onClick={() => setActiveUnit(null)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                data-testid="button-back-to-chapter-tools"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All chapter tools
              </button>

              <section aria-label={activeDetails?.label}>
                <div className="mb-4 flex items-center gap-3">
                  {activeDetails && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        accent.soft,
                        accent.text,
                      )}
                    >
                      <activeDetails.icon className="h-4.5 w-4.5" />
                    </span>
                  )}
                  <h2 className="text-section">{activeDetails?.label}</h2>
                </div>
                <UnitContent unit={activeUnit} context={context} onAction={setActiveUnit} />
              </section>
            </div>
          ) : (
            <>
              {/* ── Ask about this chapter ──────────────────────────────────
                  Seeded with the chapter name so the question already has its
                  context — the student types the doubt, not the setup. */}
              <section className="mt-6">
                <h2 className="text-card-title mb-2.5">Study this chapter</h2>
                {/*
                  No seeded value any more. The bar used to be pre-filled with
                  "Electricity: " because the five modes were prompt prefixes
                  and the chapter had to be typed into the question. The modes
                  are routes now and they read the scope this page records, so
                  picking "Quiz me" here opens the quiz builder with this
                  chapter already chosen and an empty box.
                */}
                <StudyCommandBar size="md" enableShortcut={false} />
              </section>

              {/* ── Tools, in study order ───────────────────────────────── */}
              <div className="mt-8 space-y-6">
                {STAGES.map(({ stage, units }) => (
                  <section key={stage}>
                    <h2 className="text-eyebrow mb-2 px-1 text-muted-foreground">{stage}</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {units.map(({ action, label, description, icon: Icon }) => {
                        const opened = record?.units.includes(action) ?? false;
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => setActiveUnit(action)}
                            className={cn(
                              "group flex items-start gap-3 rounded-xl border bg-card p-4 text-left",
                              "transition-colors duration-150 hover:border-primary/35 hover:bg-muted/40",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              opened ? "border-primary/25" : "border-card-border",
                            )}
                            data-testid={`button-unit-${action}`}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                accent.soft,
                                accent.text,
                              )}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="text-card-title flex items-center gap-2">
                                {label}
                                {opened && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                                    Opened
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                {description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          <div className="mt-10">
            <Link
              href={`/subjects/${subject.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All {subject.name} chapters
            </Link>
          </div>
        </PageShell>
      </div>
      <Footer />
    </div>
  );
}

function UnitContent({
  unit,
  context,
  onAction,
}: {
  unit: UnitAction;
  context: StudyContext;
  onAction: (action: UnitAction) => void;
}) {
  switch (unit) {
    case "summary":
      return <SummaryUnit context={context} onAction={onAction} />;
    case "ncert":
      return <NcertAnswersUnit context={context} />;
    case "important":
      return <ImportantQuestionsUnit context={context} />;
    case "quiz":
      return <QuizUnit context={context} />;
    case "notes":
      return <RevisionNotesUnit context={context} />;
    case "explainer":
      return <ExplainerUnit context={context} />;
  }
}
