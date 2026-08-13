import React from "react";
import { GraduationCap, Target, BookOpen, CheckCircle2, List, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import type { AnswerVariantResponse } from "@workspace/api-client-react";

interface AnswerVariantViewProps {
  variant: AnswerVariantResponse;
  marks: number;
  contentLevel: string;
  questionText?: string;
}

const CONTENT_LEVEL_LABELS: Record<string, string> = {
  simple:       "Simple",
  moderate:     "Moderate",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

const FORMAT_LABELS: Record<string, string> = {
  direct:               "Direct Answer",
  paragraph:            "Paragraph",
  intro_body_conclusion: "Introduction–Body–Conclusion",
  numbered_points:      "Numbered Points",
  worked_solution:      "Worked Solution",
  case_study:           "Case Study",
  writing_format:       "Writing Format",
};

export function AnswerVariantView({
  variant,
  marks,
  contentLevel,
  questionText,
}: AnswerVariantViewProps) {
  const { format } = variant;
  const levelLabel = CONTENT_LEVEL_LABELS[contentLevel] ?? contentLevel;
  const formatLabel = FORMAT_LABELS[format] ?? format;
  const wordRange = variant.targetWordRange;

  return (
    <Card className="border-2 border-success/50 shadow-md overflow-hidden relative">
      {/* shimmer top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-success/10 to-transparent" />

      {/* Header */}
      <CardHeader className="bg-success/5 p-4 border-b border-success/50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-success" />
            <CardTitle className="text-success text-base font-bold">
              Board Exam Answer
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge className="bg-success/15 text-success border-success/50 text-xs">
              {marks} Mark{marks !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-xs border-border/60">
              {levelLabel}
            </Badge>
            <Badge variant="outline" className="text-xs border-border/60">
              {formatLabel}
            </Badge>
            <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
              {variant.actualWordCount}w / {wordRange.min}–{wordRange.max}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* IBC format */}
        {format === "intro_body_conclusion" &&
          variant.introduction &&
          variant.body &&
          variant.conclusion ? (
          <div className="space-y-4">
            <IBCSection label="Introduction" content={variant.introduction} color="blue" />
            <div className="border-l-2 border-border/40 ml-1" />
            <IBCSection label="Body" content={variant.body} color="default" />
            <div className="border-l-2 border-border/40 ml-1" />
            <IBCSection label="Conclusion" content={variant.conclusion} color="purple" />
          </div>
        ) : format === "numbered_points" && variant.answerPoints.length > 0 ? (
          /* Numbered points */
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <List className="h-3.5 w-3.5" />
              Answer Points
            </div>
            {variant.answerPoints.map((point, idx) => (
              <div key={idx} className="flex gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success/15 text-success flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="text-sm pt-0.5">
                  <MarkdownRenderer compact>{point}</MarkdownRenderer>
                </div>
              </div>
            ))}
          </div>
        ) : format === "worked_solution" && variant.workingSteps.length > 0 ? (
          /* Worked solution */
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Calculator className="h-3.5 w-3.5" />
              Step-by-Step Solution
            </div>
            {variant.workingSteps.map((step, idx) => (
              <div key={idx} className="flex gap-3 p-3 rounded-lg bg-muted/40">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="text-sm pt-0.5">
                  <MarkdownRenderer compact>{step}</MarkdownRenderer>
                </div>
              </div>
            ))}
            {variant.finalAnswer && (
              <div className="mt-3 p-3 rounded-xl border-2 border-success/50 bg-success/5">
                <p className="text-xs font-bold text-success mb-1">Final Answer</p>
                <MarkdownRenderer compact className="font-medium">{variant.finalAnswer}</MarkdownRenderer>
              </div>
            )}
          </div>
        ) : (
          /* Paragraph / direct / fallback — render examReadyAnswer */
          <MarkdownRenderer className="text-base leading-relaxed">
            {variant.examReadyAnswer}
          </MarkdownRenderer>
        )}

        {/* Scoring keywords */}
        {variant.scoringKeywords.length > 0 && (
          <div className="border-t border-border/40 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              <Target className="h-3.5 w-3.5" />
              Scoring Keywords
            </div>
            <div className="flex flex-wrap gap-1.5">
              {variant.scoringKeywords.map((kw, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="bg-success/8 text-success border border-success/50 text-xs"
                >
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Word count status */}
        <WordCountStatus
          actual={variant.actualWordCount}
          min={wordRange.min}
          max={wordRange.max}
        />
      </CardContent>
    </Card>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

type IBCColor = "blue" | "purple" | "default";

function IBCSection({
  label,
  content,
  color,
}: {
  label: string;
  content: string;
  color: IBCColor;
}) {
  const colorClasses: Record<IBCColor, { label: string; pill: string }> = {
    blue:    { label: "text-primary", pill: "bg-primary/10 border-primary/50" },
    purple:  { label: "text-primary", pill: "bg-primary/10 border-primary/50" },
    default: { label: "text-foreground", pill: "bg-muted/50 border-border/40" },
  };
  const cls = colorClasses[color];

  return (
    <div className="space-y-1.5">
      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 border text-[11px] font-bold uppercase tracking-wider ${cls.pill} ${cls.label}`}>
        {label}
      </div>
      <MarkdownRenderer compact className="text-sm leading-relaxed pl-1">
        {content}
      </MarkdownRenderer>
    </div>
  );
}

function WordCountStatus({
  actual,
  min,
  max,
}: {
  actual: number;
  min: number;
  max: number;
}) {
  const pct = Math.min(100, Math.round((actual / max) * 100));
  const isUnder = actual < min;
  const isOver = actual > max;
  const statusColor = isOver ? "bg-warning" : isUnder ? "bg-destructive" : "bg-success";

  return (
    <div className="flex items-center gap-3">
      <CheckCircle2
        className={`h-3.5 w-3.5 shrink-0 ${isOver || isUnder ? "text-warning" : "text-success"}`}
      />
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${statusColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground shrink-0">
        {actual}w {isUnder ? "(add more)" : isOver ? "(slightly over)" : "✓"}
      </span>
    </div>
  );
}
