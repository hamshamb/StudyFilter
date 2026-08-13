/**
 * Central CBSE answer-format and mark-rule configuration.
 * Single source of truth for all subjects, question types, allowed marks,
 * word limits, and answer formats. Update here — nowhere else.
 */

export const CBSE_PATTERN_VERSION = "2025-26";

// ── Type definitions ────────────────────────────────────────────────────────

export type StudySubject =
  | "mathematics"
  | "science"
  | "social_science"
  | "english"
  | "hindi_a"
  | "hindi_b"
  | "unknown";

export type QuestionType =
  | "objective"
  | "direct_answer"
  | "literature_extract"
  | "literature_short"
  | "literature_long"
  | "grammar"
  | "writing_skill"
  | "numerical"
  | "proof"
  | "diagram"
  | "descriptive"
  | "case_study"
  | "map_question"
  | "unknown";

export type AnswerFormat =
  | "direct"
  | "paragraph"
  | "intro_body_conclusion"
  | "numbered_points"
  | "worked_solution"
  | "case_study"
  | "writing_format";

export type ContentLevel = "simple" | "moderate" | "intermediate" | "advanced";

export type AllowedMark = 1 | 2 | 3 | 4 | 5 | 6;

export interface WordLimit {
  min?: number;
  max?: number;
  official: boolean;
}

export interface MarkRule {
  allowedMarks: AllowedMark[];
  defaultMark: AllowedMark;
  answerFormat: AnswerFormat;
  wordLimits?: Partial<Record<AllowedMark, WordLimit>>;
}

// ── Subject detection ───────────────────────────────────────────────────────

export function detectStudySubject(subject: string): StudySubject {
  const s = subject.toLowerCase();
  if (s.includes("math")) return "mathematics";
  if (s.includes("social")) return "social_science";
  if (s.includes("science")) return "science";
  if (s.includes("hindi") && (s.includes("course b") || s.includes("hindi b"))) return "hindi_b";
  if (s.includes("hindi") && (s.includes("course a") || s.includes("hindi a"))) return "hindi_a";
  if (s.includes("hindi")) return "hindi_a"; // default to A when unspecified
  if (s.includes("english")) return "english";
  return "unknown";
}

// ── Mark rules by subject + question type ───────────────────────────────────

/**
 * Returns the mark rule for a given subject and question type.
 * Falls back to the subject's default rule when no specific rule exists.
 */
export function getMarkRule(
  subject: StudySubject,
  questionType: QuestionType,
): MarkRule {
  const subjectMap = MARK_RULES[subject];
  if (!subjectMap) return DEFAULT_RULE;
  return subjectMap[questionType] ?? subjectMap["unknown"] ?? DEFAULT_RULE;
}

const DEFAULT_RULE: MarkRule = {
  allowedMarks: [2, 3, 5],
  defaultMark: 3,
  answerFormat: "numbered_points",
};

/**
 * Social Science official word limits (CBSE 2025-26).
 */
const SS_WORD_LIMITS: Partial<Record<AllowedMark, WordLimit>> = {
  2: { max: 40, official: true },
  3: { max: 60, official: true },
  4: { max: 100, official: true },
  5: { max: 120, official: true },
};

/**
 * Dynamic output-token budget for the answer-variant endpoint.
 * Keys are resolved mark values.
 */
export const BOARD_ANSWER_TOKEN_LIMITS: Record<AllowedMark, number> = {
  1: 180,
  2: 300,
  3: 500,
  4: 700,
  5: 900,
  6: 1100,
};

// Mark rules keyed by [subject][questionType].
// Each subject must have an "unknown" fallback.
export const MARK_RULES: Record<string, Record<string, MarkRule>> = {
  // ── Mathematics ──────────────────────────────────────────────────────────
  mathematics: {
    objective: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
      wordLimits: { 1: { max: 20, official: false } },
    },
    direct_answer: {
      allowedMarks: [1, 2],
      defaultMark: 2,
      answerFormat: "worked_solution",
    },
    numerical: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "worked_solution",
    },
    proof: {
      allowedMarks: [3, 5],
      defaultMark: 5,
      answerFormat: "worked_solution",
    },
    case_study: {
      allowedMarks: [4],
      defaultMark: 4,
      answerFormat: "case_study",
    },
    unknown: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "worked_solution",
    },
  },

  // ── Science ───────────────────────────────────────────────────────────────
  science: {
    objective: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
    },
    direct_answer: {
      allowedMarks: [1, 2],
      defaultMark: 2,
      answerFormat: "numbered_points",
    },
    descriptive: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "numbered_points",
    },
    diagram: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "numbered_points",
    },
    case_study: {
      allowedMarks: [4],
      defaultMark: 4,
      answerFormat: "case_study",
    },
    numerical: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "worked_solution",
    },
    unknown: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "numbered_points",
    },
  },

  // ── Social Science ────────────────────────────────────────────────────────
  social_science: {
    objective: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
      wordLimits: { 1: { max: 20, official: true } },
    },
    direct_answer: {
      allowedMarks: [1, 2],
      defaultMark: 2,
      answerFormat: "numbered_points",
      wordLimits: SS_WORD_LIMITS,
    },
    descriptive: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "numbered_points",
      wordLimits: SS_WORD_LIMITS,
    },
    case_study: {
      allowedMarks: [4],
      defaultMark: 4,
      answerFormat: "case_study",
      wordLimits: SS_WORD_LIMITS,
    },
    map_question: {
      allowedMarks: [1, 2],
      defaultMark: 1,
      answerFormat: "direct",
    },
    unknown: {
      allowedMarks: [2, 3, 5],
      defaultMark: 3,
      answerFormat: "numbered_points",
      wordLimits: SS_WORD_LIMITS,
    },
  },

  // ── English ───────────────────────────────────────────────────────────────
  english: {
    objective: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
    },
    literature_extract: {
      allowedMarks: [1, 2],
      defaultMark: 1,
      answerFormat: "paragraph",
      wordLimits: {
        1: { max: 20, official: false },
        2: { max: 40, official: false },
      },
    },
    literature_short: {
      allowedMarks: [3],
      defaultMark: 3,
      answerFormat: "paragraph",
      wordLimits: {
        3: { min: 40, max: 50, official: false },
      },
    },
    literature_long: {
      allowedMarks: [3, 6],
      defaultMark: 6,
      answerFormat: "intro_body_conclusion",
      wordLimits: {
        3: { min: 40, max: 50, official: false },
        6: { min: 100, max: 120, official: false },
      },
    },
    grammar: {
      allowedMarks: [1, 2],
      defaultMark: 2,
      answerFormat: "direct",
    },
    writing_skill: {
      allowedMarks: [5],
      defaultMark: 5,
      answerFormat: "writing_format",
      wordLimits: { 5: { min: 100, max: 150, official: false } },
    },
    unknown: {
      allowedMarks: [3, 6],
      defaultMark: 3,
      answerFormat: "paragraph",
      wordLimits: {
        3: { min: 40, max: 50, official: false },
        6: { min: 100, max: 120, official: false },
      },
    },
  },

  // ── Hindi A ───────────────────────────────────────────────────────────────
  hindi_a: {
    objective: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
    },
    literature_extract: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
    },
    literature_short: {
      allowedMarks: [2, 4],
      defaultMark: 2,
      answerFormat: "paragraph",
      wordLimits: {
        2: { min: 25, max: 30, official: false },
        4: { min: 50, max: 60, official: false },
      },
    },
    literature_long: {
      allowedMarks: [2, 4],
      defaultMark: 4,
      answerFormat: "paragraph",
      wordLimits: {
        2: { min: 25, max: 30, official: false },
        4: { min: 50, max: 60, official: false },
      },
    },
    grammar: {
      allowedMarks: [1, 2],
      defaultMark: 2,
      answerFormat: "direct",
    },
    writing_skill: {
      allowedMarks: [5],
      defaultMark: 5,
      answerFormat: "writing_format",
    },
    unknown: {
      allowedMarks: [2, 4],
      defaultMark: 2,
      answerFormat: "paragraph",
      wordLimits: {
        2: { min: 25, max: 30, official: false },
        4: { min: 50, max: 60, official: false },
      },
    },
  },

  // ── Hindi B ───────────────────────────────────────────────────────────────
  hindi_b: {
    objective: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
    },
    literature_extract: {
      allowedMarks: [1],
      defaultMark: 1,
      answerFormat: "direct",
    },
    literature_short: {
      allowedMarks: [2, 3],
      defaultMark: 2,
      answerFormat: "paragraph",
      wordLimits: {
        2: { min: 25, max: 30, official: false },
        3: { min: 40, max: 50, official: false },
      },
    },
    literature_long: {
      allowedMarks: [2, 3],
      defaultMark: 3,
      answerFormat: "paragraph",
      wordLimits: {
        2: { min: 25, max: 30, official: false },
        3: { min: 40, max: 50, official: false },
      },
    },
    grammar: {
      allowedMarks: [1, 2],
      defaultMark: 2,
      answerFormat: "direct",
    },
    writing_skill: {
      allowedMarks: [5],
      defaultMark: 5,
      answerFormat: "writing_format",
    },
    unknown: {
      allowedMarks: [2, 3],
      defaultMark: 2,
      answerFormat: "paragraph",
      wordLimits: {
        2: { min: 25, max: 30, official: false },
        3: { min: 40, max: 50, official: false },
      },
    },
  },

  // ── Unknown subject fallback ──────────────────────────────────────────────
  unknown: {
    unknown: DEFAULT_RULE,
  },
};
