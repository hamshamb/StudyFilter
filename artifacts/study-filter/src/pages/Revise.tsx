import React from "react";
import { Link, useSearch } from "wouter";
import {
  Brain,
  CalendarDays,
  FileQuestion,
  KeyRound,
  Layers,
  Network,
  NotebookPen,
  Sigma,
  Zap,
} from "lucide-react";
import { SUBJECTS } from "@workspace/cbse-content";
import type { NoteTerm, RevisionNotes } from "@workspace/api-client-react";
import { PageShell, PageHeader, Panel, EmptyState } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Chip, ProgressBar } from "@/components/ui/primitives";
import { UnitError, UnitLoading } from "@/components/hub/UnitState";
import { DiagramRenderer } from "@/components/hub/DiagramRenderer";
import { SummaryUnit } from "@/components/hub/units/SummaryUnit";
import { ImportantQuestionsUnit } from "@/components/hub/units/ImportantQuestionsUnit";
import { ContentStatus, useIsFresh } from "@/components/hub/units/ContentStatus";
import { SeoHead } from "@/components/SeoHead";
import { useScopedRoute } from "@/hooks/use-study-scope";
import { useRecordRecent } from "@/hooks/use-recents";
import { recordMasteryReview, useMastery } from "@/hooks/use-mastery";
import { chapterKey, MASTERY_INFO } from "@/lib/mastery";
import { useChapterContent, useRefreshChapterContent } from "@/lib/study-content";
import { errorMessage } from "@/lib/api";
import { humanitiesStrand, isPoetryChapter, scopeToSearch, subjectShape } from "@/lib/scope";
import type { StudyContext } from "@/components/hub/types";
import type { SubjectId } from "@workspace/cbse-content";
import { cn } from "@/lib/utils";

/**
 * The revision workspace.
 *
 * Two things make this different from a page that prints revision notes.
 *
 * **It adapts to the subject.** A timeline is essential for History and
 * meaningless for Trigonometry; a formula sheet is the whole point of Maths
 * revision and absurd for a poem. So the formats offered are chosen from the
 * subject *and* — for Social Science, which is four subjects wearing one name
 * — from the strand the chapter belongs to.
 *
 * **It only offers what exists.** The format list is filtered against what the
 * chapter's notes actually contain, so a chapter with no diagrams never shows
 * a "Diagrams" tab that leads to an empty panel. That is the difference
 * between adapting and pretending to adapt.
 */

type FormatId =
  | "summary"
  | "concepts"
  | "formulae"
  | "definitions"
  | "diagrams"
  | "timeline"
  | "mnemonics"
  | "onepage"
  | "important";

interface FormatSpec {
  id: FormatId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** False when the chapter's notes contain nothing for this format. */
  available: (notes: RevisionNotes | undefined) => boolean;
}

const FORMATS: Record<FormatId, FormatSpec> = {
  summary: {
    id: "summary",
    label: "Chapter summary",
    icon: NotebookPen,
    available: () => true,
  },
  concepts: {
    id: "concepts",
    label: "Key concepts",
    icon: Brain,
    available: (n) => (n?.sections?.length ?? 0) > 0,
  },
  formulae: {
    id: "formulae",
    label: "Formulas",
    icon: Sigma,
    available: (n) => (n?.formulae?.length ?? 0) > 0,
  },
  definitions: {
    id: "definitions",
    label: "Definitions",
    icon: KeyRound,
    available: (n) => (n?.keyTerms?.length ?? 0) > 0,
  },
  diagrams: {
    id: "diagrams",
    label: "Diagrams",
    icon: Network,
    available: (n) => (n?.diagrams?.length ?? 0) > 0,
  },
  timeline: {
    id: "timeline",
    label: "Dates & timeline",
    icon: CalendarDays,
    available: (n) => (n?.importantDates?.length ?? 0) > 0,
  },
  mnemonics: {
    id: "mnemonics",
    label: "Memory aids",
    icon: Brain,
    available: (n) => (n?.mnemonics?.length ?? 0) > 0,
  },
  onepage: {
    id: "onepage",
    label: "One-page revision",
    icon: Zap,
    available: (n) => (n?.quickRevision?.length ?? 0) > 0,
  },
  important: {
    id: "important",
    label: "Important questions",
    icon: FileQuestion,
    available: () => true,
  },
};

/**
 * Which formats a subject can offer at all, in the order they are useful.
 *
 * This is the "hide what doesn't apply" rule, written down. Maths leads with
 * formulas and methods; a literature chapter leads with the summary and the
 * terms, and is never offered a formula sheet.
 */
function formatsForSubject(
  subjectId: SubjectId | null,
  chapter: { unit?: string } | null,
): FormatId[] {
  const shape = subjectShape(subjectId);

  if (shape === "maths") {
    return ["formulae", "concepts", "summary", "mnemonics", "onepage", "important"];
  }
  if (shape === "science") {
    return ["concepts", "definitions", "formulae", "diagrams", "summary", "mnemonics", "onepage", "important"];
  }
  if (shape === "humanities") {
    const strand = humanitiesStrand(chapter as never);
    if (strand === "history") {
      return ["timeline", "concepts", "definitions", "summary", "mnemonics", "onepage", "important"];
    }
    if (strand === "geography") {
      return ["concepts", "definitions", "diagrams", "summary", "onepage", "important"];
    }
    // Civics and Economics live on terms and arguments, not dates.
    return ["definitions", "concepts", "summary", "timeline", "onepage", "important"];
  }
  // Literature.
  return isPoetryChapter(chapter as never)
    ? ["summary", "concepts", "definitions", "mnemonics", "onepage", "important"]
    : ["summary", "concepts", "definitions", "timeline", "onepage", "important"];
}

export default function Revise() {
  const { scope, setScope } = useScopedRoute("/revise");
  const search = useSearch();
  const mastery = useMastery();

  /*
   * `?format=important` opens on that panel.
   *
   * This is what makes "Important questions" in the command bar keep its
   * promise: it lands on the important-questions tab, not on the chapter
   * summary with the right tab merely available somewhere on the strip.
   */
  const requestedFormat = React.useMemo<FormatId | null>(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const raw = params.get("format");
    return raw && raw in FORMATS ? (raw as FormatId) : null;
  }, [search]);

  const [format, setFormat] = React.useState<FormatId>(requestedFormat ?? "summary");

  React.useEffect(() => {
    if (requestedFormat) setFormat(requestedFormat);
  }, [requestedFormat]);

  const apiScope = scope.hasChapter
    ? {
        classLevel: scope.classLevel,
        subject: scope.subject!.name,
        chapter: scope.chapter!.title,
        ...(scope.topic ? { topic: scope.topic } : {}),
      }
    : null;

  const notes = useChapterContent("notes", apiScope);
  const refreshNotes = useRefreshChapterContent("notes", apiScope);
  const fresh = useIsFresh(notes.dataUpdatedAt);

  const scopeSearch = scopeToSearch(scope);

  useRecordRecent(
    scope.hasChapter
      ? {
          kind: "revision",
          title: `Revising ${scope.chapter!.title}`,
          subtitle: scope.subject!.name,
          href: `/revise${scopeSearch}`,
          ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
          ...(scope.chapterId ? { chapterId: scope.chapterId } : {}),
        }
      : null,
  );

  /*
   * Opening a revision surface counts as revision. That is what stops a
   * chapter you re-read every week from decaying to "needs revision" purely
   * because you haven't been quizzed on it lately.
   */
  React.useEffect(() => {
    if (!scope.subjectId || !scope.chapterId || !scope.chapter) return;
    recordMasteryReview({
      key: chapterKey(scope.subjectId, scope.chapterId),
      domain: "chapter",
      label: scope.chapter.title,
      subjectId: scope.subjectId,
      chapterId: scope.chapterId,
    });
  }, [scope.subjectId, scope.chapterId, scope.chapter]);

  const allowed = formatsForSubject(scope.subjectId, scope.chapter);
  const available = allowed.filter((id) => {
    const spec = FORMATS[id];
    // Until the notes arrive, show only the formats that never depend on them,
    // rather than flashing a full tab strip that then shrinks.
    if (notes.isPending) return id === "summary" || id === "important";
    return spec.available(notes.data);
  });

  React.useEffect(() => {
    // While the notes are still loading, `available` is deliberately only the
    // two formats that don't depend on them. Falling back now would throw away
    // a format asked for in the URL (?format=formulae) a moment before it
    // becomes available.
    if (notes.isPending) return;
    if (available.length > 0 && !available.includes(format)) setFormat(available[0]!);
  }, [available, format, notes.isPending]);

  if (!scope.hasChapter) {
    return (
      <PageShell width="content">
        <PageHeader
          icon={NotebookPen}
          title="Revise"
          description="Pick a chapter and the revision formats that suit it will appear."
        />
        <div className="space-y-4">
          <div className="rail py-0.5">
            {SUBJECTS.map((subject) => (
              <Chip
                key={subject.id}
                active={scope.subjectId === subject.id}
                onClick={() => setScope({ subjectId: subject.id, chapterId: null })}
              >
                {subject.shortName}
              </Chip>
            ))}
          </div>
          {scope.subject ? (
            <ul className="overflow-hidden rounded-xl border border-card-border bg-card">
              {scope.subject.chapters.map((chapter) => (
                <li key={chapter.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => setScope({ chapterId: chapter.id })}
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {chapter.number}
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{chapter.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={NotebookPen}
              title="Choose a subject"
              description="Revision formats differ by subject — maths gets formulas, history gets a timeline."
            />
          )}
        </div>
      </PageShell>
    );
  }

  const context: StudyContext = {
    classLevel: scope.classLevel,
    subjectId: scope.subjectId as SubjectId,
    subjectName: scope.subject!.name,
    chapterTitle: scope.chapter!.title,
    ...(scope.topic ? { topic: scope.topic } : {}),
  };

  const record = scope.subjectId && scope.chapterId
    ? mastery.get(chapterKey(scope.subjectId, scope.chapterId))
    : null;
  const state = record ? mastery.stateOf(chapterKey(scope.subjectId!, scope.chapterId!)) : "not-started";

  return (
    <>
      <SeoHead
        title={`Revise ${scope.chapter!.title} — Class ${scope.classLevel} ${scope.subject!.name} | StudyFilter`}
        description={`Revision formats built for ${scope.subject!.name}: ${available
          .map((id) => FORMATS[id].label)
          .join(", ")}.`}
        canonical="/revise"
      />
      <PageShell width="content">
        <PageHeader
          icon={NotebookPen}
          title={scope.chapter!.title}
          eyebrow={`${scope.subject!.name} · Chapter ${scope.chapter!.number}`}
          description="Revision formats chosen for this subject. Nothing here is generated fresh unless you ask."
          actions={
            <Button variant="outline" size="sm" onClick={() => setScope({ chapterId: null })}>
              Change chapter
            </Button>
          }
        />

        <div
          className={cn(
            "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5",
            MASTERY_INFO[state].className,
          )}
        >
          <div>
            <p className="text-sm font-semibold">{MASTERY_INFO[state].label}</p>
            <p className="text-xs opacity-90">{MASTERY_INFO[state].hint}</p>
          </div>
          {record && record.attempts > 0 && (
            <div className="w-32">
              <ProgressBar
                value={Math.round(record.recent * 100)}
                size="sm"
                label={`Recent accuracy ${Math.round(record.recent * 100)}%`}
              />
              <p className="mt-1 text-[11px] tabular-nums opacity-90">
                {Math.round(record.recent * 100)}% recent · {record.attempts} answered
              </p>
            </div>
          )}
        </div>

        <div className="rail mb-5 py-0.5" role="tablist" aria-label="Revision format">
          {available.map((id) => {
            const spec = FORMATS[id];
            const Icon = spec.icon;
            const active = format === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFormat(id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {spec.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          {format === "summary" && <SummaryUnit context={context} onAction={() => {}} />}
          {format === "important" && <ImportantQuestionsUnit context={context} />}
          {format !== "summary" && format !== "important" && (
            <NotesFormat
              format={format}
              notes={notes.data}
              loading={notes.isPending}
              error={notes.isError ? errorMessage(notes.error, "We couldn't load these notes.") : null}
              onRetry={() => notes.refetch()}
              retrying={notes.isFetching}
              fresh={fresh}
              onRefresh={() => refreshNotes.mutate()}
              refreshing={refreshNotes.isPending}
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/flashcards${scopeSearch}`}>
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Turn this into flashcards
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/quiz${scopeSearch}`}>
              <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />
              Test yourself
            </Link>
          </Button>
        </div>
      </PageShell>
    </>
  );
}

function NotesFormat({
  format,
  notes,
  loading,
  error,
  onRetry,
  retrying,
  fresh,
  onRefresh,
  refreshing,
}: {
  format: FormatId;
  notes: RevisionNotes | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  retrying: boolean;
  fresh: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (loading) return <UnitLoading message="Pulling together your revision notes" />;
  if (error) return <UnitError message={error} onRetry={onRetry} retrying={retrying} />;
  if (!notes) return null;

  return (
    <div className="space-y-4">
      <ContentStatus label="notes" fresh={fresh} onRefresh={onRefresh} refreshing={refreshing} />

      {format === "concepts" &&
        notes.sections?.map((section, i) => (
          <Panel key={i} title={section.heading}>
            <Bullets items={section.points} />
          </Panel>
        ))}

      {format === "formulae" && (
        <Panel title="Every formula in this chapter" icon={Sigma}>
          <ul className="space-y-2.5">
            {notes.formulae?.map((formula, i) => (
              <li key={i} className="font-mono text-sm">
                {formula}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {format === "definitions" && (
        <Panel title="Terms you must be able to define" icon={KeyRound}>
          <Terms terms={notes.keyTerms ?? []} />
        </Panel>
      )}

      {format === "diagrams" && (
        <Panel title="Diagrams" icon={Network}>
          <DiagramRenderer diagrams={notes.diagrams} />
        </Panel>
      )}

      {format === "timeline" && (
        <Panel title="Dates and events, in order" icon={CalendarDays}>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {notes.importantDates?.map((entry, i) => (
              <li key={i} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.4375rem] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background"
                />
                <p className="text-sm font-semibold">{entry.term}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">{entry.meaning}</p>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {format === "mnemonics" && (
        <Panel title="Ways to remember it" icon={Brain}>
          <Bullets items={notes.mnemonics ?? []} />
        </Panel>
      )}

      {format === "onepage" && (
        <Panel title="The night before" icon={Zap} description="Everything that matters, on one screen.">
          <Bullets items={notes.quickRevision ?? []} />
        </Panel>
      )}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Terms({ terms }: { terms: NoteTerm[] }) {
  return (
    <dl className="space-y-2.5">
      {terms.map((term, i) => (
        <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 font-semibold sm:w-40">{term.term}</dt>
          <dd className="text-sm leading-relaxed text-foreground/90">{term.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
