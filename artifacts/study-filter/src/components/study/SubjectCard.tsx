import React from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import type { Subject } from "@workspace/cbse-content";
import { getAccent } from "@/components/hub/accents";
import { ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * A subject, as a row you can open.
 *
 * The old version was a 24px-radius tile with a gradient wash, a shadow, a
 * 48px solid-colour block, a hover lift and a translating arrow — five
 * effects on a link to a chapter list. This is a card with a border, a
 * tinted monogram and the one number that matters.
 *
 * Colour appears twice and both times it is load-bearing: the monogram makes
 * the subject recognisable in a grid, and the progress bar inherits it so you
 * can see at a glance which subject you have actually been working in.
 */
export interface SubjectCardProps {
  subject: Subject;
  /** Chapters started, from the local study record. Omitted renders no bar. */
  startedCount?: number;
  className?: string;
}

export function SubjectCard({ subject, startedCount, className }: SubjectCardProps) {
  const accent = getAccent(subject.accent);
  const total = subject.chapters.length;
  const started = startedCount ?? 0;
  const pct = total > 0 ? (started / total) * 100 : 0;

  return (
    <Link
      href={`/subjects/${subject.id}`}
      className={cn(
        "group flex items-center gap-3.5 rounded-xl border border-card-border bg-card p-4",
        "transition-colors duration-150 hover:border-primary/35 hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      data-testid={`link-subject-${subject.id}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
          accent.soft,
          accent.text,
        )}
      >
        {subject.shortName.slice(0, 2)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-card-title block truncate">{subject.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {total} chapters
          {started > 0 && ` · ${started} started`}
        </span>
        {started > 0 && (
          <ProgressBar
            value={pct}
            size="sm"
            className="mt-2"
            label={`${subject.name}: ${started} of ${total} chapters started`}
          />
        )}
      </span>

      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
      />
    </Link>
  );
}
