import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListStudyPlans,
  useListPlannerTasks,
  useUpdatePlannerTask,
  useDeletePlannerTask,
  useUpdateStudyPlan,
  useDeleteStudyPlan,
  useReschedulePlan,
  getListPlannerTasksQueryKey,
  getListStudyPlansQueryKey,
  type PlannerTask,
  type StudyPlanRecord,
} from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { SeoHead } from "@/components/SeoHead";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlanWizard } from "@/components/planner/PlanWizard";
import { TaskCard } from "@/components/planner/TaskCard";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageShell, PageHeader, EmptyState } from "@/components/layout/PageShell";
import { LoadingBlock } from "@/components/ui/primitives";

type ViewMode = "today" | "week";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(dateIso: string): Date {
  const d = new Date(dateIso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

function fmtDay(dateIso: string): string {
  return new Date(dateIso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function Plan() {
  const sessionId = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("today");
  const [anchor, setAnchor] = useState(iso(new Date()));
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<StudyPlanRecord | null>(null);

  const plansQuery = useListStudyPlans(
    { sessionId },
    { query: { enabled: !!sessionId, queryKey: getListStudyPlansQueryKey({ sessionId }) } },
  );
  const plans = plansQuery.data?.plans ?? [];
  const activePlan =
    plans.find((p) => p.status === "active") ??
    plans.find((p) => p.status === "paused") ??
    plans[0];

  const weekStart = startOfWeek(anchor);
  const range =
    view === "today"
      ? { fromDate: anchor, toDate: anchor }
      : {
          fromDate: iso(weekStart),
          toDate: iso(new Date(weekStart.getTime() + 6 * 86400000)),
        };

  const tasksParams = {
    sessionId,
    planId: activePlan?.id,
    ...range,
  };
  const tasksQuery = useListPlannerTasks(tasksParams, {
    query: {
      enabled: !!sessionId && !!activePlan,
      queryKey: getListPlannerTasksQueryKey(tasksParams),
    },
  });
  const tasks = tasksQuery.data?.tasks ?? [];

  const missedParams = { sessionId, planId: activePlan?.id, status: "missed" };
  const missedQuery = useListPlannerTasks(missedParams, {
    query: {
      enabled: !!sessionId && !!activePlan,
      queryKey: getListPlannerTasksQueryKey(missedParams),
    },
  });
  const missedTasks = (missedQuery.data?.tasks ?? []).filter(
    (t) => !tasks.some((x) => x.id === t.id),
  );

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("planner") });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("plans") });
  }

  const updateTask = useUpdatePlannerTask({
    mutation: { onSuccess: invalidateAll },
  });
  const deleteTask = useDeletePlannerTask({
    mutation: { onSuccess: invalidateAll },
  });
  const updatePlan = useUpdateStudyPlan({
    mutation: { onSuccess: invalidateAll },
  });
  const deletePlan = useDeleteStudyPlan({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Plan deleted" });
      },
    },
  });
  const reschedule = useReschedulePlan({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        toast({
          title: "Plan redistributed",
          description: "Remaining tasks were rebalanced across your available days.",
        });
      },
      onError: () =>
        toast({ title: "Could not redistribute", variant: "destructive" }),
    },
  });

  function onStatus(task: PlannerTask, status: string) {
    updateTask.mutate({
      taskId: task.id,
      data: { sessionId, status: status as never },
    });
  }

  function onMove(task: PlannerTask, date: string) {
    updateTask.mutate({
      taskId: task.id,
      data: { sessionId, scheduledDate: date, status: "pending" },
    });
  }

  function onDelete(task: PlannerTask) {
    deleteTask.mutate({ taskId: task.id, data: { sessionId } });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, PlannerTask[]>();
    for (const t of tasks) {
      const list = map.get(t.scheduledDate) ?? [];
      list.push(t);
      map.set(t.scheduledDate, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
    }
    return map;
  }, [tasks]);

  const weekDays = useMemo(() => {
    if (view !== "week") return [];
    return Array.from({ length: 7 }, (_, i) =>
      iso(new Date(weekStart.getTime() + i * 86400000)),
    );
  }, [view, weekStart]);

  const doneCount = tasks.filter((t) => t.status === "completed").length;

  function shiftAnchor(dir: 1 | -1) {
    const d = new Date(anchor + "T00:00:00");
    d.setDate(d.getDate() + dir * (view === "today" ? 1 : 7));
    setAnchor(iso(d));
  }

  return (
    <>
      <SeoHead
        title="Study plan — StudyFilter"
        description="Build and follow a realistic CBSE study plan with daily tasks, revision cycles and buffer days."
        canonical="/plan"
      />
      <PageShell>
      <PageHeader
        icon={CalendarDays}
        title="Study Plan"
        description="A realistic schedule with spaced revision — built around your days."
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New plan
          </Button>
        }
      />

      {plansQuery.isLoading ? (
        <LoadingBlock label="Loading your study plan…" />
      ) : !activePlan ? (
        <EmptyState
          className="mt-6"
          icon={Sparkles}
          title="No study plan yet"
          description="Answer a few questions about your goal, subjects and available time, and get a complete day-by-day schedule with revision built in."
          action={
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Create your first plan
            </Button>
          }
        />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{activePlan.title}</span>
                <Badge
                  variant={activePlan.status === "active" ? "default" : "secondary"}
                  className="text-[11px] capitalize"
                >
                  {activePlan.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtDay(activePlan.startDate)} → {fmtDay(activePlan.targetDate)}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {activePlan.status === "active" ? (
                  <DropdownMenuItem
                    onClick={() =>
                      updatePlan.mutate({
                        planId: activePlan.id,
                        data: { sessionId, status: "paused" },
                      })
                    }
                  >
                    <Pause className="h-4 w-4 mr-2" /> Pause plan
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      updatePlan.mutate({
                        planId: activePlan.id,
                        data: { sessionId, status: "active" },
                      })
                    }
                  >
                    <Play className="h-4 w-4 mr-2" /> Resume plan
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    reschedule.mutate({
                      planId: activePlan.id,
                      data: { sessionId, fromDate: iso(new Date()) },
                    })
                  }
                >
                  <RefreshCcw className="h-4 w-4 mr-2" /> Redistribute remaining tasks
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDeletePlan(activePlan)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {missedTasks.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {missedTasks.length} missed task{missedTasks.length > 1 ? "s" : ""} to
                  catch up on
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    reschedule.mutate({
                      planId: activePlan.id,
                      data: { sessionId, fromDate: iso(new Date()) },
                    })
                  }
                >
                  <RefreshCcw className="h-3 w-3 mr-1" /> Redistribute plan
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {missedTasks.slice(0, 4).map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onStatus={onStatus}
                    onMove={onMove}
                    onDelete={onDelete}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftAnchor(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setAnchor(iso(new Date()))}
              >
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftAnchor(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {view === "today" && (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {fmtDay(anchor)}
                </h2>
                {tasks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{tasks.length} done
                  </span>
                )}
              </div>
              {tasksQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Loading tasks…
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nothing scheduled for this day. A rest day is a good day.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onStatus={onStatus}
                      onMove={onMove}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "week" && (
            <div className="mt-4 space-y-6">
              {weekDays.map((day) => {
                const list = grouped.get(day) ?? [];
                const isToday = day === iso(new Date());
                return (
                  <div key={day}>
                    <div className="mb-2 flex items-center gap-2">
                      <h3
                        className={cn(
                          "text-sm font-semibold",
                          isToday ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {fmtDay(day)}
                      </h3>
                      {isToday && (
                        <Badge variant="secondary" className="text-[10px]">
                          Today
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {list.length === 0
                          ? "Rest"
                          : `${list.reduce((s, t) => s + t.estimatedMinutes, 0)} min`}
                      </span>
                    </div>
                    {list.length > 0 && (
                      <div className="space-y-2">
                        {list.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            onStatus={onStatus}
                            onMove={onMove}
                            onDelete={onDelete}
                            compact
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <PlanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={invalidateAll}
      />

      <AlertDialog
        open={!!confirmDeletePlan}
        onOpenChange={(o) => !o && setConfirmDeletePlan(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDeletePlan?.title}" and all its tasks will be removed. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeletePlan) {
                  deletePlan.mutate({
                    planId: confirmDeletePlan.id,
                    data: { sessionId },
                  });
                }
                setConfirmDeletePlan(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </PageShell>
    </>
  );
}
