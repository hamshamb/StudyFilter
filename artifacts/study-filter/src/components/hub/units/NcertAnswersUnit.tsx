import React from "react";
import { BookOpenCheck } from "lucide-react";
import { UnitLoading, UnitError, UnitEmpty } from "../UnitState";
import { ContentStatus, contextToScope, useIsFresh } from "./ContentStatus";
import type { StudyContext } from "../types";
import { useChapterContent, useRefreshChapterContent } from "@/lib/study-content";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function NcertAnswersUnit({ context }: { context: StudyContext }) {
  const scope = React.useMemo(() => contextToScope(context), [context]);
  const query = useChapterContent("ncert", scope);
  const refresh = useRefreshChapterContent("ncert", scope);
  const fresh = useIsFresh(query.dataUpdatedAt);

  if (query.isPending) return <UnitLoading message="Fetching NCERT model answers" />;
  if (query.isError || !query.data)
    return (
      <UnitError
        message={errorMessage(query.error, "We couldn't load the NCERT answers.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );

  const data = query.data;

  if (!data.answers?.length)
    return (
      <UnitEmpty
        icon={BookOpenCheck}
        title="No NCERT answers found"
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
        label="model answers"
        fresh={fresh}
        onRefresh={() => refresh.mutate()}
        refreshing={refresh.isPending}
      />
      <p className="text-sm text-muted-foreground">
        {data.answers.length} textbook questions, answered the way they should be written.
      </p>
      {data.retrievalFailed ? (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          Live textbook sources were unavailable — answers shown from curriculum knowledge.
        </p>
      ) : null}
      <ol className="space-y-4">
        {data.answers.map((qa, i) => (
          <li key={i} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="font-semibold leading-snug">
                <span className="mr-1.5 text-primary">Q{i + 1}.</span>
                {qa.question}
              </p>
              {qa.marks ? (
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {qa.marks}
                </span>
              ) : null}
            </div>
            {qa.answer ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {qa.answer}
              </p>
            ) : null}
            {qa.points?.length ? (
              <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground/90">
                {qa.points.map((point, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="font-semibold text-primary">{j + 1}.</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
