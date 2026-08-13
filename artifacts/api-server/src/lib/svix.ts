import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Resend webhook signature.
 *
 * Resend delivers webhooks (including inbound email) through Svix, and
 * signs them with Svix's scheme rather than a Resend-specific one:
 *
 *   1. secret is `whsec_<base64>` — the part after the prefix is the actual
 *      HMAC key, base64-decoded.
 *   2. the signed content is `{svix-id}.{svix-timestamp}.{raw body}`,
 *      joined with literal periods. This must be the exact bytes Resend
 *      sent — re-serializing a parsed-and-reparsed JSON body changes
 *      whitespace and key order and breaks the signature.
 *   3. HMAC-SHA256(key, content), base64-encoded, is the expected signature.
 *   4. svix-signature holds one or more space-separated `v1,<sig>` tokens
 *      (multiple only during Svix's own secret-rotation window) — a match
 *      against any one of them is a pass.
 *
 * Implemented by hand against Svix's own documented algorithm rather than
 * pulling in the `svix` package for a single HMAC comparison — this route
 * needed no other functionality from that library.
 */

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

function decodeSecret(secret: string): Buffer {
  const withoutPrefix = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(withoutPrefix, "base64");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch rather than returning false,
  // and a length difference is itself not secret, so short-circuit first.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifySvixSignature(
  rawBody: Buffer,
  headers: SvixHeaders,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): VerifyResult {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing svix-id, svix-timestamp or svix-signature header" };
  }

  // Bounds the window a captured request could be replayed in. Svix
  // recommends this check as a companion to the signature itself, not a
  // substitute for it.
  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) {
    return { ok: false, reason: "svix-timestamp is not a number" };
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - tsSeconds);
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: `svix-timestamp outside tolerance (${Math.round(ageSeconds)}s)` };
  }

  const key = decodeSecret(secret);
  const signedContent = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  const candidates = signature.split(" ").filter(Boolean);
  for (const candidate of candidates) {
    const [version, sig] = candidate.split(",", 2);
    if (version !== "v1" || !sig) continue;
    if (safeEqual(sig, expected)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: "no matching v1 signature" };
}
