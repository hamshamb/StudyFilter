import { Router } from "express";
import { db } from "@workspace/db";
import { studentProgressTable, activityTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { resolveOwnerKey } from "../lib/owner";
import { istDayKey, istDayKeyAgo, istDayStart, istWeekAnchorKey } from "../lib/day";

const router = Router();

/**
 * All day arithmetic runs in IST — see lib/day.ts. getYesterday in particular
 * used to mix clocks: setDate() is local while toISOString() is UTC, so it was
 * only correct because the server happens to run in UTC.
 */
const getToday = () => istDayKey();

/**
 * Monday of the current week, as YYYY-MM-DD. The leaderboard ranks on XP
 * earned since this date, so it has to agree exactly with the anchor stored
 * on each progress row.
 */
const getWeekAnchor = () => istWeekAnchorKey();

const getYesterday = () => istDayKeyAgo(1);

// GET /api/progress
router.get("/progress", async (req, res) => {
  // Signed in? The server decides the key, ignoring whatever the client sent.
  const sessionId = resolveOwnerKey(req, req.query["sessionId"]);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const today = getToday();

  let progress = await db
    .select()
    .from(studentProgressTable)
    .where(eq(studentProgressTable.sessionId, sessionId))
    .limit(1);

  if (progress.length === 0) {
    const [newProgress] = await db
      .insert(studentProgressTable)
      .values({
        sessionId,
        xp: 0,
        streak: 0,
        questionsSolved: 0,
        dailyGoal: 5,
        accuracy: 0,
        chaptersCompleted: 0,
        lastActiveDate: today,
      })
      .returning();
    progress = [newProgress];
  }

  // Count today's questions from activity table
  const todayStart = istDayStart();

  const todayActivity = await db
    .select()
    .from(activityTable)
    .where(
      and(
        eq(activityTable.sessionId, sessionId),
        gte(activityTable.createdAt, todayStart),
      )
    );

  const questionsToday = todayActivity.length;

  const p = progress[0];
  res.json({
    sessionId: p.sessionId,
    xp: p.xp,
    streak: p.streak,
    questionsSolved: p.questionsSolved,
    questionsToday,
    dailyGoal: p.dailyGoal,
    accuracy: p.accuracy,
    chaptersCompleted: p.chaptersCompleted,
    lastActiveDate: p.lastActiveDate,
  });
});

// PUT /api/progress
//
// XP is no longer accepted here. It is priced by the server from the event
// that earned it (POST /api/events) — leaving a client-settable xpDelta open
// while a public leaderboard reads the same number would make the board
// trivially forgeable from the browser console. The remaining fields are
// bookkeeping the client can legitimately report.
router.put("/progress", async (req, res) => {
  const { questionsSolvedDelta, correctAnswers, totalAnswers, chapterCompleted } = req.body;
  const xpDelta = 0;
  const sessionId = resolveOwnerKey(req, req.body?.sessionId);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const today = getToday();
  const yesterday = getYesterday();

  let existing = await db
    .select()
    .from(studentProgressTable)
    .where(eq(studentProgressTable.sessionId, sessionId))
    .limit(1);

  if (existing.length === 0) {
    const [created] = await db
      .insert(studentProgressTable)
      .values({
        sessionId,
        xp: xpDelta || 0,
        streak: 1,
        questionsSolved: questionsSolvedDelta || 0,
        dailyGoal: 5,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        chaptersCompleted: chapterCompleted ? 1 : 0,
        lastActiveDate: today,
        weekAnchorDate: getWeekAnchor(),
        weekAnchorXp: 0,
      })
      .returning();
    existing = [created];
  } else {
    const p = existing[0];
    const newXp = p.xp + (xpDelta || 0);
    const newSolved = p.questionsSolved + (questionsSolvedDelta || 0);

    // Streak: maintain if active today, increment if yesterday, reset if older
    let newStreak: number;
    if (p.lastActiveDate === today) {
      newStreak = p.streak;
    } else if (p.lastActiveDate === yesterday) {
      newStreak = p.streak + 1;
    } else {
      newStreak = 1;
    }

    // Weighted accuracy: blend old accuracy with new answers
    let newAccuracy = p.accuracy;
    if (totalAnswers > 0) {
      const prevWeight = p.questionsSolved;
      const newWeight = totalAnswers;
      const prevAccuracy = p.accuracy;
      const newAnswerAccuracy = (correctAnswers / totalAnswers) * 100;
      newAccuracy = (prevAccuracy * prevWeight + newAnswerAccuracy * newWeight) / (prevWeight + newWeight);
    }

    const newChapters = chapterCompleted ? p.chaptersCompleted + 1 : p.chaptersCompleted;

    // First write of a new week: freeze the running total as this week's
    // starting line, so weekly XP restarts from zero for everyone at once.
    const weekAnchor = getWeekAnchor();
    const rollWeek = p.weekAnchorDate !== weekAnchor;

    const [updated] = await db
      .update(studentProgressTable)
      .set({
        xp: newXp,
        streak: newStreak,
        questionsSolved: newSolved,
        accuracy: newAccuracy,
        chaptersCompleted: newChapters,
        lastActiveDate: today,
        weekAnchorDate: weekAnchor,
        weekAnchorXp: rollWeek ? p.xp : p.weekAnchorXp,
        updatedAt: new Date(),
      })
      .where(eq(studentProgressTable.sessionId, sessionId))
      .returning();
    existing = [updated];
  }

  const p = existing[0];

  const todayStart = istDayStart();
  const todayActivity = await db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.sessionId, sessionId), gte(activityTable.createdAt, todayStart)));

  res.json({
    sessionId: p.sessionId,
    xp: p.xp,
    streak: p.streak,
    questionsSolved: p.questionsSolved,
    questionsToday: todayActivity.length,
    dailyGoal: p.dailyGoal,
    accuracy: p.accuracy,
    chaptersCompleted: p.chaptersCompleted,
    lastActiveDate: p.lastActiveDate,
  });
});

// GET /api/progress/activity
router.get("/progress/activity", async (req, res) => {
  const { limit } = req.query;
  const sessionId = resolveOwnerKey(req, req.query["sessionId"]);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const limitNum = limit && typeof limit === "string" ? parseInt(limit, 10) : 10;

  const activities = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.sessionId, sessionId))
    .orderBy(desc(activityTable.createdAt))
    .limit(limitNum);

  res.json(
    activities.map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      question: a.question,
      subject: a.subject,
      classLevel: a.classLevel,
      answerSource: a.answerSource ?? null,
      createdAt: a.createdAt.toISOString(),
    }))
  );
});

// POST /api/progress/activity
router.post("/progress/activity", async (req, res) => {
  const { question, subject, classLevel, answerSource } = req.body;
  const sessionId = resolveOwnerKey(req, req.body?.sessionId);

  if (!sessionId || !question || !subject || !classLevel) {
    res.status(400).json({ error: "sessionId, question, subject, and classLevel are required" });
    return;
  }

  const [activity] = await db
    .insert(activityTable)
    .values({ sessionId, question, subject, classLevel, answerSource })
    .returning();

  res.status(201).json({
    id: activity.id,
    sessionId: activity.sessionId,
    question: activity.question,
    subject: activity.subject,
    classLevel: activity.classLevel,
    answerSource: activity.answerSource ?? null,
    createdAt: activity.createdAt.toISOString(),
  });
});

export default router;
