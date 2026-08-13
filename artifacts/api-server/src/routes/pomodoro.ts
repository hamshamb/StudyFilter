import { Router } from "express";
import { db } from "@workspace/db";
import { pomodoroSettingsTable, focusSessionsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";

import { resolveOwnerKey } from "../lib/owner";
import { istDayKey, istDayKeyAgo, istDayStart, istDayStartAgo, istWeekStart } from "../lib/day";

const router = Router();

function serializeSettings(s: typeof pomodoroSettingsTable.$inferSelect) {
  return {
    sessionId: s.sessionId,
    focusMinutes: s.focusMinutes,
    shortBreakMinutes: s.shortBreakMinutes,
    longBreakMinutes: s.longBreakMinutes,
    sessionsBeforeLongBreak: s.sessionsBeforeLongBreak,
    autoStartBreaks: s.autoStartBreaks,
    autoStartFocus: s.autoStartFocus,
    dailyGoalMinutes: s.dailyGoalMinutes,
    weeklyGoalMinutes: s.weeklyGoalMinutes,
    soundEnabled: s.soundEnabled,
    soundVolume: s.soundVolume,
    musicVolume: s.musicVolume,
    preferredAudioId: s.preferredAudioId,
    appearancePreset: s.appearancePreset,
  };
}

function serializeFocusSession(s: typeof focusSessionsTable.$inferSelect) {
  return {
    id: s.id,
    sessionId: s.sessionId,
    planId: s.planId,
    taskId: s.taskId,
    sessionType: s.sessionType,
    plannedSeconds: s.plannedSeconds,
    actualSeconds: s.actualSeconds,
    subject: s.subject,
    chapter: s.chapter,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    status: s.status,
  };
}

// GET /api/pomodoro/settings
router.get("/pomodoro/settings", async (req, res) => {
  const sessionId = resolveOwnerKey(req, req.query["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  let [settings] = await db
    .select()
    .from(pomodoroSettingsTable)
    .where(eq(pomodoroSettingsTable.sessionId, sessionId))
    .limit(1);
  if (!settings) {
    [settings] = await db
      .insert(pomodoroSettingsTable)
      .values({ sessionId })
      .returning();
  }
  res.json(serializeSettings(settings!));
});

// PUT /api/pomodoro/settings
router.put("/pomodoro/settings", async (req, res) => {
  const body = req.body as Record<string, unknown> & { sessionId: string };
  // Server decides ownership; the client-sent id is only a fallback when anonymous.
  body.sessionId = resolveOwnerKey(req, body.sessionId) ?? "";
  if (!body.sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const updates: Partial<typeof pomodoroSettingsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  const fields = [
    "focusMinutes",
    "shortBreakMinutes",
    "longBreakMinutes",
    "sessionsBeforeLongBreak",
    "autoStartBreaks",
    "autoStartFocus",
    "dailyGoalMinutes",
    "weeklyGoalMinutes",
    "soundEnabled",
    "soundVolume",
    "musicVolume",
    "preferredAudioId",
    "appearancePreset",
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) {
      (updates as Record<string, unknown>)[f] = body[f];
    }
  }
  const [existing] = await db
    .select()
    .from(pomodoroSettingsTable)
    .where(eq(pomodoroSettingsTable.sessionId, body.sessionId))
    .limit(1);
  let settings;
  if (existing) {
    [settings] = await db
      .update(pomodoroSettingsTable)
      .set(updates)
      .where(eq(pomodoroSettingsTable.sessionId, body.sessionId))
      .returning();
  } else {
    [settings] = await db
      .insert(pomodoroSettingsTable)
      .values({ sessionId: body.sessionId, ...updates })
      .returning();
  }
  res.json(serializeSettings(settings!));
});

// POST /api/pomodoro/sessions
router.post("/pomodoro/sessions", async (req, res) => {
  const body = req.body as {
    sessionId: string;
    planId?: number | null;
    taskId?: number | null;
    sessionType: string;
    plannedSeconds: number;
    subject?: string | null;
    chapter?: string | null;
    startedAt: string;
  };
  body.sessionId = resolveOwnerKey(req, body.sessionId) ?? "";
  if (!body.sessionId || !body.sessionType || !body.plannedSeconds || !body.startedAt) {
    res.status(400).json({ error: "Missing required session fields" });
    return;
  }
  const [session] = await db
    .insert(focusSessionsTable)
    .values({
      sessionId: body.sessionId,
      planId: body.planId ?? null,
      taskId: body.taskId ?? null,
      sessionType: body.sessionType,
      plannedSeconds: body.plannedSeconds,
      subject: body.subject ?? null,
      chapter: body.chapter ?? null,
      startedAt: new Date(body.startedAt),
      status: "active",
    })
    .returning();
  res.status(201).json({ focusSession: serializeFocusSession(session!) });
});

// PUT /api/pomodoro/sessions/:focusSessionId
router.put("/pomodoro/sessions/:focusSessionId", async (req, res) => {
  const id = Number(req.params.focusSessionId);
  const body = req.body as {
    sessionId: string;
    actualSeconds?: number;
    status?: string;
    endedAt?: string | null;
  };
  body.sessionId = resolveOwnerKey(req, body.sessionId) ?? "";
  if (!body.sessionId || !Number.isFinite(id)) {
    res.status(400).json({ error: "sessionId and focusSessionId are required" });
    return;
  }
  const updates: Partial<typeof focusSessionsTable.$inferInsert> = {};
  if (body.actualSeconds !== undefined) updates.actualSeconds = body.actualSeconds;
  if (body.status !== undefined) updates.status = body.status;
  if (body.endedAt !== undefined)
    updates.endedAt = body.endedAt ? new Date(body.endedAt) : null;
  const [session] = await db
    .update(focusSessionsTable)
    .set(updates)
    .where(
      and(
        eq(focusSessionsTable.id, id),
        eq(focusSessionsTable.sessionId, body.sessionId),
      ),
    )
    .returning();
  if (!session) {
    res.status(404).json({ error: "Focus session not found" });
    return;
  }
  res.json({ focusSession: serializeFocusSession(session) });
});

// GET /api/pomodoro/statistics
router.get("/pomodoro/statistics", async (req, res) => {
  const sessionId = resolveOwnerKey(req, req.query["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const [settings] = await db
    .select()
    .from(pomodoroSettingsTable)
    .where(eq(pomodoroSettingsTable.sessionId, sessionId))
    .limit(1);

  // All three are IST boundaries now. weekStart in particular used to be
  // `getDate() - getDay()`, i.e. the preceding SUNDAY — while progress,
  // events and the leaderboard all anchor weeks to Monday. "This week's
  // focus minutes" therefore covered a different seven days than the
  // leaderboard a student was comparing it against.
  const todayStart = istDayStart();
  const weekStart = istWeekStart();
  const monthAgo = istDayStartAgo(30);

  const recent = await db
    .select()
    .from(focusSessionsTable)
    .where(
      and(
        eq(focusSessionsTable.sessionId, sessionId),
        gte(focusSessionsTable.startedAt, monthAgo),
      ),
    )
    .orderBy(desc(focusSessionsTable.startedAt));

  const focusOnly = recent.filter(
    (s) => s.sessionType === "focus" || s.sessionType === "custom",
  );
  const done = focusOnly.filter(
    (s) => s.status === "completed" || s.status === "skipped",
  );

  const todaySessions = done.filter((s) => s.startedAt >= todayStart);
  const weekSessions = done.filter((s) => s.startedAt >= weekStart);
  const todayMinutes = Math.round(
    todaySessions.reduce((sum, s) => sum + s.actualSeconds, 0) / 60,
  );
  const weekMinutes = Math.round(
    weekSessions.reduce((sum, s) => sum + s.actualSeconds, 0) / 60,
  );
  const completedToday = todaySessions.filter(
    (s) => s.status === "completed",
  ).length;
  const completedWeek = weekSessions.filter(
    (s) => s.status === "completed",
  ).length;
  const avg =
    done.length > 0
      ? Math.round(
          done.reduce((sum, s) => sum + s.actualSeconds, 0) / done.length / 60,
        )
      : 0;

  // Streak: consecutive days (ending today or yesterday) with completed focus
  const daysWithFocus = new Set(
    done
      .filter((s) => s.actualSeconds >= 60)
      .map((s) => istDayKey(s.startedAt)),
  );
  // Walk back in whole IST days. The previous version stepped a Date with
  // local setDate() and then keyed it with UTC toISOString(), so the two
  // only lined up because the server runs in UTC.
  let streak = 0;
  let offset = daysWithFocus.has(istDayKey()) ? 0 : 1;
  for (let i = 0; i < 60; i++) {
    if (!daysWithFocus.has(istDayKeyAgo(offset))) break;
    streak++;
    offset++;
  }

  const bySubject = new Map<string, number>();
  const byChapter = new Map<string, number>();
  for (const s of done) {
    if (s.subject) {
      bySubject.set(
        s.subject,
        (bySubject.get(s.subject) ?? 0) + Math.round(s.actualSeconds / 60),
      );
    }
    if (s.chapter) {
      byChapter.set(
        s.chapter,
        (byChapter.get(s.chapter) ?? 0) + Math.round(s.actualSeconds / 60),
      );
    }
  }
  let mostFocusedChapter: string | null = null;
  let max = 0;
  for (const [ch, min] of byChapter) {
    if (min > max) {
      max = min;
      mostFocusedChapter = ch;
    }
  }

  res.json({
    todayMinutes,
    weekMinutes,
    dailyGoalMinutes: settings?.dailyGoalMinutes ?? 120,
    weeklyGoalMinutes: settings?.weeklyGoalMinutes ?? 600,
    completedSessionsToday: completedToday,
    completedSessionsWeek: completedWeek,
    averageSessionMinutes: avg,
    currentStreakDays: streak,
    mostFocusedChapter,
    subjectDistribution: [...bySubject.entries()].map(([subject, minutes]) => ({
      subject,
      minutes,
    })),
  });
});

export default router;
