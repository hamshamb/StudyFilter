import { Router } from "express";
import { db } from "@workspace/db";
import { examPapersTable, markingSchemesTable, ncertBooksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import path from "path";
import { downloadBytes, safeObjectKey } from "../lib/objectStorage";

const router = Router();

// Map API query param values (from OpenAPI spec) → DB stored values
const PAPER_TYPE_MAP: Record<string, string> = {
  previous_year: "PYQ",
  sample_paper: "Sample",
  marking_scheme: "MarkingScheme",
  mock_exam: "MockExam",
};

router.get("/library/papers", async (req, res) => {
  try {
    const { subject, year, paperType } = req.query;
    const conditions = [];
    if (typeof subject === "string" && subject) conditions.push(eq(examPapersTable.subject, subject));
    if (typeof year === "string" && year) conditions.push(eq(examPapersTable.year, parseInt(year, 10)));
    if (typeof paperType === "string" && paperType) {
      const dbType = PAPER_TYPE_MAP[paperType] ?? paperType;
      conditions.push(eq(examPapersTable.paperType, dbType));
    }
    const papers = await (conditions.length
      ? db.select().from(examPapersTable).where(and(...conditions)).orderBy(desc(examPapersTable.year))
      : db.select().from(examPapersTable).orderBy(desc(examPapersTable.year)));
    res.json({ papers });
  } catch (err) {
    req.log.error(err, "library/papers error");
    res.status(500).json({ error: "Failed to load papers" });
  }
});

router.get("/library/papers/:paperId/marking-scheme", async (req, res) => {
  try {
    const id = parseInt(req.params.paperId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid paper id" }); return; }
    const [paper] = await db.select().from(examPapersTable).where(eq(examPapersTable.id, id));
    if (!paper?.markingSchemeId) { res.status(404).json({ error: "No marking scheme" }); return; }
    const [ms] = await db.select().from(markingSchemesTable).where(eq(markingSchemesTable.id, paper.markingSchemeId));
    if (!ms) { res.status(404).json({ error: "Marking scheme not found" }); return; }
    res.json({ markingScheme: ms });
  } catch (err) {
    req.log.error(err, "library/papers/:id/marking-scheme error");
    res.status(500).json({ error: "Failed to load marking scheme" });
  }
});

router.get("/library/papers/:paperId", async (req, res) => {
  try {
    const id = parseInt(req.params.paperId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid paper id" }); return; }
    const [paper] = await db.select().from(examPapersTable).where(eq(examPapersTable.id, id));
    if (!paper) { res.status(404).json({ error: "Not found" }); return; }
    let markingScheme = null;
    if (paper.markingSchemeId) {
      const [ms] = await db.select().from(markingSchemesTable).where(eq(markingSchemesTable.id, paper.markingSchemeId));
      markingScheme = ms ?? null;
    }
    res.json({ paper, markingScheme });
  } catch (err) {
    req.log.error(err, "library/papers/:id error");
    res.status(500).json({ error: "Failed to load paper" });
  }
});

router.get("/library/ncert-books", async (req, res) => {
  try {
    const { subject, language } = req.query;
    const conditions = [];
    if (typeof subject === "string" && subject) conditions.push(eq(ncertBooksTable.subject, subject));
    if (typeof language === "string" && language) conditions.push(eq(ncertBooksTable.language, language));
    const books = await (conditions.length
      ? db.select().from(ncertBooksTable).where(and(...conditions))
      : db.select().from(ncertBooksTable));
    res.json({ books });
  } catch (err) {
    req.log.error(err, "library/ncert-books error");
    res.status(500).json({ error: "Failed to load NCERT books" });
  }
});

/**
 * Streams a PDF out of Object Storage under our own origin, so the in-app
 * viewer can render it without the browser ever talking to a third-party host.
 *
 * The SDK exposes no byte-range download, so range requests are not supported;
 * every PDF in the library is under 10 MB, which PDF.js fetches in one go
 * happily. `Accept-Ranges: none` stops it from trying and falling back.
 */
router.get("/library/files/{*fileKey}", async (req, res) => {
  try {
    const rawKey = Array.isArray(req.params.fileKey) ? req.params.fileKey.join("/") : (req.params.fileKey ?? "");
    if (!rawKey) { res.status(400).json({ error: "Missing file key" }); return; }

    const key = safeObjectKey(rawKey);
    if (!key) { res.status(400).json({ error: "Invalid file key" }); return; }

    // Read first, then decide the status — this way a miss still produces a
    // clean JSON 404 rather than a truncated body, without needing exists().
    const { bytes, error } = await downloadBytes(key);
    if (!bytes) {
      req.log.warn({ key, error }, "library/files object unreadable");
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(key)}"`);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(bytes);
  } catch (err) {
    req.log.error(err, "library/files error");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

/**
 * Proxies an official NCERT chapter PDF through our own origin.
 *
 * The chapter URLs in @workspace/cbse-content point straight at ncert.nic.in.
 * A cross-origin <iframe> could render those directly, but the canvas reader
 * fetches bytes with XHR, and ncert.nic.in sends no Access-Control-Allow-Origin
 * header — so every NCERT chapter failed to load once the viewer stopped using
 * an iframe. Fetching server-side sidesteps CORS entirely and keeps the source
 * policy intact: the bytes still come from ncert.nic.in and nowhere else.
 */
const NCERT_HOST = "ncert.nic.in";
const NCERT_HOSTS = new Set([NCERT_HOST, `www.${NCERT_HOST}`]);
const MAX_NCERT_PDF_BYTES = 32 * 1024 * 1024;

function isAllowedNcertPdf(target: URL): boolean {
  return (
    target.protocol === "https:" &&
    NCERT_HOSTS.has(target.hostname) &&
    /\.pdf$/i.test(target.pathname)
  );
}

/**
 * NCERT has used both /textbook/pdf/<file> and /ncerts/l/<file> for the same
 * chapter files. Try both official paths, with and without www, because the
 * two frontends do not always have identical availability from cloud hosts.
 */
function ncertSourceCandidates(target: URL): URL[] {
  const filename = path.posix.basename(target.pathname);
  const paths = [target.pathname, `/textbook/pdf/${filename}`, `/ncerts/l/${filename}`];
  const urls = [target];

  for (const hostname of NCERT_HOSTS) {
    for (const pathname of paths) {
      const candidate = new URL(target);
      candidate.hostname = hostname;
      candidate.pathname = pathname;
      candidate.search = "";
      candidate.hash = "";
      urls.push(candidate);
    }
  }

  return Array.from(new Map(urls.map((url) => [url.toString(), url])).values());
}

async function fetchNcertCandidate(source: URL): Promise<Buffer | null> {
  try {
    const upstream = await fetch(source, {
      headers: {
        Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
        "Accept-Encoding": "identity",
        Referer: "https://ncert.nic.in/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok || !upstream.body) return null;

    const declaredLength = Number(upstream.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_NCERT_PDF_BYTES) return null;

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (
      bytes.length < 5 ||
      bytes.length > MAX_NCERT_PDF_BYTES ||
      bytes.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

router.get("/library/ncert-file", async (req, res) => {
  try {
    const raw = typeof req.query["url"] === "string" ? req.query["url"] : "";
    if (!raw) { res.status(400).json({ error: "Missing url" }); return; }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      res.status(400).json({ error: "Invalid url" }); return;
    }

    // Strict allowlist — this endpoint must never become an open proxy.
    if (!isAllowedNcertPdf(target)) {
      res.status(403).json({ error: "Only https ncert.nic.in PDF URLs are allowed" });
      return;
    }

    // Try official mirrors in small parallel batches. A single blocked NCERT
    // hostname must not make every chapter fail for all StudyFilter users.
    const candidates = ncertSourceCandidates(target);
    let bytes: Buffer | null = null;
    let sourceUrl = target;
    for (let index = 0; index < candidates.length && !bytes; index += 2) {
      const batch = candidates.slice(index, index + 2);
      const results = await Promise.all(batch.map(fetchNcertCandidate));
      const successIndex = results.findIndex((result) => result !== null);
      if (successIndex >= 0) {
        bytes = results[successIndex];
        sourceUrl = batch[successIndex];
      }
    }

    if (!bytes) {
      req.log.warn(
        { url: target.toString(), candidates: candidates.map(String) },
        "ncert-file official sources unavailable",
      );
      res.setHeader("Retry-After", "60");
      res.status(503).json({
        error: "NCERT's PDF service is temporarily unavailable",
        code: "NCERT_TEMPORARILY_UNAVAILABLE",
        officialUrl: target.toString(),
      });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(target.pathname)}"`);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-StudyFilter-PDF-Source", sourceUrl.hostname);
    res.end(bytes);
  } catch (err) {
    req.log.error(err, "library/ncert-file error");
    res.setHeader("Retry-After", "60");
    res.status(503).json({
      error: "NCERT's PDF service is temporarily unavailable",
      code: "NCERT_TEMPORARILY_UNAVAILABLE",
    });
  }
});

export default router;
