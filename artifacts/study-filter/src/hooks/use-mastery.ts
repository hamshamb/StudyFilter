import React from "react";
import { createStore, isObject, num, oneOf, str, useStore } from "@/lib/store";
import {
  applyAttempt,
  applyReview,
  byPriority,
  emptyRecord,
  masteryStateOf,
  type MasteryDomain,
  type MasteryRecord,
  type MasteryState,
} from "@/lib/mastery";

/**
 * The single store every practice surface writes into.
 *
 * Quizzes, map rounds, element drills and flashcard reviews all report here,
 * which is what makes one "practise your weak areas" button possible across
 * features that otherwise share nothing.
 */

const DOMAINS = ["chapter", "topic", "element", "map"] as const;

const store = createStore<Record<string, MasteryRecord>>({
  key: "sf_mastery",
  version: 1,
  fallback: () => ({}),
  parse: (raw) => {
    if (!isObject(raw)) return null;
    const out: Record<string, MasteryRecord> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!isObject(value)) continue;
      const record: MasteryRecord = {
        key,
        domain: oneOf(value.domain, DOMAINS, "chapter") as MasteryDomain,
        label: str(value.label, key),
        attempts: Math.max(0, num(value.attempts)),
        correct: Math.max(0, num(value.correct)),
        recent: Math.max(0, Math.min(1, num(value.recent))),
        lastSeen: num(value.lastSeen),
        lastRevised: num(value.lastRevised),
        reviews: Math.max(0, num(value.reviews)),
      };
      const subjectId = str(value.subjectId);
      const chapterId = str(value.chapterId);
      if (subjectId) record.subjectId = subjectId;
      if (chapterId) record.chapterId = chapterId;
      out[key] = record;
    }
    return out;
  },
});

export interface MasteryTarget {
  key: string;
  domain: MasteryDomain;
  label: string;
  subjectId?: string;
  chapterId?: string;
}

function ensure(all: Record<string, MasteryRecord>, target: MasteryTarget): MasteryRecord {
  const existing = all[target.key];
  if (existing) {
    // Labels drift when a chapter is renamed; always keep the newest.
    return { ...existing, label: target.label || existing.label };
  }
  return emptyRecord(target.key, target.domain, target.label, {
    subjectId: target.subjectId,
    chapterId: target.chapterId,
  });
}

/** Records a practice result. Safe to call from anywhere, including effects. */
export function recordMasteryAttempt(
  target: MasteryTarget,
  result: { correct: number; total: number },
): void {
  if (result.total <= 0) return;
  store.set((all) => ({
    ...all,
    [target.key]: applyAttempt(ensure(all, target), result),
  }));
}

/** Records that the student revised something (read a summary, drilled cards). */
export function recordMasteryReview(target: MasteryTarget): void {
  store.set((all) => ({
    ...all,
    [target.key]: applyReview(ensure(all, target)),
  }));
}

/** Records several targets at once — one quiz touches several topics. */
export function recordMasteryBatch(
  entries: Array<{ target: MasteryTarget; correct: number; total: number }>,
): void {
  const useful = entries.filter((e) => e.total > 0);
  if (useful.length === 0) return;
  store.set((all) => {
    const next = { ...all };
    for (const { target, correct, total } of useful) {
      next[target.key] = applyAttempt(ensure(next, target), { correct, total });
    }
    return next;
  });
}

export function readMastery(key: string): MasteryRecord | null {
  return store.get()[key] ?? null;
}

export interface UseMastery {
  all: MasteryRecord[];
  byKey: Record<string, MasteryRecord>;
  get: (key: string) => MasteryRecord | null;
  stateOf: (key: string) => MasteryState;
  /** Most urgent first — revision-due, then weakest, then least recent. */
  priority: (options?: { domain?: MasteryDomain; subjectId?: string; limit?: number }) => MasteryRecord[];
  /** Things that were learned and have gone stale. */
  dueForRevision: (limit?: number) => MasteryRecord[];
  /** Things attempted with poor recent accuracy. */
  weakest: (limit?: number) => MasteryRecord[];
  counts: Record<MasteryState, number>;
}

export function useMastery(): UseMastery {
  const byKey = useStore(store);

  return React.useMemo(() => {
    const all = Object.values(byKey);
    const now = Date.now();

    const counts = {
      "not-started": 0,
      learning: 0,
      practising: 0,
      strong: 0,
      "needs-revision": 0,
    } as Record<MasteryState, number>;
    for (const record of all) counts[masteryStateOf(record, now)] += 1;

    return {
      all,
      byKey,
      get: (key: string) => byKey[key] ?? null,
      stateOf: (key: string) => masteryStateOf(byKey[key], now),
      priority: (
        {
          domain,
          subjectId,
          limit = 5,
        }: { domain?: MasteryDomain; subjectId?: string; limit?: number } = {},
      ) =>
        all
          .filter((r) => r.attempts > 0)
          .filter((r) => (domain ? r.domain === domain : true))
          .filter((r) => (subjectId ? r.subjectId === subjectId : true))
          .sort((a, b) => byPriority(a, b, now))
          .slice(0, limit),
      dueForRevision: (limit = 5) =>
        all
          .filter((r) => masteryStateOf(r, now) === "needs-revision")
          .sort((a, b) => a.lastSeen - b.lastSeen)
          .slice(0, limit),
      weakest: (limit = 5) =>
        all
          .filter((r) => r.attempts > 0 && masteryStateOf(r, now) === "learning")
          .sort((a, b) => a.recent - b.recent)
          .slice(0, limit),
      counts,
    };
  }, [byKey]);
}

/** Clears every mastery record. Exposed in Settings → Privacy. */
export function clearMastery(): void {
  store.clear();
}

/** Used by the data export in Settings. */
export function exportMastery(): MasteryRecord[] {
  return Object.values(store.get());
}
