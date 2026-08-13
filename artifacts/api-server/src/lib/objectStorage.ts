/**
 * Replit Object Storage access for the PDF library.
 *
 * All study PDFs (NCERT books, board papers, sample papers, marking schemes,
 * exemplars) live in the bucket declared under [objectStorage] in .replit —
 * NOT on the local filesystem. They used to be read from `data/pdfs` via
 * process.cwd(), which resolved correctly in dev (cwd = the artifact dir) but
 * pointed at the repo root in production, so every PDF 404'd on the live site.
 * Shipping ~1.1 GB of PDFs in the deploy image also blew past the registry's
 * blob size limit and broke deploys outright.
 *
 * Object keys mirror the old on-disk layout so existing `storedFileKey` values
 * keep working unchanged, e.g.:
 *   selfstudys/pyq/mathematics_2024_...pdf
 *   selfstudys/exemplar/science_1-a-letter-to-god_...pdf
 *   ncert/...pdf
 */

import { Client } from "@replit/object-storage";

let cached: Client | null = null;

/** Lazily constructed so importing this module never throws at startup. */
export function objectStorage(): Client {
  if (!cached) {
    // No options — the SDK picks up the default bucket from .replit.
    cached = new Client();
  }
  return cached;
}

/**
 * Normalises an untrusted, URL-supplied file key into a safe object key.
 *
 * Object Storage has no directory traversal in the filesystem sense, but a key
 * containing `..` or a leading slash would still let a caller probe for objects
 * outside the intended prefixes, so reject those. Only PDFs are servable.
 *
 * Returns null when the key is unusable.
 */
export function safeObjectKey(rawKey: string): string | null {
  if (!rawKey) return null;

  // Callers may pass the key percent-encoded (Library.tsx does not, MockExamPicker
  // does). Decoding a key that contains a stray '%' throws, so guard it.
  let key: string;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    key = rawKey;
  }

  key = key.replace(/^\/+/, "").trim();
  if (!key) return null;
  if (key.includes("\0")) return null;
  if (key.split("/").some((seg) => seg === "." || seg === "..")) return null;
  if (!/\.pdf$/i.test(key)) return null;

  return key;
}

/**
 * Reads an object's bytes, returning null when it cannot be read.
 *
 * Deliberately does NOT pre-check with `exists()`. In this bucket `exists()`
 * reports false for objects that `list()` returns and `downloadAsBytes()` reads
 * back fine, so gating downloads on it 404'd every PDF in production. Reading
 * once and inspecting the Result is both correct and a round trip cheaper.
 *
 * Every PDF in the library is under 10 MB, so buffering is acceptable and gives
 * us a real Content-Length. Revisit if larger files ever land here.
 */
export async function downloadBytes(
  key: string,
): Promise<{ bytes: Buffer | null; error?: string }> {
  const { ok, value, error } = await objectStorage().downloadAsBytes(key);
  if (!ok || !value) return { bytes: null, error: String(error ?? "unknown") };

  // downloadAsBytes has returned a single-element Buffer[] in some SDK
  // versions; normalise both shapes rather than trusting one.
  const bytes = Array.isArray(value) ? value[0] : value;
  return bytes ? { bytes } : { bytes: null, error: "empty result" };
}

/** Lists object keys under a prefix, e.g. "selfstudys/pyq/". */
export async function listObjectKeys(prefix: string): Promise<string[]> {
  const { ok, value, error } = await objectStorage().list({ prefix });
  if (!ok || !value) {
    throw new Error(`Object Storage list failed for "${prefix}": ${String(error)}`);
  }
  // Filter defensively in case the backend ignores the prefix option.
  return value
    .map((obj) => obj.name)
    .filter((name) => name.startsWith(prefix) && /\.pdf$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
}
