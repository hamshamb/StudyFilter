import React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared page furniture.
 *
 * Before this existed every page invented its own wrapper. Across ten screens
 * there were four content widths, three vertical rhythms and three unrelated
 * heading treatments — so the content column visibly jumped width and slid up
 * and down as you moved between Dashboard, Library and Settings, which reads
 * as the site being slightly broken rather than as a design.
 *
 * These four components are now the only way a page frames itself.
 */

type Icon = React.ComponentType<{ className?: string }>;

/**
 * Content widths. A fixed four-step scale — the point is to remove the
 * choice, not relocate it. Each step has a stated job, so picking one is a
 * decision about the content rather than a guess at a number.
 *
 *  narrow  — single-column forms and lists (Settings, Leaderboard)
 *  prose   — long-form reading, held near 70 characters
 *  content — study pages: a heading, a hero and one column of units
 *  default — grids, dashboards and shelves
 */
const WIDTHS = {
  narrow: "max-w-2xl",
  prose: "max-w-3xl",
  content: "max-w-4xl",
  default: "max-w-5xl",
} as const;

export interface PageShellProps {
  children: React.ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
  /**
   * Defaults to a plain <div>. The router shell in App.tsx already wraps every
   * route in the page's one <main> landmark, so pages that opened a <main> of
   * their own were nesting a second one inside it. Pass "main" only for a page
   * rendered outside that shell.
   */
  as?: "main" | "div";
}

export function PageShell({
  children,
  width = "default",
  className,
  as = "div",
}: PageShellProps) {
  const Tag = as;
  return (
    <Tag
      /*
       * Vertical rhythm comes from --sf-page-y rather than a `py-` utility so
       * the Compact density preference in Settings can tighten every page at
       * once. The variable already carries its own responsive step, which is
       * why there is no `sm:` counterpart here.
       */
      style={{ paddingBlock: "var(--sf-page-y)" }}
      className={cn("mx-auto w-full px-4 sm:px-6", WIDTHS[width], className)}
    >
      {children}
    </Tag>
  );
}

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  icon?: Icon;
  /** Buttons or controls, right-aligned on desktop and stacked on mobile. */
  actions?: React.ReactNode;
  /** Small line above the title — a breadcrumb, subject name or count. */
  eyebrow?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>
          )}
          {/*
            The one <h1> on the page. The workspace header used to render an
            <h1> of its own for the page title, so every screen shipped two —
            screen readers announced the chrome as the document heading. That
            one is a <p> now; this is the real heading.
          */}
          <h1 className={cn("text-page-title", eyebrow && "mt-1")}>{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export interface PanelProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: Icon;
  actions?: React.ReactNode;
  className?: string;
  /** Drops the inner padding, for panels holding a full-bleed table or map. */
  flush?: boolean;
}

/**
 * A titled card. One border, one radius, one padding — a card is a container
 * for related things, not a decoration, so it has no shadow by default.
 */
export function Panel({
  children,
  title,
  description,
  icon: Icon,
  actions,
  className,
  flush = false,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);
  const pad = { padding: "var(--sf-card-p)" };
  return (
    <section
      // Padding via --sf-card-p so Compact density reaches cards too.
      style={flush ? undefined : pad}
      className={cn(
        "rounded-xl border border-card-border bg-card",
        flush && "overflow-hidden",
        className,
      )}
    >
      {hasHeader && (
        <div
          style={flush ? pad : undefined}
          className={cn(
            "flex flex-wrap items-start justify-between gap-3",
            flush && "border-b border-card-border",
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-card-title flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(hasHeader && !flush && "mt-4", flush && !hasHeader && "p-0")}>
        {children}
      </div>
    </section>
  );
}

export interface EmptyStateProps {
  icon?: Icon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /**
   * Heading level. An empty state is normally a section inside a page that
   * already has its own <h1>, so h2 is the default — but when the empty state
   * *is* the page (404), it needs to be the h1.
   */
  titleAs?: "h1" | "h2";
}

/**
 * Empty states were hand-rolled on five pages with five different paddings,
 * icon sizes and border styles. One shape now — and every one of them should
 * name the next action, because "no data available" leaves a student stuck.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  titleAs: Heading = "h2",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <Heading className="text-section">{title}</Heading>
        {description && (
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
