import { Router } from "express";
import { db } from "@workspace/db";
import {
  activityTable,
  mockAttemptsTable,
  quizAttemptsTable,
  studentProgressTable,
  xpEventsTable,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { resolveOwnerKey } from "../lib/owner";
import { istDayKey, istDayStartAgo } from "../lib/day";

const router = Router();

// Buckets are IST calendar days, so the trend chart lines up with the streak
// and daily goal rather than being shifted 5.5 hours from them.
const daysAgo = (n: number): Date => istDayStartAgo(n);
const isoDay = (d: Date): string => istDayKey(d);

/**
 * GET /api/analytics
 *
 * One request backing the whole dashboard. Quizzes, mock exams and answered
 * doubts were previously three unconnected things — XP was the only number
 * that combined them, and it says nothing about *what* a student is weak at.
 * This joins them so the dashboard can answer the questions that actually
 * change what someone studies next: which subject is slipping, which chapters
 * keep going wrong, and whether accuracy is moving.
 */
router.get("/analytics", async (req, res) => {
  try {
    const ownerKey = resolveOwnerKey(req, req.query["sessionId"]);
    if (!ownerKey) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const since = daysAgo(29);

    const [progress] = await db
      .select()
      .from(studentProgressTable)
      .where(eq(studentProgressTable.sessionId, ownerKey))
      .limit(1);

    const [quizzes, mocks, doubts, xpEvents] = await Promise.all([
      db
        .select()
        .from(quizAttemptsTable)
        .where(
          and(
            eq(quizAttemptsTable.sessionId, ownerKey),
            gte(quizAttemptsTable.createdAt, since),
          ),
        )
        .orderBy(desc(quizAttemptsTable.createdAt)),
      db
        .select()
        .from(mockAttemptsTable)
        .where(
          and(
            eq(mockAttemptsTable.sessionId, ownerKey),
            gte(mockAttemptsTable.createdAt, since),
          ),
        )
        .orderBy(desc(mockAttemptsTable.createdAt)),
      db
        .select()
        .from(activityTable)
        .where(
          and(
            eq(activityTable.sessionId, ownerKey),
            gte(activityTable.createdAt, since),
          ),
        ),
      db
        .select()
        .from(xpEventsTable)
        .where(
          and(
            eq(xpEventsTable.sessionId, ownerKey),
            gte(xpEventsTable.createdAt, since),
          ),
        ),
    ]);

    // ── Per-subject rollup across quizzes AND mocks ────────────────────────
    const bySubject = new Map<
      string,
      { subject: string; attempts: number; correct: number; total: number; mockMarks: number; mockTotal: number }
    >();

    function bucket(subject: string | null) {
      const key = subject?.trim() || "Unspecified";
      if (!bySubject.has(key)) {
        bySubject.set(key, {
          subject: key,
          attempts: 0,
          correct: 0,
          total: 0,
          mockMarks: 0,
          mockTotal: 0,
        });
      }
      return bySubject.get(key)!;
    }

    for (const q of quizzes) {
      const b = bucket(q.subject);
      b.attempts += 1;
      b.correct += q.correctAnswers;
      b.total += q.totalQuestions;
    }
    for (const m of mocks) {
      const b = bucket(m.subject);
      b.attempts += 1;
      if (typeof m.obtainedMarks === "number" && typeof m.totalMarks === "number") {
        b.mockMarks += m.obtainedMarks;
        b.mockTotal += m.totalMarks;
      }
    }

    const subjects = [...bySubject.values()]
      .map((b) => {
        // Blend quiz accuracy with mock percentage when both exist — a student
        // who aces quizzes but stalls in timed mocks is a different problem
        // from one who is simply behind, and the dashboard should show that.
        const quizAcc = b.total > 0 ? b.correct / b.total : null;
        const mockAcc = b.mockTotal > 0 ? b.mockMarks / b.mockTotal : null;
        const combined =
          quizAcc !== null && mockAcc !== null
            ? (quizAcc + mockAcc) / 2
            : (quizAcc ?? mockAcc);
        return {
          subject: b.subject,
          attempts: b.attempts,
          quizAccuracy: quizAcc,
          mockAccuracy: mockAcc,
          accuracy: combined,
        };
      })
      .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1));

    // ── Chapters that keep going wrong ─────────────────────────────────────
    const byChapter = new Map<string, { subject: string; chapter: string; correct: number; total: number }>();
    for (const q of quizzes) {
      if (!q.chapter) continue;
      const key = `${q.subject ?? "?"}::${q.chapter}`;
      const c = byChapter.get(key) ?? {
        subject: q.subject ?? "?",
        chapter: q.chapter,
        correct: 0,
        total: 0,
      };
      c.correct += q.correctAnswers;
      c.total += q.totalQuestions;
      byChapter.set(key, c);
    }
    const weakChapters = [...byChapter.values()]
      .filter((c) => c.total >= 3) // ignore one-off noise
      .map((c) => ({ ...c, accuracy: c.correct / c.total }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    // ── Daily activity for the trend chart ─────────────────────────────────
    const days: { date: string; xp: number; questions: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      days.push({ date: isoDay(daysAgo(i)), xp: 0, questions: 0 });
    }
    const dayIndex = new Map(days.map((d, i) => [d.date, i]));

    for (const e of xpEvents) {
      const i = dayIndex.get(isoDay(e.createdAt));
      if (i !== undefined) days[i]!.xp += e.xpAwarded;
    }
    for (const q of quizzes) {
      const i = dayIndex.get(isoDay(q.createdAt));
      if (i !== undefined) days[i]!.questions += q.totalQuestions;
    }
    for (const d of doubts) {
      const i = dayIndex.get(isoDay(d.createdAt));
      if (i !== undefined) days[i]!.questions += 1;
    }

    const quizQuestions = quizzes.reduce((s, q) => s + q.totalQuestions, 0);
    const quizCorrect = quizzes.reduce((s, q) => s + q.correctAnswers, 0);

    res.json({
      progress: progress
        ? {
            xp: progress.xp,
            streak: progress.streak,
            questionsSolved: progress.questionsSolved,
            accuracy: progress.accuracy,
            chaptersCompleted: progress.chaptersCompleted,
          }
        : null,
      totals: {
        quizAttempts: quizzes.length,
        quizQuestions,
        quizAccuracy: quizQuestions > 0 ? quizCorrect / quizQuestions : null,
        mockAttempts: mocks.length,
        doubtsAsked: doubts.length,
        xp30d: xpEvents.reduce((s, e) => s + e.xpAwarded, 0),
      },
      subjects,
      weakChapters,
      days,
      recentMocks: mocks.slice(0, 5).map((m) => ({
        id: m.id,
        subject: m.subject,
        year: m.year,
        obtainedMarks: m.obtainedMarks,
        totalMarks: m.totalMarks,
        accuracy: m.accuracy,
        timeTakenSeconds: m.timeTakenSeconds,
        submittedAt: m.submittedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err, "analytics error");
    res.status(500).json({ error: "Could not load your analytics" });
  }
});

export default router;
