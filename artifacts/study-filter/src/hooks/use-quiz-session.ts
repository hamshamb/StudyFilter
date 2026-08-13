import React from "react";
import { createStore, isObject, list, newId, num, oneOf, str, useStore } from "@/lib/store";
import type { GeneratedQuizQuestion } from "@/lib/study-content";

/**
 * Quiz state that survives.
 *
 * The old chapter quiz kept everything in component state and regenerated on
 * every mount, so leaving the page mid-quiz lost the attempt *and* the
 * questions — coming back produced a different quiz and no record that the
 * first one happened. Nothing could say "you got 7/10 on Electricity last
 * Tuesday", so nothing could recommend anything.
 *
 * There are two things here:
 *
 *  - **the active session** — one at a time, resumable. Answers, timings and
 *    position are written as they happen, so closing the tab mid-question
 *    costs nothing.
 *  - **finished attempts** — a capped history used by the dashboard, the
 *    mastery model and "practise your weak areas".
 *
 * Questions are stored *with* the session. That is what makes resume real: a
 * resumed quiz is the same quiz, not a fresh generation wearing the old
 * score.
 */

export const QUIZ_MODES = ["practice", "exam", "rapid"] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

export const QUIZ_FORMATS = [
  "mcq",
  "true_false",
  "fill_blank",
  "assertion_reason",
  "multi_select",
  "short",
] as const;
export type QuizFormat = (typeof QUIZ_FORMATS)[number];

export const FORMAT_LABELS: Record<QuizFormat, string> = {
  mcq: "Multiple choice",
  true_false: "True / False",
  fill_blank: "Fill in the blank",
  assertion_reason: "Assertion & Reason",
  multi_select: "Multiple correct",
  short: "Short answer",
};

export const MODE_INFO: Record<QuizMode, { label: string; hint: string }> = {
  practice: {
    label: "Practice",
    hint: "Check each answer as you go. No pressure, no clock unless you want one.",
  },
  exam: {
    label: "Exam",
    hint: "Answer everything first, marks at the end. Closest to the real thing.",
  },
  rapid: {
    label: "Rapid fire",
    hint: "20 seconds a question. Trains recall, not working.",
  },
};

/** Seconds per question in rapid fire. Fixed, so the mode means one thing. */
export const RAPID_SECONDS = 20;

export interface QuizConfig {
  classLevel: number;
  subjectId: string | null;
  subjectName: string;
  chapterId: string | null;
  chapterTitle: string;
  topic: string | null;
  count: number;
  difficulty: string;
  formats: QuizFormat[];
  mode: QuizMode;
  /** Whole-quiz limit in seconds. 0 means untimed. */
  timeLimitSec: number;
  /** Practice mode only: reveal the explanation as soon as an answer is given. */
  instantFeedback: boolean;
}

export interface QuizAnswer {
  questionId: string;
  /** The option text chosen. null = skipped. */
  chosen: string | null;
  correct: boolean;
  /** Milliseconds spent on this question. */
  ms: number;
}

export interface QuizSession {
  id: string;
  config: QuizConfig;
  questions: GeneratedQuizQuestion[];
  answers: Record<string, QuizAnswer>;
  index: number;
  startedAt: number;
  /** Set when the quiz is submitted. */
  finishedAt: number | null;
}

export interface QuizAttempt {
  id: string;
  config: QuizConfig;
  score: number;
  total: number;
  /** Total milliseconds across answered questions. */
  ms: number;
  finishedAt: number;
  /** Concepts answered wrong, deduped — feeds "practise weak areas". */
  weakTopics: string[];
  strongTopics: string[];
}

interface QuizData {
  active: QuizSession | null;
  attempts: QuizAttempt[];
}

const MAX_ATTEMPTS = 60;

function parseQuestion(raw: unknown): GeneratedQuizQuestion | null {
  if (!isObject(raw)) return null;
  const question = str(raw.question);
  const options = Array.isArray(raw.options) ? raw.options.map((o) => str(o)).filter(Boolean) : [];
  const correctAnswer = str(raw.correctAnswer);
  if (!question || options.length < 2 || !options.includes(correctAnswer)) return null;
  const out: GeneratedQuizQuestion = {
    id: str(raw.id) || newId(),
    question,
    options,
    correctAnswer,
    explanation: str(raw.explanation),
    subject: str(raw.subject),
  };
  const topic = str(raw.topic);
  const format = str(raw.format);
  const difficulty = str(raw.difficulty);
  if (topic) out.topic = topic;
  if (format) out.format = format;
  if (difficulty) out.difficulty = difficulty;
  return out;
}

function parseConfig(raw: unknown): QuizConfig | null {
  if (!isObject(raw)) return null;
  return {
    classLevel: num(raw.classLevel, 10),
    subjectId: str(raw.subjectId) || null,
    subjectName: str(raw.subjectName, "Mixed"),
    chapterId: str(raw.chapterId) || null,
    chapterTitle: str(raw.chapterTitle),
    topic: str(raw.topic) || null,
    count: Math.max(1, Math.min(30, num(raw.count, 10))),
    difficulty: str(raw.difficulty, "medium"),
    formats: Array.isArray(raw.formats)
      ? (raw.formats.filter((f): f is QuizFormat =>
          (QUIZ_FORMATS as readonly string[]).includes(String(f)),
        ) as QuizFormat[])
      : ["mcq"],
    mode: oneOf(raw.mode, QUIZ_MODES, "practice") as QuizMode,
    timeLimitSec: Math.max(0, num(raw.timeLimitSec)),
    instantFeedback: raw.instantFeedback === true,
  };
}

const store = createStore<QuizData>({
  key: "sf_quiz",
  version: 1,
  fallback: () => ({ active: null, attempts: [] }),
  parse: (raw) => {
    if (!isObject(raw)) return null;

    let active: QuizSession | null = null;
    if (isObject(raw.active)) {
      const config = parseConfig(raw.active.config);
      const questions = list(raw.active.questions, parseQuestion);
      if (config && questions.length > 0) {
        const answers: Record<string, QuizAnswer> = {};
        if (isObject(raw.active.answers)) {
          for (const [id, value] of Object.entries(raw.active.answers)) {
            if (!isObject(value)) continue;
            answers[id] = {
              questionId: id,
              chosen: typeof value.chosen === "string" ? value.chosen : null,
              correct: value.correct === true,
              ms: Math.max(0, num(value.ms)),
            };
          }
        }
        active = {
          id: str(raw.active.id) || newId(),
          config,
          questions,
          answers,
          index: Math.max(0, Math.min(questions.length - 1, num(raw.active.index))),
          startedAt: num(raw.active.startedAt, Date.now()),
          finishedAt: typeof raw.active.finishedAt === "number" ? raw.active.finishedAt : null,
        };
      }
    }

    const attempts = list<QuizAttempt>(raw.attempts, (item) => {
      if (!isObject(item)) return null;
      const config = parseConfig(item.config);
      if (!config) return null;
      return {
        id: str(item.id) || newId(),
        config,
        score: num(item.score),
        total: Math.max(1, num(item.total, 1)),
        ms: num(item.ms),
        finishedAt: num(item.finishedAt, Date.now()),
        weakTopics: Array.isArray(item.weakTopics)
          ? item.weakTopics.filter((t): t is string => typeof t === "string")
          : [],
        strongTopics: Array.isArray(item.strongTopics)
          ? item.strongTopics.filter((t): t is string => typeof t === "string")
          : [],
      };
    });

    return { active, attempts: attempts.slice(0, MAX_ATTEMPTS) };
  },
});

export function startQuizSession(config: QuizConfig, questions: GeneratedQuizQuestion[]): string {
  const id = newId();
  store.set((prev) => ({
    ...prev,
    active: {
      id,
      config,
      questions,
      answers: {},
      index: 0,
      startedAt: Date.now(),
      finishedAt: null,
    },
  }));
  return id;
}

export function answerQuestion(questionId: string, chosen: string | null, ms: number): void {
  store.set((prev) => {
    const active = prev.active;
    if (!active) return prev;
    const question = active.questions.find((q) => q.id === questionId);
    if (!question) return prev;
    return {
      ...prev,
      active: {
        ...active,
        answers: {
          ...active.answers,
          [questionId]: {
            questionId,
            chosen,
            correct: chosen !== null && chosen === question.correctAnswer,
            ms: Math.max(0, Math.round(ms)),
          },
        },
      },
    };
  });
}

export function goToQuestion(index: number): void {
  store.set((prev) =>
    prev.active
      ? {
          ...prev,
          active: {
            ...prev.active,
            index: Math.max(0, Math.min(prev.active.questions.length - 1, index)),
          },
        }
      : prev,
  );
}

/**
 * Ends the session and files the attempt.
 *
 * A concept counts as weak if it was answered wrong *and* not answered right
 * anywhere else in the same quiz — a single slip on something you otherwise
 * know is not a weakness, and treating it as one makes the recommendations
 * noisy enough to ignore.
 */
export function finishQuizSession(): QuizAttempt | null {
  const active = store.get().active;
  if (!active) return null;

  const wrongTopics = new Set<string>();
  const rightTopics = new Set<string>();
  for (const question of active.questions) {
    const topic = (question.topic ?? "").trim();
    if (!topic) continue;
    const answer = active.answers[question.id];
    if (answer?.correct) rightTopics.add(topic);
    else wrongTopics.add(topic);
  }

  const answers: QuizAnswer[] = Object.values(active.answers);
  const attempt: QuizAttempt = {
    id: active.id,
    config: active.config,
    score: answers.filter((a) => a.correct).length,
    total: active.questions.length,
    ms: answers.reduce((sum, a) => sum + a.ms, 0),
    finishedAt: Date.now(),
    weakTopics: [...wrongTopics].filter((t) => !rightTopics.has(t)),
    strongTopics: [...rightTopics].filter((t) => !wrongTopics.has(t)),
  };

  store.set((prev) => ({
    // The finished session is kept as `active` with `finishedAt` set, so the
    // results screen can still read every question and answer. Starting a new
    // quiz replaces it.
    active: prev.active ? { ...prev.active, finishedAt: attempt.finishedAt } : null,
    attempts: [attempt, ...prev.attempts].slice(0, MAX_ATTEMPTS),
  }));

  return attempt;
}

export function abandonQuizSession(): void {
  store.set((prev) => ({ ...prev, active: null }));
}

export function useQuizStore() {
  const data = useStore(store);

  return React.useMemo(() => {
    const active = data.active;
    const inProgress = active && active.finishedAt === null ? active : null;
    return {
      active,
      inProgress,
      attempts: data.attempts,
      /** Attempts for one chapter, newest first. */
      attemptsFor: (subjectId: string | null, chapterId: string | null) =>
        data.attempts.filter(
          (a) => a.config.subjectId === subjectId && a.config.chapterId === chapterId,
        ),
      /**
       * Concepts this student keeps getting wrong, most persistent first.
       * Counted across the last 12 attempts so one bad afternoon doesn't
       * dominate the list for a month.
       */
      weakTopics: (limit = 6) => {
        const counts = new Map<string, number>();
        for (const attempt of data.attempts.slice(0, 12)) {
          for (const topic of attempt.weakTopics) {
            counts.set(topic, (counts.get(topic) ?? 0) + 1);
          }
          // Getting it right later reduces the count rather than clearing it —
          // one good answer isn't proof, but it is evidence.
          for (const topic of attempt.strongTopics) {
            if (counts.has(topic)) counts.set(topic, Math.max(0, counts.get(topic)! - 1));
          }
        }
        return [...counts.entries()]
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([topic]) => topic);
      },
      totalAnswered: data.attempts.reduce((sum, a) => sum + a.total, 0),
      totalCorrect: data.attempts.reduce((sum, a) => sum + a.score, 0),
    };
  }, [data]);
}

export function readQuizAttempts(): QuizAttempt[] {
  return store.get().attempts;
}

export function clearQuizHistory(): void {
  store.clear();
}

/** "3m 40s" — used on the results screen and in attempt lists. */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
