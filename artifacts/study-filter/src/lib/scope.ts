/**
 * Where the student currently is, as data.
 *
 * BOARD → CLASS → SUBJECT → CHAPTER → TOPIC.
 *
 * This is the fix for the single most tiring thing about the old product: the
 * five command-bar modes all funnelled into one text box, so a student sitting
 * inside "Class 10 · Science · Electricity" still had to type "class 10 cbse
 * science electricity" to get a quiz about it. Every feature that needs to
 * know what is being studied now reads one scope instead of asking again.
 *
 * Two rules make it behave:
 *
 * 1. **The URL wins.** A scope encoded in the query string is authoritative,
 *    so `/quiz?subject=science&chapter=electricity` is a real, shareable,
 *    refreshable location rather than a page that depends on what you clicked
 *    before you got there.
 * 2. **Otherwise the last place you were wins.** Opening `/quiz` cold picks up
 *    the chapter you were just reading, because that is obviously what you
 *    meant.
 *
 * Nothing is invented. A scope with no chapter stays a scope with no chapter,
 * and features that need one ask for it explicitly rather than guessing.
 */

import { SUBJECTS, GRADE, type Chapter, type Subject, type SubjectId } from "@workspace/cbse-content";

/** The only board modelled today. Named so the shape is ready for a second. */
export const BOARD = "CBSE" as const;
export type Board = typeof BOARD;

export interface StudyScope {
  board: Board;
  classLevel: number;
  subjectId: SubjectId | null;
  chapterId: string | null;
  /** A sub-topic inside the chapter, free text — "Ohm's law", "Series circuits". */
  topic: string | null;
}

export const EMPTY_SCOPE: StudyScope = {
  board: BOARD,
  classLevel: GRADE,
  subjectId: null,
  chapterId: null,
  topic: null,
};

/** A scope with its content-model objects looked up. */
export interface ResolvedScope extends StudyScope {
  subject: Subject | null;
  chapter: Chapter | null;
  /** True when there is enough context to generate chapter-specific material. */
  hasChapter: boolean;
  /** "Class 10 · CBSE" / "Science · Electricity" — for breadcrumbs and eyebrows. */
  label: string;
  /** Short label for chips: "Electricity" or "Science" or "Class 10". */
  shortLabel: string;
}

export function resolveScope(scope: StudyScope): ResolvedScope {
  const subject = scope.subjectId
    ? (SUBJECTS.find((s) => s.id === scope.subjectId) ?? null)
    : null;
  const chapter =
    subject && scope.chapterId
      ? (subject.chapters.find((c) => c.id === scope.chapterId) ?? null)
      : null;

  const parts = [`Class ${scope.classLevel} · ${scope.board}`];
  if (subject) parts.push(subject.name);
  if (chapter) parts.push(chapter.title);
  if (scope.topic) parts.push(scope.topic);

  return {
    ...scope,
    // A chapter id that no longer resolves (renamed chapter, stale bookmark)
    // must not leave a dangling id behind that later gets sent to the API.
    subjectId: subject?.id ?? null,
    chapterId: chapter?.id ?? null,
    subject,
    chapter,
    hasChapter: !!chapter,
    label: parts.join(" · "),
    shortLabel: scope.topic ?? chapter?.title ?? subject?.name ?? `Class ${scope.classLevel}`,
  };
}

/**
 * The context object the study endpoints already accept.
 *
 * `subject` and `chapter` are sent as display names because that is what the
 * existing `/study/*` routes were built to take, and what the generated-content
 * cache is keyed on. Changing that would invalidate every cached summary.
 */
export interface ApiScope {
  classLevel: number;
  subject: string;
  chapter: string;
  topic?: string;
}

export function toApiScope(scope: ResolvedScope, fallbackChapter = ""): ApiScope {
  return {
    classLevel: scope.classLevel,
    subject: scope.subject?.name ?? "General",
    chapter: scope.chapter?.title ?? fallbackChapter,
    ...(scope.topic ? { topic: scope.topic } : {}),
  };
}

// ── URL encoding ─────────────────────────────────────────────────────────────

/**
 * Scope lives in the query string, not the path.
 *
 * A path like `/quiz/science/electricity` reads nicely but forces a new
 * `<Route>` and a new production rewrite for every optional segment
 * combination, and the deploy silently 404s anything missing from that
 * allowlist. One route plus query parameters is one rewrite and still gives a
 * URL that can be refreshed, bookmarked and shared.
 */
export function scopeToSearch(scope: Partial<StudyScope>): string {
  const params = new URLSearchParams();
  if (scope.subjectId) params.set("subject", scope.subjectId);
  if (scope.chapterId) params.set("chapter", scope.chapterId);
  if (scope.topic) params.set("topic", scope.topic);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function scopeFromSearch(search: string): Partial<StudyScope> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const subjectId = params.get("subject");
  const chapterId = params.get("chapter");
  const topic = params.get("topic");
  const out: Partial<StudyScope> = {};
  if (subjectId) out.subjectId = subjectId as SubjectId;
  if (chapterId) out.chapterId = chapterId;
  if (topic) out.topic = topic;
  return out;
}

/** Builds a link to a feature route carrying the current scope. */
export function scopedHref(path: string, scope: Partial<StudyScope>): string {
  return `${path}${scopeToSearch(scope)}`;
}

// ── Subject shape ────────────────────────────────────────────────────────────

/**
 * What kind of subject this is, which decides which revision formats and
 * question types make sense.
 *
 * "Show every format for every subject" is what made the old revision surface
 * feel generic — offering "Formulas" for a Hindi poem and "Timeline" for
 * Trigonometry. This is the discriminator the revision workspace switches on.
 */
export type SubjectShape = "science" | "maths" | "humanities" | "literature";

export function subjectShape(subjectId: SubjectId | null | undefined): SubjectShape {
  switch (subjectId) {
    case "mathematics":
      return "maths";
    case "science":
      return "science";
    case "social-science":
      return "humanities";
    case "english":
    case "hindi":
      return "literature";
    default:
      return "science";
  }
}

/**
 * Social Science is four subjects wearing one name, and the right revision
 * formats differ sharply between them — a timeline is essential for History
 * and meaningless for Economics. Chapters carry the strand in `unit`.
 */
export type HumanitiesStrand = "history" | "geography" | "civics" | "economics" | null;

export function humanitiesStrand(chapter: Chapter | null | undefined): HumanitiesStrand {
  const unit = chapter?.unit?.toLowerCase() ?? "";
  if (unit.includes("history")) return "history";
  if (unit.includes("geograph")) return "geography";
  if (unit.includes("political")) return "civics";
  if (unit.includes("econom")) return "economics";
  return null;
}

/** Poetry and prose want different revision formats too. */
export function isPoetryChapter(chapter: Chapter | null | undefined): boolean {
  const unit = chapter?.unit?.toLowerCase() ?? "";
  return unit.includes("poetry") || unit.includes("काव्य");
}

/** Every chapter in the model, flattened — used by search and pickers. */
export interface FlatChapter {
  subject: Subject;
  chapter: Chapter;
  href: string;
}

export const ALL_CHAPTERS: FlatChapter[] = SUBJECTS.flatMap((subject) =>
  subject.chapters.map((chapter) => ({
    subject,
    chapter,
    href: `/subjects/${subject.id}/${chapter.id}`,
  })),
);
