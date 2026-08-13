import { Router } from "express";
import { db } from "@workspace/db";
import {
  mockAttemptsTable,
  quizAttemptsTable,
  studentProgressTable,
  xpEventsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { resolveOwnerKey } from "../lib/owner";
import {
  DAILY_XP_CAP,
  flatPrice,
  priceMock,
  priceQuiz,
  type XpEventType,
} from "../lib/xp";
import { istDayKey, istDayKeyAgo, istDayStart, istWeekAnchorKey } from "../lib/day";

const router = Router();

// IST, not UTC — the daily XP cap and the streak both hang off these, so a
// 5.5-hour offset meant both rolled over at 5:30 AM local. See lib/day.ts.
const todayStart = (): Date => istDayStart();
const weekAnchor = (): string => istWeekAnchorKey();
const todayIso = (): string => istDayKey();
const yesterdayIso = (): string => istDayKeyAgo(1);

/** XP already awarded to this owner today, for the daily cap. */
async function xpEarnedToday(ownerKey: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${xpEventsTable.xpAwarded}), 0)` })
    .from(xpEventsTable)
    .where(
      and(
        eq(xpEventsTable.sessionId, ownerKey),
        gte(xpEventsTable.createdAt, todayStart()),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Applies an XP award and the streak/accuracy bookkeeping that goes with it.
 * Mirrors the logic in PUT /api/progress so both paths stay consistent.
 */
async function applyProgress(
  ownerKey: string,
  xp: number,
  opts: { questionsSolved?: number; correct?: number; total?: number },
) {
  const today = todayIso();
  const yesterday = yesterdayIso();
  const anchor = weekAnchor();

  const [existing] = await db
    .select()
    .from(studentProgressTable)
    .where(eq(studentProgressTable.sessionId, ownerKey))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(studentProgressTable)
      .values({
        sessionId: ownerKey,
        xp,
        streak: 1,
        questionsSolved: opts.questionsSolved ?? 0,
        dailyGoal: 5,
        accuracy:
          opts.total && opts.total > 0 ? ((opts.correct ?? 0) / opts.total) * 100 : 0,
        chaptersCompleted: 0,
        lastActiveDate: today,
        weekAnchorDate: anchor,
        weekAnchorXp: 0,
      })
      .returning();
    return created;
  }

  const p = existing;
  const streak =
    p.lastActiveDate === today
      ? p.streak
      : p.lastActiveDate === yesterday
        ? p.streak + 1
        : 1;

  let accuracy = p.accuracy;
  if (opts.total && opts.total > 0) {
    const prevWeight = p.questionsSolved;
    const newAccuracy = ((opts.correct ?? 0) / opts.total) * 100;
    accuracy =
      (p.accuracy * prevWeight + newAccuracy * opts.total) / (prevWeight + opts.total);
  }

  const rollWeek = p.weekAnchorDate !== anchor;

  const [updated] = await db
    .update(studentProgressTable)
    .set({
      xp: p.xp + xp,
      streak,
      questionsSolved: p.questionsSolved + (opts.questionsSolved ?? 0),
      accuracy,
      lastActiveDate: today,
      weekAnchorDate: anchor,
      weekAnchorXp: rollWeek ? p.xp : p.weekAnchorXp,
      updatedAt: new Date(),
    })
    .where(eq(studentProgressTable.sessionId, ownerKey))
    .returning();
  return updated;
}

/**
 * POST /api/events
 *
 * The single way XP is earned. The client reports WHAT happened; the server
 * decides what it is worth. Bodies never contain an XP amount.
 */
router.post("/events", async (req, res) => {
  try {
    const ownerKey = resolveOwnerKey(req, req.body?.sessionId);
    if (!ownerKey) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const type = req.body?.type as XpEventType | undefined;
    if (!type) {
      res.status(400).json({ error: "type is required" });
      return;
    }

    let xp = 0;
    let detail: string | null = null;
    let progressOpts: { questionsSolved?: number; correct?: number; total?: number } = {};

    switch (type) {
      case "quiz_completed": {
        const { source, subject, chapter, difficulty, totalQuestions, correctAnswers, timeTakenSeconds } =
          req.body ?? {};
        const priced = priceQuiz(Number(totalQuestions), Number(correctAnswers));
        if (priced === null) {
          res.status(400).json({ error: "Invalid quiz result" });
          return;
        }
        xp = priced;
        detail = `${subject ?? "?"}/${chapter ?? "?"}`;
        progressOpts = {
          questionsSolved: Number(totalQuestions),
          correct: Number(correctAnswers),
          total: Number(totalQuestions),
        };

        await db.insert(quizAttemptsTable).values({
          sessionId: ownerKey,
          source: typeof source === "string" ? source : "practice",
          subject: typeof subject === "string" ? subject : null,
          chapter: typeof chapter === "string" ? chapter : null,
          difficulty: typeof difficulty === "string" ? difficulty : null,
          totalQuestions: Number(totalQuestions),
          correctAnswers: Number(correctAnswers),
          accuracy: Number(correctAnswers) / Number(totalQuestions),
          timeTakenSeconds: Number.isFinite(Number(timeTakenSeconds))
            ? Math.max(0, Math.min(86400, Number(timeTakenSeconds)))
            : 0,
          xpEarned: xp,
        });
        break;
      }

      case "mock_submitted": {
        // Priced from the stored attempt, not from anything the client claims.
        const attemptId = Number(req.body?.attemptId);
        if (!Number.isFinite(attemptId)) {
          res.status(400).json({ error: "attemptId is required" });
          return;
        }
        const [attempt] = await db
          .select()
          .from(mockAttemptsTable)
          .where(
            and(
              eq(mockAttemptsTable.id, attemptId),
              eq(mockAttemptsTable.sessionId, ownerKey),
            ),
          )
          .limit(1);
        if (!attempt) {
          res.status(404).json({ error: "Attempt not found" });
          return;
        }
        // Award once per attempt.
        const [already] = await db
          .select({ id: xpEventsTable.id })
          .from(xpEventsTable)
          .where(
            and(
              eq(xpEventsTable.sessionId, ownerKey),
              eq(xpEventsTable.eventType, "mock_submitted"),
              eq(xpEventsTable.detail, `attempt:${attemptId}`),
            ),
          )
          .limit(1);
        if (already) {
          res.json({ xpAwarded: 0, reason: "already-awarded" });
          return;
        }
        xp = priceMock(attempt.accuracy);
        detail = `attempt:${attemptId}`;
        break;
      }

      case "doubt_answered":
      case "practice_session":
      case "focus_session": {
        xp = flatPrice(type);
        detail = typeof req.body?.subject === "string" ? req.body.subject : null;
        if (type === "doubt_answered") progressOpts = { questionsSolved: 1 };
        break;
      }

      default:
        res.status(400).json({ error: "Unknown event type" });
        return;
    }

    // Daily ceiling — clamp rather than reject, so a genuine heavy day still
    // records the activity, it just stops adding to the score.
    const earned = await xpEarnedToday(ownerKey);
    const remaining = Math.max(0, DAILY_XP_CAP - earned);
    const awarded = Math.min(xp, remaining);

    if (awarded > 0) {
      await db.insert(xpEventsTable).values({
        sessionId: ownerKey,
        eventType: type,
        xpAwarded: awarded,
        detail,
      });
    }

    const progress = await applyProgress(ownerKey, awarded, progressOpts);

    res.json({
      xpAwarded: awarded,
      cappedForToday: awarded < xp,
      progress: progress
        ? { xp: progress.xp, streak: progress.streak, accuracy: progress.accuracy }
        : null,
    });
  } catch (err) {
    req.log.error(err, "events error");
    res.status(500).json({ error: "Could not record that" });
  }
});

export default router;
