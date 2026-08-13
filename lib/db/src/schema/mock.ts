import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mockAttemptsTable = pgTable("mock_attempts", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  subject: text("subject").notNull(),
  year: integer("year").notNull(),
  paperType: text("paper_type").notNull().default("previous_year"),
  questionPaperUrl: text("question_paper_url"),
  status: text("status").notNull().default("completed"),
  startedAt: timestamp("started_at").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
  totalMarks: integer("total_marks"),
  obtainedMarks: integer("obtained_marks"),
  accuracy: real("accuracy"),
  xpEarned: integer("xp_earned").notNull().default(0),
  sectionScores: jsonb("section_scores"),
  paletteSnapshot: jsonb("palette_snapshot"),
  writtenAnswers: text("written_answers"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sectionScoreSchema = z.record(
  z.string(),
  z.object({
    obtained: z.number().int().min(0),
    total: z.number().int().min(1),
  }),
);

export const insertMockAttemptSchema = createInsertSchema(mockAttemptsTable, {
  sectionScores: sectionScoreSchema.nullable().optional(),
  paletteSnapshot: z.array(z.string()).nullable().optional(),
}).omit({ id: true, createdAt: true });

export type InsertMockAttempt = z.infer<typeof insertMockAttemptSchema>;
export type MockAttempt = typeof mockAttemptsTable.$inferSelect;
export type SectionScores = z.infer<typeof sectionScoreSchema>;
