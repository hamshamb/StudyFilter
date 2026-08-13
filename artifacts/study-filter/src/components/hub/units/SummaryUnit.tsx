import React from "react";
import { AnswerRenderer } from "../AnswerRenderer";
import { DynamicWidgetGrid } from "../DynamicWidgetGrid";
import { UnitLoading, UnitError } from "../UnitState";
import { ContentStatus, contextToScope, useIsFresh } from "./ContentStatus";
import type { StudyContext } from "../types";
import type { UnitAction } from "./actions";
import { useChapterContent, useRefreshChapterContent } from "@/lib/study-content";
import { errorMessage } from "@/lib/api";

/**
 * The chapter summary.
 *
 * Previously this fired a POST from a `useEffect` on every mount, so opening
 * the summary, going back, and opening it again meant two full generations of
 * a piece of text the server already had stored permanently. It is a cached
 * query now, which is what makes opening it in the floating workspace and then
 * expanding it to the full page feel like one continuous thing rather than two
 * loads of the same summary.
 */
export function SummaryUnit({
  context,
  onAction,
}: {
  context: StudyContext;
  onAction: (action: UnitAction) => void;
}) {
  const scope = React.useMemo(() => contextToScope(context), [context]);
  const query = useChapterContent("summary", scope);
  const refresh = useRefreshChapterContent("summary", scope);
  const fresh = useIsFresh(query.dataUpdatedAt);

  if (query.isPending) return <UnitLoading message="Writing your chapter summary" />;
  if (query.isError || !query.data)
    return (
      <UnitError
        message={errorMessage(query.error, "We couldn't generate the summary.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );

  return (
    <div className="space-y-6">
      <ContentStatus
        label="summary"
        fresh={fresh}
        onRefresh={() => refresh.mutate()}
        refreshing={refresh.isPending}
      />
      <AnswerRenderer
        answer={query.data}
        question={`${context.chapterTitle} — chapter summary`}
        classLevel={context.classLevel}
      />
      <DynamicWidgetGrid
        answer={query.data}
        subjectId={context.subjectId}
        onAction={onAction}
      />
    </div>
  );
}
