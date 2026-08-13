/**
 * Pre-warms `generated_content` for every chapter in the syllabus.
 *
 * The four chapter generators — summary, NCERT answers, important questions,
 * revision notes — are deterministic for a given (class, subject, chapter),
 * so their results are written to `generated_content` and reused by every
 * student forever. The cache is global: none of those endpoints take a
 * session id, so there is nothing per-student to fragment on.
 *
 * The catch is that it fills *reactively*. Whichever student opens a chapter
 * first pays the full generation wait, and with roughly 76 chapters across
 * five subjects that is ~300 cold generations paid one at a time by whoever
 * happens to land there first. This script pays all of them up front, off
 * peak, so no student ever waits.
 *
 * It drives the real HTTP endpoints rather than reimplementing the prompts.
 * That keeps one definition of what a summary is, and means anything the
 * endpoints already do — retrieval, validation, the cache write itself —
 * happens identically here.
 *
 *   pnpm --filter @workspace/scripts run prewarm
 *
 * Safe to re-run and safe to interrupt. An already-cached chapter returns
 * from the cache in well under a second, so a second pass costs a few
 * minutes of round trips and regenerates nothing.
 *
 * Environment:
 *   API_BASE_URL   default http://127.0.0.1:8080  (the api-server artifact)
 *   PREWARM_ONLY   comma-separated subject ids, e.g. "science,mathematics"
 *   PREWARM_CONC   parallel requests, default 2
 *   PREWARM_DELAY  ms between dispatches, default 250
 */

import { SUBJECTS, GRADE } from "@workspace/cbse-content";
import { db, generatedContentTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const ONLY = (process.env.PREWARM_ONLY ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const CONCURRENCY = Math.max(1, Number(process.env.PREWARM_CONC ?? 2));
const DISPATCH_DELAY_MS = Math.max(0, Number(process.env.PREWARM_DELAY ?? 250));

/**
 * Generous: the server allows a 60s budget for these, and a request that is
 * genuinely generating should not be abandoned at 30s — that would waste the
 * tokens already spent and cache nothing.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/** Anything faster than this came from the cache rather than the model. */
const CACHE_HIT_MS = 3_000;

interface Job {
  feature: string;
  path: string;
  subject: string;
  chapter: string;
}

const FEATURES: { feature: string; path: string }[] = [
  { feature: "summary", path: "/api/study/summary" },
  { feature: "ncert answers", path: "/api/study/ncert-answers" },
  { feature: "important questions", path: "/api/study/important-questions" },
  { feature: "revision notes", path: "/api/study/revision-notes" },
];

function buildJobs(): Job[] {
  const jobs: Job[] = [];
  for (const subject of SUBJECTS) {
    if (ONLY.length > 0 && !ONLY.includes(subject.id.toLowerCase())) continue;
    for (const chapter of subject.chapters) {
      for (const { feature, path } of FEATURES) {
        jobs.push({ feature, path, subject: subject.name, chapter: chapter.title });
      }
    }
  }
  return jobs;
}

type Outcome = "generated" | "cached" | "failed";

interface Result {
  job: Job;
  outcome: Outcome;
  ms: number;
  detail?: string;
}

async function runJob(job: Job): Promise<Result> {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${job.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classLevel: GRADE,
        subject: job.subject,
        chapter: job.chapter,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const ms = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { job, outcome: "failed", ms, detail: `HTTP ${res.status} ${body.slice(0, 120)}` };
    }

    // A 200 carrying an { error } body is how the endpoints report a soft
    // failure (no API key, for instance) — that is not a warm cache entry.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (body && typeof body.error === "string") {
      return { job, outcome: "failed", ms, detail: body.error.slice(0, 120) };
    }

    return { job, outcome: ms < CACHE_HIT_MS ? "cached" : "generated", ms };
  } catch (err) {
    const ms = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    return { job, outcome: "failed", ms, detail: message.slice(0, 120) };
  }
}

async function countRows(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(generatedContentTable);
  return row?.n ?? 0;
}

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

async function main(): Promise<void> {
  const jobs = buildJobs();

  console.log(`[prewarm] target       ${BASE_URL}`);
  console.log(`[prewarm] jobs         ${jobs.length} (${FEATURES.length} features x chapters)`);
  console.log(`[prewarm] concurrency  ${CONCURRENCY}`);
  if (ONLY.length) console.log(`[prewarm] subjects     ${ONLY.join(", ")}`);

  // Fail loudly and immediately rather than logging 300 connection refusals.
  try {
    const probe = await fetch(`${BASE_URL}/api/pdfs/list`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!probe.ok) throw new Error(`probe returned HTTP ${probe.status}`);
  } catch (err) {
    console.error(
      `\n[prewarm] cannot reach the API at ${BASE_URL}\n` +
        `          Start the server first, or set API_BASE_URL.\n` +
        `          ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const before = await countRows().catch(() => -1);
  if (before >= 0) console.log(`[prewarm] cached rows  ${before} before starting`);
  console.log("");

  const results: Result[] = [];
  let index = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = index++;
      if (i >= jobs.length) return;
      const job = jobs[i]!;

      // Stagger dispatches so a burst of workers does not trip a rate limit.
      if (DISPATCH_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, DISPATCH_DELAY_MS));
      }

      const result = await runJob(job);
      results.push(result);
      done++;

      const mark =
        result.outcome === "generated" ? "+" : result.outcome === "cached" ? "." : "!";
      const line = `[${String(done).padStart(3)}/${jobs.length}] ${mark} ${fmt(result.ms).padStart(6)}  ${job.subject} · ${job.chapter} · ${job.feature}`;
      console.log(result.detail ? `${line}\n            ${result.detail}` : line);
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsed = Date.now() - startedAt;

  const generated = results.filter((r) => r.outcome === "generated");
  const cached = results.filter((r) => r.outcome === "cached");
  const failed = results.filter((r) => r.outcome === "failed");

  console.log("\n" + "─".repeat(64));
  console.log(`  generated      ${generated.length}`);
  console.log(`  already cached ${cached.length}`);
  console.log(`  failed         ${failed.length}`);
  console.log(`  elapsed        ${fmt(elapsed)}`);

  const after = await countRows().catch(() => -1);
  if (before >= 0 && after >= 0) {
    console.log(`  rows           ${before} -> ${after}  (+${after - before})`);
  }

  if (failed.length > 0) {
    console.log("\n  failures — re-run to retry these:");
    for (const f of failed) {
      console.log(`    ${f.job.subject} · ${f.job.chapter} · ${f.job.feature}`);
      if (f.detail) console.log(`      ${f.detail}`);
    }
  }
  console.log("─".repeat(64));

  // Non-zero exit on failures so a scheduled run surfaces them.
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[prewarm] fatal", err);
  process.exit(1);
});
