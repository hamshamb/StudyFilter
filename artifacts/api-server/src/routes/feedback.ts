import { Router } from "express";
import type { Logger } from "pino";
import { db, feedbackTable } from "@workspace/db";
import { resolveOwnerKey } from "../lib/owner";
import { isMailConfigured, sendMail, supportAddress } from "../lib/mailer";

const router = Router();

const CATEGORIES = new Set([
  "wrong_answer",
  "broken_pdf",
  "bug",
  "suggestion",
  "other",
]);

/** Mirrors the labels in FeedbackDialog, so the email reads like the form did. */
const CATEGORY_LABELS: Record<string, string> = {
  wrong_answer: "An answer looks wrong",
  broken_pdf: "A PDF is missing or won't open",
  bug: "Something is broken",
  suggestion: "A suggestion",
  other: "Something else",
};

/**
 * Per-reporter email throttle.
 *
 * This is a public, unauthenticated endpoint that now triggers outbound mail,
 * which makes it a way to flood the support inbox. The *report* is never
 * dropped — the row is always written — only the notification is rate
 * limited, so nothing a student says is ever lost to this.
 *
 * In-memory is sufficient: the API server is a single long-lived process, and
 * the worst case on restart is a few extra emails.
 */
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAILS_PER_WINDOW = 5;
const recentEmails = new Map<string, number[]>();

function mayEmail(ownerKey: string): boolean {
  const now = Date.now();
  const seen = (recentEmails.get(ownerKey) ?? []).filter((t) => now - t < EMAIL_WINDOW_MS);
  if (seen.length >= EMAILS_PER_WINDOW) {
    recentEmails.set(ownerKey, seen);
    return false;
  }
  seen.push(now);
  recentEmails.set(ownerKey, seen);

  // Keep the map from growing without bound on a long-running server.
  if (recentEmails.size > 5_000) {
    for (const [key, times] of recentEmails) {
      if (times.every((t) => now - t >= EMAIL_WINDOW_MS)) recentEmails.delete(key);
    }
  }
  return true;
}

interface FeedbackRow {
  id: number;
  sessionId: string;
  category: string;
  message: string;
  pageContext: string | null;
  contextJson: string | null;
}

function composeEmail(row: FeedbackRow): { subject: string; text: string } {
  const label = CATEGORY_LABELS[row.category] ?? row.category;
  const where = row.pageContext ?? "unknown page";
  const signedIn = row.sessionId.startsWith("clerk:");

  const lines = [
    `Category:  ${label}`,
    `Page:      ${where}`,
    `Reporter:  ${row.sessionId} (${signedIn ? "signed in" : "anonymous"})`,
    `Feedback #${row.id}`,
    "",
    "─".repeat(60),
    row.message,
    "─".repeat(60),
  ];

  if (row.contextJson) {
    lines.push("", `Context: ${row.contextJson}`);
  }

  lines.push(
    "",
    "This report is stored in the feedback table. To see everything waiting:",
    "  select created_at, category, message, page_context from feedback",
    "  where status = 'new' order by created_at desc;",
  );

  return {
    subject: `[StudyFilter] ${label} — ${where}`,
    text: lines.join("\n"),
  };
}

/**
 * Fired after the response has gone out. The row is already committed and is
 * the system of record, so a slow or failing mail hop must never make a
 * student's report look like it failed.
 */
async function notifySupport(row: FeedbackRow, log: Logger): Promise<void> {
  if (!isMailConfigured()) {
    log.warn(
      { feedbackId: row.id },
      "feedback saved but RESEND_API_KEY is unset — no email sent",
    );
    return;
  }
  if (!mayEmail(row.sessionId)) {
    log.warn(
      { feedbackId: row.id, sessionId: row.sessionId },
      "feedback saved but email throttled for this reporter",
    );
    return;
  }

  const { subject, text } = composeEmail(row);
  const result = await sendMail({ to: supportAddress(), subject, text });
  if (!result.ok) {
    log.error({ feedbackId: row.id, err: result.error }, "feedback email failed to send");
  }
}

router.post("/feedback", async (req, res) => {
  try {
    const { category, message, pageContext, context } = req.body;
    // Attribute reports to the signed-in user when there is one, so a reply is
    // possible and repeat reporters are recognisable across devices.
    const sessionId = resolveOwnerKey(req, req.body?.sessionId);

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }
    if (typeof category !== "string" || !CATEGORIES.has(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }
    const trimmed = typeof message === "string" ? message.trim() : "";
    if (trimmed.length < 5) {
      res.status(400).json({ error: "Please add a few more words so we know what happened" });
      return;
    }
    if (trimmed.length > 2000) {
      res.status(400).json({ error: "Message is too long" });
      return;
    }

    const values = {
      sessionId,
      category,
      message: trimmed,
      pageContext: typeof pageContext === "string" ? pageContext.slice(0, 500) : null,
      contextJson: context ? JSON.stringify(context).slice(0, 2000) : null,
    };

    // `returning` so the notification can cite the row, making an email and a
    // database record trivially matchable when triaging.
    const [inserted] = await db.insert(feedbackTable).values(values).returning({
      id: feedbackTable.id,
    });

    res.status(201).json({ ok: true });

    const log = req.log;
    void notifySupport({ ...values, id: inserted?.id ?? 0 }, log).catch((err) => {
      log.error(err, "feedback notification threw");
    });
  } catch (err) {
    req.log.error(err, "feedback submit error");
    res.status(500).json({ error: "Could not save your report. Please try again." });
  }
});

export default router;
