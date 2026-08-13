import React from "react";
import { Link } from "wouter";
import { FileQuestion, Layers, NotebookPen, Sparkles, StickyNote, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummaryUnit } from "@/components/hub/units/SummaryUnit";
import { NcertAnswersUnit } from "@/components/hub/units/NcertAnswersUnit";
import { ImportantQuestionsUnit } from "@/components/hub/units/ImportantQuestionsUnit";
import { RevisionNotesUnit } from "@/components/hub/units/RevisionNotesUnit";
import { DepthPicker, ExplainView } from "@/components/study/ExplainView";
import { FlashcardMaker } from "@/components/study/FlashcardMaker";
import { EmptyState } from "@/components/layout/PageShell";
import type { StudyContext } from "@/components/hub/types";
import type { SubjectId } from "@workspace/cbse-content";
import type { ExplainDepth } from "@/lib/study-content";
import { scopeToSearch, type ResolvedScope } from "@/lib/scope";
import { appendToChapterNote } from "@/hooks/use-notes";
import { useToast } from "@/hooks/use-toast";
import type { WorkspaceRequest } from "./types";

/**
 * What actually fills the Study Workspace.
 *
 * Every kind here renders the *same component the full page renders*. That is
 * the point of the panel: it is not a preview or a summary-of-a-summary, it is
 * the feature, in a narrower column. "Expand" then swaps the container, not
 * the content, and because both read one cached query the page opens already
 * populated.
 */
export function WorkspaceBody({
  request,
  scope,
  onNavigate,
  onClose,
}: {
  request: WorkspaceRequest;
  scope: ResolvedScope;
  onNavigate: (request: WorkspaceRequest) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [depth, setDepth] = React.useState<ExplainDepth>("standard");

  const needsChapter = ["summary", "important", "notes", "ncert"].includes(request.kind);
  if (needsChapter && !scope.hasChapter) {
    return (
      <EmptyState
        icon={Target}
        title="Pick a chapter first"
        description="This panel works on one chapter at a time."
        action={
          <Button asChild onClick={onClose}>
            <Link href="/subjects">Browse subjects</Link>
          </Button>
        }
      />
    );
  }

  const context: StudyContext = {
    classLevel: scope.classLevel,
    subjectId: (scope.subjectId ?? "science") as SubjectId,
    subjectName: scope.subject?.name ?? "General",
    chapterTitle: scope.chapter?.title ?? "",
    ...(scope.topic ? { topic: scope.topic } : {}),
  };

  function saveToNotes(title: string, body: string) {
    appendToChapterNote({
      title,
      body,
      ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
      ...(scope.chapterId ? { chapterId: scope.chapterId } : {}),
      chapterTitle: scope.chapter?.title ?? title,
      source: "summary",
    });
    toast({ title: "Saved to your notes" });
  }

  const search = scopeToSearch(scope);

  const footer = (
    <NextActions
      request={request}
      scope={scope}
      search={search}
      onNavigate={onNavigate}
      onClose={onClose}
      onSaveNote={saveToNotes}
    />
  );

  switch (request.kind) {
    case "summary":
      return (
        <>
          <SummaryUnit
            context={context}
            onAction={(action) => {
              // The widget grid inside the summary can hand off to a sibling
              // unit; keep that inside the panel rather than navigating.
              if (action === "quiz") onNavigate({ kind: "quiz", scope: request.scope });
              else if (action === "important") onNavigate({ kind: "important", scope: request.scope });
              else if (action === "notes") onNavigate({ kind: "notes", scope: request.scope });
              else if (action === "ncert") onNavigate({ kind: "ncert", scope: request.scope });
            }}
          />
          {footer}
        </>
      );

    case "ncert":
      return (
        <>
          <NcertAnswersUnit context={context} />
          {footer}
        </>
      );

    case "important":
      return (
        <>
          <ImportantQuestionsUnit context={context} />
          {footer}
        </>
      );

    case "notes":
      return (
        <>
          <RevisionNotesUnit context={context} />
          {footer}
        </>
      );

    case "explain":
      return (
        <div className="space-y-4">
          {request.selection && (
            <blockquote className="rounded-lg border-l-2 border-primary/50 bg-muted/50 py-2 pl-3 pr-2 text-sm italic leading-relaxed text-muted-foreground">
              {request.selection.length > 320
                ? `${request.selection.slice(0, 320)}…`
                : request.selection}
            </blockquote>
          )}
          <DepthPicker value={depth} onChange={setDepth} />
          <ExplainView
            scope={scope}
            topic={request.question ?? request.title ?? scope.topic ?? scope.chapter?.title ?? ""}
            depth={depth}
            {...(request.selection ? { passage: request.selection } : {})}
            footer={footer}
          />
        </div>
      );

    case "flashcards":
      return (
        <div className="space-y-4">
          <FlashcardMaker
            scope={scope}
            {...(request.selection ? { passage: request.selection } : {})}
            source={request.selection ? "selection" : "chapter"}
          />
          <Button asChild variant="ghost" className="w-full" onClick={onClose}>
            <Link href={`/flashcards${search}`}>Open all my decks</Link>
          </Button>
        </div>
      );

    case "quiz":
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-card-border bg-card p-4 text-center">
            <FileQuestion className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">
              Test yourself on {scope.chapter?.title ?? scope.subject?.name ?? "this"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the length, difficulty and question types on the next screen.
            </p>
            <Button asChild className="mt-3 w-full" onClick={onClose}>
              <Link href={`/quiz${search}`}>Set up the quiz</Link>
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            The chapter you&rsquo;re reading is already selected.
          </p>
        </div>
      );

    case "ask":
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ask anything about {scope.chapter?.title ?? scope.subject?.name ?? "your syllabus"}.
          </p>
          <Button asChild className="w-full" onClick={onClose}>
            <Link
              href={`/chat?q=${encodeURIComponent(
                request.question ?? `${scope.chapter?.title ?? ""}: `,
              )}`}
            >
              Open Ask StudyFilter
            </Link>
          </Button>
        </div>
      );
  }
}

/**
 * The connected part.
 *
 * Every panel ends with the two or three things a student most plausibly wants
 * next, and each of them stays inside the workspace where it can. This is what
 * turns a set of features into a session.
 */
function NextActions({
  request,
  scope,
  search,
  onNavigate,
  onClose,
  onSaveNote,
}: {
  request: WorkspaceRequest;
  scope: ResolvedScope;
  search: string;
  onNavigate: (request: WorkspaceRequest) => void;
  onClose: () => void;
  onSaveNote: (title: string, body: string) => void;
}) {
  const canRevise = scope.hasChapter && scope.subjectId && scope.chapterId;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="text-eyebrow mb-2 text-muted-foreground">Next</p>
      <div className="flex flex-wrap gap-2">
        {request.kind !== "flashcards" && (
          <ActionChip
            icon={Layers}
            label="Make flashcards"
            onClick={() => onNavigate({ kind: "flashcards", scope: request.scope, ...(request.selection ? { selection: request.selection } : {}) })}
          />
        )}
        {request.kind !== "quiz" && (
          <ActionChip
            icon={FileQuestion}
            label="Quiz me on this"
            onClick={() => onNavigate({ kind: "quiz", scope: request.scope })}
          />
        )}
        {request.kind !== "notes" && canRevise && (
          <ActionChip
            icon={NotebookPen}
            label="Quick revision"
            onClick={() => onNavigate({ kind: "notes", scope: request.scope })}
          />
        )}
        {request.kind !== "important" && canRevise && (
          <ActionChip
            icon={Target}
            label="Important questions"
            onClick={() => onNavigate({ kind: "important", scope: request.scope })}
          />
        )}
        {request.kind !== "explain" && (
          <ActionChip
            icon={Sparkles}
            label="Explain a term"
            onClick={() => onNavigate({ kind: "explain", scope: request.scope })}
          />
        )}
        {canRevise && (
          <ActionChip
            icon={StickyNote}
            label="Add to my notes"
            onClick={() => {
              onSaveNote(
                request.title ?? "Saved from the study panel",
                `Studied **${scope.chapter?.title}** — ${new Date().toLocaleDateString()}.`,
              );
            }}
          />
        )}
      </div>

      {canRevise && (
        <Button asChild variant="ghost" size="sm" className="mt-3 w-full" onClick={onClose}>
          <Link href={`/revise${search}`}>Open the full revision workspace</Link>
        </Button>
      )}
    </div>
  );
}

function ActionChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
