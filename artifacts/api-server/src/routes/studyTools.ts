import { Router } from "express";
import { createHash } from "node:crypto";
import type { Logger } from "pino";
import { db, generatedContentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  OPENAI_MODEL,
  REASONING_EFFORT_PARAMS,
  getOpenAIApiKey,
  getOpenAIClient,
  missingApiKeyResponse,
  safeParseOpenAIJson,
} from "../lib/openai";

/**
 * The independent study tools: Explain, Solve and Flashcards.
 *
 * These live outside `study.ts` deliberately. That file is already 2,300 lines
 * and holds the general answer engine — web retrieval, CBSE mark rules,
 * literature word limits, OCR. Explain and Solve are not variations on "ask a
 * question": each returns a *structured* result that a purpose-built component
 * renders, which is the whole point of this pass. Bolting them onto the answer
 * engine would have made them prompt variants again.
 *
 * What every route here has in common:
 *
 * - it returns typed JSON with a fixed shape, never a wall of prose
 * - it validates and coerces whatever the model returned, so a malformed
 *   field degrades to an empty section rather than crashing a page
 * - it caches results that are genuinely reusable, and refuses to cache
 *   anything derived from text the student pasted
 */

const router = Router();

const MODEL_TIMEOUT_MS = 30_000;

// ── Coercion helpers ─────────────────────────────────────────────────────────
// The model is told exactly what to return, and mostly complies. These exist
// for the times it doesn't: a missing array must become [], not undefined,
// because the client renders `sections.map(...)` without a guard on every line.

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown, limit = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, limit);
}

function asObjectArray(value: unknown, limit = 24): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    .slice(0, limit);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// ── Reusable-content cache ───────────────────────────────────────────────────

function cacheKeyOf(parts: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 48);
}

async function cachedGet(key: string, log: Logger): Promise<unknown | null> {
  try {
    const [row] = await db
      .select()
      .from(generatedContentTable)
      .where(eq(generatedContentTable.cacheKey, key));
    return row?.payload ?? null;
  } catch (err) {
    // A cache miss must never fail the request.
    log.warn({ err }, "studyTools cache read failed");
    return null;
  }
}

async function cachedSet(
  key: string,
  kind: string,
  meta: { subject?: string; chapter?: string; classLevel?: number },
  payload: unknown,
  log: Logger,
): Promise<void> {
  try {
    await db
      .insert(generatedContentTable)
      .values({
        kind,
        cacheKey: key,
        subject: meta.subject ?? null,
        chapter: meta.chapter ?? null,
        classLevel: meta.classLevel ?? null,
        payload: payload as object,
      })
      .onConflictDoUpdate({
        target: generatedContentTable.cacheKey,
        set: { payload: payload as object, updatedAt: new Date() },
      });
  } catch (err) {
    log.warn({ err }, "studyTools cache write failed");
  }
}

async function completeJson(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
  log: Logger,
): Promise<Record<string, unknown>> {
  const openai = getOpenAIClient(apiKey);
  const completion = await openai.chat.completions.create(
    {
      model: OPENAI_MODEL,
      ...REASONING_EFFORT_PARAMS,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { timeout: MODEL_TIMEOUT_MS },
  );
  const parsed = safeParseOpenAIJson(completion, log);
  if (!parsed) throw new Error("Model returned no usable JSON");
  return parsed;
}

// ═══ POST /api/study/explain ═════════════════════════════════════════════════

const EXPLAIN_DEPTHS = ["quick", "standard", "deep", "new", "exam"] as const;
type ExplainDepth = (typeof EXPLAIN_DEPTHS)[number];

const DEPTH_GUIDE: Record<ExplainDepth, string> = {
  quick:
    "One tight explanation. Two or three short sections at most, no derivations, no extended examples. A student re-checking something they already half-know.",
  standard:
    "The normal classroom explanation: what it is, why it works, how it is used, with one worked example. Three to five sections.",
  deep: "Go properly deep. Derive results rather than stating them, cover the assumptions and the edge cases, and connect the idea to neighbouring topics. Five to seven sections.",
  new: "Assume the student has never met this idea. Use everyday analogies before any formal language, define every term the moment it appears, and keep sentences short. Never use a symbol you have not introduced.",
  exam: "Explain it the way it is examined. Lead with what the board actually asks, the exact wording expected in an answer, the marks each part carries, and the mistakes examiners penalise.",
};

/**
 * The diagram contract.
 *
 * The model may only *choose* a diagram and supply its parameters — it never
 * writes drawing code. The client renders each kind itself, so a figure is
 * either geometrically correct or absent. This is the rule that stops a
 * confident-looking, wrong ray diagram from ever reaching a student.
 */
const DIAGRAM_CONTRACT = `
"diagram": null, or ONE of these exact shapes:
  {"kind":"flow","caption":"...","spec":{"steps":["step 1","step 2","step 3"]}}
  {"kind":"cycle","caption":"...","spec":{"steps":["stage 1","stage 2","stage 3","stage 4"]}}
  {"kind":"axes","caption":"...","spec":{"xLabel":"V (volts)","yLabel":"I (amperes)","points":[[0,0],[2,0.4],[4,0.8]],"line":true}}
  {"kind":"circuit","caption":"...","spec":{"arrangement":"series"|"parallel","cellVolts":6,"resistors":[{"label":"R1","ohms":2},{"label":"R2","ohms":4}]}}
  {"kind":"ray","caption":"...","spec":{"optic":"concave-mirror"|"convex-mirror"|"convex-lens"|"concave-lens","focalLengthCm":15,"objectDistanceCm":30,"objectHeightCm":4}}

Choose a diagram ONLY when a picture genuinely adds understanding, and only
when the values are ones you are confident in. If nothing fits, use null —
a missing diagram is always better than a misleading one.`;

router.post("/study/explain", async (req, res) => {
  const topic = asString(req.body?.topic);
  const passage = asString(req.body?.passage).slice(0, 4000);
  const classLevel = clampInt(req.body?.classLevel, 6, 12, 10);
  const subject = asString(req.body?.subject);
  const chapter = asString(req.body?.chapter);
  const depth: ExplainDepth = (EXPLAIN_DEPTHS as readonly string[]).includes(req.body?.depth)
    ? (req.body.depth as ExplainDepth)
    : "standard";

  if (!topic && !passage) {
    res.status(400).json({ error: "Tell us what to explain." });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res.status(503).json(missingApiKeyResponse());
    return;
  }

  /*
   * Only topic-based explanations are cached. A passage comes from whatever
   * the student highlighted — it is their content, and a shared cache keyed on
   * it would let one student's selection surface for another. Chapter topics
   * are curriculum, and safe to share.
   */
  const cacheable = !passage;
  const key = cacheKeyOf({ e: "explain", topic, depth, classLevel, subject, chapter });

  if (cacheable) {
    const hit = await cachedGet(key, req.log);
    if (hit) {
      res.json(hit);
      return;
    }
  }

  const context = [
    subject ? `Subject: ${subject}` : "",
    chapter ? `Chapter: ${chapter}` : "",
    `Class: ${classLevel} (CBSE, NCERT)`,
  ]
    .filter(Boolean)
    .join("\n");

  const subjectMatter = passage
    ? `Explain this passage the student highlighted while reading:\n"""\n${passage}\n"""${topic ? `\n\nThey are asking specifically about: ${topic}` : ""}`
    : `Explain: ${topic}`;

  const system =
    "You are a CBSE subject teacher. You return ONLY valid JSON matching the requested schema exactly. Every value you give must be correct for the NCERT syllabus; if you are not confident about a number, omit the field rather than guessing.";

  const user = `${subjectMatter}

${context}

Depth: ${depth} — ${DEPTH_GUIDE[depth]}

Return this JSON object:
{
  "title": "short title for this explanation",
  "inShort": "one sentence that answers it completely, before any elaboration",
  "definitions": [{"term":"...","meaning":"..."}],
  "sections": [{"heading":"...","body":["paragraph"],"points":["bullet"]}],
  "formulae": [{"expression":"V = IR","meaning":"what each symbol is"}],
  "examples": [{"prompt":"...","working":["step"],"answer":"..."}],
  "table": {"caption":"...","columns":["A","B"],"rows":[["a1","b1"]]},
  "keyConcepts": ["..."],
  "commonMistakes": ["..."],
  "related": ["neighbouring topic"],
  ${DIAGRAM_CONTRACT}
}

Rules:
- Use "body" for explanation prose and "points" for genuine lists. A section may use either or both.
- Include "table" ONLY for a real comparison or classification. Omit it otherwise.
- Include "formulae" only for subjects that have them.
- Write in clear British-Indian classroom English at Class ${classLevel} level.
- Never invent NCERT page numbers, exam years or statistics.`;

  try {
    const parsed = await completeJson(apiKey, system, user, 3200, req.log);

    const result = {
      title: asString(parsed.title) || topic || "Explanation",
      inShort: asString(parsed.inShort),
      definitions: asObjectArray(parsed.definitions, 8)
        .map((d) => ({ term: asString(d.term), meaning: asString(d.meaning) }))
        .filter((d) => d.term && d.meaning),
      sections: asObjectArray(parsed.sections, 10)
        .map((s) => ({
          heading: asString(s.heading),
          body: asStringArray(s.body, 8),
          points: asStringArray(s.points, 12),
        }))
        .filter((s) => s.heading && (s.body.length > 0 || s.points.length > 0)),
      formulae: asObjectArray(parsed.formulae, 10)
        .map((f) => ({ expression: asString(f.expression), meaning: asString(f.meaning) }))
        .filter((f) => f.expression),
      examples: asObjectArray(parsed.examples, 6)
        .map((e) => ({
          prompt: asString(e.prompt),
          working: asStringArray(e.working, 12),
          answer: asString(e.answer),
        }))
        .filter((e) => e.prompt),
      table: normaliseTable(parsed.table),
      keyConcepts: asStringArray(parsed.keyConcepts, 10),
      commonMistakes: asStringArray(parsed.commonMistakes, 8),
      related: asStringArray(parsed.related, 8),
      diagram: normaliseDiagram(parsed.diagram),
    };

    if (result.sections.length === 0 && !result.inShort) {
      throw new Error("Explanation came back empty");
    }

    if (cacheable) {
      await cachedSet(key, "explain", { subject, chapter, classLevel }, result, req.log);
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "explain failed");
    res.status(500).json({ error: "We couldn't write that explanation. Try again." });
  }
});

function normaliseTable(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const table = value as Record<string, unknown>;
  const columns = asStringArray(table.columns, 6);
  if (columns.length < 2) return null;
  const rows = (Array.isArray(table.rows) ? table.rows : [])
    .map((row) => asStringArray(row, columns.length))
    // A row that doesn't line up with the header would render as a broken
    // table; padding it is less confusing than dropping the whole thing.
    .map((row) => (row.length === columns.length ? row : [...row, ...Array(columns.length - row.length).fill("—")]))
    .filter((row) => row.some((cell) => cell && cell !== "—"))
    .slice(0, 12);
  if (rows.length === 0) return null;
  return { caption: asString(table.caption), columns, rows };
}

const DIAGRAM_KINDS = ["flow", "cycle", "axes", "circuit", "ray"] as const;

function normaliseDiagram(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const diagram = value as Record<string, unknown>;
  const kind = asString(diagram.kind);
  if (!(DIAGRAM_KINDS as readonly string[]).includes(kind)) return null;
  const spec = diagram.spec;
  if (!spec || typeof spec !== "object") return null;
  return { kind, caption: asString(diagram.caption), spec };
}

// ═══ POST /api/study/solve ═══════════════════════════════════════════════════

const SOLVE_KINDS = ["auto", "numerical", "algebra", "geometry", "word", "proof"] as const;

router.post("/study/solve", async (req, res) => {
  const question = asString(req.body?.question).slice(0, 3000);
  const classLevel = clampInt(req.body?.classLevel, 6, 12, 10);
  const subject = asString(req.body?.subject);
  const chapter = asString(req.body?.chapter);
  const requestedKind = (SOLVE_KINDS as readonly string[]).includes(req.body?.kind)
    ? (req.body.kind as string)
    : "auto";

  if (question.length < 5) {
    res.status(400).json({ error: "Paste the full question so the working can be complete." });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res.status(503).json(missingApiKeyResponse());
    return;
  }

  /*
   * Deliberately not cached. A solve request is whatever the student typed or
   * photographed — a homework question, sometimes with their own numbers in
   * it. Storing that in a table shared across every user of the app is a
   * privacy decision nobody asked us to make, and the saving would be small
   * because near-identical questions rarely hash identically anyway.
   */

  const system =
    "You are a CBSE mathematics and science teacher marking working. You return ONLY valid JSON. Every arithmetic step must be correct and must follow from the previous one. If the question cannot be solved as written, say so in `note` and leave `steps` empty rather than inventing a solution.";

  const user = `Solve this, showing full working the way it should be written in a CBSE answer script.

Question: ${question}
Class: ${classLevel} (CBSE, NCERT)${subject ? `\nCurrent workspace subject (may be stale): ${subject}` : ""}${chapter ? `\nCurrent workspace chapter (may be stale): ${chapter}` : ""}
${requestedKind !== "auto" ? `The student says this is a ${requestedKind} problem.` : ""}

Infer the subject and NCERT chapter from the question itself. Use the current
workspace context only when it genuinely matches; never force an unrelated
chapter onto the solution.

Return this JSON object:
{
  "kind": "numerical" | "algebra" | "geometry" | "word" | "proof",
  "subject": "Physics" | "Chemistry" | "Biology" | "Mathematics" | "...",
  "chapter": "best matching NCERT chapter title",
  "given": ["each quantity or fact supplied by the question, with its unit"],
  "required": ["what the question asks you to find"],
  "concept": "the principle or theorem this uses, in one line",
  "formulae": ["the formula(e) used, as written in NCERT"],
  "substitution": "the formula with the given values put in, before simplifying",
  "steps": [{"label":"what this step does","detail":"the reasoning","expression":"the line of maths"}],
  "answer": "the final answer",
  "units": "the unit of the final answer, if any",
  "verification": "a check — substitute back, or a sanity check on magnitude",
  "note": "only if something is ambiguous or missing from the question"
}

Rules:
- "given" and "required" are for numericals and word problems. For a proof, put what is given and what is to be proved.
- Each step must contain exactly one idea. Do not merge three manipulations into one line.
- Put the mathematics in "expression" and the words in "detail" — never mix them.
- Carry units through the working, not just onto the final answer.
- Round only at the very end, and say what you rounded to.`;

  try {
    const parsed = await completeJson(apiKey, system, user, 2600, req.log);

    const steps = asObjectArray(parsed.steps, 20)
      .map((s) => ({
        label: asString(s.label),
        detail: asString(s.detail),
        expression: asString(s.expression),
      }))
      .filter((s) => s.label || s.detail || s.expression);

    const result = {
      question,
      kind: (SOLVE_KINDS as readonly string[]).includes(asString(parsed.kind))
        ? asString(parsed.kind)
        : "numerical",
      subject: asString(parsed.subject) || subject,
      chapter: asString(parsed.chapter),
      given: asStringArray(parsed.given, 12),
      required: asStringArray(parsed.required, 6),
      concept: asString(parsed.concept),
      formulae: asStringArray(parsed.formulae, 8),
      substitution: asString(parsed.substitution),
      steps,
      answer: asString(parsed.answer),
      units: asString(parsed.units),
      verification: asString(parsed.verification),
      note: asString(parsed.note),
    };

    if (!result.answer && result.steps.length === 0 && !result.note) {
      throw new Error("Solution came back empty");
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "solve failed");
    res.status(500).json({ error: "We couldn't work that one through. Try again." });
  }
});

// ═══ POST /api/study/flashcards ══════════════════════════════════════════════

router.post("/study/flashcards", async (req, res) => {
  const classLevel = clampInt(req.body?.classLevel, 6, 12, 10);
  const subject = asString(req.body?.subject);
  const chapter = asString(req.body?.chapter);
  const topic = asString(req.body?.topic);
  const passage = asString(req.body?.passage).slice(0, 6000);
  const count = clampInt(req.body?.count, 3, 30, 12);

  if (!chapter && !topic && !passage) {
    res.status(400).json({ error: "Pick a chapter or select some text first." });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res.status(503).json(missingApiKeyResponse());
    return;
  }

  // Same rule as Explain: chapter material is shared, pasted passages are not.
  const cacheable = !passage;
  const key = cacheKeyOf({ e: "flashcards", classLevel, subject, chapter, topic, count });

  if (cacheable) {
    const hit = await cachedGet(key, req.log);
    if (hit) {
      res.json(hit);
      return;
    }
  }

  const system =
    "You write flashcards for CBSE revision. You return ONLY valid JSON. A good card has exactly one fact on it and can be answered in under ten seconds.";

  const user = `Write ${count} flashcards.

${passage ? `From this passage:\n"""\n${passage}\n"""` : `Topic: ${topic || chapter}`}
Class: ${classLevel} (CBSE, NCERT)${subject ? `\nSubject: ${subject}` : ""}${chapter ? `\nChapter: ${chapter}` : ""}

Return: {"cards":[{"front":"the question or prompt","back":"the answer","hint":"optional nudge"}]}

Rules:
- One idea per card. Split anything that needs "and" in the answer.
- The front must be answerable without seeing the back — no "What is it?".
- Backs are short: a definition, a value with its unit, a formula, a date, a name.
- Prefer the things that are actually asked in the exam over trivia.
- No card should repeat another's answer.`;

  try {
    const parsed = await completeJson(apiKey, system, user, 2000, req.log);
    const cards = asObjectArray(parsed.cards, 30)
      .map((c) => ({
        front: asString(c.front),
        back: asString(c.back),
        hint: asString(c.hint),
      }))
      .filter((c) => c.front && c.back);

    if (cards.length === 0) throw new Error("No usable cards");

    const payload = { cards };
    if (cacheable) {
      await cachedSet(key, "flashcards", { subject, chapter, classLevel }, payload, req.log);
    }
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "flashcards failed");
    res.status(500).json({ error: "We couldn't make cards for that. Try again." });
  }
});

export default router;
