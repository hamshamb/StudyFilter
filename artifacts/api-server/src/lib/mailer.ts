/**
 * Outbound email, via Resend's REST API.
 *
 * Deliberately dependency-free. Node has global fetch and Resend's send
 * endpoint is a single POST, so the `resend` package would buy nothing except
 * another decision about esbuild externals — the exact class of mistake that
 * broke this server's startup once already with @replit/object-storage.
 *
 * Everything here is best-effort. If the key is missing or Resend is down,
 * callers must still succeed: mail is a notification, never the system of
 * record. The database row is what actually holds the report.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Bounded so a hanging mail hop can't pin a request handler open. Callers
 * fire this after responding, so the student never waits on it either way.
 */
const SEND_TIMEOUT_MS = 8_000;

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Where a reply should go, if it shouldn't go to the From address. */
  replyTo?: string;
}

export interface MailResult {
  ok: boolean;
  error?: string;
}

/**
 * Must be an address on a domain verified in the Resend dashboard — Resend
 * rejects sends from unverified domains outright.
 *
 * Note the `contact.` subdomain. The verified domain is
 * contact.studyfilter.online, not the root: sending reputation is kept off
 * the apex so a spam complaint here can never affect anything else the
 * domain does. An address at the root would be rejected.
 */
export function mailFrom(): string {
  return process.env.FEEDBACK_FROM ?? "StudyFilter <feedback@contact.studyfilter.online>";
}

/**
 * Where reports land. Overridable because the destination is a normal
 * mailbox with no relationship to the verified sending domain — point it at
 * any address that actually receives mail.
 */
export function supportAddress(): string {
  return process.env.SUPPORT_EMAIL ?? "support@studyfilter.online";
}

/** False when RESEND_API_KEY is unset — the local and preview default. */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Resend puts the actual reason in the body — an unverified sending
      // domain and a bad key both surface as 4xx and are easy to confuse.
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend responded ${res.status}: ${body.slice(0, 300)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
