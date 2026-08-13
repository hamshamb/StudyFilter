import { useCallback, useSyncExternalStore } from "react";
import type { SubjectId } from "@workspace/cbse-content";

/**
 * What the student has actually opened, per chapter.
 *
 * The dashboard needs to answer "what were you studying?" and the subject
 * contents needs to answer "how far in am I?". Neither question has a backend
 * behind it — there is no per-chapter completion table, and inventing a
 * percentage from nothing would be worse than showing none.
 *
 * So this records the one thing that is genuinely knowable on the client: the
 * chapter tools the student has opened, and when. Six tools exist on a
 * chapter page, so "4 of 6" is a real count of work done, not a guess. It is
 * per-device by design — it is a convenience trail, not an account record,
 * and it never contradicts anything the server knows.
 */

export const CHAPTER_UNIT_COUNT = 6;

const STORAGE_KEY = "sf_chapter_progress";
const MAX_ENTRIES = 80;

export interface ChapterRecord {
  subjectId: SubjectId | string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  /** Unit actions opened, deduped. Length is the "done" count. */
  units: string[];
  /** Epoch ms of the most recent visit. */
  lastVisited: number;
}

function isRecord(value: unknown): value is ChapterRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.subjectId === "string" &&
    typeof r.subjectName === "string" &&
    typeof r.chapterId === "string" &&
    typeof r.chapterTitle === "string" &&
    typeof r.chapterNumber === "number" &&
    Array.isArray(r.units) &&
    r.units.every((u) => typeof u === "string") &&
    typeof r.lastVisited === "number"
  );
}

function read(): ChapterRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

/*
 * A module-level cache plus a subscriber set, so every component reading this
 * re-renders when a chapter is opened somewhere else on the same page. Reading
 * localStorage inside a render (or on an interval) would either tear between
 * components or lag behind the click that caused the change.
 */
let cache: ChapterRecord[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): ChapterRecord[] {
  if (cache === null) cache = read();
  return cache;
}

function emit(next: ChapterRecord[]): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private-mode failures are not worth surfacing: the trail is a
    // convenience, and losing it degrades to "no recent chapters".
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Another tab studying the same account should not silently diverge.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = read();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Server snapshot for SSR/hydration — this data only exists in the browser. */
const EMPTY: ChapterRecord[] = [];

export interface RecordVisitInput {
  subjectId: SubjectId | string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  /** The tool that was opened, if any. Omit for "just landed on the page". */
  unit?: string | null;
}

export function useChapterProgress() {
  const records = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  const recordVisit = useCallback((input: RecordVisitInput) => {
    const now = Date.now();
    const current = snapshot();
    const idx = current.findIndex(
      (r) => r.subjectId === input.subjectId && r.chapterId === input.chapterId,
    );

    const existing = idx >= 0 ? current[idx] : null;
    const units = new Set(existing?.units ?? []);
    if (input.unit) units.add(input.unit);

    const updated: ChapterRecord = {
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      chapterId: input.chapterId,
      chapterTitle: input.chapterTitle,
      chapterNumber: input.chapterNumber,
      units: [...units],
      lastVisited: now,
    };

    // Nothing changed except the clock, and the clock moved less than a
    // minute: skip the write so simply re-rendering a chapter page doesn't
    // churn localStorage or push a re-render through every subscriber.
    if (
      existing &&
      existing.units.length === updated.units.length &&
      now - existing.lastVisited < 60_000
    ) {
      return;
    }

    const rest = idx >= 0 ? [...current.slice(0, idx), ...current.slice(idx + 1)] : current;
    emit([updated, ...rest].slice(0, MAX_ENTRIES));
  }, []);

  const forChapter = useCallback(
    (subjectId: string, chapterId: string): ChapterRecord | null =>
      records.find((r) => r.subjectId === subjectId && r.chapterId === chapterId) ?? null,
    [records],
  );

  /** 0–100. Chapters never touched return 0 rather than undefined. */
  const completion = useCallback(
    (subjectId: string, chapterId: string): number => {
      const rec = records.find((r) => r.subjectId === subjectId && r.chapterId === chapterId);
      if (!rec) return 0;
      return Math.round((Math.min(rec.units.length, CHAPTER_UNIT_COUNT) / CHAPTER_UNIT_COUNT) * 100);
    },
    [records],
  );

  /** Most recently opened chapters, newest first. */
  const recent = useCallback(
    (limit = 3): ChapterRecord[] =>
      [...records].sort((a, b) => b.lastVisited - a.lastVisited).slice(0, limit),
    [records],
  );

  /** How many chapters of a subject have been started at all. */
  const startedIn = useCallback(
    (subjectId: string): number =>
      records.filter((r) => r.subjectId === subjectId && r.units.length > 0).length,
    [records],
  );

  return { records, recordVisit, forChapter, completion, recent, startedIn };
}
