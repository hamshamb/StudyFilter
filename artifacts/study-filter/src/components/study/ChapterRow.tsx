import React from "react";
import { Link } from "wouter";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAPTER_UNIT_COUNT } from "@/hooks/use-chapter-progress";

/**
 * One line of a subject's contents page.
 *
 * A row, not a card. Chapters are an ordered list a student scans top to
 * bottom looking for a number, so they should look like a table of contents —
 * rules between items, the number in a fixed column, titles left-aligned on a
 * single axis. Fourteen floating cards with their own borders and hover lifts
 * turned a contents page into a pinboard.
 *
 * The right-hand side shows real work done: how many of the six chapter tools
 * the student has opened. Nothing is shown for a chapter never touched, so
 * the column stays quiet until it means something.
 */
export interface ChapterRowProps {
  href: string;
  number: number;
  title: string;
  /** 0–100 from the local study record. 0 renders no indicator. */
  completion?: number;
  /** Units opened, for the "3 of 6" label. */
  unitsDone?: number;
  className?: string;
}

export function ChapterRow({
  href,
  number,
  title,
  completion = 0,
  unitsDone = 0,
  className,
}: ChapterRowProps) {
  const complete = completion >= 100;

  return (
    <li className={cn("border-b border-border last:border-b-0", className)}>
      <Link
        href={href}
        className={cn(
          "group flex items-center gap-3 px-3 py-3 transition-colors duration-150",
          "hover:bg-muted/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
            complete
              ? "bg-success-soft text-success"
              : unitsDone > 0
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
          )}
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : String(number).padStart(2, "0")}
        </span>

        <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{title}</span>

        {unitsDone > 0 && (
          <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
            {Math.min(unitsDone, CHAPTER_UNIT_COUNT)}/{CHAPTER_UNIT_COUNT}
          </span>
        )}

        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
        />
      </Link>
    </li>
  );
}
