import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ImportantQuestionsResult,
  NcertAnswersResult,
  RevisionNotes,
  StudyAnswer,
} from "@workspace/api-client-react";
import { postJson } from "@/lib/api";
import type { ApiScope } from "@/lib/scope";

/**
 * Chapter study material, fetched once and kept.
 *
 * The chapter units used to be *mutations* fired from a `useEffect` on mount.
 * That meant every open of "Chapter summary" was a fresh POST — a network
 * round trip and a spinner — even though the server already stores a permanent
 * copy in `generated_content` and returns the identical bytes. Worse, opening
 * the summary in the floating workspace and then expanding it to the full page
 * counted as two opens, so a student watched the same summary load twice in a
 * row.
 *
 * As queries with a stable key, the second open is instant and the panel and
 * the page share one cache entry — which is what makes "Expand" feel like the
 * panel grew rather than like the page reloaded.
 *
 * `staleTime: Infinity` is the honest setting here: a Class 10 chapter summary
 * does not change while you are reading it. Regeneration is an explicit,
 * visible action (see {@link useRefreshChapterContent}), never a side effect of
 * navigating.
 */

export type ChapterContentKind = "summary" | "ncert" | "important" | "notes";

const ENDPOINTS: Record<ChapterContentKind, string> = {
  summary: "/api/study/summary",
  ncert: "/api/study/ncert-answers",
  important: "/api/study/important-questions",
  notes: "/api/study/revision-notes",
};

export interface ChapterContentMap {
  summary: StudyAnswer;
  ncert: NcertAnswersResult;
  important: ImportantQuestionsResult;
  notes: RevisionNotes;
}

export function chapterContentKey(kind: ChapterContentKind, scope: ApiScope | null) {
  return [
    "study-content",
    kind,
    scope?.classLevel ?? null,
    scope?.subject ?? null,
    scope?.chapter ?? null,
    scope?.topic ?? null,
  ] as const;
}

function requestBody(scope: ApiScope, refresh: boolean) {
  return {
    classLevel: scope.classLevel,
    subject: scope.subject,
    chapter: scope.chapter,
    ...(scope.topic ? { topic: scope.topic } : {}),
    // The server skips its stored copy and rewrites it when this is set. It is
    // ignored by older builds, which simply return the stored copy — a stale
    // deploy degrades to "Refresh did nothing", not to an error.
    ...(refresh ? { refresh: true } : {}),
  };
}

export function useChapterContent<K extends ChapterContentKind>(
  kind: K,
  scope: ApiScope | null,
  options?: { enabled?: boolean },
) {
  const enabled = (options?.enabled ?? true) && !!scope?.chapter && !!scope?.subject;

  return useQuery({
    queryKey: chapterContentKey(kind, scope),
    queryFn: () => postJson<ChapterContentMap[K]>(ENDPOINTS[kind], requestBody(scope!, false)),
    enabled,
    staleTime: Infinity,
    // Long enough that moving between chapters and back in one session never
    // re-fetches, short enough that a day-long tab doesn't hoard memory.
    gcTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Explicit regeneration.
 *
 * Separate from the query on purpose: a student pressing "Refresh" is asking
 * for something new, and should see it happen. The result is written straight
 * into the cache so both the panel and the full page update together.
 */
export function useRefreshChapterContent<K extends ChapterContentKind>(
  kind: K,
  scope: ApiScope | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!scope) throw new Error("No chapter selected");
      return postJson<ChapterContentMap[K]>(ENDPOINTS[kind], requestBody(scope, true));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(chapterContentKey(kind, scope), data);
    },
  });
}

// ── Ask ──────────────────────────────────────────────────────────────────────

export interface AskRequest {
  question: string;
  classLevel: number;
  subject?: string;
  chapter?: string;
  sessionId?: string;
  /** qa | board_answer | summary — steers how the answer is written. */
  intent?: string;
  studyLevel?: string;
  /** Extra framing derived from the student's learning preferences. */
  styleHints?: string[];
}

export function askStudyFilterQuestion(request: AskRequest): Promise<StudyAnswer> {
  return postJson<StudyAnswer>("/api/study/ask", request);
}

// ── Quiz generation ──────────────────────────────────────────────────────────

export interface GeneratedQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject: string;
  /** Present when the generator was asked for mixed formats. */
  format?: string;
  /** The concept this question tests — drives weak-topic reporting. */
  topic?: string;
  difficulty?: string;
}

export interface GeneratedQuiz {
  questions: GeneratedQuizQuestion[];
}

export interface QuizGenerationRequest {
  classLevel: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: string;
  count?: number;
  /** mcq | true_false | fill_blank | assertion_reason | multi_select | short | mixed */
  formats?: string[];
  /** Concepts to bias toward — used by "practise my weak areas". */
  focus?: string[];
}

export function generateQuiz(request: QuizGenerationRequest): Promise<GeneratedQuiz> {
  return postJson<GeneratedQuiz>("/api/study/practice-quiz", request);
}

// ── Flashcards ───────────────────────────────────────────────────────────────

export interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
}

export interface FlashcardGenerationRequest {
  classLevel: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  /** A passage to build cards from, instead of the whole chapter. */
  passage?: string;
  count?: number;
}

export function generateFlashcards(
  request: FlashcardGenerationRequest,
): Promise<{ cards: GeneratedCard[] }> {
  return postJson<{ cards: GeneratedCard[] }>("/api/study/flashcards", request);
}

// ── Explain / Solve ──────────────────────────────────────────────────────────

export const EXPLAIN_DEPTHS = ["quick", "standard", "deep", "new", "exam"] as const;
export type ExplainDepth = (typeof EXPLAIN_DEPTHS)[number];

export interface ExplainRequest {
  topic: string;
  depth: ExplainDepth;
  classLevel: number;
  subject?: string;
  chapter?: string;
  /** A selected passage the explanation should be about. */
  passage?: string;
}

export interface ExplainSection {
  heading: string;
  /** Prose paragraphs. */
  body?: string[];
  /** Bulleted points, when the content is a list rather than an argument. */
  points?: string[];
}

export interface ExplainResult {
  title: string;
  /** One-sentence answer, before any elaboration. */
  inShort: string;
  definitions?: { term: string; meaning: string }[];
  sections: ExplainSection[];
  formulae?: { expression: string; meaning?: string }[];
  examples?: { prompt: string; working?: string[]; answer?: string }[];
  table?: { caption?: string; columns: string[]; rows: string[][] };
  keyConcepts?: string[];
  commonMistakes?: string[];
  related?: string[];
  /** A schematic the renderer can draw — see components/diagram. */
  diagram?: { kind: string; caption?: string; spec?: unknown } | null;
}

export function explainTopic(request: ExplainRequest): Promise<ExplainResult> {
  return postJson<ExplainResult>("/api/study/explain", request);
}

export const SOLVE_KINDS = ["auto", "numerical", "algebra", "geometry", "word", "proof"] as const;
export type SolveKind = (typeof SOLVE_KINDS)[number];

export interface SolveRequest {
  question: string;
  classLevel: number;
  subject?: string;
  chapter?: string;
  kind?: SolveKind;
}

export interface SolveStep {
  /** "Substitute the values", "Rearrange for I". */
  label: string;
  /** The mathematics or reasoning for this step. */
  detail: string;
  /** Rendered as a centred expression when present. */
  expression?: string;
}

export interface SolveResult {
  question: string;
  /** Detected shape — decides which of the two layouts is used. */
  kind: SolveKind;
  subject?: string;
  /** Best matching NCERT chapter inferred from the question. */
  chapter?: string;
  given: string[];
  required?: string[];
  concept?: string;
  formulae?: string[];
  substitution?: string;
  steps: SolveStep[];
  answer: string;
  units?: string;
  verification?: string;
  note?: string;
}

export function solveProblem(request: SolveRequest): Promise<SolveResult> {
  return postJson<SolveResult>("/api/study/solve", request);
}
