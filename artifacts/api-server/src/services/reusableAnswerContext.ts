/**
 * Short-lived LRU cache for reusable answer contexts.
 * When /study/ask completes, we store source excerpts and question analysis
 * so the /study/answer-variant endpoint can regenerate without re-scraping.
 *
 * TTL: 15 minutes.  Max entries: 200 (LRU eviction).
 */
import crypto from "node:crypto";
import type { StudySubject, QuestionType } from "../config/cbseAnswerRules.js";

export interface StoredQuestionAnalysis {
  subject: StudySubject;
  chapter?: string;
  topic?: string;
  questionType: QuestionType;
  recommendedMarks: 1 | 2 | 3 | 4 | 5 | 6;
  availableMarkOptions: Array<1 | 2 | 3 | 4 | 5 | 6>;
  recommendationSource:
    | "explicit_question"
    | "question_metadata"
    | "official_pattern"
    | "inferred";
  recommendationReason?: string;
  cbsePatternVersion: string;
}

export interface ReusableAnswerContext {
  answerId: string;
  question: string;
  subject: string;
  chapter?: string;
  topic?: string;
  originalExamReadyAnswer: string;
  questionAnalysis: StoredQuestionAnalysis;
  sourceExcerpts: string;
  sourceUrls: string[];
  createdAt: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 200;

// Insertion-order map used as an LRU: entries at the front are oldest.
const cache = new Map<string, ReusableAnswerContext>();

function evictExpiredAndOverflow(): void {
  const now = Date.now();
  // Remove expired entries
  for (const [key, ctx] of cache) {
    if (now - ctx.createdAt > TTL_MS) cache.delete(key);
  }
  // Trim to max size (oldest inserted first in Map iteration order)
  while (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

export function storeAnswerContext(
  ctx: Omit<ReusableAnswerContext, "answerId" | "createdAt">,
): string {
  evictExpiredAndOverflow();
  const answerId = crypto.randomUUID();
  cache.set(answerId, { ...ctx, answerId, createdAt: Date.now() });
  return answerId;
}

export function getAnswerContext(
  answerId: string,
): ReusableAnswerContext | null {
  const ctx = cache.get(answerId);
  if (!ctx) return null;
  if (Date.now() - ctx.createdAt > TTL_MS) {
    cache.delete(answerId);
    return null;
  }
  // Refresh position in insertion order (LRU hit)
  cache.delete(answerId);
  cache.set(answerId, ctx);
  return ctx;
}
