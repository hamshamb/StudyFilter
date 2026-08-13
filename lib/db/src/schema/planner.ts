import {
  pgTable,
  text,
  serial,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studyPlansTable = pgTable("study_plans", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull(),
  goalType: text("goal_type").notNull().default("custom"),
  goalDescription: text("goal_description"),
  startDate: text("start_date").notNull(),
  targetDate: text("target_date").notNull(),
  status: text("status").notNull().default("active"),
  subjectsJson: jsonb("subjects_json"),
  chaptersJson: jsonb("chapters_json"),
  availabilityJson: jsonb("availability_json"),
  preferencesJson: jsonb("preferences_json"),
  revisionPatternJson: jsonb("revision_pattern_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudyPlanSchema = createInsertSchema(studyPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudyPlan = z.infer<typeof insertStudyPlanSchema>;
export type StudyPlan = typeof studyPlansTable.$inferSelect;

export const studyPlanTasksTable = pgTable("study_plan_tasks", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull(),
  subject: text("subject"),
  chapter: text("chapter"),
  topic: text("topic"),
  taskType: text("task_type").notNull().default("custom"),
  scheduledDate: text("scheduled_date").notNull(),
  startTime: text("start_time"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(30),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  priority: text("priority").notNull().default("medium"),
  difficulty: integer("difficulty"),
  energyRequirement: text("energy_requirement"),
  notes: text("notes"),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  revisionCycle: integer("revision_cycle"),
  isLocked: boolean("is_locked").notNull().default(false),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudyPlanTaskSchema = createInsertSchema(
  studyPlanTasksTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudyPlanTask = z.infer<typeof insertStudyPlanTaskSchema>;
export type StudyPlanTask = typeof studyPlanTasksTable.$inferSelect;

export const pomodoroSettingsTable = pgTable("pomodoro_settings", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  focusMinutes: integer("focus_minutes").notNull().default(25),
  shortBreakMinutes: integer("short_break_minutes").notNull().default(5),
  longBreakMinutes: integer("long_break_minutes").notNull().default(15),
  sessionsBeforeLongBreak: integer("sessions_before_long_break")
    .notNull()
    .default(4),
  autoStartBreaks: boolean("auto_start_breaks").notNull().default(false),
  autoStartFocus: boolean("auto_start_focus").notNull().default(false),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(120),
  weeklyGoalMinutes: integer("weekly_goal_minutes").notNull().default(600),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  soundVolume: real("sound_volume").notNull().default(0.7),
  musicVolume: real("music_volume").notNull().default(0.5),
  preferredAudioId: text("preferred_audio_id"),
  appearancePreset: text("appearance_preset").notNull().default("minimal_ink"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPomodoroSettingsSchema = createInsertSchema(
  pomodoroSettingsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPomodoroSettings = z.infer<
  typeof insertPomodoroSettingsSchema
>;
export type PomodoroSettings = typeof pomodoroSettingsTable.$inferSelect;

export const focusSessionsTable = pgTable("focus_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  planId: integer("plan_id"),
  taskId: integer("task_id"),
  sessionType: text("session_type").notNull().default("focus"),
  plannedSeconds: integer("planned_seconds").notNull(),
  actualSeconds: integer("actual_seconds").notNull().default(0),
  subject: text("subject"),
  chapter: text("chapter"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFocusSessionSchema = createInsertSchema(
  focusSessionsTable,
).omit({ id: true, createdAt: true });
export type InsertFocusSession = z.infer<typeof insertFocusSessionSchema>;
export type FocusSession = typeof focusSessionsTable.$inferSelect;
