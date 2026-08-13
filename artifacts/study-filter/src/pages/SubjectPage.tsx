import React from "react";
import { Link, useParams } from "wouter";
import { ChevronRight, ArrowRight } from "lucide-react";
import { SUBJECTS, GRADE } from "@workspace/cbse-content";
import { getAccent } from "@/components/hub/accents";
import { Footer } from "@/components/layout/Footer";
import NotFound from "@/pages/not-found";
import { PageShell } from "@/components/layout/PageShell";
import { ChapterRow } from "@/components/study/ChapterRow";
import { ProgressBar } from "@/components/ui/primitives";
import { useChapterProgress, CHAPTER_UNIT_COUNT } from "@/hooks/use-chapter-progress";
import { SeoHead } from "@/components/SeoHead";
import { cn } from "@/lib/utils";

/**
 * A subject, as a textbook's contents page.
 *
 * The chapters used to be fourteen separate cards, each with its own border,
 * hover lift and shadow — a pinboard, when what a student is doing is
 * scanning an ordered list for a number. They are rows in one framed list
 * now, grouped by unit exactly as the syllabus groups them, with the chapter
 * number in a fixed column so the eye can run straight down it.
 */

function groupByUnit(
  chapters: { id: string; number: number; title: string; unit?: string }[],
): { unit: string; items: typeof chapters }[] {
  const groups: { unit: string; items: typeof chapters }[] = [];
  for (const ch of chapters) {
    const unit = ch.unit ?? "Chapters";
    let group = groups.find((g) => g.unit === unit);
    if (!group) {
      group = { unit, items: [] };
      groups.push(group);
    }
    group.items.push(ch);
  }
  return groups;
}

export default function SubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const subject = SUBJECTS.find((s) => s.id === params.subjectId);
  const { completion, forChapter, records } = useChapterProgress();

  if (!subject) return <NotFound />;

  const accent = getAccent(subject.accent);
  const groups = groupByUnit(subject.chapters);
  const total = subject.chapters.length;

  // The most recently opened chapter *in this subject*, so "continue" points
  // at the right place rather than at whatever was opened last overall.
  const lastInSubject = records
    .filter((r) => r.subjectId === subject.id && r.units.length > 0)
    .sort((a, b) => b.lastVisited - a.lastVisited)[0];

  const started = records.filter(
    (r) => r.subjectId === subject.id && r.units.length > 0,
  ).length;

  return (
    <div className="flex min-h-viewport flex-col bg-background">
      <SeoHead
        title={`${subject.name} — Class ${GRADE} CBSE Chapters | StudyFilter`}
        description={`All Class ${GRADE} CBSE ${subject.name} chapters. Summaries, NCERT answers, important questions and quizzes for every chapter.`}
        canonical={`/subjects/${subject.id}`}
      />
      <div className="flex-1">
        <PageShell width="content">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/subjects" className="transition-colors hover:text-foreground">
              Subjects
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-foreground">{subject.name}</span>
          </nav>

          {/* ── Subject header ──────────────────────────────────────────── */}
          <header className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold",
                accent.soft,
                accent.text,
              )}
            >
              {subject.shortName.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="text-eyebrow text-muted-foreground">Class {GRADE} · CBSE</p>
              <h1 className="text-page-title mt-1">{subject.name}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {total} chapters
                {started > 0 && ` · ${started} started`}
              </p>
            </div>
          </header>

          {/* ── Continue ────────────────────────────────────────────────── */}
          {lastInSubject && (
            <Link
              href={`/subjects/${subject.id}/${lastInSubject.chapterId}`}
              className={cn(
                "mt-6 flex items-center gap-4 rounded-xl border border-card-border bg-card p-4",
                "transition-colors hover:border-primary/35 hover:bg-muted/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              data-testid="link-subject-continue"
            >
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow text-muted-foreground">Continue</p>
                <p className="text-card-title mt-1 truncate">{lastInSubject.chapterTitle}</p>
                <ProgressBar
                  value={
                    (Math.min(lastInSubject.units.length, CHAPTER_UNIT_COUNT) /
                      CHAPTER_UNIT_COUNT) *
                    100
                  }
                  size="sm"
                  className="mt-2"
                  label={`${lastInSubject.chapterTitle}: ${lastInSubject.units.length} of ${CHAPTER_UNIT_COUNT} sections opened`}
                />
              </div>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
            </Link>
          )}

          {/* ── Contents ────────────────────────────────────────────────── */}
          <div className="mt-8 space-y-6">
            {groups.map((g) => (
              <section key={g.unit}>
                <h2 className="text-eyebrow mb-2 px-1 text-muted-foreground">{g.unit}</h2>
                <ul className="overflow-hidden rounded-xl border border-card-border bg-card">
                  {g.items.map((c) => {
                    const record = forChapter(subject.id, c.id);
                    return (
                      <ChapterRow
                        key={c.id}
                        href={`/subjects/${subject.id}/${c.id}`}
                        number={c.number}
                        title={c.title}
                        completion={completion(subject.id, c.id)}
                        unitsDone={record?.units.length ?? 0}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </PageShell>
      </div>
      <Footer />
    </div>
  );
}
