import React from "react";
import {
  BookText,
  BookOpenCheck,
  Target,
  FileQuestion,
  NotebookPen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { Chapter, Subject } from "@workspace/cbse-content";
import { getAccent } from "./accents";
import type { UnitAction } from "./units/actions";

type Icon = React.ComponentType<{ className?: string }>;

const UNITS: {
  action: UnitAction;
  label: string;
  description: string;
  icon: Icon;
}[] = [
  {
    action: "summary",
    label: "Chapter summary",
    description: "A clear, exam-ready overview of the whole chapter",
    icon: BookText,
  },
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
  {
    action: "quiz",
    label: "Quick quiz",
    description: "Check your understanding with MCQs",
    icon: FileQuestion,
  },
  {
    action: "notes",
    label: "Easy-to-revise notes",
    description: "One-click notes built for quick last-minute revision",
    icon: NotebookPen,
  },
  {
    action: "explainer",
    label: "Visual explainer",
    description: "Watch the core idea play out, step by step",
    icon: Sparkles,
  },
];

export function ChapterDashboard({
  subject,
  chapter,
  onSelectUnit,
}: {
  subject: Subject;
  chapter: Chapter;
  onSelectUnit: (action: UnitAction) => void;
}) {
  const accent = getAccent(subject.accent);

  return (
    <div className="space-y-6">
      <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${accent.gradient} dark:border-border/60`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/8" />
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {subject.name}
          {chapter.unit ? ` · ${chapter.unit}` : ""} · Chapter {chapter.number}
        </p>
        <h3 className="mt-1 text-2xl font-bold leading-tight">
          {chapter.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick what you want to study. Each opens right here — no searching needed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {UNITS.map(({ action, label, description, icon: Icon }) => (
          <button
            key={action}
            type="button"
            onClick={() => onSelectUnit(action)}
            className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 dark:border-border/60 dark:hover:border-primary/30"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.soft} ${accent.text}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{label}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
