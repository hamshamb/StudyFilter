/**
 * Question analysis service.
 * Classifies an incoming question and produces:
 *  - questionType
 *  - recommendedMarks + availableMarkOptions (per CBSE mark rules)
 *  - recommendationSource (how we determined the mark)
 *
 * Priority order (per spec):
 *  1. Explicit mark wording in the question text
 *  2. (Metadata from question bank — not yet implemented; reserved)
 *  3. Official CBSE subject pattern
 *  4. Complexity inference from question verb / structure
 */

import {
  detectStudySubject,
  getMarkRule,
  CBSE_PATTERN_VERSION,
  type StudySubject,
  type QuestionType,
  type AllowedMark,
} from "../config/cbseAnswerRules.js";
import type { StoredQuestionAnalysis } from "./reusableAnswerContext.js";

// ── Explicit mark detection (Priority 1) ────────────────────────────────────

/** Returns the explicitly stated mark value from the question text, or null. */
function detectExplicitMarks(question: string): AllowedMark | null {
  const q = question.toLowerCase();

  // English patterns: "3 marks", "6-mark", "five marks", "a 3 marker"
  const numWords: Record<string, AllowedMark> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6,
  };

  // Digit patterns: "3 marks", "3-mark", "3 marker", "3mark"
  const digitMatch = q.match(/\b([1-6])[\s-]?marks?\b|\b([1-6])[\s-]?marker\b|\bfor\s+([1-6])\s+marks?\b/i);
  if (digitMatch) {
    const n = parseInt(digitMatch[1] ?? digitMatch[2] ?? digitMatch[3], 10);
    if (n >= 1 && n <= 6) return n as AllowedMark;
  }

  // Hindi digits: "३ अंक", "तीन अंकों में"
  const hindiDigitMatch = q.match(/([१२३४५६])\s*अंक/);
  if (hindiDigitMatch) {
    const devanagariMap: Record<string, AllowedMark> = { "१": 1, "२": 2, "३": 3, "४": 4, "५": 5, "६": 6 };
    return devanagariMap[hindiDigitMatch[1]] ?? null;
  }

  // Word patterns: "three marks", "a five-mark answer"
  for (const [word, val] of Object.entries(numWords)) {
    if (new RegExp(`\\b${word}[\\s-]?marks?\\b|\\b${word}[\\s-]?अंक`, "i").test(q)) {
      return val;
    }
  }

  return null;
}

// ── Question type classification ─────────────────────────────────────────────

const GRAMMAR_PATTERNS = [
  /\btense\b/, /\bpassive voice\b/, /\bactive voice\b/, /\bdirect.*indirect\b/,
  /\bindirect.*direct\b/, /\bnarration\b/, /\bclause\b/, /\bconjunction\b/,
  /\bpreposition\b/, /\bmodal\b/, /\barticle\b/, /\bpunctuation\b/,
  /\bsynonym\b/, /\bantonym\b/, /\bone word\b/, /\bspelling\b/,
  /\bसंधि\b/, /\bसमास\b/, /\bअलंकार\b/, /\bव्याकरण\b/,
];

const WRITING_SKILL_PATTERNS = [
  /\bletter\b/, /\bformal letter\b/, /\binformal letter\b/,
  /\bnotice\b/, /\badvertisement\b/, /\bemail\b/, /\bstory writing\b/,
  /\bparagraph writing\b/, /\banalytical paragraph\b/, /\bessay\b/,
  /\bdebate\b/, /\bspeech\b/, /\bpत्र\b/, /\bसूचना\b/, /\bविज्ञापन\b/,
];

const EXTRACT_PATTERNS = [
  /\bextract\b/, /\bpassage\b/, /\bgiven below\b/, /\bread.*following\b/,
  /\bfollowing.*passage\b/, /\bline\s+\d+\b/, /\bstanza\b/,
  /\bगद्यांश\b/, /\bकाव्यांश\b/,
];

const LONG_LIT_VERBS = [
  /\banalyse\b/, /\banalyze\b/, /\bexamine\b/, /\bevaluate\b/,
  /\bcompare\b/, /\bdiscuss.*detail\b/, /\bcritically\b/,
  /\bcharacter development\b/, /\btheme.*detail\b/, /\bin.*detail\b/,
  /\bविस्तार से\b/, /\bविश्लेषण करें\b/,
];

const OBJECTIVE_PATTERNS = [
  /\bwhich of the following\b/, /\bmcq\b/, /\bmultiple choice\b/,
  /\btrue or false\b/, /\bfill in the blank\b/, /\bfill the blank\b/,
  /\bmatch.*column\b/, /\bsahi.*chune\b/, /\bसही विकल्प\b/,
];

const NUMERICAL_PATTERNS = [
  /\bcalculate\b/, /\bfind the value\b/, /\bsolve\b/, /\bcompute\b/,
  /\bhow many\b.*\d/, /\bwhat is the value\b/, /\busing.*formula\b/,
];

const PROOF_PATTERNS = [
  /\bprove that\b/, /\bprove:\b/, /\bshow that\b/, /\bdemonstrate\b/,
  /\bverify that\b/,
];

const DIAGRAM_PATTERNS = [
  /\bdraw\b/, /\blabel\b/, /\bsketch\b/, /\bdiagram\b/,
  /\bshow.*diagram\b/, /\bdraw.*label\b/,
];

const CASE_STUDY_PATTERNS = [
  /\bcase study\b/, /\bcase-based\b/, /\bcase based\b/,
  /\bdata.*given.*below\b/, /\bread.*case\b/, /\banalyse.*case\b/,
  /\bcase\s+\d+\b/,
];

const MAP_PATTERNS = [
  /\bmap\b/, /\blocation\b.*map/, /\bmark.*map\b/, /\bidentify.*map\b/,
];

export function classifyQuestionType(
  question: string,
  subject: StudySubject,
): QuestionType {
  const q = question.toLowerCase();

  if (OBJECTIVE_PATTERNS.some((p) => p.test(q))) return "objective";
  if (CASE_STUDY_PATTERNS.some((p) => p.test(q))) return "case_study";

  // Subject-specific
  if (subject === "mathematics") {
    if (PROOF_PATTERNS.some((p) => p.test(q))) return "proof";
    if (DIAGRAM_PATTERNS.some((p) => p.test(q))) return "diagram";
    if (NUMERICAL_PATTERNS.some((p) => p.test(q))) return "numerical";
    return "direct_answer";
  }

  if (subject === "science") {
    if (NUMERICAL_PATTERNS.some((p) => p.test(q))) return "numerical";
    if (DIAGRAM_PATTERNS.some((p) => p.test(q))) return "diagram";
    return "descriptive";
  }

  if (subject === "social_science") {
    if (MAP_PATTERNS.some((p) => p.test(q))) return "map_question";
    return "descriptive";
  }

  // English / Hindi
  if (subject === "english" || subject === "hindi_a" || subject === "hindi_b") {
    if (GRAMMAR_PATTERNS.some((p) => p.test(q))) return "grammar";
    if (WRITING_SKILL_PATTERNS.some((p) => p.test(q))) return "writing_skill";
    if (EXTRACT_PATTERNS.some((p) => p.test(q))) return "literature_extract";
    if (LONG_LIT_VERBS.some((p) => p.test(q))) return "literature_long";
    // Short descriptive lit question
    if (/\bbriefly\b|\bshortly\b|\bin brief\b|\bshort answer\b/.test(q)) return "literature_short";
    return "literature_long"; // default for English/Hindi literature
  }

  return "unknown";
}

// ── Complexity inference for mark recommendation ─────────────────────────────

function inferRecommendedMark(
  question: string,
  subject: StudySubject,
  questionType: QuestionType,
  availableMarks: AllowedMark[],
): AllowedMark {
  const q = question.toLowerCase();

  // Long/complex question → higher marks
  const isComplex =
    LONG_LIT_VERBS.some((p) => p.test(q)) ||
    /\bexplain.*detail\b|\bin detail\b|\bin.*words\b/.test(q) ||
    q.length > 120;

  // Short/simple → lower marks
  const isShort =
    /\bwhat is\b|\bdefine\b|\bname\b|\blist\b|\bstate\b|\bgive one\b/.test(q) ||
    q.split(" ").length < 8;

  if (availableMarks.length === 1) return availableMarks[0];

  const sorted = [...availableMarks].sort((a, b) => a - b);
  if (isShort) return sorted[0];
  if (isComplex) return sorted[sorted.length - 1];
  // Default to middle option
  return sorted[Math.floor(sorted.length / 2)];
}

// ── Main analysis function ───────────────────────────────────────────────────

export function analyzeQuestion(
  question: string,
  subjectStr: string,
  chapter?: string,
): StoredQuestionAnalysis {
  const subject = detectStudySubject(subjectStr);
  const questionType = classifyQuestionType(question, subject);
  const markRule = getMarkRule(subject, questionType);

  // Priority 1: explicit mark in question wording
  const explicitMark = detectExplicitMarks(question);
  const isExplicitValid =
    explicitMark !== null &&
    (markRule.allowedMarks as number[]).includes(explicitMark);

  let recommendedMarks: AllowedMark;
  let availableMarkOptions: AllowedMark[];
  let recommendationSource: StoredQuestionAnalysis["recommendationSource"];
  let recommendationReason: string | undefined;

  if (isExplicitValid && explicitMark !== null) {
    recommendedMarks = explicitMark;
    availableMarkOptions = markRule.allowedMarks;
    recommendationSource = "explicit_question";
    recommendationReason = `Question explicitly asks for ${explicitMark} mark(s)`;
  } else if (explicitMark !== null && !isExplicitValid) {
    // Explicit but incompatible — use pattern and note it
    availableMarkOptions = markRule.allowedMarks;
    recommendedMarks = inferRecommendedMark(
      question,
      subject,
      questionType,
      availableMarkOptions,
    );
    recommendationSource = "official_pattern";
    recommendationReason = `Explicit mark ${explicitMark} not valid for ${subject} ${questionType}; using CBSE pattern`;
  } else {
    // Priority 3+4: CBSE pattern + inference
    availableMarkOptions = markRule.allowedMarks;
    recommendedMarks = inferRecommendedMark(
      question,
      subject,
      questionType,
      availableMarkOptions,
    );
    recommendationSource = "inferred";
    recommendationReason = `Inferred from subject (${subject}), question type (${questionType}), and complexity`;
  }

  return {
    subject,
    chapter,
    questionType,
    recommendedMarks,
    availableMarkOptions,
    recommendationSource,
    recommendationReason,
    cbsePatternVersion: CBSE_PATTERN_VERSION,
  };
}
