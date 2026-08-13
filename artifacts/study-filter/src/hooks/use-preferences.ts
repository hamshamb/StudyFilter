import React from "react";
import { bool, createStore, isObject, num, oneOf, useStore } from "@/lib/store";

/**
 * Learning preferences that actually change what the product does.
 *
 * The rule this file exists to enforce: nothing goes in here unless something
 * reads it. A settings screen full of switches that only write to localStorage
 * is worse than no settings screen, because it teaches a student that the
 * controls are decorative. Each preference below names its consumer.
 */

export const EXPLANATION_STYLES = ["concise", "balanced", "detailed"] as const;
export type ExplanationStyle = (typeof EXPLANATION_STYLES)[number];

export const ANSWER_MODES = ["learn", "exam", "quick"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard", "mixed", "adaptive"] as const;
export type QuizDifficultyPref = (typeof QUIZ_DIFFICULTIES)[number];

export const EXPLANATION_TIMING = ["immediate", "end"] as const;
export type ExplanationTiming = (typeof EXPLANATION_TIMING)[number];

export const DIAGRAM_MODES = ["auto", "ask", "minimal"] as const;
export type DiagramMode = (typeof DIAGRAM_MODES)[number];

export const EXAMPLE_LEVELS = ["more", "balanced", "fewer"] as const;
export type ExampleLevel = (typeof EXAMPLE_LEVELS)[number];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export interface Preferences {
  /** Read by: Explain workspace (default depth), Ask answer prompt. */
  explanationStyle: ExplanationStyle;
  /** Read by: Ask StudyFilter — which answer card leads. */
  answerMode: AnswerMode;
  /** Read by: quiz setup (pre-selected difficulty). "adaptive" uses mastery. */
  quizDifficulty: QuizDifficultyPref;
  /** Read by: quiz player — reveal the explanation per question or at the end. */
  quizExplanations: ExplanationTiming;
  /** Read by: quiz setup (pre-selected count). */
  quizCount: number;
  /** Read by: quiz setup (timer on by default). */
  quizTimer: boolean;
  /** Read by: answer renderer — whether to draw a diagram unprompted. */
  diagrams: DiagramMode;
  /** Read by: answer prompt — how many worked examples to ask for. */
  examples: ExampleLevel;
  /** Read by: flashcard review — cards per session. */
  flashcardBatch: number;
  /** Read by: PageShell + card paddings. */
  density: Density;
  /** Read by: every animated surface; also honours the OS setting. */
  reduceMotion: boolean;
  /** Read by: the reader and answer surfaces — thicker rules, stronger borders. */
  highContrast: boolean;
  /** Read by: Focus room + header — hides XP/streak for students it stresses. */
  hideStats: boolean;
  /** Read by: dashboard — whether to surface the revision-due card at all. */
  revisionReminders: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  explanationStyle: "balanced",
  answerMode: "learn",
  quizDifficulty: "medium",
  quizExplanations: "end",
  quizCount: 10,
  quizTimer: false,
  diagrams: "auto",
  examples: "balanced",
  flashcardBatch: 20,
  density: "comfortable",
  reduceMotion: false,
  highContrast: false,
  hideStats: false,
  revisionReminders: true,
};

const ALLOWED_COUNTS = [5, 10, 15, 20, 25, 30] as const;

const store = createStore<Preferences>({
  key: "sf_preferences",
  version: 1,
  fallback: () => ({ ...DEFAULT_PREFERENCES }),
  parse: (raw) => {
    if (!isObject(raw)) return null;
    const count = num(raw.quizCount, DEFAULT_PREFERENCES.quizCount);
    return {
      explanationStyle: oneOf(raw.explanationStyle, EXPLANATION_STYLES, "balanced"),
      answerMode: oneOf(raw.answerMode, ANSWER_MODES, "learn"),
      quizDifficulty: oneOf(raw.quizDifficulty, QUIZ_DIFFICULTIES, "medium"),
      quizExplanations: oneOf(raw.quizExplanations, EXPLANATION_TIMING, "end"),
      quizCount: (ALLOWED_COUNTS as readonly number[]).includes(count) ? count : 10,
      quizTimer: bool(raw.quizTimer, false),
      diagrams: oneOf(raw.diagrams, DIAGRAM_MODES, "auto"),
      examples: oneOf(raw.examples, EXAMPLE_LEVELS, "balanced"),
      flashcardBatch: Math.max(5, Math.min(60, num(raw.flashcardBatch, 20))),
      density: oneOf(raw.density, DENSITIES, "comfortable"),
      reduceMotion: bool(raw.reduceMotion, false),
      highContrast: bool(raw.highContrast, false),
      hideStats: bool(raw.hideStats, false),
      revisionReminders: bool(raw.revisionReminders, true),
    };
  },
});

export function readPreferences(): Preferences {
  return store.get();
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  store.set((prev) => ({ ...prev, [key]: value }));
}

export function resetPreferences(): void {
  store.set({ ...DEFAULT_PREFERENCES });
}

export function usePreferences(): {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
} {
  const prefs = useStore(store);
  return React.useMemo(
    () => ({ prefs, set: setPreference, reset: resetPreferences }),
    [prefs],
  );
}

/**
 * Applies the two preferences that are really document-level: motion and
 * density. Both are attributes on <html> so CSS can react without every
 * component subscribing.
 *
 * Motion respects the OS first. A student who has asked their phone to reduce
 * motion should not have to ask again here, and the app setting can only ever
 * add restraint, never remove it.
 */
export function usePreferenceSideEffects(): void {
  const prefs = useStore(store);

  React.useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const apply = () => {
      const reduced = prefs.reduceMotion || media.matches;
      root.dataset.motion = reduced ? "reduced" : "full";
      root.dataset.density = prefs.density;
      root.dataset.contrast = prefs.highContrast ? "high" : "normal";
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs.reduceMotion, prefs.density, prefs.highContrast]);
}

/**
 * How the answer prompt should be framed, derived from preferences.
 *
 * Kept here rather than in each caller so "Concise" means the same thing in
 * Explain, Solve and Ask.
 */
export function promptStyleHints(prefs: Preferences): string[] {
  const hints: string[] = [];
  if (prefs.explanationStyle === "concise") {
    hints.push("Keep it short — the core idea and one example, nothing more.");
  } else if (prefs.explanationStyle === "detailed") {
    hints.push("Go deep: derive it, cover edge cases, and connect it to related ideas.");
  }
  if (prefs.answerMode === "exam") {
    hints.push("Write it the way it should be written in the board exam, for marks.");
  } else if (prefs.answerMode === "quick") {
    hints.push("Lead with the answer itself; keep any explanation to a line or two.");
  }
  if (prefs.examples === "more") hints.push("Include several worked examples.");
  if (prefs.examples === "fewer") hints.push("Skip extra examples unless one is essential.");
  return hints;
}
