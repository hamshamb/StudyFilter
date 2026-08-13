import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";

export interface SubjectStat {
  subject: string;
  attempts: number;
  quizAccuracy: number | null;
  mockAccuracy: number | null;
  accuracy: number | null;
}

export interface WeakChapter {
  subject: string;
  chapter: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface DayPoint {
  /** YYYY-MM-DD, UTC. */
  date: string;
  xp: number;
  questions: number;
}

export interface RecentMock {
  id: number;
  subject: string;
  year: number;
  obtainedMarks: number | null;
  totalMarks: number | null;
  accuracy: number | null;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface Analytics {
  totals: {
    quizAttempts: number;
    quizQuestions: number;
    quizAccuracy: number | null;
    mockAttempts: number;
    doubtsAsked: number;
    xp30d: number;
  };
  subjects: SubjectStat[];
  weakChapters: WeakChapter[];
  /** Exactly 30 entries, oldest first — the last one is today. */
  days: DayPoint[];
  recentMocks: RecentMock[];
}

/**
 * The dashboard analytics payload.
 *
 * Shared through TanStack Query because two components on the same screen
 * need it — the Dashboard's stat row and PerformanceAnalysis below it.
 * PerformanceAnalysis previously owned a raw fetch with its own
 * setInterval and visibility check; a second consumer would have meant a
 * second request for identical data on every Dashboard load. One query key,
 * one request, one refresh loop.
 */
export function useAnalytics() {
  const sessionId = useSession();

  return useQuery<Analytics | null>({
    queryKey: ["/api/analytics", { sessionId }],
    enabled: Boolean(sessionId),
    // Keeps the numbers live if a quiz is finished in another tab. Query's
    // interval already pauses while the window is unfocused, which is what
    // the hand-rolled document.visibilityState check was doing.
    refetchInterval: 20_000,
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics?sessionId=${encodeURIComponent(sessionId!)}`,
      );
      if (!res.ok) throw new Error("analytics request failed");
      return (await res.json()) as Analytics;
    },
  });
}

/**
 * XP earned today, from the xp_events ledger.
 *
 * `days` is built server-side as 30 entries ending at today, so the last
 * element is today's bucket. Returns null rather than 0 while the data is
 * still loading, so a real zero is distinguishable from "not known yet".
 *
 * Note this is a UTC day, matching how the rest of the analytics endpoint
 * buckets everything.
 */
export function todayXp(analytics: Analytics | null | undefined): number | null {
  const days = analytics?.days;
  if (!days || days.length === 0) return null;
  return days[days.length - 1]?.xp ?? null;
}
