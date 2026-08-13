/**
 * CBSE-aligned word-limit configuration for English and Hindi literature answers.
 *
 * Limits are keyed by the number of marks for the question. They apply ONLY to
 * literature answers (prose, poetry, drama, character/theme questions, extract
 * questions). Grammar, letters, notices, emails, advertisements, analytical
 * paragraphs, story writing, and other writing-skills formats are NOT subject to
 * these limits — they have their own CBSE format requirements.
 *
 * Source: 2025–26 CBSE sample papers for English Language & Literature (code
 * 101/184), Hindi Course A (002), and Hindi Course B (085).
 *
 * Keep this file as the single source of truth. Update values here whenever the
 * CBSE examination pattern changes.
 */

export interface WordRange {
  min: number;
  max: number;
}

/** English Language and Literature (Class 10 code 184 / Class 9 code 101) */
export const ENGLISH_LITERATURE_WORD_LIMITS: Record<number, WordRange> = {
  1: { min: 10, max: 20 },
  2: { min: 20, max: 30 },
  3: { min: 40, max: 50 },
  4: { min: 60, max: 80 },
  5: { min: 80, max: 100 },
  6: { min: 100, max: 120 },
};

/** Hindi Course A (Class 9–10 code 002) */
export const HINDI_A_LITERATURE_WORD_LIMITS: Record<number, WordRange> = {
  1: { min: 10, max: 20 },
  2: { min: 25, max: 30 },
  3: { min: 40, max: 50 },
  4: { min: 50, max: 60 },
  5: { min: 80, max: 100 },
  6: { min: 100, max: 120 },
};

/** Hindi Course B (Class 9–10 code 085) */
export const HINDI_B_LITERATURE_WORD_LIMITS: Record<number, WordRange> = {
  1: { min: 10, max: 20 },
  2: { min: 25, max: 30 },
  3: { min: 40, max: 50 },
  4: { min: 50, max: 60 },
  5: { min: 80, max: 100 },
  6: { min: 100, max: 120 },
};

export type HindiCourse = "A" | "B" | "unknown";

/**
 * Returns the applicable word-limit range for a literature answer.
 * Falls back to the closest lower band when the exact marks value is not
 * listed (e.g. 7 marks → uses 6-mark range).
 */
export function getLiteratureWordRange(
  subject: string,
  marks: number,
  hindiCourse: HindiCourse = "unknown",
): WordRange {
  const s = subject.toLowerCase();

  let table: Record<number, WordRange>;
  if (s.includes("hindi")) {
    table =
      hindiCourse === "A"
        ? HINDI_A_LITERATURE_WORD_LIMITS
        : hindiCourse === "B"
          ? HINDI_B_LITERATURE_WORD_LIMITS
          : HINDI_A_LITERATURE_WORD_LIMITS;
  } else {
    table = ENGLISH_LITERATURE_WORD_LIMITS;
  }

  if (table[marks]) return table[marks];

  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const lower = keys.filter((k) => k <= marks).at(-1);
  if (lower !== undefined) return table[lower];
  return table[keys[0]];
}

/**
 * Returns true when the subject is English or Hindi literature — that is, when
 * answers must be written as connected prose paragraphs, never as bullet points.
 *
 * Note: the caller is still responsible for distinguishing literature questions
 * from grammar / writing-skills questions for the same subject.
 */
export function isLiteratureSubject(subject: string): boolean {
  const s = subject.toLowerCase();
  return s.includes("english") || s.includes("hindi");
}

/**
 * Determines whether an answer of this mark-count must use the
 * Introduction–Body–Conclusion (5–6 mark) structure.
 */
export function requiresIntroBodyConclusion(marks: number): boolean {
  return marks >= 5;
}

/**
 * Counts words in a string, excluding heading tokens (Introduction, Body,
 * Conclusion, भूमिका, मुख्य भाग, निष्कर्ष).
 */
export function countLiteratureWords(text: string): number {
  const headings = new Set([
    "introduction",
    "body",
    "conclusion",
    "भूमिका",
    "मुख्यभाग",
    "निष्कर्ष",
  ]);
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0 && !headings.has(w.toLowerCase()))
    .length;
}
