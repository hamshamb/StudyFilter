import { useState } from "react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import type { PlannerTask } from "@workspace/api-client-react";
import { subjectAccentByName } from "@/lib/curriculum";
import {
  Check,
  Clock,
  Lock,
  MoreHorizontal,
  Play,
  RotateCcw,
  CalendarDays,
  SkipForward,
  Trash2,
  Undo2,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  learn_topic: "Learn",
  read_ncert: "Read NCERT",
  chapter_summary: "Summary",
  revision_notes: "Revision notes",
  ncert_questions: "NCERT Qs",
  important_questions: "Important Qs",
  practice_questions: "Practice",
  pyq_practice: "PYQ practice",
  sample_paper: "Sample paper",
  mock_exam: "Mock exam",
  review_mistakes: "Review mistakes",
  rapid_revision: "Rapid revision",
  revision: "Revision",
  custom: "Custom",
};

/**
 * Subject tone from the shared identity tokens. This was its own map of
 * emerald/sky/amber/violet/rose at 12–15% opacity — a different set of hues
 * and a different set of opacities from the mock exam picker's map, so the
 * same subject was two different colours on two screens.
 */
function subjectTone(subject: string | null | undefined): string | undefined {
  if (!subject) return undefined;
  const accent = subjectAccentByName(subject);
  return `${accent.soft} ${accent.text}`;
}

export interface TaskCardProps {
  task: PlannerTask;
  onStatus: (task: PlannerTask, status: string) => void;
  onMove: (task: PlannerTask, date: string) => void;
  onDelete?: (task: PlannerTask) => void;
  compact?: boolean;
}

function shiftDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextSaturday(base: string): string {
  const d = new Date(base + "T00:00:00");
  const delta = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function TaskCard({ task, onStatus, onMove, onDelete, compact }: TaskCardProps) {
  const [, setLocation] = useLocation();
  const timer = useFocusTimer();
  const [pickDate, setPickDate] = useState(false);

  const done = task.status === "completed";
  const missed = task.status === "missed";
  const skipped = task.status === "skipped";
  const tone = subjectTone(task.subject);

  function startFocus() {
    timer.start("focus", {
      planId: task.planId,
      taskId: task.id,
      subject: task.subject,
      chapter: task.chapter,
      label: task.title,
    });
    setLocation("/focus");
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors",
        done && "opacity-60",
        missed && "border-destructive/40",
      )}
    >
      <button
        type="button"
        aria-label={done ? "Mark as not done" : "Mark complete"}
        onClick={() => onStatus(task, done ? "pending" : "completed")}
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors",
          done
            ? "bg-success border-success text-success-foreground"
            : "border-border hover:border-primary",
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.startTime && (
            <span className="text-xs font-mono text-muted-foreground">{task.startTime}</span>
          )}
          {task.subject && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>
              {task.subject}
            </span>
          )}
          <Badge variant="outline" className="text-[11px] font-normal">
            {TYPE_LABEL[task.taskType] ?? task.taskType}
          </Badge>
          {task.priority === "high" && (
            <Badge variant="outline" className="border-warning/40 text-[11px] text-warning">
              High priority
            </Badge>
          )}
          {task.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
          {missed && (
            <span className="text-[11px] font-medium text-destructive">Missed</span>
          )}
          {skipped && (
            <span className="text-[11px] text-muted-foreground">Skipped</span>
          )}
        </div>
        <p className={cn("mt-1 text-sm font-medium leading-snug", done && "line-through")}>
          {task.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {task.estimatedMinutes} min
          {task.chapter && !compact && <span className="truncate">· {task.chapter}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!done && !skipped && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Start a focus session"
            onClick={startFocus}
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {missed && (
              <>
                <DropdownMenuItem onClick={() => onMove(task, new Date().toISOString().slice(0, 10))}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Do today
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(task, shiftDate(task.scheduledDate, 1))}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Move to tomorrow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(task, nextSaturday(task.scheduledDate))}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Move to weekend
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {!missed && !done && (
              <>
                <DropdownMenuItem onClick={() => onMove(task, shiftDate(task.scheduledDate, 1))}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Move to next day
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(task, nextSaturday(task.scheduledDate))}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Move to weekend
                </DropdownMenuItem>
              </>
            )}
            {pickDate ? (
              <div className="px-2 py-1.5">
                <input
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  onChange={(e) => {
                    if (e.target.value) {
                      onMove(task, e.target.value);
                      setPickDate(false);
                    }
                  }}
                />
              </div>
            ) : (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setPickDate(true);
                }}
              >
                <CalendarDays className="h-4 w-4 mr-2" /> Choose another date…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {!skipped ? (
              <DropdownMenuItem onClick={() => onStatus(task, "skipped")}>
                <SkipForward className="h-4 w-4 mr-2" /> Skip
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onStatus(task, "pending")}>
                <Undo2 className="h-4 w-4 mr-2" /> Restore
              </DropdownMenuItem>
            )}
            {!done && (
              <DropdownMenuItem onClick={() => onStatus(task, "completed")}>
                <Check className="h-4 w-4 mr-2" /> Mark complete
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(task)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete task
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
