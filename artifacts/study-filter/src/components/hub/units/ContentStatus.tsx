import React from "react";
import { BookmarkCheck, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import type { StudyContext } from "../types";
import type { ApiScope } from "@/lib/scope";

/**
 * The line above every piece of generated study material that says where it
 * came from and offers the only way to change it.
 *
 * This is the visible half of a rule from this pass: study material must not
 * quietly change between visits. A student who half-memorised a summary on
 * Tuesday and opens it again on Thursday should find the same words. So the
 * default is the stored copy, it says so, and regenerating is a button they
 * press — never something that happens because they navigated.
 */
export function ContentStatus({
  fresh,
  onRefresh,
  refreshing,
  onSimplify,
  simplifying,
  label = "material",
}: {
  /** True when this was generated during this session rather than restored. */
  fresh: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  /** Optional — only offered where a simpler rewrite makes sense. */
  onSimplify?: () => void;
  simplifying?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {fresh ? (
          <>
            <Sparkles className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            Newly written for you
          </>
        ) : (
          <>
            <BookmarkCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Your saved {label} — the same every time you open it
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        {onSimplify && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSimplify}
            disabled={simplifying || refreshing}
            className="h-7 gap-1.5 text-xs"
          >
            {simplifying ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            Simplify
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="h-7 gap-1.5 text-xs"
          data-testid="button-refresh-content"
        >
          {refreshing ? (
            <Spinner />
          ) : (
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {refreshing ? "Rewriting" : "Rewrite"}
        </Button>
      </div>
    </div>
  );
}

/** The chapter units speak StudyContext; the content layer speaks ApiScope. */
export function contextToScope(context: StudyContext): ApiScope {
  return {
    classLevel: context.classLevel,
    subject: context.subjectName,
    chapter: context.chapterTitle,
    ...(context.topic ? { topic: context.topic } : {}),
  };
}

/**
 * Whether what we are looking at arrived in this session.
 *
 * `dataUpdatedAt` moves only when a fetch resolves, so comparing it against
 * when the component mounted distinguishes "the server just wrote this" from
 * "React Query handed us the copy it already had".
 */
export function useIsFresh(dataUpdatedAt: number): boolean {
  const mountedAt = React.useRef(Date.now());
  return dataUpdatedAt > mountedAt.current;
}
