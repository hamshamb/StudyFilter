import React from "react";
import { Link } from "wouter";
import { ArrowRight, Target } from "lucide-react";
import { Panel, EmptyState } from "@/components/layout/PageShell";
import { LoadingBlock, ProgressBar } from "@/components/ui/primitives";
import { useAnalytics } from "@/hooks/use-analytics";
import { resolveChapter } from "@/lib/curriculum";
import { cn } from "@/lib/utils";

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

/**
 * Tone by how much attention something needs. These were `bg-emerald-500`,
 * `bg-amber-500` and `bg-red-500` — fixed swatches that ignored the theme and
 * sat next to nothing else in the product using those exact hues.
 */
function accuracyTone(v: number | null): "success" | "warning" | "primary" {
  if (v === null) return "primary";
  if (v >= 0.75) return "success";
  if (v >= 0.5) return "warning";
  return "primary";
}

/**
 * What a student should do next, in the order they should care about it.
 *
 * "Revise these next" is first now. It used to be fourth — below a stat grid,
 * a 30-day bar chart and a subject breakdown — which meant the one section
 * that answers "so what do I study?" was the one you had to scroll to find.
 * The chapters in it are links now too: seeing that Electricity is at 40% and
 * then having to go find it in the subject list was a dead end.
 */
export function PerformanceAnalysis() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <Panel title="Performance">
        <LoadingBlock label="Working out where you stand…" />
      </Panel>
    );
  }

  if (!data) return null;

  const { totals, subjects, weakChapters, days, recentMocks } = data;
  const hasData =
    totals.quizAttempts > 0 || totals.mockAttempts > 0 || totals.doubtsAsked > 0;

  if (!hasData) {
    return (
      <EmptyState
        icon={Target}
        title="Nothing to analyse yet"
        description="Finish a chapter quiz or a mock exam and your strengths and weak spots will show up here."
        action={
          <Link
            href="/subjects"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Pick a chapter →
          </Link>
        }
      />
    );
  }

  const maxXp = Math.max(1, ...days.map((d) => d.xp));

  return (
    <div className="space-y-5">
      {/* ── Last 30 days ────────────────────────────────────────────────────
          Four numbers on one line rather than four bordered stat cards. They
          are context for everything below, not headline metrics — the
          headline numbers live in the strip at the top of the page. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-card-border bg-card p-4 sm:grid-cols-4 sm:p-5">
        {[
          { label: "Quiz accuracy", value: pct(totals.quizAccuracy), sub: `${totals.quizQuestions} questions` },
          { label: "Mock exams", value: String(totals.mockAttempts), sub: "attempted" },
          { label: "XP earned", value: totals.xp30d.toLocaleString(), sub: "last 30 days" },
          { label: "Doubts asked", value: String(totals.doubtsAsked), sub: "last 30 days" },
        ].map(({ label, value, sub }) => (
          <div key={label}>
            <dt className="text-meta text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums">{value}</dd>
            <dd className="text-[11px] text-muted-foreground">{sub}</dd>
          </div>
        ))}
      </dl>

      {/* ── What to revise ──────────────────────────────────────────────── */}
      {weakChapters.length > 0 && (
        <Panel
          title="Revise these next"
          description="Chapters you keep getting wrong, based on at least 3 attempted questions."
          flush
        >
          <ul className="divide-y divide-border">
            {weakChapters.map((c) => {
              const target = resolveChapter(c.subject, c.chapter);
              const href = target ? `${target.href}?unit=quiz` : "/subjects";
              return (
                <li key={`${c.subject}-${c.chapter}`}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 sm:px-5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.chapter}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.subject} · {c.correct}/{c.total} correct
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                      {pct(c.accuracy)}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* ── By subject ──────────────────────────────────────────────────── */}
      {subjects.length > 0 && (
        <Panel
          title="By subject"
          description="Weakest first. Quiz and mock accuracy are shown separately where both exist — acing quizzes but stalling in timed mocks is a different problem."
        >
          <div className="space-y-3.5">
            {subjects.map((s) => (
              <div key={s.subject}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{s.subject}</span>
                  <span className="tabular-nums text-muted-foreground">{pct(s.accuracy)}</span>
                </div>
                <ProgressBar
                  value={(s.accuracy ?? 0) * 100}
                  tone={accuracyTone(s.accuracy)}
                  className="mt-1.5"
                  label={`${s.subject} accuracy`}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                  {s.quizAccuracy !== null && ` · quiz ${pct(s.quizAccuracy)}`}
                  {s.mockAccuracy !== null && ` · mock ${pct(s.mockAccuracy)}`}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Activity ────────────────────────────────────────────────────── */}
      <Panel title="Daily activity" description="XP earned over the last 30 days">
        <div
          className="flex h-20 items-end gap-[3px]"
          role="img"
          aria-label={`XP earned per day over the last 30 days, highest ${maxXp}`}
        >
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.xp} XP`}
              className="flex-1 rounded-t-sm bg-primary/60 transition-colors hover:bg-primary"
              style={{ height: `${Math.max(2, (d.xp / maxXp) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </Panel>

      {/* ── Mock exams ──────────────────────────────────────────────────── */}
      {recentMocks.length > 0 && (
        <Panel title="Recent mock exams" flush>
          <ul className="divide-y divide-border">
            {recentMocks.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.subject} {m.year}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {Math.round(m.timeTakenSeconds / 60)} min ·{" "}
                    {new Date(m.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {m.obtainedMarks !== null && m.totalMarks
                    ? `${m.obtainedMarks}/${m.totalMarks}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
