import { Router } from "express";
import { db } from "@workspace/db";
import { mockAttemptsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

import { resolveOwnerKey } from "../lib/owner";

const router = Router();

router.post("/mock/attempts", async (req, res) => {
  try {
    const {
      sessionId,
      subject,
      year,
      paperType,
      questionPaperUrl,
      status,
      startedAt,
      timeTakenSeconds,
      totalMarks,
      obtainedMarks,
      xpEarned,
      sectionScores,
      paletteSnapshot,
      writtenAnswers,
    } = req.body as {
      sessionId: string;
      subject: string;
      year: number;
      paperType?: string;
      questionPaperUrl?: string;
      status?: string;
      startedAt: string;
      timeTakenSeconds: number;
      totalMarks?: number;
      obtainedMarks?: number;
      xpEarned: number;
      sectionScores?: Record<string, { obtained: number; total: number }>;
      paletteSnapshot?: string[];
      writtenAnswers?: string;
    };

    const ownerKey = resolveOwnerKey(req, sessionId);
    if (!ownerKey || !subject || !year || !startedAt) {
      res.status(400).json({ error: "sessionId, subject, year, startedAt are required" });
      return;
    }

    const accuracy =
      typeof obtainedMarks === "number" && typeof totalMarks === "number" && totalMarks > 0
        ? Math.round((obtainedMarks / totalMarks) * 1000) / 1000
        : null;

    const [attempt] = await db
      .insert(mockAttemptsTable)
      .values({
        sessionId: ownerKey,
        subject,
        year,
        paperType: paperType ?? "previous_year",
        questionPaperUrl: questionPaperUrl ?? null,
        status: status ?? "completed",
        startedAt: new Date(startedAt),
        timeTakenSeconds: timeTakenSeconds ?? 0,
        totalMarks: totalMarks ?? null,
        obtainedMarks: obtainedMarks ?? null,
        accuracy: accuracy ?? null,
        xpEarned: xpEarned ?? 0,
        sectionScores: sectionScores ?? null,
        paletteSnapshot: paletteSnapshot ?? null,
        writtenAnswers: writtenAnswers ?? null,
      })
      .returning();

    res.status(201).json({ attempt });
  } catch (err) {
    req.log.error(err, "mock/attempts POST error");
    res.status(500).json({ error: "Failed to save attempt" });
  }
});

router.get("/mock/attempts", async (req, res) => {
  try {
    const { subject } = req.query;
    const sessionId = resolveOwnerKey(req, req.query["sessionId"]);

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const conditions = [eq(mockAttemptsTable.sessionId, sessionId)];
    if (typeof subject === "string" && subject) {
      conditions.push(eq(mockAttemptsTable.subject, subject));
    }

    const attempts = await db
      .select()
      .from(mockAttemptsTable)
      .where(and(...conditions))
      .orderBy(desc(mockAttemptsTable.submittedAt))
      .limit(50);

    res.json({ attempts });
  } catch (err) {
    req.log.error(err, "mock/attempts GET error");
    res.status(500).json({ error: "Failed to load attempts" });
  }
});

export default router;
