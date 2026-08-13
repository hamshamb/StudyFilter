import React from "react";
import { cn } from "@/lib/utils";

/**
 * The notebook margin-note.
 *
 * One shape for every aside an answer can carry — the concept behind it, the
 * thing examiners look for, the mistake everyone makes. A coloured left rule
 * and a faint wash, which is as much personality as a study surface should
 * have; the answer itself is what the student is here to read.
 *
 * Tone drives a single `--callout-hue` custom property that `.sf-callout`
 * reads, so adding a tone is one entry in this map rather than a new set of
 * border/background/text classes.
 */

export type CalloutTone = "concept" | "tip" | "remember" | "mistake" | "neutral";

const TONE_HUE: Record<CalloutTone, string> = {
  concept: "var(--primary)",
  tip: "var(--success)",
  remember: "var(--warning)",
  mistake: "var(--destructive)",
  neutral: "var(--muted-foreground)",
};

const TONE_TEXT: Record<CalloutTone, string> = {
  concept: "text-primary",
  tip: "text-success",
  remember: "text-warning",
  mistake: "text-destructive",
  neutral: "text-muted-foreground",
};

export interface CalloutProps {
  tone?: CalloutTone;
  /** Short all-caps label — "BOARD EXAM TIP", "COMMON MISTAKE". */
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}

export function Callout({
  tone = "neutral",
  label,
  icon: Icon,
  children,
  className,
}: CalloutProps) {
  return (
    <aside
      className={cn("sf-callout", className)}
      style={{ ["--callout-hue" as string]: TONE_HUE[tone] }}
    >
      <p className={cn("text-eyebrow flex items-center gap-1.5", TONE_TEXT[tone])}>
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/90">{children}</div>
    </aside>
  );
}

/**
 * A formula or the diagram a student is expected to draw. Monospaced and
 * scrollable on its own, because an equation that doesn't fit should not make
 * the page scroll sideways on a phone.
 */
export function FormulaBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("sf-formula", className)}>{children}</div>;
}
