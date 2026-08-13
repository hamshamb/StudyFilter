import React from "react";
import { ChevronRight, Search, ArrowLeft } from "lucide-react";
import type { Chapter, Subject } from "@workspace/cbse-content";
import { GRADE } from "@workspace/cbse-content";
import { Input } from "@/components/ui/input";
import { StudyOverlay } from "./StudyOverlay";
import { ChapterDashboard } from "./ChapterDashboard";
import { getAccent } from "./accents";
import type { StudyContext } from "./types";
import type { UnitAction } from "./units/actions";
import { SummaryUnit } from "./units/SummaryUnit";
import { NcertAnswersUnit } from "./units/NcertAnswersUnit";
import { ImportantQuestionsUnit } from "./units/ImportantQuestionsUnit";
import { QuizUnit } from "./units/QuizUnit";
import { RevisionNotesUnit } from "./units/RevisionNotesUnit";
import { ExplainerUnit } from "./units/ExplainerUnit";

const UNIT_TITLES: Record<UnitAction, string> = {
  summary: "Chapter summary",
  ncert: "NCERT answers",
  important: "Important questions",
  quiz: "Quick quiz",
  notes: "Revision notes",
  explainer: "Visual explainer",
};

function groupByUnit(chapters: Chapter[]): { unit: string; items: Chapter[] }[] {
  const groups: { unit: string; items: Chapter[] }[] = [];
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

export function SubjectStudio({
  subject,
  open,
  onClose,
}: {
  subject: Subject | null;
  open: boolean;
  onClose: () => void;
}) {
  const [chapter, setChapter] = React.useState<Chapter | null>(null);
  const [unit, setUnit] = React.useState<UnitAction | null>(null);
  const [filter, setFilter] = React.useState("");

  // Reset internal navigation whenever the subject changes or studio reopens.
  React.useEffect(() => {
    if (open) {
      setChapter(null);
      setUnit(null);
      setFilter("");
    }
  }, [open, subject?.id]);

  if (!subject) return null;
  const accent = getAccent(subject.accent);

  const context: StudyContext | null = chapter
    ? {
        classLevel: GRADE,
        subjectId: subject.id,
        subjectName: subject.name,
        chapterTitle: chapter.title,
      }
    : null;

  const filtered = subject.chapters.filter((c) =>
    c.title.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const groups = groupByUnit(filtered);

  const header = (
    <div className="flex items-center gap-2">
      {(chapter || unit) && (
        <button
          type="button"
          onClick={() => (unit ? setUnit(null) : setChapter(null))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
          <span className={accent.text}>{subject.name}</span>
          {chapter ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="truncate">{chapter.title}</span>
            </>
          ) : null}
          {unit ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{UNIT_TITLES[unit]}</span>
            </>
          ) : null}
        </p>
        <h2 className="truncate text-lg font-bold">
          {unit
            ? UNIT_TITLES[unit]
            : chapter
              ? chapter.title
              : `${subject.name} · Class ${GRADE}`}
        </h2>
      </div>
    </div>
  );

  return (
    <StudyOverlay
      open={open}
      onClose={onClose}
      header={header}
      ariaLabel={`${subject.name} study studio`}
    >
      {!chapter ? (
        <div className="space-y-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a chapter…"
              className="pl-9"
            />
          </div>
          {groups.length ? (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.unit}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {g.unit}
                  </p>
                  <ul className="space-y-2">
                    {g.items.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setChapter(c)}
                          className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:shadow-sm dark:border-border/60 dark:hover:border-primary/30"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${accent.soft} ${accent.text}`}
                          >
                            {c.number}
                          </span>
                          <span className="flex-1 font-medium leading-snug">
                            {c.title}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No chapters match “{filter}”.
            </p>
          )}
        </div>
      ) : !unit ? (
        <ChapterDashboard
          subject={subject}
          chapter={chapter}
          onSelectUnit={setUnit}
        />
      ) : context ? (
        <UnitRenderer unit={unit} context={context} onAction={setUnit} />
      ) : null}
    </StudyOverlay>
  );
}

function UnitRenderer({
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
    default:
      return null;
  }
}
