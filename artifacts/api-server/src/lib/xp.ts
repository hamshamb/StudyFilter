/**
 * XP pricing and abuse limits.
 *
 * XP used to be whatever number the client PUT to /api/progress. That was
 * harmless while progress was private, but it now feeds a public leaderboard,
 * where "send xpDelta: 999999" is a single fetch from the browser console.
 * The server prices every award from the event that earned it, and the client
 * no longer sends amounts at all.
 */

export type XpEventType =
  | "quiz_completed"
  | "mock_submitted"
  | "doubt_answered"
  | "practice_session"
  | "focus_session";

/** Per-correct-answer and flat awards. Single source of truth. */
export const XP_RULES = {
  perCorrectAnswer: 10,
  /** Small flat award; asking questions should be encouraged, not farmed. */
  doubtAnswered: 5,
  practiceSession: 25,
  focusSession: 15,
  /** Mock exams are long, so they are worth more — scaled by accuracy below. */
  mockBase: 50,
  mockAccuracyBonus: 50,
} as const;

/**
 * Daily ceiling per student. Sized well above what a genuinely heavy study day
 * produces (roughly 300–400 XP), so it never punishes real use, while capping
 * what a scripted loop can accumulate.
 */
export const DAILY_XP_CAP = 1000;

/** Rejects implausible payloads before anything is priced or stored. */
export function priceQuiz(totalQuestions: number, correctAnswers: number): number | null {
  if (!Number.isInteger(totalQuestions) || !Number.isInteger(correctAnswers)) return null;
  if (totalQuestions < 1 || totalQuestions > 50) return null;
  if (correctAnswers < 0 || correctAnswers > totalQuestions) return null;
  return correctAnswers * XP_RULES.perCorrectAnswer;
}

/** Mock XP scales with accuracy so a blank submission is not worth a full run. */
export function priceMock(accuracy: number | null): number {
  const a = typeof accuracy === "number" && accuracy >= 0 && accuracy <= 1 ? accuracy : 0;
  return Math.round(XP_RULES.mockBase + XP_RULES.mockAccuracyBonus * a);
}

export function flatPrice(type: XpEventType): number {
  switch (type) {
    case "doubt_answered":
      return XP_RULES.doubtAnswered;
    case "practice_session":
      return XP_RULES.practiceSession;
    case "focus_session":
      return XP_RULES.focusSession;
    default:
      return 0;
  }
}
