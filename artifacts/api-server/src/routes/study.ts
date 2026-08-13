import { Router } from "express";
import type { Logger } from "pino";
import type OpenAI from "openai";
import { db, generatedContentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  findBestLocalMatch,
  sampleQuestions,
  type LocalQuestion,
} from "../data/sampleQuestions";
import {
  OPENAI_MODEL,
  REASONING_EFFORT_PARAMS,
  isReasoningModel,
  getOpenAIApiKey,
  getOpenAIClient,
  missingApiKeyResponse,
  safeParseOpenAIJson,
} from "../lib/openai";
import {
  isLiteratureSubject,
  getLiteratureWordRange,
  countLiteratureWords,
  requiresIntroBodyConclusion,
  type HindiCourse,
} from "../lib/cbseLiteratureWordLimits";
import {
  getMarkRule,
  BOARD_ANSWER_TOKEN_LIMITS,
  CBSE_PATTERN_VERSION,
  type AllowedMark,
  type AnswerFormat,
} from "../config/cbseAnswerRules";
import { analyzeQuestion } from "../services/questionAnalysis";
import {
  storeAnswerContext,
  getAnswerContext,
  type StoredQuestionAnalysis,
} from "../services/reusableAnswerContext";

const router = Router();

// ── Approved domains — source policy (FINAL) ─────────────────────────────
// NCERT textbook PDFs: ncert.nic.in only.
// Supplementary materials: selfstudys.com only.
// Forbidden (never add back): cbseacademic.nic.in, cbse.gov.in, epathshala.nic.in
const APPROVED_DOMAINS = [
  // Official NCERT (textbook PDFs only)
  "ncert.nic.in",
  // SelfStudys (supplementary materials: PYQ, SQP, marking schemes, exemplar)
  "selfstudys.com",
  "cdn.selfstudys.com",
  // Student Q&A and solution platforms
  "diksha.gov.in",
  // Top Indian ed-tech platforms
  "teachoo.com",
  "doubtnut.com",
  "byjus.com",
  "vedantu.com",
  "brainly.in",
  "brainly.com",
  "topper.com",
  "toppr.com",
  "meritnation.com",
  "extramarks.com",
  "embibe.com",
  "infinity.edu.in",
  "aakash.ac.in",
  // Allen (coaching)
  "allen.ac.in",
  "motion.ac.in",
  // CBSE solutions sites
  "cbseguess.com",
  "learncbse.in",
  "cbsencertsolutions.com",
  "ncertbooks.guru",
  "ncerthelp.com",
  "ncertsolutions.com",
  "studyrankers.com",
  "successcds.net",
  "jagranjosh.com",
  "shaalaa.com",
  "dronstudy.com",
  // Khan Academy
  "india.khanacademy.org",
  "khanacademy.org",
];

// ── Priority order for scraping (most reliable → least) ──────────────────
const PRIORITY_DOMAINS = [
  "ncert.nic.in",
  "teachoo.com",
  "doubtnut.com",
  "byjus.com",
  "vedantu.com",
  "brainly.in",
  "learncbse.in",
  "studyrankers.com",
  "shaalaa.com",
  "toppr.com",
];

function isApprovedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return APPROVED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
  } catch {
    return false;
  }
}

function getPriorityScore(url: string): number {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const idx = PRIORITY_DOMAINS.findIndex(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
    return idx === -1 ? PRIORITY_DOMAINS.length : idx;
  } catch {
    return 999;
  }
}

// ── Smart HTML content extractor ──────────────────────────────────────────
function extractContent(html: string, question: string): string {
  // Remove noise
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Preserve paragraph structure
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();

  // Find best context window around question keywords
  const lc = cleaned.toLowerCase();
  const qWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let bestIdx = 0;
  let bestCount = 0;
  const windowSize = 1200;
  const step = 150;

  for (let i = 0; i < Math.max(1, lc.length - windowSize); i += step) {
    const window = lc.slice(i, i + windowSize);
    const count = qWords.filter((w) => window.includes(w)).length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }

  // Expand slightly for context
  const start = Math.max(0, bestIdx - 100);
  return cleaned.slice(start, start + 2000).trim();
}

function scoreAnswer(
  answerText: string,
  question: string,
  subject: string,
  chapter: string,
) {
  const text = answerText.toLowerCase();
  const q = question.toLowerCase();
  const subj = subject.toLowerCase();
  const chap = chapter.toLowerCase();

  const qKeywords = q.split(/\s+/).filter((w) => w.length > 3);
  const chapKeywords = chap.split(/\s+/).filter((w) => w.length > 3);

  const keywordMatches = [...qKeywords, ...chapKeywords].filter((kw) =>
    text.includes(kw),
  ).length;
  const totalKeywords = qKeywords.length + chapKeywords.length || 1;

  const cbseMatch = Math.min(
    20,
    Math.round((keywordMatches / totalKeywords) * 20),
  );

  const hasSteps =
    text.includes("step") || text.includes("first") || text.includes("then");
  const clarity = hasSteps ? 20 : text.split(/[.!?]/).length > 2 ? 15 : 10;

  const wordCount = answerText.split(/\s+/).length;
  const examReadiness =
    wordCount >= 30 && wordCount <= 300 ? 20 : wordCount < 30 ? 10 : 15;

  const simpleLanguage =
    answerText.split(/\s+/).filter((w) => w.length > 10).length <
    wordCount * 0.2
      ? 20
      : 15;

  const hasSubjectWords = subj.split(/\s+/).some((w) => text.includes(w));
  const correctnessEstimate = hasSubjectWords ? 20 : 10;

  return {
    cbseMatch,
    correctnessEstimate,
    clarity,
    simpleLanguage,
    examReadiness,
    total:
      cbseMatch +
      correctnessEstimate +
      clarity +
      simpleLanguage +
      examReadiness,
  };
}

// ── Fast parallel page fetcher ────────────────────────────────────────────
interface ScrapedSource {
  url: string;
  title: string;
  domain: string;
  excerpt: string | null;
  status: "ok" | "error" | "rejected";
}

// ── Latency budget for a cache-miss generation ──────────────────────────────
//
// Everything chapter-scoped is cached permanently after its first request (see
// generatedGet/generatedSet below), so this budget only governs the ONE cold
// request per chapter — every student after that gets a database hit in
// milliseconds. The target is "under 10 seconds" end to end; these numbers
// leave slack for JSON parsing and the response write.
/**
 * Interactive budget — a student is watching a spinner.
 *
 * These numbers used to be 9.5s total / 7s per model call, chosen for a
 * "everything under 10 seconds" target. That target was never actually
 * enforced: the OpenAI SDK defaults to 2 retries and retries on timeout, so
 * a 7s call really took 7 + 7 + 7 plus backoff and surfaced at ~23s. Turning
 * retries off (lib/openai.ts) makes these bounds real for the first time —
 * which also means a 7s cap would now *hard fail* calls that previously
 * limped through on a retry. Raised to a window the model can actually hit.
 */
const TOTAL_BUDGET_MS = 15_000;
const DDG_SEARCH_TIMEOUT_MS = 2_500;
const SCRAPE_TIMEOUT_MS = 2_500;
const MODEL_CALL_MIN_TIMEOUT_MS = 3_000; // never hand the model an unworkable window
const MODEL_CALL_MAX_TIMEOUT_MS = 12_000; // cap even when retrieval was skipped/instant

/**
 * The four chapter-scoped generators — summary, NCERT answers, important
 * questions, revision notes — get their own, much larger budget.
 *
 * They are not interactive. Each result is written to `generated_content`
 * and reused forever, so exactly one student ever waits for a given chapter
 * and everyone after them is served from the cache in milliseconds. Holding
 * them to the same 9.5s window as a live question was actively harmful: the
 * request timed out, nothing was cached, and the *next* student hit the same
 * timeout. A chapter that failed once failed permanently.
 *
 * Better to make one student wait than to make the feature impossible.
 */
const GENERATION_BUDGET_MS = 60_000;

async function fetchPageFast(
  candidate: { url: string; title: string },
  question: string,
): Promise<ScrapedSource> {
  const domain = (() => {
    try {
      return new URL(candidate.url).hostname.replace("www.", "");
    } catch {
      return candidate.url;
    }
  })();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

    const r = await fetch(candidate.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; StudyFilter Educational Bot/2.0; +https://studyfilter.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!r.ok) {
      return {
        url: candidate.url,
        title: candidate.title,
        domain,
        excerpt: null,
        status: "error",
      };
    }

    const html = await r.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : candidate.title;
    const excerpt = extractContent(html, question);

    if (!excerpt || excerpt.length < 50) {
      return {
        url: candidate.url,
        title: pageTitle,
        domain,
        excerpt: null,
        status: "error",
      };
    }

    return {
      url: candidate.url,
      title: pageTitle,
      domain,
      excerpt,
      status: "ok",
    };
  } catch {
    return {
      url: candidate.url,
      title: candidate.title,
      domain,
      excerpt: null,
      status: "error",
    };
  }
}

// ── In-memory answer cache (TTL + simple LRU cap) ─────────────────────────
//
// This layer stays for ad-hoc questions (/study/ask, /study/search-web), where
// the key space is unbounded and staleness is harmless. Chapter-scoped study
// material uses the persistent store below instead.
interface CacheEntry {
  expires: number;
  value: unknown;
}
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;
const answerCache = new Map<string, CacheEntry>();

function cacheKey(parts: Record<string, unknown>): string {
  return JSON.stringify(parts).toLowerCase().replace(/\s+/g, " ").trim();
}

function cacheGet(key: string): unknown | null {
  const e = answerCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    answerCache.delete(key);
    return null;
  }
  // Refresh recency (move to end).
  answerCache.delete(key);
  answerCache.set(key, e);
  return e.value;
}

function cacheSet(key: string, value: unknown): void {
  if (answerCache.size >= CACHE_MAX) {
    const oldest = answerCache.keys().next().value;
    if (oldest !== undefined) answerCache.delete(oldest);
  }
  answerCache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

// ── Persistent store for generated study material ──────────────────────────
//
// A chapter summary does not change between visits, so it is generated once
// and kept. The in-memory map above sits in front as an L1 so repeat hits
// within a process never touch Postgres; the table is the durable copy that
// survives restarts, redeploys and the 30-minute TTL.
type GeneratedKind =
  | "summary"
  | "ncert_answers"
  | "important_questions"
  | "revision_notes";

async function generatedGet(
  key: string,
  log: Logger,
): Promise<unknown | null> {
  const hot = cacheGet(key);
  if (hot) return hot;

  try {
    const [row] = await db
      .select()
      .from(generatedContentTable)
      .where(eq(generatedContentTable.cacheKey, key));
    if (!row) return null;
    // Warm L1 so the next hit in this process skips the query.
    cacheSet(key, row.payload);
    return row.payload;
  } catch (err) {
    // A cache miss must never break the request — fall through and regenerate.
    log.warn({ err }, "generatedGet failed, regenerating");
    return null;
  }
}

async function generatedSet(
  key: string,
  kind: GeneratedKind,
  meta: { subject?: string; chapter?: string; classLevel?: number },
  value: unknown,
  log: Logger,
): Promise<void> {
  cacheSet(key, value);
  try {
    await db
      .insert(generatedContentTable)
      .values({
        kind,
        cacheKey: key,
        subject: meta.subject ?? null,
        chapter: meta.chapter ?? null,
        classLevel: meta.classLevel ?? null,
        payload: value as object,
      })
      // Two students can request the same chapter at once, and a student can
      // ask for a regeneration of something already stored. Upserting covers
      // both without a unique-constraint error: concurrent writes settle on
      // the last one (the payloads are equivalent), and an explicit refresh
      // replaces the stored copy rather than being silently discarded.
      .onConflictDoUpdate({
        target: generatedContentTable.cacheKey,
        set: { payload: value as object, updatedAt: new Date() },
      });
  } catch (err) {
    log.warn({ err }, "generatedSet failed, kept in memory only");
  }
}

// ── Small JSON coercion helpers ───────────────────────────────────────────
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNullableString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function extractOpenAIJson(
  completion: OpenAI.Chat.ChatCompletion,
  log?: Logger,
): Record<string, unknown> {
  const parsed = safeParseOpenAIJson(completion, log);
  if (!parsed) {
    const finishReason = completion.choices[0]?.finish_reason ?? "unknown";
    throw new Error(
      `Could not parse a valid response from the AI model (finish reason: ${finishReason}).`,
    );
  }
  return parsed;
}

// ── Subject detection (lightweight keyword heuristic) ─────────────────────
const SUBJECT_KEYWORDS: Record<string, string[]> = {
  Maths: [
    "equation", "polynomial", "triangle", "trigonometry", "probability",
    "theorem", "quadratic", "algebra", "geometry", "arithmetic", "statistics",
    "circle", "volume", "integer", "fraction", "ratio", "mensuration",
  ],
  Science: [
    "reaction", "acid", "base", "metal", "carbon", "cell", "life process",
    "electricity", "light", "magnetic", "reproduction", "heredity", "force",
    "chemical", "atom", "molecule", "reflection", "refraction", "photosynthesis",
    "respiration", "tissue", "current", "velocity", "acceleration",
  ],
  "Social Science": [
    "nationalism", "revolution", "constitution", "democracy", "federalism",
    "resources", "industry", "agriculture", "globalisation", "development",
    "credit", "history", "geography", "civics", "economics", "movement",
    "empire", "colonial", "monarchy", "parliament",
  ],
  English: [
    "letter", "essay", "poem", "poetry", "grammar", "tense", "story",
    "character", "theme", "author", "narrator", "prose", "comprehension",
    "summary", "passage",
  ],
  Hindi: [
    "हिंदी", "कविता", "कहानी", "व्याकरण", "लेखक", "पत्र", "निबंध", "गद्य",
    "काव्य", "रचना",
  ],
};

function detectSubject(question: string, chapter?: string): string {
  const text = `${question} ${chapter ?? ""}`.toLowerCase();
  let best = "General";
  let bestCount = 0;
  for (const [subj, kws] of Object.entries(SUBJECT_KEYWORDS)) {
    const count = kws.filter((k) => text.includes(k.toLowerCase())).length;
    if (count > bestCount) {
      bestCount = count;
      best = subj;
    }
  }
  return best;
}

function subjectGuidance(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("math"))
    return "This is MATHEMATICS: give clear step-by-step working, state every formula used, and present the final result clearly (e.g. 'Final Answer: ...'). Put the key formula(s) in formulaOrDiagramHint.";
  if (s.includes("science"))
    return "This is SCIENCE: give precise definitions, a worked example, and where relevant describe the process or the diagram a student should draw. Put the diagram/process or formula to remember in formulaOrDiagramHint.";
  if (s.includes("social"))
    return "This is SOCIAL SCIENCE: include key dates, causes and effects, and a short timeline or sequence of events where relevant.";
  if (s.includes("english"))
    return "SUBJECT RULE — ENGLISH: For ALL literature questions (prose, poetry, drama, character, theme, extract) the answer MUST ALWAYS be written entirely in connected prose paragraphs. NEVER use bullet points, numbered lists, or fragmented list items. For grammar, letters, notices, advertisements, analytical paragraphs, emails, and story writing: follow the standard CBSE format required for that task type.";
  if (s.includes("hindi"))
    return "विषय नियम — हिंदी: साहित्य-संबंधी सभी प्रश्नों (गद्य, पद्य, नाटक, चरित्र, विषय, गद्यांश/काव्यांश) के उत्तर हमेशा सम्पूर्ण अनुच्छेदों में लिखें। किसी भी स्थिति में बिंदुओं या क्रमांकित सूची का प्रयोग नहीं करें। व्याकरण, पत्र, सूचना, विज्ञापन, अनुच्छेद-लेखन, ईमेल, कहानी-लेखन के लिए संबंधित CBSE प्रारूप का पालन करें।";
  return "Give a clear, CBSE/NCERT-aligned answer.";
}

/**
 * Returns true for grammar / writing-skills question types that should NOT
 * use the literature paragraph format even when the subject is English/Hindi.
 */
function isGrammarOrWritingSkillsQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const grammarPatterns = [
    /\btense\b/, /\bpassive\b/, /\bactive voice\b/, /\bdirect.*indirect\b/,
    /\bindirect.*direct\b/, /\bnarration\b/, /\bclause\b/, /\bconjunction\b/,
    /\bpreposition\b/, /\bmodal\b/, /\barticle\b/, /\bpunctuation\b/,
    /\bspelling\b/, /\bsynonym\b/, /\bantonym\b/, /\bone word\b/,
  ];
  const writingPatterns = [
    /\bletter\b/, /\bformal letter\b/, /\binformal letter\b/,
    /\bnotice\b/, /\badvertisement\b/, /\bemail\b/, /\bstory\b/,
    /\bparagraph writing\b/, /\banalytical paragraph\b/, /\bessay\b/,
    /\bdebate\b/, /\bspeech\b/,
  ];
  return (
    grammarPatterns.some((p) => p.test(q)) ||
    writingPatterns.some((p) => p.test(q))
  );
}

/**
 * Builds the literature-specific prose and structure instructions injected
 * into the system prompt for English/Hindi lit questions.
 */
function literaturePromptGuidance(
  subject: string,
  marks: number,
  hindiCourse: HindiCourse,
  wordRange: { min: number; max: number },
): string {
  const isHindi = subject.toLowerCase().includes("hindi");
  const needsIBC = requiresIntroBodyConclusion(marks);

  if (isHindi) {
    if (needsIBC) {
      return `हिंदी साहित्य — अनिवार्य प्रारूप (${marks} अंक):
उत्तर में तीन भाग होने चाहिए: भूमिका, मुख्य भाग, निष्कर्ष।
प्रत्येक भाग में अनुच्छेद होने चाहिए, बिंदु नहीं।
भूमिका और निष्कर्ष संक्षिप्त हों; मुख्य भाग में अधिकांश विवरण हो।
शब्द-सीमा: लगभग ${wordRange.min}–${wordRange.max} शब्द (शीर्षक शब्दों को छोड़कर)।
JSON में "literatureIntroduction", "literatureBody", "literatureConclusion" फ़ील्ड दें।
"examReadyAnswer" में तीनों भागों को एक साथ रखें।`;
    }
    return `हिंदी साहित्य — अनिवार्य प्रारूप (${marks} अंक):
उत्तर पूर्णतः अनुच्छेद में लिखें। बिंदुओं का प्रयोग न करें।
शब्द-सीमा: लगभग ${wordRange.min}–${wordRange.max} शब्द।
JSON में "examReadyAnswer" में पूरा उत्तर दें।`;
  }

  if (needsIBC) {
    return `ENGLISH LITERATURE — REQUIRED STRUCTURE (${marks} marks):
Write using three clearly labelled sections: Introduction, Body, Conclusion.
Each section must be written as paragraphs — never as bullet points or numbered lists.
Keep Introduction and Conclusion brief. Put most detail in Body.
Target word count: approximately ${wordRange.min}–${wordRange.max} words (excluding section headings).
Provide "literatureIntroduction", "literatureBody", "literatureConclusion" as separate JSON fields.
Also put the full answer combined in "examReadyAnswer".`;
  }
  return `ENGLISH LITERATURE — REQUIRED FORMAT (${marks} marks):
Write entirely in connected prose. Never use bullet points or numbered lists.
Target word count: approximately ${wordRange.min}–${wordRange.max} words.
Put the complete answer in "examReadyAnswer".`;
}

/**
 * For Science and Social Science, CBSE answers are expected as point lists sized
 * to the marks. Returns prompt guidance (empty string for other subjects).
 */
function isPointListSubject(subject: string): boolean {
  const s = subject.toLowerCase();
  return s.includes("science") || s.includes("social");
}

function cbsePointNorms(subject: string): string {
  if (!isPointListSubject(subject)) return "";
  return `CBSE ANSWER FORMAT (mandatory for ${subject}): write explanatory answers as clear numbered points, sized to the marks —
- 1 mark → 1 point
- 2 marks → 2 points
- 3 marks → 4 points (the 4th point is optional/bonus)
- 5 marks → 6 points (the 6th point is optional/bonus)
Each point must be one complete, self-contained sentence a student can write on a single line.`;
}

/**
 * Diagram instructions, tailored per subject.
 *
 * This used to return "" for anything that was not Science or Social Science,
 * so revision notes for Maths, English and Hindi never contained a single
 * diagram — the thing that makes notes scannable was available to two
 * subjects out of five. What a useful diagram *is* differs by subject, but
 * every subject has one; a flowchart of how to solve a quadratic is as
 * revisable as the water cycle.
 *
 * The gate now lives at the call sites rather than in here, so the answer
 * engine can keep its own (deliberately narrower) rule for board answers
 * while notes offer diagrams everywhere.
 */
function diagramGuidance(subject: string): string {
  const s = subject.toLowerCase();

  let examples: string;
  if (s.includes("math")) {
    examples =
      "the steps of a solving method, a classification of number/shape types, or how a theorem's conditions lead to its conclusion";
  } else if (s.includes("english") || s.includes("hindi")) {
    examples =
      "the plot structure of a chapter or poem, how characters relate to one another, or how a theme develops across the text";
  } else {
    examples = "a process, cycle, relationship, or cause-and-effect chain";
  }

  return `Where ${examples} would help understanding, include one or two simple diagrams as Mermaid definitions. Use only "flowchart TD" or "flowchart LR". Keep node labels short (max ~6 words), use plain alphanumeric node ids, and avoid special characters, quotes, or parentheses inside labels.`;
}

function intentGuidance(intent: string, chapter?: string): string {
  if (intent === "board_answer")
    return "Write the answer EXACTLY as a student should write it in the CBSE board exam to score full marks — proper structure, numbered points or short paragraphs, and the keywords examiners look for.";
  if (intent === "summary")
    return `Produce a COMPLETE chapter summary${chapter ? ` of "${chapter}"` : ""}: cover every key idea concisely as structured revision points.`;
  return "";
}

/**
 * Backend mirror of the frontend study-level config (src/lib/study-level.ts),
 * keyed by the same ids. Only the depth/tone guidance the model needs lives here
 * so the server never imports frontend code. Keep ids in sync with the frontend.
 */
const STUDY_LEVEL_GUIDANCE: Record<string, string> = {
  "just-getting-started":
    "The student is a complete beginner. Use very simple, encouraging language and short sentences. Lead with a plain explanation and an easy real-world example before any formal definition. Avoid jargon; if a technical term is unavoidable, explain it in plain words. Keep the answer light and not overwhelming.",
  "concept-explorer":
    "The student is building understanding. Explain the concept clearly in small, guided steps and define important terms simply. Make sure each step follows logically from the last so the idea sticks.",
  "classroom-confident":
    "The student wants a balanced, exam-style answer that is still easy to follow. Give a clear, NCERT-aligned answer with the key points and the right amount of detail for the marks.",
  "challenge-seeker":
    "The student wants to be challenged. Go deeper than the basics: include rigorous reasoning, a slightly harder worked example or edge case, and explicitly flag higher-order thinking and the common mistakes that lose marks.",
  "board-exam-warrior":
    "The student is preparing intensively for the CBSE board exam. For Science and Social Science, format the answer as numbered points sized to the marks. For English and Hindi literature, format as structured prose paragraphs (Introduction, Body, Conclusion for 5/6 marks). Always include the scoring keywords examiners reward and concise guidance on how to present for full marks.",
};

function studyLevelGuidance(studyLevel?: string): string {
  if (!studyLevel) return "";
  const guidance = STUDY_LEVEL_GUIDANCE[studyLevel];
  return guidance ? `STUDENT LEVEL: ${guidance}` : "";
}

interface AnswerPromptOpts {
  question: string;
  classLevel: number;
  subject: string;
  chapter?: string;
  intent: string;
  sourceBlock: string;
  sourceUrls?: string[];
  studyLevel?: string;
  /** Number of marks for the question (used for literature word-limit enforcement). */
  marks?: number;
  /** Hindi Course A or B, when known. */
  hindiCourse?: HindiCourse;
}

function buildStudyAnswerPrompt(o: AnswerPromptOpts): string {
  const userSources =
    o.sourceUrls && o.sourceUrls.length > 0
      ? `\nUser-provided source URLs to consider: ${o.sourceUrls.join(", ")}`
      : "";

  const isLit =
    isLiteratureSubject(o.subject) &&
    !isGrammarOrWritingSkillsQuestion(o.question);

  const marks = o.marks ?? 3;
  const hindiCourse = o.hindiCourse ?? "unknown";
  const wordRange = isLit
    ? getLiteratureWordRange(o.subject, marks, hindiCourse)
    : null;

  const litGuidance = isLit && wordRange
    ? literaturePromptGuidance(o.subject, marks, hindiCourse, wordRange)
    : "";

  const isHindi = o.subject.toLowerCase().includes("hindi");
  const needsIBC = isLit && requiresIntroBodyConclusion(marks);

  const litSchemaFields = isLit
    ? `
  "literatureFormat": "${needsIBC ? "intro_body_conclusion" : marks <= 2 ? "short_paragraph" : "developed_paragraph"}",
  "literatureIntroduction": ${needsIBC ? '"introductory paragraph"' : "null"},
  "literatureBody": ${needsIBC ? '"main body paragraph(s)"' : "null"},
  "literatureConclusion": ${needsIBC ? '"concluding paragraph"' : "null"},
  "literatureWordCount": "count of words in your answer content (excluding headings, as an integer)",
  "literatureTargetMin": ${wordRange?.min ?? "null"},
  "literatureTargetMax": ${wordRange?.max ?? "null"},`
    : `
  "literatureFormat": null,
  "literatureIntroduction": null,
  "literatureBody": null,
  "literatureConclusion": null,
  "literatureWordCount": null,
  "literatureTargetMin": null,
  "literatureTargetMax": null,`;

  const formattingRules = isLit
    ? `FORMATTING RULES (apply inside every JSON string value):
- Use **bold** only to highlight key terms and names.
- Do NOT use bullet points (-, *, +) or numbered lists (1. 2. 3.) anywhere in literature answers.
- Write in connected, flowing prose paragraphs only.
- For English/Hindi literature, never fragment ideas into separate list items.${isHindi ? "\n- Write the answer in Hindi." : ""}`
    : `FORMATTING RULES (apply inside every JSON string value):
- Use **bold** to highlight key terms, formulas, and technical words.
- Use numbered lists (1. 2. 3.) or bullet lists (- item) wherever content is list-like.
- For all mathematical expressions — fractions, equations, powers, roots — use LaTeX syntax: inline with $...$ (e.g. $\\frac{7}{2}$, $x^2 + y^2 = z^2$) and display (block) equations with $$...$$..
- Do NOT use plain slash notation like 7/2 or x^2 for math — always use LaTeX.
- Do NOT wrap the whole response in markdown — only use markdown inside the string values.`;

  return `Question/Task: "${o.question}"
Class: ${o.classLevel}
Subject: ${o.subject}
Chapter: ${o.chapter || "Not specified"}${userSources}

${subjectGuidance(o.subject)}
${litGuidance}
${intentGuidance(o.intent, o.chapter)}
${studyLevelGuidance(o.studyLevel)}
${isLit ? "" : cbsePointNorms(o.subject)}
${isLit || !isPointListSubject(o.subject) ? "" : diagramGuidance(o.subject)}

${o.sourceBlock ? `TRUSTED SOURCE EXCERPTS (synthesize the most accurate, CBSE-aligned answer; ignore anything irrelevant or low quality):\n${o.sourceBlock}\n` : ""}${formattingRules}

Return ONLY a valid JSON object (no markdown wrapper, no extra text) with exactly these fields:
{
  "title": "a concise title for this answer",
  "detectedSubject": "the CBSE subject",
  "chapter": "the chapter or topic this belongs to",
  "marksBand": "most likely board marks — one of '1 mark', '2 marks', '3 marks', '5 marks'",
  "confidence": "high | medium | low",
  "shortAnswer": "1-2 sentence direct answer",
  "examReadyAnswer": "complete, well-structured exam-ready CBSE answer${isLit ? " written entirely as connected prose paragraphs — NEVER bullet points or numbered lists" : ""}",
  "answerPoints": ${isLit ? "[] // MUST be empty for English/Hindi literature — all content goes in examReadyAnswer as prose paragraphs" : isPointListSubject(o.subject) ? '["the answer as CBSE-norm numbered points sized to marksBand (3 marks = 4 points with 4th optional, 5 marks = 6 points with 6th optional)"]' : "[]"},${litSchemaFields}
  "stepByStep": ${isLit ? "[]" : '["step 1", "step 2"]'},
  "keyConcept": "the single most important concept",
  "keyPointsToRemember": ${isLit ? '["key idea 1", "key idea 2"]' : '["point 1", "point 2"]'},
  "examKeywords": ["keyword 1", "keyword 2"],
  "commonMistake": "the single most common mistake",
  "commonMistakesToAvoid": ["mistake 1", "mistake 2"],
  "howToWriteInExam": "how to present this in the board exam to score full marks",
  "formulaOrDiagramHint": null,
  "diagrams": ${isLit ? "[]" : isPointListSubject(o.subject) ? '[{ "title": "short diagram title", "mermaid": "flowchart TD\\n  A[Start] --> B[Next]", "caption": "one-line caption" }]' : "[]"},
  "memoryTrick": "a mnemonic or memory aid",
  "examTip": "one specific CBSE exam tip",
  "funExplanation": "a simple real-world analogy",
  "relatedQuestions": ["a likely follow-up question", "another"],
  "quickQuiz": { "question": "an MCQ on this topic", "options": ["A", "B", "C", "D"], "correctAnswer": "the exact correct option text", "explanation": "why it is correct" },
  "sourceReferences": ["source domain or 'NCERT'"]
}`;
}

function toWebSource(s: ScrapedSource) {
  return {
    url: s.url,
    title: s.title,
    domain: s.domain,
    excerpt: s.excerpt ? s.excerpt.slice(0, 300) : null,
    status: s.status,
  };
}

interface BuildAnswerOpts {
  answerSource: string;
  subject: string;
  chapter?: string;
  intent: string;
  webSources: ScrapedSource[];
  sourceQuality: string;
  retrievalFailed: boolean;
}

function buildAnswerResponse(
  parsed: Record<string, unknown>,
  o: BuildAnswerOpts,
) {
  const quiz = (parsed.quickQuiz as Record<string, unknown>) ?? {};
  return {
    answerSource: o.answerSource,
    confidence: asString(parsed.confidence) || "medium",
    title: asNullableString(parsed.title),
    detectedSubject: asNullableString(parsed.detectedSubject) ?? o.subject,
    chapter: asNullableString(parsed.chapter) ?? o.chapter ?? null,
    marksBand: asNullableString(parsed.marksBand),
    shortAnswer: asString(parsed.shortAnswer),
    examReadyAnswer: asString(parsed.examReadyAnswer),
    answerPoints: asStringArray(parsed.answerPoints),
    diagrams: asDiagramList(parsed.diagrams),
    stepByStep: asStringArray(parsed.stepByStep),
    keyConcept: asString(parsed.keyConcept),
    keyPointsToRemember: asStringArray(parsed.keyPointsToRemember),
    examKeywords: asStringArray(parsed.examKeywords),
    commonMistake: asString(parsed.commonMistake),
    commonMistakesToAvoid: asStringArray(parsed.commonMistakesToAvoid),
    howToWriteInExam: asNullableString(parsed.howToWriteInExam),
    formulaOrDiagramHint: asNullableString(parsed.formulaOrDiagramHint),
    memoryTrick: asString(parsed.memoryTrick),
    examTip: asString(parsed.examTip),
    funExplanation: asNullableString(parsed.funExplanation),
    relatedQuestions: asStringArray(parsed.relatedQuestions),
    quickQuiz: {
      question: asString(quiz.question),
      options: asStringArray(quiz.options),
      correctAnswer: asString(quiz.correctAnswer),
      explanation: asString(quiz.explanation),
    },
    sourceReferences: asStringArray(parsed.sourceReferences),
    sourceComparisons: [],
    webSources: o.webSources.map(toWebSource),
    sourceQuality: o.sourceQuality,
    retrievalFailed: o.retrievalFailed,
    intent: o.intent,
    // Literature-specific fields
    literatureFormat: asNullableString(parsed.literatureFormat),
    literatureIntroduction: asNullableString(parsed.literatureIntroduction),
    literatureBody: asNullableString(parsed.literatureBody),
    literatureConclusion: asNullableString(parsed.literatureConclusion),
    literatureWordCount:
      typeof parsed.literatureWordCount === "number"
        ? parsed.literatureWordCount
        : typeof parsed.literatureWordCount === "string"
          ? parseInt(parsed.literatureWordCount, 10) || null
          : null,
    literatureTargetMin:
      typeof parsed.literatureTargetMin === "number"
        ? parsed.literatureTargetMin
        : null,
    literatureTargetMax:
      typeof parsed.literatureTargetMax === "number"
        ? parsed.literatureTargetMax
        : null,
  };
}

// ── Literature answer validation ──────────────────────────────────────────
function hasBulletPoints(text: string): boolean {
  return /^[\s]*[-*+]\s/m.test(text) || /^\s*\d+\.\s/m.test(text);
}

function validateLiteratureAnswer(
  parsed: Record<string, unknown>,
  marks: number,
): { valid: boolean; reason: string } {
  const examReady = typeof parsed.examReadyAnswer === "string" ? parsed.examReadyAnswer : "";
  const intro = typeof parsed.literatureIntroduction === "string" ? parsed.literatureIntroduction : "";
  const body = typeof parsed.literatureBody === "string" ? parsed.literatureBody : "";
  const conclusion = typeof parsed.literatureConclusion === "string" ? parsed.literatureConclusion : "";

  if (hasBulletPoints(examReady))
    return { valid: false, reason: "examReadyAnswer contains bullet/numbered points" };
  if (intro && hasBulletPoints(intro))
    return { valid: false, reason: "literatureIntroduction contains bullet/numbered points" };
  if (body && hasBulletPoints(body))
    return { valid: false, reason: "literatureBody contains bullet/numbered points" };
  if (conclusion && hasBulletPoints(conclusion))
    return { valid: false, reason: "literatureConclusion contains bullet/numbered points" };

  const answerPoints = Array.isArray(parsed.answerPoints) ? parsed.answerPoints : [];
  if (answerPoints.length > 0)
    return { valid: false, reason: "answerPoints must be empty for literature answers" };

  if (requiresIntroBodyConclusion(marks)) {
    if (!intro || intro.trim().length < 10)
      return { valid: false, reason: "5/6-mark literature answer missing Introduction" };
    if (!body || body.trim().length < 20)
      return { valid: false, reason: "5/6-mark literature answer missing Body" };
    if (!conclusion || conclusion.trim().length < 10)
      return { valid: false, reason: "5/6-mark literature answer missing Conclusion" };
  }

  return { valid: true, reason: "" };
}

// ── Trusted source retrieval (DuckDuckGo + direct site search + scrape) ────
async function retrieveWebSources(
  question: string,
  classLevel: number,
  subject: string,
  log: Logger,
): Promise<{ goodSources: ScrapedSource[]; allSources: ScrapedSource[] }> {
  const query = `${question} CBSE Class ${classLevel}${subject && subject !== "General" ? " " + subject : ""}`;
  const candidateUrls: { url: string; title: string }[] = [];

  // DuckDuckGo HTML (no API key required).
  try {
    const ddgRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StudyFilter/2.0)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(DDG_SEARCH_TIMEOUT_MS),
      },
    );
    if (ddgRes.ok) {
      const html = await ddgRes.text();
      const linkRe =
        /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) !== null && candidateUrls.length < 15) {
        try {
          const uddg = m[1].match(/uddg=([^&]+)/);
          const finalUrl = uddg ? decodeURIComponent(uddg[1]) : m[1];
          const title = m[2]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .trim();
          if (finalUrl.startsWith("http")) {
            candidateUrls.push({ url: finalUrl, title });
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    log.warn("DuckDuckGo search failed");
  }

  // Direct site-search fallback when DDG yields too few results.
  if (candidateUrls.length < 3) {
    const enc = encodeURIComponent(query);
    candidateUrls.push(
      { url: `https://www.teachoo.com/search/?q=${enc}`, title: "Teachoo" },
      { url: `https://doubtnut.com/search?q=${enc}`, title: "Doubtnut" },
      { url: `https://byjus.com/?s=${enc}`, title: "BYJU'S" },
      { url: `https://www.vedantu.com/search?q=${enc}`, title: "Vedantu" },
      { url: `https://brainly.in/search?q=${enc}`, title: "Brainly" },
      {
        url: `https://www.studyrankers.com/search?q=${enc}`,
        title: "StudyRankers",
      },
      {
        url: `https://www.shaalaa.com/question-bank-solutions?q=${enc}`,
        title: "Shaalaa",
      },
    );
  }

  const approved = candidateUrls
    .filter((c) => isApprovedDomain(c.url))
    .sort((a, b) => getPriorityScore(a.url) - getPriorityScore(b.url))
    .slice(0, 6);

  const allSources: ScrapedSource[] = await Promise.all(
    approved.map((c) => fetchPageFast(c, question)),
  );

  const goodSources = allSources
    .filter((s) => s.status === "ok" && s.excerpt && s.excerpt.length > 100)
    .slice(0, 4);

  return { goodSources, allSources };
}

// ── Unified CBSE answer engine ────────────────────────────────────────────
interface EngineParams {
  question: string;
  classLevel: number;
  subject?: string;
  chapter?: string;
  intent?: string;
  sourceUrls?: string[];
  studyLevel?: string;
  useWebSources?: boolean;
  apiKey: string;
  log: Logger;
  /** Number of marks for the question — drives word limits for English/Hindi lit. */
  marks?: number;
  /** Hindi Course A or B, when available from the student profile. */
  hindiCourse?: HindiCourse;
  /**
   * Overrides the interactive budget. Set only by the cache-once chapter
   * generators, where one slow request buys a result every later student
   * gets instantly.
   */
  budgetMs?: number;
}

async function generateCbseAnswer(p: EngineParams) {
  // Retrieval eats into the same budget as the model call, so track elapsed
  // time from entry and hand the model whatever is left, not a fixed window
  // that could push the total past the target.
  const budget = p.budgetMs ?? TOTAL_BUDGET_MS;
  const maxCall = p.budgetMs ? p.budgetMs : MODEL_CALL_MAX_TIMEOUT_MS;
  const startedAt = Date.now();
  function remainingModelTimeoutMs(): number {
    const elapsed = Date.now() - startedAt;
    const remaining = budget - elapsed;
    return Math.min(maxCall, Math.max(MODEL_CALL_MIN_TIMEOUT_MS, remaining));
  }

  const subject =
    p.subject && p.subject.trim().length > 0
      ? p.subject
      : detectSubject(p.question, p.chapter);
  const intent = p.intent || "qa";
  const marks = p.marks ?? 3;
  const hindiCourse = p.hindiCourse ?? "unknown";

  const isLit =
    isLiteratureSubject(subject) &&
    !isGrammarOrWritingSkillsQuestion(p.question);

  let goodSources: ScrapedSource[] = [];
  let allSources: ScrapedSource[] = [];
  let retrievalFailed = false;

  if (p.useWebSources) {
    try {
      const r = await retrieveWebSources(
        p.question,
        p.classLevel,
        subject,
        p.log,
      );
      goodSources = r.goodSources;
      allSources = r.allSources;
      if (goodSources.length === 0) retrievalFailed = true;
    } catch (err) {
      p.log.warn({ err }, "source retrieval failed");
      retrievalFailed = true;
    }
  }

  const sourceBlock =
    goodSources.length > 0
      ? goodSources
          .map(
            (s, i) =>
              `--- Source ${i + 1}: ${s.title} (${s.domain}) ---\n${s.excerpt}`,
          )
          .join("\n\n")
      : "";

  const systemPrompt = `You are StudyFilter, a CBSE study expert for Classes 8-12. You produce clean, accurate, board-exam-ready answers strictly aligned with the CBSE/NCERT curriculum. Return ONLY valid JSON with no extra text or markdown.`;

  const promptOpts: AnswerPromptOpts = {
    question: p.question,
    classLevel: p.classLevel,
    subject,
    chapter: p.chapter,
    intent,
    sourceBlock,
    sourceUrls: p.sourceUrls,
    studyLevel: p.studyLevel,
    marks,
    hindiCourse,
  };
  const userPrompt = buildStudyAnswerPrompt(promptOpts);

  const openai = getOpenAIClient(p.apiKey);

  async function callModel(prompt: string): Promise<Record<string, unknown>> {
    const completion = await openai.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        // A complete chapter summary fills substantially more of the StudyAnswer
        // schema than a single-question response. A 2,500-token cap regularly
        // truncated the JSON before its closing brace.
        max_completion_tokens: intent === "summary" ? 8000 : 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      },
      { timeout: remainingModelTimeoutMs() },
    );
    return extractOpenAIJson(completion, p.log);
  }

  let parsed = await callModel(userPrompt);

  // For literature answers, validate and attempt one controlled regeneration —
  // but only if there's still enough of the budget left for a second full
  // model call. Skipping a retry we can't afford beats guaranteeing the
  // request runs long; the first (unvalidated) answer still ships.
  if (isLit) {
    const { valid, reason } = validateLiteratureAnswer(parsed, marks);
    if (valid) {
      // no-op
    } else if (remainingModelTimeoutMs() <= MODEL_CALL_MIN_TIMEOUT_MS) {
      p.log.warn(
        { reason },
        "literature answer failed validation — skipping retry, out of time budget",
      );
    } else {
      p.log.warn({ reason }, "literature answer failed validation — retrying");
      const retryPrompt = `${userPrompt}\n\nCRITICAL REMINDER: The previous answer was rejected because: "${reason}". Please regenerate — write ONLY in connected prose paragraphs, with NO bullet points or numbered lists anywhere in the answer.`;
      parsed = await callModel(retryPrompt);
    }
  }

  const sourceQuality =
    goodSources.length >= 3
      ? "high"
      : goodSources.length >= 1
        ? "medium"
        : "low";
  const answerSource = !p.useWebSources
    ? "ai_trusted_sources"
    : goodSources.length > 0
      ? "web_search"
      : "ai_general";

  return buildAnswerResponse(parsed, {
    answerSource,
    subject,
    chapter: p.chapter,
    intent,
    webSources: allSources,
    sourceQuality,
    retrievalFailed,
  });
}

function buildLocalAnswer(lm: LocalQuestion, score: number) {
  return {
    answerSource: "local_data",
    confidence: score >= 85 ? "high" : "medium",
    title: lm.question,
    detectedSubject: lm.subject,
    chapter: lm.chapter,
    marksBand: null,
    shortAnswer: lm.bestAnswer,
    examReadyAnswer: lm.examReadyAnswer,
    stepByStep: lm.stepByStep,
    keyConcept: lm.keyConcept,
    keyPointsToRemember: [] as string[],
    examKeywords: [] as string[],
    commonMistake: lm.commonMistake,
    commonMistakesToAvoid: lm.commonMistake ? [lm.commonMistake] : [],
    howToWriteInExam: null,
    formulaOrDiagramHint: null,
    memoryTrick: lm.memoryTrick,
    examTip: lm.examTip,
    funExplanation: null,
    relatedQuestions: [] as string[],
    quickQuiz: {
      question: lm.quizQuestion,
      options: lm.quizOptions,
      correctAnswer: lm.correctQuizOption,
      explanation: lm.quizExplanation,
    },
    sourceReferences: ["StudyFilter CBSE Database"],
    sourceComparisons: [],
    webSources: [],
    sourceQuality: "high",
    retrievalFailed: false,
    intent: "qa",
    literatureFormat: null,
    literatureIntroduction: null,
    literatureBody: null,
    literatureConclusion: null,
    literatureWordCount: null,
    literatureTargetMin: null,
    literatureTargetMax: null,
  };
}

function buildNoApiKeyAnswer(
  subject: string | undefined,
  chapter: string | undefined,
  intent: string,
) {
  const msg =
    "Full answers aren't available right now. You can still use the local CBSE questions to keep studying.";
  return {
    answerSource: "no_api_key",
    confidence: "low",
    title: null,
    detectedSubject: subject ?? null,
    chapter: chapter ?? null,
    marksBand: null,
    shortAnswer: msg,
    examReadyAnswer: msg,
    stepByStep: ["Browse the local CBSE questions to keep studying."],
    keyConcept: "Temporarily unavailable",
    keyPointsToRemember: [] as string[],
    examKeywords: [] as string[],
    commonMistake: "",
    commonMistakesToAvoid: [] as string[],
    howToWriteInExam: null,
    formulaOrDiagramHint: null,
    memoryTrick: "",
    examTip: "Check your NCERT textbook for this question.",
    funExplanation: null,
    relatedQuestions: [] as string[],
    quickQuiz: { question: "", options: [], correctAnswer: "", explanation: "" },
    sourceReferences: [] as string[],
    sourceComparisons: [],
    webSources: [],
    sourceQuality: "low",
    retrievalFailed: null,
    intent,
    literatureFormat: null,
    literatureIntroduction: null,
    literatureBody: null,
    literatureConclusion: null,
    literatureWordCount: null,
    literatureTargetMin: null,
    literatureTargetMax: null,
  };
}

function asDiagramList(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      return {
        title: asNullableString(o.title),
        mermaid: asString(o.mermaid),
        caption: asNullableString(o.caption),
      };
    })
    .filter((d) => d.mermaid.length > 0);
}

function asNoteSectionList(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      return {
        heading: asString(o.heading),
        points: asStringArray(o.points),
      };
    })
    .filter((s) => s.heading.length > 0 && s.points.length > 0);
}

function asNoteTermList(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      return {
        term: asString(o.term),
        meaning: asString(o.meaning),
      };
    })
    .filter((t) => t.term.length > 0 && t.meaning.length > 0);
}

function asNcertAnswerList(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      question: asString(o.question),
      answer: asString(o.answer),
      marks: asNullableString(o.marks),
      points: asStringArray(o.points),
    };
  });
}

function asImportantQuestionList(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      question: asString(o.question),
      marks: asNullableString(o.marks),
      type: asNullableString(o.type),
      hint: asNullableString(o.hint),
    };
  });
}

// ── POST /api/study/ask (unified CBSE answer engine) ──────────────────────
router.post("/study/ask", async (req, res) => {
  const { question, classLevel, subject, chapter, sourceUrls, intent, studyLevel, marks, hindiCourse } =
    req.body;

  if (!question || !classLevel) {
    res.status(400).json({ error: "question and classLevel are required" });
    return;
  }

  // Run question analysis early — CPU-only, always cheap.
  const questionAnalysis = analyzeQuestion(
    question,
    subject ?? "unknown",
    chapter ?? undefined,
  );

  const reqIntent =
    intent === "board_answer" || intent === "summary" ? intent : "qa";

  const { question: localMatch, score } = findBestLocalMatch(
    question,
    classLevel,
    subject,
    chapter,
  );

  // Local data only answers plain Q&A confidently; richer intents go to the engine.
  if (localMatch && score >= 70 && reqIntent === "qa") {
    const base = buildLocalAnswer(localMatch, score);
    const answerId = storeAnswerContext({
      question,
      subject: subject ?? "unknown",
      chapter: chapter ?? undefined,
      originalExamReadyAnswer: base.examReadyAnswer,
      questionAnalysis,
      sourceExcerpts: "",
      sourceUrls: [],
    });
    res.json({ ...base, answerId, questionAnalysis });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    const base = buildNoApiKeyAnswer(subject, chapter, reqIntent);
    const answerId = storeAnswerContext({
      question,
      subject: subject ?? "unknown",
      chapter: chapter ?? undefined,
      originalExamReadyAnswer: base.examReadyAnswer,
      questionAnalysis,
      sourceExcerpts: "",
      sourceUrls: [],
    });
    res.json({ ...base, answerId, questionAnalysis });
    return;
  }

  const marksNum = typeof marks === "number" ? marks : (parseInt(marks, 10) || 3);
  const key = cacheKey({
    e: "ask",
    question,
    classLevel,
    subject: subject || "",
    chapter: chapter || "",
    intent: reqIntent,
    studyLevel: studyLevel || "",
    marks: String(marksNum),
    hindiCourse: hindiCourse || "",
  });
  const cached = cacheGet(key);
  if (cached) {
    // Re-analyze and re-store so the answerId context is always fresh (15-min TTL).
    // The cached base answer is already enriched but we want a live answerId.
    const cachedAny = cached as Record<string, unknown>;
    const freshAnswerId = storeAnswerContext({
      question,
      subject: subject ?? "unknown",
      chapter: chapter ?? undefined,
      originalExamReadyAnswer: (cachedAny.examReadyAnswer as string) ?? "",
      questionAnalysis,
      sourceExcerpts: (cachedAny._sourceExcerpts as string) ?? "",
      sourceUrls: (cachedAny._sourceUrls as string[]) ?? [],
    });
    res.json({ ...cached, answerId: freshAnswerId, questionAnalysis });
    return;
  }

  try {
    const answer = await generateCbseAnswer({
      question,
      classLevel,
      subject,
      chapter,
      intent: reqIntent,
      sourceUrls,
      studyLevel,
      useWebSources: true,
      apiKey,
      log: req.log,
      marks: marksNum,
      hindiCourse: hindiCourse as HindiCourse | undefined,
    });
    // Store context so /study/answer-variant can reuse it without re-scraping.
    const answerId = storeAnswerContext({
      question,
      subject: subject ?? "unknown",
      chapter: chapter ?? undefined,
      originalExamReadyAnswer: answer.examReadyAnswer ?? "",
      questionAnalysis,
      sourceExcerpts: (answer as Record<string, unknown>)._sourceExcerpts as string ?? "",
      sourceUrls: ((answer as Record<string, unknown>)._sourceUrls as string[]) ?? [],
    });
    const enriched = { ...answer, answerId, questionAnalysis };
    cacheSet(key, enriched);
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "ask engine error");
    res
      .status(500)
      .json({ error: "Failed to get an answer. Please try again." });
  }
});

// ── POST /api/study/answer-variant ────────────────────────────────────────
// Generates a Board-Exam-Mode formatted answer at a specific mark level,
// reusing the source context cached from /study/ask so no re-scraping.
router.post("/study/answer-variant", async (req, res) => {
  const { answerId, marks, contentLevel } = req.body;

  if (!answerId || typeof marks !== "number") {
    res.status(400).json({ error: "answerId and marks are required" });
    return;
  }

  const ctx = getAnswerContext(answerId);
  if (!ctx) {
    res.status(404).json({
      error: "Answer context has expired. Please ask your question again to get a fresh Board Exam answer.",
    });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res.status(503).json(missingApiKeyResponse());
    return;
  }

  const resolvedMarks = Math.min(Math.max(Math.round(marks), 1), 6) as AllowedMark;
  const markRule = getMarkRule(ctx.questionAnalysis.subject, ctx.questionAnalysis.questionType);
  const format: AnswerFormat = markRule.answerFormat;
  const maxTokens = BOARD_ANSWER_TOKEN_LIMITS[resolvedMarks] ?? 500;
  const wordLimitForMark = markRule.wordLimits?.[resolvedMarks];
  const targetMin = wordLimitForMark?.min ?? Math.round(resolvedMarks * 20);
  const targetMax = wordLimitForMark?.max ?? Math.round(resolvedMarks * 30);

  const level = contentLevel ?? "moderate";
  const contentLevelGuidance: Record<string, string> = {
    simple:       "Use very simple vocabulary. Short sentences. Avoid jargon. Perfect for students reading at a Class 8 level.",
    moderate:     "Use standard CBSE textbook language. Clear and precise. Suitable for Class 9-10.",
    intermediate: "Use subject-specific terminology. Demonstrate conceptual depth. Suitable for Class 11-12.",
    advanced:     "Use advanced academic vocabulary, show analytical depth, reference underlying principles. Exam-warrior level.",
  };
  const contentGuidance = contentLevelGuidance[level] ?? contentLevelGuidance.moderate;

  // Subject-specific numbered_points instruction
  const subj = ctx.questionAnalysis.subject;
  const isScienceSubject = subj === "science";
  const isSocialScience = subj === "social_science";

  const numberedPointsInstruction = isScienceSubject
    ? `Write exactly ${resolvedMarks} numbered points. Science answers MUST use numbered points. Include: relevant scientific principles, balanced chemical equations (where applicable), formulas with units, cause-and-effect explanations, and worked examples. Format: "1. ...\n2. ..." etc. No sub-bullets.`
    : isSocialScience
    ? `Write exactly ${resolvedMarks} numbered points. Social Science answers MUST use numbered points. Include: relevant causes/effects/features/arguments, key dates, important people or places, constitutional terms and economic concepts where relevant. Format: "1. ...\n2. ..." etc. No sub-bullets.`
    : `Write exactly ${resolvedMarks} numbered points. Each point: 1 sentence capturing a key fact. Format: "1. ...\n2. ..." etc. No sub-bullets.`;

  // Format-specific output instructions
  const formatInstructions: Record<AnswerFormat, string> = {
    direct: `Give a single direct answer in 1-2 sentences. No preamble.`,
    paragraph: `Write a coherent paragraph of ${targetMin}–${targetMax} words. No bullet points or headers. Prose only.`,
    intro_body_conclusion: `Write THREE clearly labeled sections:
INTRODUCTION: (1 sentence introducing the topic)
BODY: (${Math.max(targetMin - 30, 40)}–${Math.max(targetMax - 20, 60)} words covering key points)
CONCLUSION: (1 sentence wrapping up the significance)
No bullet points. Prose only throughout.`,
    numbered_points: numberedPointsInstruction,
    worked_solution: `Show a step-by-step solution with clearly numbered steps. End with a boxed final answer labelled "Final Answer:".`,
    case_study: `Address each part of the case study in order. Use short numbered answers for each sub-question.`,
    writing_format: `Follow the appropriate writing format (letter heading/date/body/closing, notice format, etc.) for the given task.`,
  };

  const sourceContext = ctx.sourceExcerpts
    ? `\n\nSOURCE CONTEXT (use this to ground your answer):\n${ctx.sourceExcerpts.slice(0, 1200)}`
    : "";

  const prompt = `You are a CBSE board exam answer expert for Class 8–12 students.
Generate a ${resolvedMarks}-mark board exam answer for the following question.

QUESTION: ${ctx.question}
SUBJECT: ${ctx.questionAnalysis.subject.replace(/_/g, " ")}
MARKS: ${resolvedMarks}
CONTENT LEVEL: ${level.toUpperCase()} — ${contentGuidance}
TARGET WORD COUNT: ${targetMin}–${targetMax} words (for the answer content, not counting labels)
ANSWER FORMAT: ${format.replace(/_/g, " ")}
CBSE PATTERN VERSION: ${CBSE_PATTERN_VERSION}${sourceContext}

FORMAT INSTRUCTIONS:
${formatInstructions[format]}

Respond with ONLY a JSON object (no markdown code block):
{
  "examReadyAnswer": "<full answer text including labels if format requires them>",
  "introduction": "<intro paragraph if IBC format, else null>",
  "body": "<body paragraph if IBC format, else null>",
  "conclusion": "<conclusion paragraph if IBC format, else null>",
  "answerPoints": [<array of point strings if numbered_points format, else []>],
  "workingSteps": [<array of step strings if worked_solution format, else []>],
  "finalAnswer": "<final boxed answer if worked_solution format, else null>",
  "scoringKeywords": [<3-5 key terms the examiner will reward>],
  "actualWordCount": <integer — actual word count of answer content>
}`;

  try {
    const client = getOpenAIClient(apiKey);
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        // Reasoning models only support the default temperature (1) and reject
        // other values, so only pin temperature for non-reasoning models.
        ...(isReasoningModel(OPENAI_MODEL) ? {} : { temperature: 0.3 }),
      },
      { timeout: MODEL_CALL_MAX_TIMEOUT_MS },
    );

    const parsed = (safeParseOpenAIJson(completion, req.log) ?? {}) as Record<string, unknown>;

    const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
    const asStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x))) : [];
    const asNullStr = (v: unknown): string | null =>
      typeof v === "string" ? v : null;

    const examReadyAnswer = asStr(parsed.examReadyAnswer);
    const actualWordCount =
      typeof parsed.actualWordCount === "number"
        ? parsed.actualWordCount
        : examReadyAnswer.split(/\s+/).filter(Boolean).length;

    res.json({
      examReadyAnswer,
      introduction: asNullStr(parsed.introduction),
      body: asNullStr(parsed.body),
      conclusion: asNullStr(parsed.conclusion),
      answerPoints: asStrArr(parsed.answerPoints),
      workingSteps: asStrArr(parsed.workingSteps),
      finalAnswer: asNullStr(parsed.finalAnswer),
      scoringKeywords: asStrArr(parsed.scoringKeywords),
      format,
      resolvedMarks,
      targetWordRange: { min: targetMin, max: targetMax },
      actualWordCount,
    });
  } catch (err) {
    req.log.error({ err }, "answer-variant error");
    res.status(500).json({ error: "Failed to generate the board exam variant. Please try again." });
  }
});

// ── POST /api/study/search-web (web-sourced CBSE answer) ─────────────────
router.post("/study/search-web", async (req, res) => {
  const { question, classLevel, subject, chapter, studyLevel } = req.body;

  if (!question || !classLevel) {
    res.status(400).json({ error: "question and classLevel are required" });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res
      .status(503)
      .json(missingApiKeyResponse());
    return;
  }

  const key = cacheKey({
    e: "search-web",
    question,
    classLevel,
    subject: subject || "",
    chapter: chapter || "",
    studyLevel: studyLevel || "",
  });
  const cached = cacheGet(key);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const answer = await generateCbseAnswer({
      question,
      classLevel,
      subject,
      chapter,
      intent: "qa",
      studyLevel,
      useWebSources: true,
      apiKey,
      log: req.log,
    });
    cacheSet(key, answer);
    res.json(answer);
  } catch (err) {
    req.log.error({ err }, "Web search synthesis error");
    res
      .status(500)
      .json({ error: "Failed to synthesize answer. Please try again." });
  }
});

// ── POST /api/study/practice-quiz ────────────────────────────────────────
router.post("/study/practice-quiz", async (req, res) => {
  const { classLevel, subject, chapter, topic, difficulty, count, formats, focus } = req.body;

  if (!classLevel) {
    res.status(400).json({ error: "classLevel is required" });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res
      .status(503)
      .json(missingApiKeyResponse());
    return;
  }

  const numQuestions = Math.min(Math.max(Number(count) || 10, 1), 30);
  const difficultyLevel = difficulty || "medium";
  const subjectName = subject && subject !== "Mixed" ? subject : "Mixed";
  const subjectLine =
    subjectName !== "Mixed"
      ? `Subject: ${subjectName}`
      : "Subject: Mixed (cover Maths, Science, Social Science, and English roughly equally)";
  const chapterLine = chapter ? `\nChapter: ${chapter}` : "";
  const topicLine = topic ? `\nTopic focus: ${topic}` : "";
  const scopeRule = chapter
    ? `\n- EVERY question MUST come from the "${chapter}" chapter${topic ? ` (focus on "${topic}")` : ""} of the Class ${classLevel} ${subjectName} NCERT syllabus — do NOT include questions from other chapters`
    : "";

  const difficultyGuide =
    difficultyLevel === "easy"
      ? "straightforward recall — definitions, basic facts, direct application"
      : difficultyLevel === "hard"
        ? "challenging inference, multi-step reasoning, and application"
        : "moderate questions requiring understanding and application, not just recall";

  /*
   * Question formats.
   *
   * This endpoint only ever produced four-option MCQs, which is why the quiz
   * builder could offer nothing else. Every format below still returns the
   * same {question, options, correctAnswer} shape — a true/false is a
   * two-option MCQ, a fill-in-the-blank is a sentence with a gap and four
   * candidate fillers — so the player renders them all without special cases,
   * and the only thing that changes is how the question is written.
   */
  const FORMAT_RULES: Record<string, string> = {
    mcq: "Standard multiple choice with exactly 4 plausible options.",
    true_false:
      'A statement to judge. Options are exactly ["True", "False"]. The statement must be unambiguously one or the other.',
    fill_blank:
      "A sentence with one blank written as ______ . Give 4 candidate fillers as options; only one completes it correctly.",
    assertion_reason:
      'Write "Assertion (A): ... Reason (R): ..." in the question, and use exactly these 4 options: ["Both A and R are true and R is the correct explanation of A", "Both A and R are true but R is not the correct explanation of A", "A is true but R is false", "A is false but R is true"].',
    multi_select:
      'Several statements are correct. Options are combinations such as "(i) and (iii) only" — exactly one combination is fully correct.',
    short:
      "A one-line answer question. Give 4 short candidate answers as options, only one of which is exactly right.",
  };

  const requestedFormats: string[] = Array.isArray(formats)
    ? formats.map((f: unknown) => String(f)).filter((f) => f in FORMAT_RULES)
    : [];
  const activeFormats = requestedFormats.length > 0 ? requestedFormats : ["mcq"];
  const formatBlock =
    activeFormats.length === 1 && activeFormats[0] === "mcq"
      ? ""
      : `\n\nQuestion formats — spread the ${numQuestions} questions across these, roughly evenly:\n${activeFormats
          .map((f) => `- "${f}": ${FORMAT_RULES[f]}`)
          .join("\n")}\nSet "format" on each question to the format you used.`;

  /*
   * Weak-concept focus. Sent by "practise your weak areas", which knows from
   * the mastery store which concepts this student keeps getting wrong.
   */
  const focusList: string[] = Array.isArray(focus)
    ? focus.map((f: unknown) => String(f).trim()).filter(Boolean).slice(0, 8)
    : [];
  const focusBlock =
    focusList.length > 0
      ? `\n\nThis student is weak on these specific concepts — at least two-thirds of the questions must test them directly:\n${focusList.map((f) => `- ${f}`).join("\n")}`
      : "";

  const systemPrompt = `You are a CBSE exam expert creating practice questions for Classes 8-12, strictly aligned with the NCERT curriculum. Return ONLY valid JSON, no extra text or markdown.`;

  const userPrompt = `Generate ${numQuestions} CBSE practice questions.
Class: ${classLevel}
${subjectLine}${chapterLine}${topicLine}
Difficulty: ${difficultyLevel} — ${difficultyGuide}${formatBlock}${focusBlock}

Return a JSON object:
{
  "questions": [
    {
      "id": "q1",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": "exact text of the correct option",
      "explanation": "why it is correct, with NCERT reference where possible",
      "subject": "subject name",
      "chapter": "NCERT chapter name (short form)",
      "topic": "the single concept this question tests, 1-4 words",
      "format": "${activeFormats[0]}",
      "difficulty": "${difficultyLevel}"
    }
  ]
}

Rules:
- Every option must be plausible; no filler options
- correctAnswer must be EXACTLY one of the option strings, character for character
- "topic" must be a concept name a student would recognise ("Ohm's law", "Series resistance"), not a restatement of the question — it is used to tell them what to revise
- Questions must be from the Class ${classLevel} NCERT syllabus${scopeRule}
- No repeated questions, and no two questions testing the same fact`;

  try {
    const openai = getOpenAIClient(apiKey);
    const completion = await openai.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        // Ten complete questions with explanations regularly exceed 2,500
        // tokens, especially on reasoning models. Size the budget to the
        // requested quiz while keeping a hard ceiling for cost control.
        max_completion_tokens: Math.min(12_000, 2_500 + numQuestions * 550),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      // Quiz generation is a larger structured response than a single answer.
      // A 12-second deadline caused valid generations to be cancelled in
      // production before their JSON closing brace arrived.
      { timeout: 40_000 },
    );

    const parsed = extractOpenAIJson(completion, req.log);
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("Invalid quiz format");
    }

    const questions = (parsed.questions as Record<string, unknown>[]).map(
      (q, idx) => ({
        id: asString(q.id) || `q${idx + 1}`,
        question: asString(q.question),
        options: asStringArray(q.options),
        correctAnswer: asString(q.correctAnswer),
        explanation: asString(q.explanation),
        subject: asString(q.subject) || subjectName,
        chapter: asString(q.chapter),
        topic: asString(q.topic),
        format: asString(q.format) || activeFormats[0],
        difficulty: asString(q.difficulty) || difficultyLevel,
      }),
    )
    // A question whose correctAnswer isn't one of its own options can never be
    // answered correctly. That used to reach the player and silently mark a
    // right answer wrong; dropping it is the only honest handling.
    .filter((q) => q.question && q.options.length >= 2 && q.options.includes(q.correctAnswer));

    if (questions.length === 0) {
      throw new Error("No well-formed questions returned");
    }

    res.json({ questions });
  } catch (err) {
    req.log.error({ err }, "Practice quiz generation error");
    res
      .status(500)
      .json({ error: "Failed to generate quiz. Please try again." });
  }
});

// ── POST /api/study/fetch-sources ────────────────────────────────────────
router.post("/study/fetch-sources", async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls)) {
    res.status(400).json({ error: "urls array is required" });
    return;
  }

  const results = await Promise.all(
    urls.slice(0, 3).map(async (url: string) => {
      if (!isApprovedDomain(url)) {
        return {
          url,
          title: "",
          excerpt: null,
          status: "rejected",
          reason: "Domain not approved",
        };
      }
      return fetchPageFast({ url, title: url }, "");
    }),
  );

  res.json(results);
});

// ── POST /api/study/compare ──────────────────────────────────────────────
router.post("/study/compare", async (req, res) => {
  const { question, classLevel, subject, chapter, answers } = req.body;

  if (!question || !answers || !Array.isArray(answers) || answers.length < 2) {
    res
      .status(400)
      .json({ error: "question and at least 2 answers are required" });
    return;
  }

  const scores = answers.map((a: { sourceName: string; answer: string }) => ({
    sourceName: a.sourceName,
    ...scoreAnswer(a.answer, question, subject, chapter),
  }));

  const best = scores.reduce((prev, curr) =>
    curr.total > prev.total ? curr : prev,
  );

  const bestAnswer =
    answers.find(
      (a: { sourceName: string; answer: string }) =>
        a.sourceName === best.sourceName,
    )?.answer || "";

  let finalAnswer: string | null = null;
  const apiKey = getOpenAIApiKey();
  if (apiKey) {
    try {
      const openai = getOpenAIClient(apiKey);
      const completion = await openai.chat.completions.create(
        {
          model: OPENAI_MODEL,
          ...REASONING_EFFORT_PARAMS,
          max_completion_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `You are a CBSE exam expert. Given these answers to "${question}" (Class ${classLevel} ${subject}), create ONE clean exam-ready CBSE answer combining the best parts. Return only the answer text.\n\n${answers.map((a: { sourceName: string; answer: string }, i: number) => `Answer ${i + 1} (${a.sourceName}):\n${a.answer}`).join("\n\n")}`,
            },
          ],
        },
        { timeout: MODEL_CALL_MAX_TIMEOUT_MS },
      );
      const c = completion.choices[0]?.message?.content;
      if (c) finalAnswer = c.trim();
    } catch {
      /* ignore */
    }
  }

  res.json({
    scores,
    bestSource: best.sourceName,
    bestAnswer,
    reasoning: `"${best.sourceName}" scored highest (${best.total}/100) for CBSE alignment, clarity, and exam readiness.`,
    finalAnswer,
  });
});

// ── POST /api/study/ocr ──────────────────────────────────────────────────
// Free, open-source OCR pipeline: sharp (preprocessing) + tesseract.js (OCR).
// Works with no OPENAI_API_KEY. If a key IS configured, OpenAI is used only to
// tidy up whitespace/formatting of the text Tesseract already extracted — it
// never invents text and never solves the question.
const OCR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const OCR_MAX_BYTES = 8 * 1024 * 1024; // 8MB

function cleanOcrText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function cleanupOcrWithOpenAI(
  rawText: string,
  log: Logger,
): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey || !rawText.trim()) return rawText;

  try {
    const openai = getOpenAIClient(apiKey);
    const completion = await openai.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        max_completion_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Clean up ONLY the formatting/whitespace of this OCR-extracted text from a CBSE student's textbook/notes image. Fix obvious line-break artifacts and preserve numbered questions/options. Do NOT add, remove, translate, or invent any content — return only the cleaned text with no commentary or markdown:\n\n${rawText}`,
          },
        ],
      },
      { timeout: MODEL_CALL_MAX_TIMEOUT_MS },
    );
    const cleaned = completion.choices[0]?.message?.content?.trim();
    return cleaned && cleaned.length > 0 ? cleaned : rawText;
  } catch (err) {
    log.warn({ err }, "OCR formatting cleanup via OpenAI failed, using raw Tesseract text");
    return rawText;
  }
}

router.post("/study/ocr", async (req, res) => {
  const { imageBase64, mediaType } = req.body;

  if (!imageBase64 || !mediaType) {
    res.status(400).json({ error: "imageBase64 and mediaType are required" });
    return;
  }

  if (!OCR_ALLOWED_TYPES.includes(mediaType)) {
    res.status(400).json({
      error: "Unsupported image type. Please upload a JPG, PNG, or WebP image.",
    });
    return;
  }

  let inputBuffer: Buffer;
  try {
    inputBuffer = Buffer.from(imageBase64, "base64");
  } catch {
    res.status(400).json({ error: "imageBase64 is not valid base64 data." });
    return;
  }

  if (inputBuffer.length === 0) {
    res.status(400).json({ error: "The uploaded image is empty." });
    return;
  }
  if (inputBuffer.length > OCR_MAX_BYTES) {
    res
      .status(400)
      .json({ error: "Image is too large. Please upload an image under 8MB." });
    return;
  }

  try {
    const sharp = (await import("sharp")).default;

    const preprocessed = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 2000, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .grayscale()
      .normalize()
      .sharpen()
      .toFormat("png")
      .toBuffer();

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    let rawText = "";
    let confidencePct = 0;
    try {
      const {
        data: { text, confidence },
      } = await worker.recognize(preprocessed);
      rawText = text || "";
      confidencePct = confidence || 0;
    } finally {
      await worker.terminate();
    }

    const cleanedText = cleanOcrText(rawText);

    if (!cleanedText) {
      res.status(422).json({
        error: "Could not detect any readable text in this image. Try a clearer photo.",
      });
      return;
    }

    const finalText = await cleanupOcrWithOpenAI(cleanedText, req.log);

    const confidence =
      confidencePct >= 75 ? "high" : confidencePct >= 45 ? "medium" : "low";

    res.json({
      extractedText: finalText,
      confidence,
      hint: null,
    });
  } catch (err) {
    req.log.error({ err }, "OCR error");
    res
      .status(500)
      .json({ error: "Failed to extract text. Please try again." });
  }
});

// ── POST /api/study/summary (chapter summary) ────────────────────────────
router.post("/study/summary", async (req, res) => {
  const { classLevel, subject, chapter, topic } = req.body;

  if (!classLevel || !subject || !chapter) {
    res
      .status(400)
      .json({ error: "classLevel, subject, and chapter are required" });
    return;
  }

  const focus = topic ? ` focusing on "${topic}"` : "";
  const question = `Give a complete CBSE Class ${classLevel} ${subject} chapter summary of "${chapter}"${focus}.`;

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res.json(buildNoApiKeyAnswer(subject, chapter, "summary"));
    return;
  }

  const key = cacheKey({
    e: "summary",
    classLevel,
    subject,
    chapter,
    topic: topic || "",
  });
  /*
   * "Refresh" has to actually regenerate.
   *
   * The row in generated_content is permanent by design — a chapter summary
   * that changed every visit would be worse than useless for revision. But
   * that also meant a Refresh button could only ever return the identical
   * bytes after a spinner, which is a lie told with a loading state. This flag
   * is the one path that bypasses the stored copy; everything else still gets
   * it, so study material stays stable unless the student asks for new.
   */
  const forceRefresh = req.body?.refresh === true;
  const cached = forceRefresh ? null : await generatedGet(key, req.log);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const answer = await generateCbseAnswer({
      question,
      classLevel,
      subject,
      chapter,
      intent: "summary",
      useWebSources: true,
      apiKey,
      log: req.log,
      budgetMs: GENERATION_BUDGET_MS,
    });
    await generatedSet(key, "summary", { subject, chapter, classLevel }, answer, req.log);
    res.json(answer);
  } catch (err) {
    req.log.error({ err }, "summary engine error");
    res
      .status(500)
      .json({ error: "Failed to generate summary. Please try again." });
  }
});

// ── POST /api/study/ncert-answers ────────────────────────────────────────
router.post("/study/ncert-answers", async (req, res) => {
  const { classLevel, subject, chapter } = req.body;

  if (!classLevel || !subject || !chapter) {
    res
      .status(400)
      .json({ error: "classLevel, subject, and chapter are required" });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res.status(503).json(missingApiKeyResponse());
    return;
  }

  const key = cacheKey({ e: "ncert", classLevel, subject, chapter });
  /*
   * "Refresh" has to actually regenerate.
   *
   * The row in generated_content is permanent by design — a chapter summary
   * that changed every visit would be worse than useless for revision. But
   * that also meant a Refresh button could only ever return the identical
   * bytes after a spinner, which is a lie told with a loading state. This flag
   * is the one path that bypasses the stored copy; everything else still gets
   * it, so study material stays stable unless the student asks for new.
   */
  const forceRefresh = req.body?.refresh === true;
  const cached = forceRefresh ? null : await generatedGet(key, req.log);
  if (cached) {
    res.json(cached);
    return;
  }

  const systemPrompt = `You are a CBSE expert. You produce NCERT textbook (in-text and exercise) questions with model, exam-ready answers, strictly aligned to the NCERT syllabus. Return ONLY valid JSON, no extra text.`;
  const pointSubject = isPointListSubject(subject);
  const userPrompt = `For CBSE Class ${classLevel} ${subject}, chapter "${chapter}", list the most important NCERT in-text and exercise questions WITH model answers.
${pointSubject ? `\n${cbsePointNorms(subject)}\nFor every answer, also provide a "points" array containing the model answer broken into CBSE-norm numbered points sized to the marks (3 marks = 4 points with the 4th optional, 5 marks = 6 points with the 6th optional). Keep "answer" as a short connecting summary.\n` : ""}
Return a JSON object:
{
  "answers": [
    { "question": "the NCERT question", "answer": "the complete model answer", "marks": "e.g. '3 marks' or null"${pointSubject ? ', "points": ["point 1", "point 2", "point 3", "point 4"]' : ""} }
  ]
}
Include 6-12 of the most important questions. Keep answers exam-ready and concise.`;

  try {
    const openai = getOpenAIClient(apiKey);
    const completion = await openai.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        // Six to twelve model answers cannot reliably fit in 2,500 tokens.
        max_completion_tokens: 7000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      { timeout: GENERATION_BUDGET_MS },
    );
    const parsed = extractOpenAIJson(completion, req.log);
    const answers = asNcertAnswerList(parsed.answers);
    const result = { subject, chapter, answers, retrievalFailed: false };
    await generatedSet(key, "ncert_answers", { subject, chapter, classLevel }, result, req.log);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "ncert-answers error");
    res
      .status(500)
      .json({ error: "Failed to generate NCERT answers. Please try again." });
  }
});

// ── POST /api/study/important-questions ──────────────────────────────────
router.post("/study/important-questions", async (req, res) => {
  const { classLevel, subject, chapter } = req.body;

  if (!classLevel || !subject || !chapter) {
    res
      .status(400)
      .json({ error: "classLevel, subject, and chapter are required" });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res
      .status(503)
      .json(missingApiKeyResponse());
    return;
  }

  const key = cacheKey({ e: "important", classLevel, subject, chapter });
  /*
   * "Refresh" has to actually regenerate.
   *
   * The row in generated_content is permanent by design — a chapter summary
   * that changed every visit would be worse than useless for revision. But
   * that also meant a Refresh button could only ever return the identical
   * bytes after a spinner, which is a lie told with a loading state. This flag
   * is the one path that bypasses the stored copy; everything else still gets
   * it, so study material stays stable unless the student asks for new.
   */
  const forceRefresh = req.body?.refresh === true;
  const cached = forceRefresh ? null : await generatedGet(key, req.log);
  if (cached) {
    res.json(cached);
    return;
  }

  const systemPrompt = `You are a CBSE board-exam expert. You list the most important, frequently-asked questions for a chapter, strictly aligned to the CBSE/NCERT syllabus. Return ONLY valid JSON, no extra text.`;
  const userPrompt = `For CBSE Class ${classLevel} ${subject}, chapter "${chapter}", list the most important questions likely to appear in the board exam.

Return a JSON object:
{
  "questions": [
    { "question": "the question", "marks": "1 mark | 2 marks | 3 marks | 5 marks", "type": "VSA | SA | LA | MCQ", "hint": "a one-line hint or null" }
  ]
}
Include 8-12 questions across a mix of marks and types.`;

  try {
    const openai = getOpenAIClient(apiKey);
    const completion = await openai.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        max_completion_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      { timeout: GENERATION_BUDGET_MS },
    );
    const parsed = extractOpenAIJson(completion, req.log);
    const questions = asImportantQuestionList(parsed.questions);
    const result = { subject, chapter, questions };
    await generatedSet(key, "important_questions", { subject, chapter, classLevel }, result, req.log);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "important-questions error");
    res.status(500).json({
      error: "Failed to generate important questions. Please try again.",
    });
  }
});

// ── POST /api/study/revision-notes ───────────────────────────────────────
router.post("/study/revision-notes", async (req, res) => {
  const { classLevel, subject, chapter, topic } = req.body;

  if (!classLevel || !subject || !chapter) {
    res
      .status(400)
      .json({ error: "classLevel, subject, and chapter are required" });
    return;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    res
      .status(503)
      .json(missingApiKeyResponse());
    return;
  }

  const key = cacheKey({
    e: "notes",
    classLevel,
    subject,
    chapter,
    topic: topic || "",
  });
  /*
   * "Refresh" has to actually regenerate.
   *
   * The row in generated_content is permanent by design — a chapter summary
   * that changed every visit would be worse than useless for revision. But
   * that also meant a Refresh button could only ever return the identical
   * bytes after a spinner, which is a lie told with a loading state. This flag
   * is the one path that bypasses the stored copy; everything else still gets
   * it, so study material stays stable unless the student asks for new.
   */
  const forceRefresh = req.body?.refresh === true;
  const cached = forceRefresh ? null : await generatedGet(key, req.log);
  if (cached) {
    res.json(cached);
    return;
  }

  const focus = topic ? ` Focus especially on "${topic}".` : "";
  const systemPrompt = `You are a CBSE study expert. You produce clean, accurate, easy-to-revise notes strictly aligned with the CBSE/NCERT curriculum. Return ONLY valid JSON, no extra text or markdown.`;
  const userPrompt = `Create easy-to-revise notes for CBSE Class ${classLevel} ${subject}, chapter "${chapter}".${focus}

Make them scannable for last-minute revision: short, dense, high-yield points a student can read quickly before the exam.

${diagramGuidance(subject)}

Return a JSON object with these fields (use empty arrays or null where not relevant):
{
  "title": "a concise notes title",
  "overview": "2-3 sentence chapter overview",
  "sections": [ { "heading": "a topic heading", "points": ["short point", "short point"] } ],
  "keyTerms": [ { "term": "term", "meaning": "short definition" } ],
  "formulae": ["formula 1"],
  "importantDates": [ { "term": "year/date", "meaning": "what happened" } ],
  "mnemonics": ["a memory aid"],
  "quickRevision": ["one-line last-minute fact"],
  "diagrams": [ { "title": "short title", "mermaid": "flowchart TD\\n  A[Start] --> B[Next]", "caption": "one-line caption" } ]
}
Use "formulae" mainly for Science/Maths and "importantDates" mainly for Social Science. Provide 4-8 sections covering the whole chapter.`;

  try {
    const openai = getOpenAIClient(apiKey);
    const completion = await openai.chat.completions.create(
      {
        model: OPENAI_MODEL,
        ...REASONING_EFFORT_PARAMS,
        max_completion_tokens: 7000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      { timeout: GENERATION_BUDGET_MS },
    );
    const parsed = extractOpenAIJson(completion, req.log);
    const result = {
      subject,
      chapter,
      title: asNullableString(parsed.title),
      overview: asNullableString(parsed.overview),
      sections: asNoteSectionList(parsed.sections),
      keyTerms: asNoteTermList(parsed.keyTerms),
      formulae: asStringArray(parsed.formulae),
      importantDates: asNoteTermList(parsed.importantDates),
      mnemonics: asStringArray(parsed.mnemonics),
      quickRevision: asStringArray(parsed.quickRevision),
      diagrams: asDiagramList(parsed.diagrams),
    };
    await generatedSet(key, "revision_notes", { subject, chapter, classLevel }, result, req.log);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "revision-notes error");
    res
      .status(500)
      .json({ error: "Failed to generate revision notes. Please try again." });
  }
});

// ── GET /api/study/local-questions ───────────────────────────────────────
router.get("/study/local-questions", (req, res) => {
  const { classLevel, subject, chapter } = req.query;

  let filtered = [...sampleQuestions];
  if (classLevel)
    filtered = filtered.filter((q) => q.classLevel === Number(classLevel));
  if (subject)
    filtered = filtered.filter(
      (q) => q.subject.toLowerCase() === String(subject).toLowerCase(),
    );
  if (chapter)
    filtered = filtered.filter((q) =>
      q.chapter.toLowerCase().includes(String(chapter).toLowerCase()),
    );

  res.json(filtered);
});

export default router;
