import React from "react";
import { Link } from "wouter";
import { useGetProgress, useGetRecentActivity } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { Flame, Target, CheckCircle2, TrendingUp, Clock, Zap } from "lucide-react";
import { Stat, LoadingBlock, ProgressBar } from "@/components/ui/primitives";
import { useAnalytics, todayXp } from "@/hooks/use-analytics";
import { PerformanceAnalysis } from "@/components/dashboard/PerformanceAnalysis";
import { PageShell, PageHeader, Panel, EmptyState } from "@/components/layout/PageShell";
import { cn } from "@/lib/utils";
import { SeoHead } from "@/components/SeoHead";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SOURCE_LABELS: Record<string, string> = {
  local_data: "Local notes",
  web_search: "Trusted web sources",
  ai_trusted_sources: "AI answer",
  ai_general: "AI answer",
  no_api_key: "Local notes",
};

/**
 * Progress.
 *
 * Ordered to answer the three questions a student actually has: how am I
 * doing, what should I revise, and what have I been asking. The revision list
 * inside PerformanceAnalysis is the point of the page, so nothing decorative
 * goes above it.
 */
export default function Dashboard() {
  const sessionId = useSession();

  const { data: progress, isLoading: progressLoading } = useGetProgress(
    { sessionId: sessionId ?? "" },
    { query: { enabled: !!sessionId, queryKey: ["/api/progress", { sessionId }] } },
  );

  // Same query key PerformanceAnalysis uses, so the two share one request.
  const { data: analytics } = useAnalytics();

  const { data: activity, isLoading: activityLoading } = useGetRecentActivity(
    { sessionId: sessionId ?? "", limit: 10 },
    { query: { enabled: !!sessionId, queryKey: ["/api/progress/activity", { sessionId }] } },
  );

  if (progressLoading || !progress) {
    return (
      <PageShell>
        <LoadingBlock full label="Loading your progress…" />
      </PageShell>
    );
  }

  const questionsToday = progress.questionsToday ?? 0;
  const goalPercentage = Math.min(
    100,
    Math.round((questionsToday / Math.max(1, progress.dailyGoal)) * 100),
  );
  const goalMet = questionsToday >= progress.dailyGoal;
  const accuracyDisplay = Math.round(progress.accuracy);
  const xpToday = todayXp(analytics);

  return (
    <>
      <SeoHead
        title="Your progress — StudyFilter"
        description="Review your StudyFilter activity, accuracy, daily goal, XP and recommended revision topics."
        canonical="/dashboard"
      />
      <PageShell className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Your progress"
        description="Where you stand, and what to look at next."
        className="mb-0"
      />

      {/* ── Headline numbers ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Streak"
          value={
            <>
              {progress.streak}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                day{progress.streak === 1 ? "" : "s"}
              </span>
            </>
          }
          icon={Flame}
        />
        <Stat
          label="Solved"
          value={progress.questionsSolved}
          hint={`${questionsToday} today`}
          icon={Target}
        />
        <Stat
          label="Quiz accuracy"
          value={`${accuracyDisplay}%`}
          hint="from quizzes"
          icon={CheckCircle2}
        />
        {/*
          Read from the xp_events ledger via /api/analytics, not derived on the
          client. The original computed questionsToday * 10 — a hardcoded rate
          that stopped being true the moment XP moved to the server, where it
          is priced per activity with accuracy and streak bonuses and a daily
          cap. `null` while analytics is in flight, so a genuine zero is never
          shown as a placeholder or vice versa.
        */}
        <Stat
          label="XP today"
          value={xpToday === null ? "—" : xpToday.toLocaleString()}
          hint={`${progress.xp.toLocaleString()} all time`}
          icon={Zap}
        />
      </div>

      {/* ── Daily goal ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-card-title">Daily goal</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {questionsToday}/{progress.dailyGoal}
          </span>
        </div>
        <ProgressBar
          value={goalPercentage}
          tone={goalMet ? "success" : "primary"}
          className="mt-2.5"
          label={`Daily goal: ${questionsToday} of ${progress.dailyGoal} questions`}
        />
        <p className={cn("mt-2 text-sm", goalMet ? "text-success" : "text-muted-foreground")}>
          {goalMet
            ? "Goal met — that keeps your streak alive."
            : `${progress.dailyGoal - questionsToday} more question${
                progress.dailyGoal - questionsToday === 1 ? "" : "s"
              } to hit today's goal.`}
        </p>
      </div>

      {/* ── Quiz / mock / doubt analysis ────────────────────────────────── */}
      <PerformanceAnalysis />

      {/* ── Recent questions ────────────────────────────────────────────── */}
      <Panel
        title="Recent questions"
        description={
          activity && activity.length > 0
            ? `Your last ${Math.min(10, activity.length)} questions`
            : undefined
        }
        flush={!!activity && activity.length > 0}
      >
        {activityLoading ? (
          <div className="p-4 sm:p-5">
            <LoadingBlock label="Loading recent questions…" />
          </div>
        ) : !activity || activity.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No questions yet"
            description="Ask your first doubt and it will show up here, so you can find it again the night before an exam."
            action={
              <Link href="/chat" className="text-sm font-semibold text-primary hover:underline">
                Ask a question →
              </Link>
            }
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id} className="px-4 py-3 sm:px-5">
                <p className="line-clamp-2 text-sm leading-snug">{item.question}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(item.createdAt)}
                  </span>
                  {item.answerSource && (
                    <Badge variant="outline">
                      {SOURCE_LABELS[item.answerSource] ?? item.answerSource}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </PageShell>
    </>
  );
}
