import { pgTable, text, serial, integer, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentProgressTable = pgTable("student_progress", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  questionsSolved: integer("questions_solved").notNull().default(0),
  dailyGoal: integer("daily_goal").notNull().default(5),
  accuracy: real("accuracy").notNull().default(0),
  chaptersCompleted: integer("chapters_completed").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  /**
   * `xp` is cumulative and never resets, so it cannot answer "how much did
   * this student earn THIS week" — which is what the leaderboard ranks on.
   * These two record the Monday of the current week and the XP total at that
   * moment; weekly XP is simply `xp - weekAnchorXp`. Ranking on the cumulative
   * total instead would hand first place permanently to whoever joined
   * earliest, and every new student would arrive already last.
   */
  weekAnchorDate: text("week_anchor_date"),
  weekAnchorXp: integer("week_anchor_xp").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudentProgressSchema = createInsertSchema(studentProgressTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentProgress = z.infer<typeof insertStudentProgressSchema>;
export type StudentProgress = typeof studentProgressTable.$inferSelect;

/**
 * Per-account preferences that must survive a cleared cache or a device
 * change — unlike grade/level, which still live in localStorage for anonymous
 * visitors. Keyed by the same owner key as every other table (see
 * api-server/src/lib/owner.ts).
 */
export const accountSettingsTable = pgTable("account_settings", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  /**
   * Leaderboard participation is opt-IN. Most of these students are around 15;
   * publishing a ranking someone never agreed to appear in is not a default
   * worth shipping.
   */
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
  /** Shown on the leaderboard. Never the student's real name unless they type one. */
  displayName: text("display_name"),
  /**
   * Public handle — lowercase letters, digits and single underscores.
   *
   * Not UNIQUE on purpose. Enforcing uniqueness across anonymous
   * browser-session rows would let anyone squat every good name without
   * ever creating an account, and would make the claim-on-sign-in merge
   * (routes/account.ts) fail whenever a student's guest row and their new
   * signed-in row both held a handle. Display names here are labels, not
   * identities — nothing is authorised by them.
   */
  username: text("username"),
  /** One of AVATAR_SYMBOLS in the client's lib/avatar.ts. */
  avatarSymbol: text("avatar_symbol"),
  /** One of AVATAR_PALETTES in the client's lib/avatar.ts. */
  avatarColor: text("avatar_color"),
  grade: integer("grade"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AccountSettings = typeof accountSettingsTable.$inferSelect;

/**
 * Permanent store for AI-generated study material — chapter summaries, NCERT
 * answers, important questions, revision notes.
 *
 * These are deterministic for a given (chapter, class, topic): the same chapter
 * summary is correct today and next term, so regenerating it is pure waste —
 * it costs an OpenAI call and several seconds of the student's time for an
 * identical result. The previous in-memory cache expired after 30 minutes,
 * capped at 200 entries, and was wiped by every deploy, so in practice most
 * requests re-generated. Rows here are written once and reused indefinitely.
 */
export const generatedContentTable = pgTable("generated_content", {
  id: serial("id").primaryKey(),
  /** "summary" | "ncert_answers" | "important_questions" | "revision_notes" */
  kind: text("kind").notNull(),
  /** Stable hash of the generation inputs — one row per distinct request. */
  cacheKey: text("cache_key").notNull().unique(),
  subject: text("subject"),
  chapter: text("chapter"),
  classLevel: integer("class_level"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GeneratedContent = typeof generatedContentTable.$inferSelect;

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  question: text("question").notNull(),
  subject: text("subject").notNull(),
  classLevel: integer("class_level").notNull(),
  answerSource: text("answer_source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
