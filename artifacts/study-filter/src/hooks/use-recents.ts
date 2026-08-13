import React from "react";
import { createStore, isObject, newId, num, oneOf, str, useStore } from "@/lib/store";

/**
 * One recent-activity trail for the whole app.
 *
 * The pieces existed before — chapter visits in `sf_chapter_progress`, answers
 * in `sf_history`, PDFs nowhere at all — but they had different shapes and
 * different lifetimes, so nothing could show "here is what you were doing".
 * Every feature now writes one entry with a title, a destination and a time,
 * which is all "Continue" needs.
 *
 * Entries are *resumable by URL*, which is the constraint that keeps this
 * honest: if a feature can't express where it was as a link, it doesn't get a
 * recent entry, rather than getting one that goes somewhere useless.
 */

export const RECENT_KINDS = [
  "chapter",
  "reader",
  "doubt",
  "quiz",
  "revision",
  "flashcards",
  "note",
  "map",
  "elements",
  "paper",
] as const;

export type RecentKind = (typeof RECENT_KINDS)[number];

export interface RecentEntry {
  id: string;
  kind: RecentKind;
  /** What it was. "Electricity", "Ohm's law quiz", "2023 Maths Set 1". */
  title: string;
  /** Where it sat. "Science · Chapter 11", "10 questions · 7/10". */
  subtitle?: string;
  /** Where "Continue" goes. Always an in-app route. */
  href: string;
  at: number;
  subjectId?: string;
  chapterId?: string;
  /** 0–100, when the activity has a meaningful notion of "how far in". */
  progress?: number;
}

const MAX_ENTRIES = 40;

const store = createStore<RecentEntry[]>({
  key: "sf_recents",
  version: 1,
  fallback: () => [],
  parse: (raw) => {
    if (!Array.isArray(raw)) return null;
    const out: RecentEntry[] = [];
    for (const value of raw) {
      if (!isObject(value)) continue;
      const href = str(value.href);
      const title = str(value.title);
      if (!href || !title) continue;
      const entry: RecentEntry = {
        id: str(value.id) || newId(),
        kind: oneOf(value.kind, RECENT_KINDS, "chapter") as RecentKind,
        title,
        href,
        at: num(value.at),
      };
      const subtitle = str(value.subtitle);
      const subjectId = str(value.subjectId);
      const chapterId = str(value.chapterId);
      if (subtitle) entry.subtitle = subtitle;
      if (subjectId) entry.subjectId = subjectId;
      if (chapterId) entry.chapterId = chapterId;
      if (typeof value.progress === "number") {
        entry.progress = Math.max(0, Math.min(100, value.progress));
      }
      out.push(entry);
    }
    return out.sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES);
  },
});

export type RecentInput = Omit<RecentEntry, "id" | "at"> & { at?: number };

/**
 * Records an activity.
 *
 * Re-recording the same destination updates the existing entry rather than
 * adding a second — otherwise reading one chapter for an hour buries every
 * other thing the student did that day under forty copies of itself.
 */
export function recordRecent(input: RecentInput): void {
  const at = input.at ?? Date.now();
  store.set((entries) => {
    const idx = entries.findIndex((e) => e.kind === input.kind && e.href === input.href);
    const base: RecentEntry =
      idx >= 0 ? { ...entries[idx]!, ...input, at } : { ...input, id: newId(), at };
    const rest = idx >= 0 ? [...entries.slice(0, idx), ...entries.slice(idx + 1)] : entries;
    return [base, ...rest].slice(0, MAX_ENTRIES);
  });
}

export function removeRecent(id: string): void {
  store.set((entries) => entries.filter((e) => e.id !== id));
}

export function clearRecents(): void {
  store.clear();
}

export function readRecents(): RecentEntry[] {
  return store.get();
}

export interface UseRecents {
  recents: RecentEntry[];
  /** Newest first, optionally filtered by kind. */
  byKind: (kind: RecentKind | "all", limit?: number) => RecentEntry[];
  /** The single best "pick up where you left off" candidate, if any. */
  continueWith: RecentEntry | null;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Which entry "Continue studying" should offer.
 *
 * Prefers something with unfinished progress over something merely recent —
 * an abandoned quiz at 40% is a better offer than the chapter page you opened
 * afterwards. Falls back to the most recent thing of any kind.
 */
function pickContinue(entries: RecentEntry[]): RecentEntry | null {
  const unfinished = entries.find(
    (e) => typeof e.progress === "number" && e.progress > 0 && e.progress < 100,
  );
  return unfinished ?? entries[0] ?? null;
}

export function useRecents(): UseRecents {
  const recents = useStore(store);

  return React.useMemo(
    () => ({
      recents,
      byKind: (kind, limit = 6) =>
        (kind === "all" ? recents : recents.filter((e) => e.kind === kind)).slice(0, limit),
      continueWith: pickContinue(recents),
      remove: removeRecent,
      clear: clearRecents,
    }),
    [recents],
  );
}

/** Records on mount and whenever the destination changes. */
export function useRecordRecent(input: RecentInput | null): void {
  const key = input ? `${input.kind}|${input.href}|${input.title}|${input.progress ?? ""}` : null;
  React.useEffect(() => {
    if (!input || !key) return;
    recordRecent(input);
    // `key` captures every field that should trigger a re-record; including
    // the object itself would re-run on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** "2 hours ago", "yesterday" — short enough for a card subtitle. */
export function relativeTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
