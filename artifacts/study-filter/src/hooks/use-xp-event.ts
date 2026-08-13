import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";

export type XpEvent =
  | {
      type: "quiz_completed";
      /**
       * Where the quiz was sat. A label for the ledger only — the server
       * prices every quiz from its score alone (see priceQuiz in
       * routes/events.ts) and stores whatever string arrives, so adding a
       * value here cannot change anyone's XP.
       *
       * "quiz" is the standalone builder at /quiz. It is deliberately not
       * folded into "practice", which already covers both the mock-exam page
       * and map rounds — three different activities under one label would
       * make the history unreadable.
       */
      source: "chapter_quiz" | "practice" | "doubt_followup" | "quiz";
      subject?: string | null;
      chapter?: string | null;
      difficulty?: string | null;
      totalQuestions: number;
      correctAnswers: number;
      timeTakenSeconds?: number;
    }
  | { type: "mock_submitted"; attemptId: number }
  | { type: "doubt_answered"; subject?: string | null }
  | { type: "practice_session"; subject?: string | null }
  | { type: "focus_session"; subject?: string | null };

/**
 * Reports what the student did. Deliberately has no way to say how much XP
 * that is worth — the server prices every event, because these numbers now
 * drive a public leaderboard and a client-supplied amount is trivially forged.
 *
 * Invalidates progress/analytics/leaderboard on success so the dashboard and
 * the board reflect the new score without a manual refresh.
 */
export function useXpEvent() {
  const sessionId = useSession();
  const queryClient = useQueryClient();

  return useCallback(
    async (event: XpEvent) => {
      if (!sessionId) return null;
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...event }),
        });
        if (!res.ok) return null;
        const json = await res.json();

        queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] });

        return json as { xpAwarded: number; cappedForToday: boolean };
      } catch {
        return null;
      }
    },
    [sessionId, queryClient],
  );
}
