import React from "react";
import { Lightbulb, Target } from "lucide-react";
import { UnitLoading, UnitError, UnitEmpty } from "../UnitState";
import { ContentStatus, contextToScope, useIsFresh } from "./ContentStatus";
import type { StudyContext } from "../types";
import { useChapterContent, useRefreshChapterContent } from "@/lib/study-content";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

const TYPE_LABEL: Record<string, string> = {
  VSA: "Very short answer",
  SA: "Short answer",
  LA: "Long answer",
  MCQ: "Multiple choice",
};

export function ImportantQuestionsUnit({ context }: { context: StudyContext }) {
  const scope = React.useMemo(() => contextToScope(context), [context]);
  const query = useChapterContent("important", scope);
  const refresh = useRefreshChapterContent("important", scope);
  const fresh = useIsFresh(query.dataUpdatedAt);

  if (query.isPending) return <UnitLoading message="Finding the most-asked questions" />;
  if (query.isError || !query.data)
    return (
      <UnitError
        message={errorMessage(query.error, "We couldn't load the important questions.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );

  const questions = query.data.questions ?? [];

  if (questions.length === 0)
    return (
      <UnitEmpty
        icon={Target}
        title="No questions found"
        message="Nothing came back for this chapter. Rewriting usually fixes it."
        action={
          <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? "Rewriting…" : "Try again"}
          </Button>
        }
      />
    );

  return (
    <div className="space-y-4">
      <ContentStatus
        label="question list"
        fresh={fresh}
        onRefresh={() => refresh.mutate()}
        refreshing={refresh.isPending}
      />
      <p className="text-sm text-muted-foreground">
        {questions.length} questions the board asks most often from this chapter.
      </p>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={i} className="rounded-xl border border-card-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {q.type ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {TYPE_LABEL[q.type] ?? q.type}
                </span>
              ) : null}
              {q.marks ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {q.marks}
                </span>
              ) : null}
            </div>
            <p className="font-medium leading-snug">
              <span className="mr-1.5 text-primary">Q{i + 1}.</span>
              {q.question}
            </p>
            {q.hint ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                {q.hint}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
