import React, { memo } from "react";
import { GraduationCap } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";

export type ContentLevel = "simple" | "moderate" | "intermediate" | "advanced";

export interface BoardAnswerControlsProps {
  availableMarkOptions: number[];
  recommendedMarks: number;
  selectedMarks: number | "auto";
  selectedLevel: ContentLevel;
  isUpdating: boolean;
  onMarksChange: (marks: number | "auto") => void;
  onLevelChange: (level: ContentLevel) => void;
}

const CONTENT_LEVELS: { id: ContentLevel; label: string; tip: string }[] = [
  { id: "simple",       label: "Simple",       tip: "Basic vocabulary, short sentences — quick revision" },
  { id: "moderate",     label: "Moderate",     tip: "Standard CBSE textbook language (default)" },
  { id: "intermediate", label: "Intermediate", tip: "Stronger terminology and reasoning" },
  { id: "advanced",     label: "Advanced",     tip: "Higher-order reasoning within Grade 10 syllabus" },
];

export const BoardAnswerControls = memo(function BoardAnswerControls({
  availableMarkOptions,
  recommendedMarks,
  selectedMarks,
  selectedLevel,
  isUpdating,
  onMarksChange,
  onLevelChange,
}: BoardAnswerControlsProps) {
  const safeMarkOptions = availableMarkOptions ?? [];

  return (
    <div className="rounded-t-2xl border border-b-0 border-primary/20 bg-primary/4 dark:bg-primary/6 dark:border-primary/20 px-4 py-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <GraduationCap className="h-3.5 w-3.5" />
          Answer Format
        </div>
        {isUpdating && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
            <Spinner />
            Updating answer…
          </div>
        )}
      </div>

      {/* Marks row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-12 shrink-0">Marks</span>
        <div className="flex gap-1.5 flex-wrap">
          {/* Auto chip */}
          <button
            type="button"
            title={`Recommended: ${recommendedMarks} marks based on question type`}
            onClick={() => onMarksChange("auto")}
            className={[
              "h-7 px-2.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap",
              selectedMarks === "auto"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            ].join(" ")}
          >
            Auto: {recommendedMarks}M
          </button>
          {/* Specific mark chips */}
          {safeMarkOptions.map((m) => (
            <button
              key={m}
              type="button"
              title={`${m} mark answer`}
              onClick={() => onMarksChange(m)}
              className={[
                "h-7 w-9 rounded-full text-xs font-bold transition-all border",
                selectedMarks === m
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
              ].join(" ")}
            >
              {m}M
            </button>
          ))}
        </div>
      </div>

      {/* Content level row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-12 shrink-0">Depth</span>
        <div className="flex gap-1.5 flex-wrap">
          {CONTENT_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              title={lvl.tip}
              onClick={() => onLevelChange(lvl.id)}
              className={[
                "h-7 px-2.5 rounded-full text-xs font-semibold transition-all border",
                selectedLevel === lvl.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
              ].join(" ")}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
