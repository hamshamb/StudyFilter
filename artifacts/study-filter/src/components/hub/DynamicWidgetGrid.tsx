import React from "react";
import {
  Sigma,
  ListChecks,
  Target,
  AlertCircle,
  KeyRound,
  Tags,
  PencilRuler,
  BookOpenCheck,
  FileQuestion,
  Landmark,
  Drama,
  NotebookPen,
  Network,
  Sparkles,
} from "lucide-react";
import type { StudyAnswer } from "@workspace/api-client-react";
import type { SubjectId } from "@workspace/cbse-content";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnitEmpty } from "./UnitState";
import { DiagramRenderer } from "./DiagramRenderer";
import { useStudyLevel } from "@/hooks/use-study-level";

type Icon = React.ComponentType<{ className?: string }>;

interface ContentWidget {
  key: string;
  label: string;
  description: string;
  icon: Icon;
  kind: "content";
  render: (a: StudyAnswer) => React.ReactNode;
  available: (a: StudyAnswer) => boolean;
}

interface ActionWidget {
  key: string;
  label: string;
  description: string;
  icon: Icon;
  kind: "action";
  action: "quiz" | "ncert" | "important" | "notes" | "explainer";
}

type Widget = ContentWidget | ActionWidget;

function bullets(items?: string[]) {
  if (!items?.length) return null;
  return (
    <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

const FORMULA: ContentWidget = {
  key: "formula",
  label: "Formula & diagram",
  description: "The exact formula or diagram to reproduce",
  icon: Sigma,
  kind: "content",
  available: (a) => !!a.formulaOrDiagramHint,
  render: (a) => (
    <p className="whitespace-pre-line rounded-lg bg-muted p-3 font-mono text-sm">
      {a.formulaOrDiagramHint}
    </p>
  ),
};

const DIAGRAMS: ContentWidget = {
  key: "diagrams",
  label: "Diagrams",
  description: "Visual flowcharts that explain the concept",
  icon: Network,
  kind: "content",
  available: (a) => !!a.diagrams?.length,
  render: (a) => <DiagramRenderer diagrams={a.diagrams} />,
};

const STEPS: ContentWidget = {
  key: "steps",
  label: "Method, step by step",
  description: "Follow the full working in order",
  icon: ListChecks,
  kind: "content",
  available: (a) => !!a.stepByStep?.length,
  render: (a) => (
    <ol className="space-y-2 text-sm leading-relaxed">
      {a.stepByStep.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  ),
};

const MISTAKES: ContentWidget = {
  key: "mistakes",
  label: "Mistakes to avoid",
  description: "Where students commonly lose marks",
  icon: AlertCircle,
  kind: "content",
  available: (a) => !!a.commonMistakesToAvoid?.length || !!a.commonMistake,
  render: (a) =>
    a.commonMistakesToAvoid?.length ? (
      bullets(a.commonMistakesToAvoid)
    ) : (
      <p className="text-sm leading-relaxed">{a.commonMistake}</p>
    ),
};

const KEYPOINTS: ContentWidget = {
  key: "keypoints",
  label: "Key points",
  description: "The must-remember points",
  icon: KeyRound,
  kind: "content",
  available: (a) => !!a.keyPointsToRemember?.length || !!a.keyConcept,
  render: (a) =>
    a.keyPointsToRemember?.length ? (
      bullets(a.keyPointsToRemember)
    ) : (
      <p className="text-sm leading-relaxed">{a.keyConcept}</p>
    ),
};

const KEYWORDS: ContentWidget = {
  key: "keywords",
  label: "Keywords to use",
  description: "Words examiners reward",
  icon: Tags,
  kind: "content",
  available: (a) => !!a.examKeywords?.length,
  render: (a) => (
    <div className="flex flex-wrap gap-2">
      {a.examKeywords!.map((k) => (
        <span key={k} className="rounded-md bg-muted px-2.5 py-1 text-sm font-medium">
          {k}
        </span>
      ))}
    </div>
  ),
};

const WRITING: ContentWidget = {
  key: "writing",
  label: "How to write it",
  description: "Presenting this for full marks",
  icon: NotebookPen,
  kind: "content",
  available: (a) => !!a.howToWriteInExam || !!a.examTip,
  render: (a) => (
    <p className="whitespace-pre-line text-sm leading-relaxed">
      {a.howToWriteInExam || a.examTip}
    </p>
  ),
};

const QUIZ: ActionWidget = {
  key: "quiz",
  label: "Quick quiz",
  description: "Test yourself on this chapter",
  icon: FileQuestion,
  kind: "action",
  action: "quiz",
};
const IMPORTANT: ActionWidget = {
  key: "important",
  label: "Important questions",
  description: "Most-asked board questions",
  icon: Target,
  kind: "action",
  action: "important",
};
const NCERT: ActionWidget = {
  key: "ncert",
  label: "NCERT answers",
  description: "Model textbook answers",
  icon: BookOpenCheck,
  kind: "action",
  action: "ncert",
};
const NOTES: ActionWidget = {
  key: "notes",
  label: "Revision notes",
  description: "One-click easy-to-revise notes",
  icon: NotebookPen,
  kind: "action",
  action: "notes",
};
const EXPLAINER: ActionWidget = {
  key: "explainer",
  label: "Visual explainer",
  description: "See the core idea animated",
  icon: Sparkles,
  kind: "action",
  action: "explainer",
};

const SUBJECT_WIDGETS: Record<SubjectId, Widget[]> = {
  mathematics: [FORMULA, STEPS, EXPLAINER, QUIZ, MISTAKES, IMPORTANT, NOTES],
  science: [DIAGRAMS, KEYPOINTS, FORMULA, EXPLAINER, QUIZ, IMPORTANT, MISTAKES, NCERT, NOTES],
  "social-science": [
    DIAGRAMS,
    KEYPOINTS,
    KEYWORDS,
    EXPLAINER,
    IMPORTANT,
    NCERT,
    MISTAKES,
    NOTES,
  ],
  english: [WRITING, KEYPOINTS, EXPLAINER, IMPORTANT, NCERT, KEYWORDS, NOTES],
  hindi: [WRITING, KEYPOINTS, EXPLAINER, IMPORTANT, NCERT, KEYWORDS, NOTES],
};

const ACTION_ICON_OVERRIDE: Partial<Record<SubjectId, Icon>> = {
  "social-science": Landmark,
  english: Drama,
  hindi: Drama,
  mathematics: PencilRuler,
};

/**
 * Subject-aware grid shown beneath an answer. Each widget performs its own
 * function against the current context — content widgets reveal a slice of the
 * answer, action widgets open another working unit. None redirect to search.
 */
export function DynamicWidgetGrid({
  answer,
  subjectId,
  onAction,
}: {
  answer: StudyAnswer;
  subjectId: SubjectId;
  onAction: (action: ActionWidget["action"]) => void;
}) {
  const [active, setActive] = React.useState<ContentWidget | null>(null);
  const { level } = useStudyLevel();

  const widgets = (SUBJECT_WIDGETS[subjectId] ?? SUBJECT_WIDGETS.science).filter(
    (w) => w.kind === "action" || w.available(answer),
  );

  // Surface the widgets this study level cares about first, in the level's
  // priority order; everything else keeps its normal subject order after them.
  const priority = level.primaryWidgetKeys;
  const orderedWidgets = [...widgets].sort((a, b) => {
    const ai = priority.indexOf(a.key);
    const bi = priority.indexOf(b.key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  if (!orderedWidgets.length) return null;

  return (
    <div>
      <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Keep studying this chapter
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {orderedWidgets.map((w) => {
          const Icon =
            w.kind === "action" && ACTION_ICON_OVERRIDE[subjectId]
              ? ACTION_ICON_OVERRIDE[subjectId]!
              : w.icon;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() =>
                w.kind === "content" ? setActive(w) : onAction(w.action)
              }
              className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-3.5 text-left transition-all hover:border-primary/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-semibold leading-tight">{w.label}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {w.description}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <active.icon className="h-5 w-5 text-primary" />
                  {active.label}
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {active.available(answer) ? (
                  active.render(answer)
                ) : (
                  <UnitEmpty message="No details available for this part." />
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
