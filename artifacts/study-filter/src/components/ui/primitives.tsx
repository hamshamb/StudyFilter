import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small shared pieces every page needs, defined once.
 *
 * Before this file the app had four unrelated ways to say "loading" — a
 * spinner at three sizes, shadcn Skeletons, three bouncing dots and a
 * hand-rolled spinning border — and eight sizes of the little icon tile that
 * sits next to a heading. Nothing was wrong with any one of them, which is
 * exactly why they multiplied. The result read as several sites stitched
 * together.
 */

type Icon = React.ComponentType<{ className?: string }>;

// ── Loading ────────────────────────────────────────────────────────────────

const SPINNER_SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export interface SpinnerProps {
  size?: keyof typeof SPINNER_SIZES;
  className?: string;
  /** Announced to screen readers; omit inside an element already labelled. */
  label?: string;
}

/** Inline spinner — for buttons and anything mid-sentence. */
export function Spinner({ size = "sm", className, label }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", SPINNER_SIZES[size], className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export interface LoadingBlockProps {
  /** Keep it specific: "Loading your plan", not "Loading". */
  label?: string;
  className?: string;
  /** Fills the content area rather than sitting inline. */
  full?: boolean;
}

/**
 * The standard "this region is loading" state, for regions whose shape isn't
 * known ahead of time. Where the shape *is* known, use a Skeleton instead —
 * a spinner tells the student nothing about what is arriving.
 */
export function LoadingBlock({ label = "Loading…", className, full }: LoadingBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        full ? "min-h-[32vh]" : "py-10",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Skeletons ──────────────────────────────────────────────────────────────

/**
 * A shimmering placeholder shaped like the thing that is coming. Compose
 * these into the layout of the real content rather than showing one big box.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("sf-skeleton", className)} aria-hidden="true" />;
}

export interface SkeletonTextProps {
  /** Number of lines. The last one is drawn short, like real text. */
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** A card-shaped placeholder: title line, two body lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-card-border bg-card p-4", className)}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <SkeletonText lines={2} className="mt-4" />
    </div>
  );
}

/**
 * The state shown while an answer is being written.
 *
 * The three dots are honest: they are a "still working" indicator, not a
 * fake list of pipeline stages the product isn't actually reporting.
 */
export function ThinkingState({
  label = "Working on your answer",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3.5",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="sf-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="sf-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="sf-thinking-dot h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Icon badge ─────────────────────────────────────────────────────────────

const BADGE_SIZES = {
  sm: { box: "h-7 w-7 rounded-md", icon: "h-3.5 w-3.5" },
  md: { box: "h-9 w-9 rounded-lg", icon: "h-4.5 w-4.5" },
  lg: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5" },
  xl: { box: "h-14 w-14 rounded-xl", icon: "h-6 w-6" },
} as const;

const BADGE_TONES = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive/10 text-destructive",
} as const;

export interface IconBadgeProps {
  icon: Icon;
  size?: keyof typeof BADGE_SIZES;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}

/** The tinted tile an icon sits in. Four sizes, five tones, nothing else. */
export function IconBadge({ icon: Icon, size = "md", tone = "primary", className }: IconBadgeProps) {
  const s = BADGE_SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", s.box, BADGE_TONES[tone], className)}
    >
      <Icon className={s.icon} />
    </span>
  );
}

// ── Progress ───────────────────────────────────────────────────────────────

const PROGRESS_TONES = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
} as const;

export interface ProgressBarProps {
  /** 0–100. Clamped, so a caller can't overflow the track. */
  value: number;
  tone?: keyof typeof PROGRESS_TONES;
  /** Track height. `sm` is the inline one used in list rows. */
  size?: "sm" | "md";
  /** Required unless the bar sits directly under its own visible label. */
  label?: string;
  className?: string;
}

/**
 * One progress bar for the whole product. There were four — a Radix Progress
 * at three heights, plus two hand-rolled divs — with different radii and
 * different ideas about whether zero should render a sliver.
 */
export function ProgressBar({
  value,
  tone = "primary",
  size = "md",
  label,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1" : "h-1.5",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", PROGRESS_TONES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Stat ───────────────────────────────────────────────────────────────────

export interface StatProps {
  label: string;
  value: React.ReactNode;
  /** Small print under the value — "12 today", "from quizzes". */
  hint?: React.ReactNode;
  icon?: Icon;
  className?: string;
}

/**
 * One number with its label. Kept deliberately quiet: a border, a small
 * label, a large number. Dashboard, Home and Focus each had their own
 * near-identical version of this with different type scales.
 */
export function Stat({ label, value, hint, icon: Icon, className }: StatProps) {
  return (
    <div className={cn("rounded-xl border border-card-border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-meta text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  /** Trailing count, dimmed — "Everything 40". */
  count?: number;
  className?: string;
  type?: "button" | "submit";
}

/**
 * The selectable pill used for filters and category pickers. Map Practice,
 * Library and Plan each had their own, with different padding and radii.
 */
export function Chip({ active, onClick, children, count, className, type = "button" }: ChipProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
        active
          ? "border-primary/35 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
      {typeof count === "number" && <span className="opacity-60 tabular-nums">{count}</span>}
    </button>
  );
}

// ── Section heading ────────────────────────────────────────────────────────

export interface SectionHeadingProps {
  children: React.ReactNode;
  icon?: Icon;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** An h2 inside a page. Consistent weight and spacing wherever it appears. */
export function SectionHeading({
  children,
  icon: Icon,
  description,
  actions,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-section flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          {children}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
