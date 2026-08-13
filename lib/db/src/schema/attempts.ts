import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";

/**
 * Every graded attempt a student makes, from any surface.
 *
 * Quiz and practice results were previously not stored at all — the client
 * awarded itself XP and nothing about the attempt survived, so there was no
 * way to answer "which chapters is this student weakest in?". Mock exams were
 * the only graded thing on record. This unifies them so the dashboard can
 * analyse across all three.
 *
 * `source` distinguishes where the attempt came from:
 *   "chapter_quiz"     — the quiz unit on a chapter page
 *   "practice"         — the Practice page
 *   "doubt_followup"   — the quick check after an answered doubt
 */
export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  source: text("source").notNull(),
  subject: text("subject"),
  chapter: text("chapter"),
  difficulty: text("difficulty"),
  totalQuestions: integer("total_questions").notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  accuracy: real("accuracy").notNull().default(0),
  timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
  /** Awarded by the server, never sent by the client. */
  xpEarned: integer("xp_earned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;

/**
 * Append-only ledger of every XP award, with the event that caused it.
 *
 * Keeping the reason alongside the amount makes the daily cap enforceable,
 * makes "why did my XP jump?" answerable, and means a bad actor's inflated
 * score can be traced and reversed rather than just silently distorting the
 * leaderboard forever.
 */
export const xpEventsTable = pgTable("xp_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(),
  xpAwarded: integer("xp_awarded").notNull(),
  /** Free-form detail — subject/chapter/attempt id, for auditing. */
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type XpEvent = typeof xpEventsTable.$inferSelect;
