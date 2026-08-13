import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useFocusTimer,
  formatTimer,
  type TimerPhase,
} from "@/hooks/use-focus-timer";
import { useAmbientAudio, AMBIENT_SOUNDS } from "@/hooks/use-ambient-audio";
import { useSession } from "@/hooks/use-session";
import {
  useGetPomodoroStatistics,
  getGetPomodoroStatisticsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { SeoHead } from "@/components/SeoHead";
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
import { cn } from "@/lib/utils";
import {
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Flame,
  Clock,
  Target,
} from "lucide-react";

const PHASES: { id: TimerPhase; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "short_break", label: "Short break" },
  { id: "long_break", label: "Long break" },
];

const VISUAL_MODES = [
  {
    id: "parchment",
    label: "Parchment",
    className:
      "bg-[radial-gradient(ellipse_at_top,hsl(40,45%,94%),hsl(38,35%,88%))] dark:bg-[radial-gradient(ellipse_at_top,hsl(220,15%,14%),hsl(220,15%,10%))]",
  },
  {
    id: "night_library",
    label: "Night Library",
    className:
      // Was a cold blue-black (222/230 hue) borrowed from another theme,
      // sitting inside an app whose night palette is green-grey. Re-cut to
      // the same family as --background / --card in dark mode.
      "bg-[linear-gradient(160deg,hsl(160,10%,15%),hsl(165,10%,7%))] text-white",
  },
  {
    id: "rain_window",
    label: "Rain Window",
    className:
      "bg-[linear-gradient(180deg,hsl(205,30%,86%),hsl(210,25%,74%))] dark:bg-[linear-gradient(180deg,hsl(208,25%,20%),hsl(210,25%,12%))]",
  },
  {
    id: "forest_study",
    label: "Forest Study",
    className:
      "bg-[linear-gradient(160deg,hsl(140,20%,88%),hsl(150,18%,78%))] dark:bg-[linear-gradient(160deg,hsl(150,18%,15%),hsl(150,20%,9%))]",
  },
  {
    id: "minimal_ink",
    label: "Minimal Ink",
    className: "bg-background",
  },
];

const MODE_KEY = "sf_focus_visual_mode";

export default function Focus() {
  const timer = useFocusTimer();
  const audio = useAmbientAudio();
  const sessionId = useSession();
  const [, setLocation] = useLocation();
  const [minimal, setMinimal] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [mode, setMode] = useState<string>(
    () => localStorage.getItem(MODE_KEY) ?? "parchment",
  );

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const statsParams = { sessionId };
  const statsQuery = useGetPomodoroStatistics(statsParams, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetPomodoroStatisticsQueryKey(statsParams),
    },
  });
  const stats = statsQuery.data;

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (timer.status === "running") timer.pause();
        else if (timer.status === "paused") timer.resume();
        else timer.start(timer.phase);
      } else if (e.key === "r" || e.key === "R") {
        if (timer.isActive) setConfirmReset(true);
      } else if (e.key === "s" || e.key === "S") {
        if (timer.isActive) timer.skip();
      } else if (e.key === "m" || e.key === "M") {
        audio.toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        setMinimal((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer, audio]);

  const visual = VISUAL_MODES.find((m) => m.id === mode) ?? VISUAL_MODES[0];
  const dark = mode === "night_library";

  const ring = useMemo(() => {
    const r = 118;
    const c = 2 * Math.PI * r;
    return { r, c, offset: c * (1 - timer.progress) };
  }, [timer.progress]);

  const settings = timer.settings;
  const presets = [
    { label: "Classic 25/5", focus: 25 },
    { label: "Deep Work 50/10", focus: 50 },
    { label: "Sprint 15/3", focus: 15 },
    { label: "Long 90/20", focus: 90 },
  ];

  return (
    <>
      <SeoHead
        title="Focus room — StudyFilter"
        description="Run a distraction-free study timer with configurable focus sessions, breaks, ambient audio and scenes."
        canonical="/focus"
      />
      <div
      className={cn(
        "min-h-viewport transition-colors",
        visual.className,
        dark && "text-white",
      )}
    >
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {!minimal && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Focus Room
              </h1>
              <p
                className={cn(
                  "mt-1 text-sm",
                  dark ? "text-white/60" : "text-muted-foreground",
                )}
              >
                One task. One timer. Nothing else.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {VISUAL_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={m.label}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-[11px] transition-colors",
                    mode === m.id
                      ? dark
                        ? "border-white/60 bg-white/10 font-medium"
                        : "border-primary bg-primary/10 font-medium"
                      : dark
                        ? "border-white/20 text-white/60"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn("flex flex-col items-center", minimal ? "pt-20" : "pt-8")}>
          {!minimal && (
            <div className="mb-6 flex gap-1.5">
              {PHASES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (!timer.isActive) timer.start(p.id, timer.link);
                  }}
                  disabled={timer.isActive}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                    timer.phase === p.id
                      ? dark
                        ? "bg-white/15 font-medium"
                        : "bg-primary text-primary-foreground font-medium"
                      : dark
                        ? "text-white/60 hover:bg-white/10"
                        : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {timer.link.label && (
            <Badge
              variant="secondary"
              className={cn("mb-4 max-w-md truncate", dark && "bg-white/10 text-white")}
            >
              {timer.link.subject ? `${timer.link.subject} · ` : ""}
              {timer.link.label}
            </Badge>
          )}

          <div className="relative">
            <svg width="280" height="280" viewBox="0 0 280 280" aria-hidden>
              <circle
                cx="140"
                cy="140"
                r={ring.r}
                fill="none"
                strokeWidth="6"
                className={dark ? "stroke-white/15" : "stroke-border"}
              />
              <circle
                cx="140"
                cy="140"
                r={ring.r}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ring.c}
                strokeDashoffset={ring.offset}
                transform="rotate(-90 140 140)"
                className={cn(
                  "transition-[stroke-dashoffset] duration-500",
                  /*
                    Break phases used `stroke-accent`, which is now the
                    neutral hover surface — a grey ring on a grey track. A
                    break is rest, so it reads green, matching every other
                    "you're done" signal in the product.
                  */
                  timer.phase === "focus"
                    ? dark
                      ? "stroke-white"
                      : "stroke-primary"
                    : "stroke-success",
                )}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-6xl font-semibold tabular-nums tracking-tight">
                {formatTimer(timer.remainingMs)}
              </span>
              <span
                className={cn(
                  "mt-1 text-xs uppercase tracking-widest",
                  dark ? "text-white/50" : "text-muted-foreground",
                )}
              >
                {timer.status === "idle"
                  ? "Ready"
                  : timer.status === "paused"
                    ? "Paused"
                    : PHASES.find((p) => p.id === timer.phase)?.label}
              </span>
              {timer.completedFocusCount > 0 && (
                <span
                  className={cn(
                    "mt-1 text-[11px]",
                    dark ? "text-white/40" : "text-muted-foreground",
                  )}
                >
                  {timer.completedFocusCount} focus session
                  {timer.completedFocusCount > 1 ? "s" : ""} today
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {timer.status === "running" ? (
              <Button size="lg" className="h-12 px-8" onClick={timer.pause}>
                <Pause className="h-5 w-5 mr-2" /> Pause
              </Button>
            ) : timer.status === "paused" ? (
              <Button size="lg" className="h-12 px-8" onClick={timer.resume}>
                <Play className="h-5 w-5 mr-2" /> Resume
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-12 px-8"
                onClick={() => timer.start(timer.phase, timer.link)}
              >
                <Play className="h-5 w-5 mr-2" /> Start
              </Button>
            )}
            {timer.isActive && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn("h-12 w-12", dark && "border-white/30 bg-transparent hover:bg-white/10")}
                  title="Skip (S)"
                  onClick={timer.skip}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn("h-12 w-12", dark && "border-white/30 bg-transparent hover:bg-white/10")}
                  title="Reset (R)"
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12"
              title="Minimal mode (F)"
              onClick={() => setMinimal((v) => !v)}
            >
              {minimal ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>

          {!minimal && !timer.isActive && settings && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {presets.map((p) => (
                <span
                  key={p.label}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px]",
                    settings.focusMinutes === p.focus
                      ? dark
                        ? "border-white/50 bg-white/10"
                        : "border-primary bg-primary/10"
                      : dark
                        ? "border-white/20 text-white/50"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {p.label}
                </span>
              ))}
              <button
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] underline-offset-2 hover:underline",
                  dark ? "border-white/20 text-white/70" : "border-border text-muted-foreground",
                )}
                onClick={() => setLocation("/settings")}
              >
                Change in Settings
              </button>
            </div>
          )}
        </div>

        {!minimal && (
          <>
            <div
              className={cn(
                "mx-auto mt-8 max-w-xl rounded-xl border p-4",
                dark ? "border-white/15 bg-white/5" : "border-border bg-card/70",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Ambient sound</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={audio.toggleMute}
                    className={dark ? "text-white/70" : "text-muted-foreground"}
                    title="Mute (M)"
                  >
                    {audio.muted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <Slider
                    className="w-28"
                    value={[Math.round(audio.volume * 100)]}
                    max={100}
                    step={5}
                    onValueChange={([v]) => audio.setVolume(v / 100)}
                  />
                </div>
              </div>
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  dark ? "text-white/50" : "text-muted-foreground",
                )}
              >
                Mix up to two layers. Generated on-device — no downloads, no lyrics.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {AMBIENT_SOUNDS.map((s) => {
                  const on = audio.layers.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => audio.toggleLayer(s.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        on
                          ? dark
                            ? "border-white/60 bg-white/15 font-medium"
                            : "border-primary bg-primary/10 font-medium"
                          : dark
                            ? "border-white/20 text-white/60"
                            : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
                {audio.layers.length > 0 && (
                  <button
                    type="button"
                    onClick={audio.stopAll}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs underline-offset-2 hover:underline",
                      dark ? "text-white/60" : "text-muted-foreground",
                    )}
                  >
                    Stop all
                  </button>
                )}
              </div>
            </div>

            {stats && (
              <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  dark={dark}
                  icon={Clock}
                  label="Today"
                  value={`${stats.todayMinutes}m`}
                  sub={`of ${stats.dailyGoalMinutes}m goal`}
                />
                <StatTile
                  dark={dark}
                  icon={Target}
                  label="This week"
                  value={`${stats.weekMinutes}m`}
                  sub={`${stats.completedSessionsWeek} sessions`}
                />
                <StatTile
                  dark={dark}
                  icon={Flame}
                  label="Streak"
                  value={`${stats.currentStreakDays}d`}
                  sub="consecutive days"
                />
                <StatTile
                  dark={dark}
                  icon={Clock}
                  label="Avg session"
                  value={`${stats.averageSessionMinutes}m`}
                  sub={stats.mostFocusedChapter ?? "—"}
                />
              </div>
            )}

            <p
              className={cn(
                "mt-8 text-center text-[11px]",
                dark ? "text-white/40" : "text-muted-foreground",
              )}
            >
              Space start/pause · S skip · R reset · M mute · F minimal mode
            </p>
          </>
        )}
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the timer?</AlertDialogTitle>
            <AlertDialogDescription>
              The current session ends and the timer returns to the start. Focus minutes
              so far are still recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                timer.stop();
                setConfirmReset(false);
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
}

function StatTile({
  dark,
  icon: Icon,
  label,
  value,
  sub,
}: {
  dark: boolean;
  icon: typeof Clock;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        dark ? "border-white/15 bg-white/5" : "border-border bg-card/70",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px]",
          dark ? "text-white/50" : "text-muted-foreground",
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div
        className={cn(
          "truncate text-[11px]",
          dark ? "text-white/40" : "text-muted-foreground",
        )}
      >
        {sub}
      </div>
    </div>
  );
}
