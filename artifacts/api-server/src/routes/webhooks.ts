import { Router } from "express";
import type { Logger } from "pino";
import { eq } from "drizzle-orm";
import { db, inboundEmailTable } from "@workspace/db";
import { verifySvixSignature } from "../lib/svix";
import { isMailConfigured, sendMail, supportAddress } from "../lib/mailer";

const router = Router();

/**
 * contact.studyfilter.online receives mail through Resend, not a mailbox
 * anyone can log into. Every message that arrives fires this webhook —
 * this is the only thing that makes that address behave like an inbox at
 * all: it verifies the request came from Resend, stores the message, and
 * relays it to a real address.
 *
 * Resend's inbound event ships as `email.received`, delivered through Svix
 * — see lib/svix.ts for why that's a Resend-specific detail worth knowing.
 * Resend has not published the exact field layout of an `email.received`
 * payload, so field extraction below is best-effort: every value falls
 * back to something rather than throwing, and the untouched payload is
 * always stored in `rawPayload` regardless of whether extraction guessed
 * right. If the extracted columns come back empty once real mail is
 * flowing, `rawPayload` on that row is the ground truth for correcting it.
 */

function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/** `to` may be a bare string, an {email} object, or an array of either. */
function firstAddress(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstAddress(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return firstString(obj.email, obj.address);
  }
  return null;
}

interface ExtractedEmail {
  resendEmailId: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
}

/** Caps mirror feedback.ts's message bound — generous for a report, not unbounded for storage. */
const MAX_TEXT_LEN = 20_000;

function extractEmail(data: Record<string, unknown>): ExtractedEmail {
  return {
    resendEmailId: firstString(data.email_id, data.id, data.message_id),
    fromAddress: firstAddress(data.from) ?? firstAddress((data.envelope as Record<string, unknown> | undefined)?.from),
    toAddress: firstAddress(data.to) ?? firstAddress((data.envelope as Record<string, unknown> | undefined)?.to),
    subject: firstString(data.subject)?.slice(0, 500) ?? null,
    textBody: firstString(data.text, data.text_body)?.slice(0, MAX_TEXT_LEN) ?? null,
    htmlBody: firstString(data.html, data.html_body)?.slice(0, MAX_TEXT_LEN) ?? null,
  };
}

function composeRelay(row: { id: number; fromAddress: string | null; subject: string | null; textBody: string | null }, rawPayload: unknown): { subject: string; text: string } {
  const from = row.fromAddress ?? "unknown sender";
  const subject = row.subject ?? "(no subject)";
  const body = row.textBody ?? "(no plain-text body in this payload — see the raw JSON below)";

  return {
    subject: `[StudyFilter inbox] ${subject}`,
    text: [
      `From: ${from}`,
      `Inbound email #${row.id}`,
      "",
      "─".repeat(60),
      body,
      "─".repeat(60),
      "",
      "This address (contact.studyfilter.online) has no real mailbox — replying",
      "here will not reach the original sender unless the row above shows a",
      "usable From address.",
      "",
      "Raw payload, for anything the extraction above missed:",
      JSON.stringify(rawPayload, null, 2).slice(0, 4_000),
    ].join("\n"),
  };
}

async function relay(
  row: { id: number; fromAddress: string | null; subject: string | null; textBody: string | null },
  rawPayload: unknown,
  log: Logger,
): Promise<void> {
  if (!isMailConfigured()) {
    log.warn({ inboundEmailId: row.id }, "inbound email stored but RESEND_API_KEY is unset — not relayed");
    return;
  }
  const { subject, text } = composeRelay(row, rawPayload);
  const result = await sendMail({ to: supportAddress(), subject, text });
  if (!result.ok) {
    log.error({ inboundEmailId: row.id, err: result.error }, "inbound email relay failed to send");
    return;
  }
  await db
    .update(inboundEmailTable)
    .set({ relayedAt: new Date() })
    .where(eq(inboundEmailTable.id, row.id));
}

router.post("/webhooks/resend-inbound", async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    req.log.error("RESEND_WEBHOOK_SECRET is not set — rejecting inbound webhook");
    res.status(500).json({ error: "webhook not configured" });
    return;
  }
  if (!req.rawBody) {
    // Should be unreachable — app.ts always sets this for a JSON request —
    // but a signature can't be checked against a body we didn't capture,
    // and failing open here would mean an unverified request gets processed.
    req.log.error("no rawBody captured — cannot verify webhook signature");
    res.status(500).json({ error: "internal error" });
    return;
  }

  const verdict = verifySvixSignature(req.rawBody, {
    id: req.header("svix-id"),
    timestamp: req.header("svix-timestamp"),
    signature: req.header("svix-signature"),
  }, secret);

  if (!verdict.ok) {
    req.log.warn({ reason: verdict.reason }, "inbound webhook signature rejected");
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  const body = req.body as { type?: string; data?: Record<string, unknown> };

  // Acknowledge immediately once the signature is verified. Anything else
  // this endpoint is ever subscribed to that isn't inbound mail is simply
  // not our concern, and Resend has no reason to retry it.
  if (body?.type !== "email.received") {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const extracted = extractEmail(body.data ?? {});
    const [inserted] = await db
      .insert(inboundEmailTable)
      .values({ ...extracted, rawPayload: body })
      .returning({ id: inboundEmailTable.id });

    res.status(200).json({ ok: true });

    if (inserted) {
      const row = { id: inserted.id, fromAddress: extracted.fromAddress, subject: extracted.subject, textBody: extracted.textBody };
      void relay(row, body, req.log).catch((err) => {
        req.log.error(err, "inbound email relay threw");
      });
    }
  } catch (err) {
    req.log.error(err, "inbound webhook processing error");
    // Signature already verified — a storage failure here is ours, not a
    // reason for Resend to keep retrying an event it delivered correctly.
    res.status(200).json({ ok: false });
  }
});

export default router;
