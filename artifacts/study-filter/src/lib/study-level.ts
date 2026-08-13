/**
 * Academic study levels — a personalization dimension that sits ALONGSIDE the
 * student's class/grade. The class decides the syllabus; the level decides how
 * the same syllabus is presented (depth, tone, defaults, recommendations).
 *
 * This is the single source of truth. The frontend reads it directly; the
 * backend keeps its own small mirror keyed by the same ids (see study.ts) so it
 * never needs to import frontend code.
 */

export const STUDY_LEVEL_IDS = [
  "just-getting-started",
  "concept-explorer",
  "classroom-confident",
  "challenge-seeker",
  "board-exam-warrior",
] as const;

export type StudyLevelId = (typeof STUDY_LEVEL_IDS)[number];

export const DEFAULT_STUDY_LEVEL_ID: StudyLevelId = "classroom-confident";

/** Difficulty understood by the practice-quiz API. */
export type QuizDifficulty = "easy" | "medium" | "hard" | "mixed";
/** Difficulty the Practice page exposes as buttons. */
export type PracticeDifficulty = "easy" | "medium" | "hard";

export interface StudyLevel {
  id: StudyLevelId;
  /** Full name shown in onboarding and the header badge. */
  label: string;
  /** Short tag for compact spots (badges, pills). */
  short: string;
  /** One-line explanation of who this level is for. */
  description: string;
  /** Personalized highlighted line in the hero headline. */
  heroTitle: string;
  /** Personalized hero sub-paragraph. */
  heroSub: string;
  /** Personalized eyebrow/badge text above the hero headline. */
  heroBadge: string;
  /** Primary call-to-action label on the hero. */
  ctaText: string;
  /** Plain-language tone descriptor used in the answer prompt. */
  tone: string;
  /** Depth descriptor used in the answer prompt. */
  answerDepth: string;
  /** Default difficulty for the inline chapter quiz. */
  defaultQuizDifficulty: QuizDifficulty;
  /** Default difficulty pre-selected on the Practice page. */
  practiceDifficulty: PracticeDifficulty;
  /** Default question count for the inline chapter quiz. */
  quizCount: number;
  /** Default question count pre-selected on the Practice page (5|10|15|20). */
  practiceCount: number;
  /** Whether timed practice is encouraged for this level. */
  quizTimer: boolean;
  /**
   * Widget keys (from DynamicWidgetGrid) to surface first, in priority order.
   * Any widgets not listed keep their normal subject order, after these.
   */
  primaryWidgetKeys: string[];
  /** Three suggested next actions, shown after onboarding / in the hero area. */
  nextSteps: string[];
}

export const STUDY_LEVELS: Record<StudyLevelId, StudyLevel> = {
  "just-getting-started": {
    id: "just-getting-started",
    label: "Just Getting Started",
    short: "Beginner-friendly",
    description: "Simple explanations, one concept at a time.",
    heroTitle: "made simple",
    heroBadge: "Beginner-friendly · One concept at a time",
    heroSub:
      "Let's make Class 10 simple — clear explanations, easy real-world examples and gentle practice, one concept at a time.",
    ctaText: "Start with the basics",
    tone: "very simple and encouraging",
    answerDepth: "basic",
    defaultQuizDifficulty: "easy",
    practiceDifficulty: "easy",
    quizCount: 3,
    practiceCount: 5,
    quizTimer: false,
    primaryWidgetKeys: ["explainer", "steps", "keypoints", "quiz"],
    nextSteps: [
      "Read a simple chapter summary",
      "Try a short, easy quiz",
      "Ask one doubt in plain words",
    ],
  },
  "concept-explorer": {
    id: "concept-explorer",
    label: "Concept Explorer",
    short: "Guided learning",
    description: "Step-by-step concepts with quick checks.",
    heroTitle: "explained step by step",
    heroBadge: "Guided learning · Step by step",
    heroSub:
      "Explore each concept with guided, step-by-step explanations and quick checks that make sure the idea really sticks.",
    ctaText: "Explore a concept",
    tone: "clear and guided",
    answerDepth: "guided",
    defaultQuizDifficulty: "easy",
    practiceDifficulty: "easy",
    quizCount: 5,
    practiceCount: 5,
    quizTimer: false,
    primaryWidgetKeys: ["steps", "keypoints", "keywords", "quiz", "important"],
    nextSteps: [
      "Walk through a concept step by step",
      "Review the key terms",
      "Try a quick concept check",
    ],
  },
  "classroom-confident": {
    id: "classroom-confident",
    label: "Classroom Confident",
    short: "Balanced study",
    description: "Clear, exam-style answers and steady practice.",
    heroTitle: "Study Hub",
    heroBadge: "CBSE · Class 10 · NCERT aligned",
    heroSub:
      "Balanced, exam-style answers that stay easy to follow — chapter summaries, NCERT answers, important questions and quizzes in one calm place.",
    ctaText: "Ask a doubt",
    tone: "balanced and exam-aware",
    answerDepth: "exam-ready",
    defaultQuizDifficulty: "medium",
    practiceDifficulty: "medium",
    quizCount: 5,
    practiceCount: 10,
    quizTimer: false,
    primaryWidgetKeys: ["ncert", "notes", "important", "quiz", "board"],
    nextSteps: [
      "Read the NCERT answer",
      "Practise important questions",
      "Take a practice quiz",
    ],
  },
  "challenge-seeker": {
    id: "challenge-seeker",
    label: "Challenge Seeker",
    short: "Deeper & harder",
    description: "Harder questions and timed practice.",
    heroTitle: "pushed further",
    heroBadge: "Deeper concepts · Harder practice",
    heroSub:
      "Push yourself with harder questions, timed practice and deeper explanations that go well beyond the basics.",
    ctaText: "Take a challenge",
    tone: "rigorous and challenging",
    answerDepth: "deep",
    defaultQuizDifficulty: "hard",
    practiceDifficulty: "hard",
    quizCount: 10,
    practiceCount: 10,
    quizTimer: true,
    primaryWidgetKeys: ["quiz", "mistakes", "steps", "important", "formula"],
    nextSteps: [
      "Attempt a hard quiz",
      "Review common mistakes",
      "Try a timed practice set",
    ],
  },
  "board-exam-warrior": {
    id: "board-exam-warrior",
    label: "Board Exam Warrior",
    short: "Board-exam focused",
    description: "CBSE-ready answers and board papers.",
    heroTitle: "Board-ready",
    heroBadge: "Board-exam focused · Score for marks",
    heroSub:
      "Practise CBSE-ready answers, scoring keywords and previous-year board questions, formatted exactly the way the exam rewards.",
    ctaText: "Write a board answer",
    tone: "exam-focused and precise",
    answerDepth: "cbse-ready",
    defaultQuizDifficulty: "mixed",
    practiceDifficulty: "hard",
    quizCount: 5,
    practiceCount: 10,
    quizTimer: true,
    primaryWidgetKeys: ["board", "writing", "keywords", "important", "ncert"],
    nextSteps: [
      "Write a board-style answer",
      "Memorise the scoring keywords",
      "Practise a previous-year paper",
    ],
  },
};

export const ALL_STUDY_LEVELS: StudyLevel[] = STUDY_LEVEL_IDS.map(
  (id) => STUDY_LEVELS[id],
);

export function isStudyLevelId(value: string): value is StudyLevelId {
  return (STUDY_LEVEL_IDS as readonly string[]).includes(value);
}
