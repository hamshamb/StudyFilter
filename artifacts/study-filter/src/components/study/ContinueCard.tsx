import React from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { getAccent } from "@/components/hub/accents";
import { ProgressBar } from "@/components/ui/primitives";
import { CHAPTER_UNIT_COUNT, type ChapterRecord } from "@/hooks/use-chapter-progress";
import { SUBJECTS } from "@workspace/cbse-content";
import { cn } from "@/lib/utils";

/**
 * "Pick up where you left off."
 *
 * The single most useful thing a study dashboard can show, and the one the
 * old home page didn't have at all — it opened with a marketing headline and
 * a stat grid, so a student who had been studying Electricity yesterday
 * landed on a page that knew nothing about them.
 *
 * Everything on this card is real: the chapter comes from the local study
 * record, and the progress is the count of chapter tools actually opened.
 */
export interface ContinueCardProps {
  record: ChapterRecord;
  className?: string;
}

export function ContinueCard({ record, className }: ContinueCardProps) {
  const subject = SUBJECTS.find((s) => s.id === record.subjectId);
  const accent = getAccent(subject?.accent);
  const done = Math.min(record.units.length, CHAPTER_UNIT_COUNT);
  const pct = (done / CHAPTER_UNIT_COUNT) * 100;

  return (
    <Link
      href={`/subjects/${record.subjectId}/${record.chapterId}`}
      className={cn(
        "group flex flex-col rounded-xl border border-card-border bg-card p-4",
        "transition-colors duration-150 hover:border-primary/35 hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      data-testid={`link-continue-${record.chapterId}`}
    >
      <div className="flex items-start gap-2">
        <span className={cn("text-eyebrow", accent.text)}>{record.subjectName}</span>
      </div>

      <p className="text-card-title mt-1.5 line-clamp-2 leading-snug">{record.chapterTitle}</p>

      <div className="mt-auto pt-3">
        <ProgressBar
          value={pct}
          size="sm"
          label={`${record.chapterTitle}: ${done} of ${CHAPTER_UNIT_COUNT} sections opened`}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {done === 0
              ? "Not started"
              : done >= CHAPTER_UNIT_COUNT
                ? "All sections opened"
                : `${done} of ${CHAPTER_UNIT_COUNT} sections`}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Continue
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
