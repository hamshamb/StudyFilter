import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Student-reported issues and suggestions. Captured in-app rather than
 * relying solely on a mailto: link — a bare mailto opens nothing on a
 * student's phone if no mail client is configured, and the report is lost.
 * support@studyfilter.online is offered as the escalation path for anything
 * urgent, not the only channel.
 */
export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  /** Where the student was when they reported this — page path, or subject/chapter context. */
  pageContext: text("page_context"),
  /** e.g. { subject, chapter, question } — whatever the reporting surface can attach automatically. */
  contextJson: text("context_json"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({
  id: true,
  status: true,
  createdAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;
