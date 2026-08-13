import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createFocusSession,
  updateFocusSession,
  getPomodoroSettings,
  type PomodoroSettings,
} from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";

export type TimerPhase = "focus" | "short_break" | "long_break";
export type TimerStatus = "idle" | "running" | "paused";

interface TimerLink {
  planId?: number | null;
  taskId?: number | null;
  subject?: string | null;
  chapter?: string | null;
  label?: string | null;
}

interface PersistedTimer {
  phase: TimerPhase;
  status: TimerStatus;
  endsAt: number | null;
  remainingMs: number;
  totalMs: number;
  completedFocusCount: number;
  focusSessionId: number | null;
  startedAtIso: string | null;
  link: TimerLink;
}

export interface FocusTimerContextValue {
  phase: TimerPhase;
  status: TimerStatus;
  remainingMs: number;
  totalMs: number;
  completedFocusCount: number;
  link: TimerLink;
  settings: PomodoroSettings | null;
  progress: number;
  isActive: boolean;
  start: (phase?: TimerPhase, link?: TimerLink) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
  refreshSettings: () => void;
}

const STORAGE_KEY = "sf_focus_timer";

const DEFAULT_SETTINGS: Omit<PomodoroSettings, "sessionId"> = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  dailyGoalMinutes: 120,
  weeklyGoalMinutes: 600,
  soundEnabled: true,
  soundVolume: 0.7,
  musicVolume: 0.5,
  appearancePreset: "minimal_ink",
};

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

function loadPersisted(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTimer;
    if (typeof parsed.totalMs !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function FocusTimerProvider({ children }: { children: React.ReactNode }) {
  const sessionId = useSession();
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const persisted = useMemo(loadPersisted, []);

  const [phase, setPhase] = useState<TimerPhase>(persisted?.phase ?? "focus");
  const [status, setStatus] = useState<TimerStatus>(() => {
    if (!persisted) return "idle";
    if (persisted.status === "running" && persisted.endsAt) {
      return persisted.endsAt > Date.now() ? "running" : "idle";
    }
    return persisted.status;
  });
  const [endsAt, setEndsAt] = useState<number | null>(
    persisted?.status === "running" && persisted.endsAt && persisted.endsAt > Date.now()
      ? persisted.endsAt
      : null,
  );
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!persisted) return DEFAULT_SETTINGS.focusMinutes * 60_000;
    if (persisted.status === "running" && persisted.endsAt) {
      return Math.max(0, persisted.endsAt - Date.now());
    }
    return persisted.remainingMs;
  });
  const [totalMs, setTotalMs] = useState<number>(
    persisted?.totalMs ?? DEFAULT_SETTINGS.focusMinutes * 60_000,
  );
  const [completedFocusCount, setCompletedFocusCount] = useState<number>(
    persisted?.completedFocusCount ?? 0,
  );
  const [link, setLink] = useState<TimerLink>(persisted?.link ?? {});
  const focusSessionIdRef = useRef<number | null>(persisted?.focusSessionId ?? null);
  const startedAtRef = useRef<string | null>(persisted?.startedAtIso ?? null);
  const completingRef = useRef(false);
  // Holds the latest advancePhase so the Tick effect never re-runs just because remainingMs changed
  const advancePhaseRef = useRef<(completed: boolean) => void>(null!);

  const refreshSettings = useCallback(() => {
    if (!sessionId) return;
    getPomodoroSettings({ sessionId })
      .then(setSettings)
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const effective = settings ?? { sessionId: "", ...DEFAULT_SETTINGS };

  const phaseMinutes = useCallback(
    (p: TimerPhase) =>
      p === "focus"
        ? effective.focusMinutes
        : p === "short_break"
          ? effective.shortBreakMinutes
          : effective.longBreakMinutes,
    [effective.focusMinutes, effective.shortBreakMinutes, effective.longBreakMinutes],
  );

  // Persist on every meaningful change
  useEffect(() => {
    const data: PersistedTimer = {
      phase,
      status,
      endsAt,
      remainingMs,
      totalMs,
      completedFocusCount,
      focusSessionId: focusSessionIdRef.current,
      startedAtIso: startedAtRef.current,
      link,
    };
    try {
      if (status === "idle" && !focusSessionIdRef.current) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      /* ignore quota errors */
    }
  }, [phase, status, endsAt, remainingMs, totalMs, completedFocusCount, link]);

  const finishBackendSession = useCallback(
    (finalStatus: "completed" | "cancelled" | "skipped", actualSeconds: number) => {
      const id = focusSessionIdRef.current;
      focusSessionIdRef.current = null;
      startedAtRef.current = null;
      if (!id || !sessionId) return;
      updateFocusSession(id, {
        sessionId,
        actualSeconds,
        status: finalStatus,
        endedAt: new Date().toISOString(),
      }).catch(() => {});
    },
    [sessionId],
  );

  const start = useCallback(
    (p: TimerPhase = "focus", newLink?: TimerLink) => {
      const minutes = phaseMinutes(p);
      const ms = minutes * 60_000;
      const started = new Date().toISOString();
      setPhase(p);
      setTotalMs(ms);
      setRemainingMs(ms);
      setEndsAt(Date.now() + ms);
      setStatus("running");
      if (newLink !== undefined) setLink(newLink);
      startedAtRef.current = started;
      if (sessionId) {
        const l = newLink ?? link;
        createFocusSession({
          sessionId,
          planId: l.planId ?? null,
          taskId: l.taskId ?? null,
          sessionType: p,
          plannedSeconds: Math.round(ms / 1000),
          subject: l.subject ?? null,
          chapter: l.chapter ?? null,
          startedAt: started,
        })
          .then((r) => {
            focusSessionIdRef.current = r.focusSession.id;
          })
          .catch(() => {});
      }
    },
    [phaseMinutes, sessionId, link],
  );

  const pause = useCallback(() => {
    if (status !== "running" || !endsAt) return;
    setRemainingMs(Math.max(0, endsAt - Date.now()));
    setEndsAt(null);
    setStatus("paused");
  }, [status, endsAt]);

  const resume = useCallback(() => {
    if (status !== "paused") return;
    setEndsAt(Date.now() + remainingMs);
    setStatus("running");
  }, [status, remainingMs]);

  const advancePhase = useCallback(
    (completed: boolean) => {
      const elapsed = Math.round((totalMs - remainingMs) / 1000);
      const fullSeconds = Math.round(totalMs / 1000);
      finishBackendSession(
        completed ? "completed" : "skipped",
        completed ? fullSeconds : elapsed,
      );
      if (phase === "focus") {
        const nextCount = completed ? completedFocusCount + 1 : completedFocusCount;
        setCompletedFocusCount(nextCount);
        const nextPhase: TimerPhase =
          nextCount > 0 && nextCount % effective.sessionsBeforeLongBreak === 0
            ? "long_break"
            : "short_break";
        if (effective.autoStartBreaks) {
          start(nextPhase);
        } else {
          setPhase(nextPhase);
          const ms = phaseMinutes(nextPhase) * 60_000;
          setTotalMs(ms);
          setRemainingMs(ms);
          setEndsAt(null);
          setStatus("idle");
        }
      } else {
        if (effective.autoStartFocus) {
          start("focus");
        } else {
          setPhase("focus");
          const ms = phaseMinutes("focus") * 60_000;
          setTotalMs(ms);
          setRemainingMs(ms);
          setEndsAt(null);
          setStatus("idle");
        }
      }
    },
    [
      phase,
      totalMs,
      remainingMs,
      completedFocusCount,
      effective.sessionsBeforeLongBreak,
      effective.autoStartBreaks,
      effective.autoStartFocus,
      finishBackendSession,
      phaseMinutes,
      start,
    ],
  );

  // Keep ref in sync with the latest advancePhase implementation (no deps = runs after every render)
  useEffect(() => {
    advancePhaseRef.current = advancePhase;
  });

  const skip = useCallback(() => advancePhaseRef.current(false), []);

  const stop = useCallback(() => {
    const elapsed = Math.round((totalMs - remainingMs) / 1000);
    finishBackendSession("cancelled", elapsed);
    setPhase("focus");
    const ms = phaseMinutes("focus") * 60_000;
    setTotalMs(ms);
    setRemainingMs(ms);
    setEndsAt(null);
    setStatus("idle");
    setCompletedFocusCount(0);
    setLink({});
  }, [totalMs, remainingMs, finishBackendSession, phaseMinutes]);

  // Tick — depends only on status/endsAt so setRemainingMs changes don't cause effect re-runs
  useEffect(() => {
    if (status !== "running" || !endsAt) return;
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemainingMs(left);
      if (left <= 0 && !completingRef.current) {
        completingRef.current = true;
        advancePhaseRef.current(true);
        setTimeout(() => {
          completingRef.current = false;
        }, 500);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [status, endsAt]); // advancePhase intentionally omitted — accessed via ref

  // If we reloaded and the persisted timer expired while away, close it out
  useEffect(() => {
    if (
      persisted &&
      persisted.status === "running" &&
      persisted.endsAt &&
      persisted.endsAt <= Date.now() &&
      persisted.focusSessionId &&
      sessionId
    ) {
      updateFocusSession(persisted.focusSessionId, {
        sessionId,
        actualSeconds: Math.round(persisted.totalMs / 1000),
        status: "completed",
        endedAt: new Date(persisted.endsAt).toISOString(),
      }).catch(() => {});
      focusSessionIdRef.current = null;
      localStorage.removeItem(STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const value: FocusTimerContextValue = {
    phase,
    status,
    remainingMs,
    totalMs,
    completedFocusCount,
    link,
    settings,
    progress: totalMs > 0 ? 1 - remainingMs / totalMs : 0,
    isActive: status === "running" || status === "paused",
    start,
    pause,
    resume,
    skip,
    stop,
    refreshSettings,
  };

  return (
    <FocusTimerContext.Provider value={value}>
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer(): FocusTimerContextValue {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used within FocusTimerProvider");
  return ctx;
}

export function formatTimer(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
