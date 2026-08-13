import React from "react";
import { RotateCw, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/layout/PageShell";

/**
 * The three states every chapter unit can be in.
 *
 * The loading state shapes itself like an answer — a title line, a couple of
 * body lines, then blocks — rather than showing a spinner over an empty
 * region. Generation genuinely takes seconds the first time a chapter is
 * opened, so what fills that time should tell the student what is coming.
 */
export function UnitLoading({
  message = "Preparing your study material",
  lines = 3,
}: {
  message?: string;
  lines?: number;
}) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="sf-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="sf-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="sf-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        {message}…
      </div>

      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="space-y-2.5 p-4 sm:p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-2 border-t border-border p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Failure state with a retry action. */
export function UnitError({
  message = "We couldn't load this just now.",
  onRetry,
  retrying,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-9 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
      </span>
      <div>
        <p className="text-section">Something went wrong</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
      <Button onClick={onRetry} disabled={retrying} className="mt-1">
        <RotateCw className={retrying ? "animate-spin" : undefined} aria-hidden="true" />
        {retrying ? "Retrying" : "Try again"}
      </Button>
    </div>
  );
}

/**
 * Empty state. Delegates to the shared EmptyState so a unit with nothing in it
 * looks exactly like an empty Library shelf or an empty Saved list.
 */
export function UnitEmpty({
  title = "Nothing here yet",
  message,
  icon: Icon = Inbox,
  action,
}: {
  title?: string;
  message?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return <EmptyState icon={Icon} title={title} description={message} action={action} />;
}
