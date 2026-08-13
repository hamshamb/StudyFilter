import React from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  ArrowRight,
  Bookmark,
  Flame,
  Target,
  Zap,
} from "lucide-react";
import { SUBJECTS } from "@workspace/cbse-content";
import { useGetProgress } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useAnalytics, todayXp } from "@/hooks/use-analytics";
import { useChapterProgress } from "@/hooks/use-chapter-progress";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAccountSettings } from "@/hooks/use-account-settings";
import { resolveChapter } from "@/lib/curriculum";
import { StudyCommandBar } from "@/components/study/StudyCommandBar";
import { SubjectCard } from "@/components/study/SubjectCard";
import { ContinueCard } from "@/components/study/ContinueCard";
import { TodayPanel } from "@/components/home/TodayPanel";
import { PageShell } from "@/components/layout/PageShell";
import { SectionHeading, ProgressBar, SkeletonCard } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The student's desk.
 *
 * The old home page opened with a marketing headline, a mesh-gradient hero
 * and a four-card stat grid — it told a returning student how many XP they
 * had before it told them anything they could act on, and it never mentioned
 * the chapter they were reading yesterday.
 *
 * This is ordered by what a student does next: ask, resume, then browse.
 * Numbers appear once, in a single strip, and only the three that change
 * behaviour — today's goal, the streak that is at risk, the XP just earned.
 */

/** Local clock, deliberately: a greeting is about the student's time of day. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function StudentHome() {
  const sessionId = useSession();
  const { user } = useUser();
  const { data: account } = useAccountSettings();
  const { recent, startedIn } = useChapterProgress();
  const { bookmarks } = useBookmarks();

  const { data: progress, isLoading: progressLoading } = useGetProgress(
    { sessionId: sessionId ?? "" },
    { query: { enabled: !!sessionId, queryKey: ["/api/progress", { sessionId }] } },
  );
  const { data: analytics } = useAnalytics();

  const name = user?.firstName ?? account?.username ?? null;
  const continueItems = recent(3);

  const questionsToday = progress?.questionsToday ?? 0;
  const dailyGoal = progress?.dailyGoal ?? 5;
  const goalPct = dailyGoal > 0 ? Math.min(100, (questionsToday / dailyGoal) * 100) : 0;
  const goalMet = questionsToday >= dailyGoal;
  const xpToday = todayXp(analytics);

  // The weakest chapter the server actually has evidence for. No evidence, no
  // challenge — a made-up "daily challenge" would be noise.
  const weakest = analytics?.weakChapters?.[0] ?? null;
  const weakestTarget = weakest ? resolveChapter(weakest.subject, weakest.chapter) : null;

  return (
    <PageShell className="space-y-8">
      {/* ── Ask ─────────────────────────────────────────────────────────── */}
      <section className="animate-rise">
        <h1 className="text-page-title">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">What are you studying today?</p>
        <StudyCommandBar className="mt-4" autoFocus={false} />
      </section>

      {/* ── Resume ──────────────────────────────────────────────────────── */}
      {continueItems.length > 0 && (
        <section>
          <SectionHeading
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/subjects">
                  All subjects
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            Pick up where you left off
          </SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {continueItems.map((record) => (
              <ContinueCard key={`${record.subjectId}/${record.chapterId}`} record={record} />
            ))}
          </div>
        </section>
      )}

      {/* ── Today ───────────────────────────────────────────────────────────
          One strip, three numbers. Not a dashboard. */}
      <section>
        {progressLoading || !progress ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="min-w-[12rem] flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-card-title">Today&apos;s goal</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {questionsToday}/{dailyGoal}
                  </span>
                </div>
                <ProgressBar
                  value={goalPct}
                  tone={goalMet ? "success" : "primary"}
                  className="mt-2.5"
                  label={`Daily goal: ${questionsToday} of ${dailyGoal} questions`}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {goalMet
                    ? "Goal met. Anything more is a bonus."
                    : `${dailyGoal - questionsToday} more question${
                        dailyGoal - questionsToday === 1 ? "" : "s"
                      } to go.`}
                </p>
              </div>

              <dl className="flex items-center gap-6">
                <div>
                  <dt className="text-meta flex items-center gap-1.5 text-muted-foreground">
                    <Flame className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                    Streak
                  </dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums">
                    {progress.streak}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      day{progress.streak === 1 ? "" : "s"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-meta flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                    XP today
                  </dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums">
                    {xpToday === null ? "—" : xpToday.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </section>

      {/* ── The study plan, if there is one ─────────────────────────────── */}
      <section>
        <TodayPanel />
      </section>

      {/* ── Worth another look ──────────────────────────────────────────────
          Real weakness from the quiz record, not a randomly generated
          "challenge". Hidden entirely when there is nothing to say. */}
      {weakest && weakest.total > 0 && (
        <section>
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="text-eyebrow text-warning">Worth another look</p>
              <p className="text-card-title mt-1">{weakest.chapter}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                You got {weakest.correct} of {weakest.total} right in {weakest.subject}.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href={weakestTarget ? `${weakestTarget.href}?unit=quiz` : "/practice"}>
                <Target className="h-4 w-4" />
                Practise this
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── Subjects ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading description="Open a chapter to read, practise or test yourself.">
          Subjects
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              startedCount={startedIn(subject.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Saved ───────────────────────────────────────────────────────────
          Compact by design: this is a pointer to the Saved page, not a second
          copy of it. */}
      {bookmarks.length > 0 && (
        <section>
          <SectionHeading
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/saved">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            Saved answers
          </SectionHeading>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-card-border bg-card">
            {bookmarks.slice(0, 3).map((b) => (
              <li key={b.id}>
                <Link
                  href="/saved"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                >
                  <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm">{b.question}</span>
                  {b.answer?.detectedSubject && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {b.answer.detectedSubject}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
