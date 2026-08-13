import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  useListStudyPlans,
  useListPlannerTasks,
  getListStudyPlansQueryKey,
  getListPlannerTasksQueryKey,
  type PlannerTask,
} from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/primitives";
import { ArrowRight, CalendarDays, Check, Clock, Play } from "lucide-react";

/**
 * Today's study plan, as one line.
 *
 * This used to be a two-column panel with its own task list, a badge counting
 * days to the target, a four-number "this week" grid and a 2×2 quick-action
 * pad — a second dashboard sitting above the dashboard, duplicating the
 * navigation that is already in the sidebar.
 *
 * What a student needs from their plan on the home page is one thing: what is
 * next, and a way to start it. The plan itself lives at /plan, which is where
 * the full list belongs.
 *
 * Nothing was dropped — the task list, the day counter and the weekly stats
 * are all still on the Plan and Focus pages, which own them.
 */

/**
 * Today, as the planner stores it: a local calendar date, matching the
 * `fromDate`/`toDate` strings the tasks endpoint expects.
 */
function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function TodayPanel() {
  const sessionId = useSession();
  const timer = useFocusTimer();
  const [, setLocation] = useLocation();

  const plansParams = { sessionId };
  const plansQuery = useListStudyPlans(plansParams, {
    query: { enabled: !!sessionId, queryKey: getListStudyPlansQueryKey(plansParams) },
  });
  const activePlan = (plansQuery.data?.plans ?? []).find((p) => p.status === "active");

  const tasksParams = {
    sessionId,
    planId: activePlan?.id,
    fromDate: todayIso(),
    toDate: todayIso(),
  };
  const tasksQuery = useListPlannerTasks(tasksParams, {
    query: {
      enabled: !!sessionId && !!activePlan,
      queryKey: getListPlannerTasksQueryKey(tasksParams),
    },
  });

  const tasks = useMemo(() => {
    const list = [...(tasksQuery.data?.tasks ?? [])];
    list.sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
    return list;
  }, [tasksQuery.data]);

  const nextTask = tasks.find((t) => t.status === "pending" || t.status === "in_progress");
  const doneCount = tasks.filter((t) => t.status === "completed").length;

  function startFocusFor(task: PlannerTask) {
    timer.start("focus", {
      planId: task.planId,
      taskId: task.id,
      subject: task.subject,
      chapter: task.chapter,
      label: task.title,
    });
    setLocation("/focus");
  }

  // No plan: one quiet invitation, not a card competing with the subjects grid.
  if (!activePlan) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-card-title">No study plan yet</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Build a day-by-day schedule with spaced revision and mock exams.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/plan">
            <CalendarDays className="h-4 w-4" />
            Create a plan
          </Link>
        </Button>
      </div>
    );
  }

  const pct = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;

  return (
    <div className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-card-title">Today&apos;s plan</h2>
        {tasks.length > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {doneCount}/{tasks.length} done
          </span>
        )}
      </div>

      {tasks.length > 0 && (
        <ProgressBar
          value={pct}
          tone={doneCount === tasks.length ? "success" : "primary"}
          size="sm"
          className="mt-2.5"
          label={`Today's plan: ${doneCount} of ${tasks.length} tasks done`}
        />
      )}

      {nextTask ? (
        <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-eyebrow text-muted-foreground">Up next</p>
            <p className="mt-1 truncate text-sm font-medium">{nextTask.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {nextTask.subject && <span>{nextTask.subject}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {nextTask.estimatedMinutes} min
              </span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => startFocusFor(nextTask)}>
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/plan">
                Plan
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : tasks.length > 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
          Everything scheduled for today is done.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing scheduled today — a rest day is part of the plan too.
        </p>
      )}
    </div>
  );
}
