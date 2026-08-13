import React from "react";
import { createStore, isObject, list, newId, num, oneOf, str, useStore } from "@/lib/store";

/**
 * Study notes.
 *
 * Stored as Markdown, not as a rich document model. That is a deliberate
 * ceiling: this is a place to keep the three lines that finally made a concept
 * click, not a word processor. Markdown gives headings, bold, lists, tables
 * and — through the existing KaTeX pipeline in MarkdownRenderer — real
 * formulae, which covers everything a Class 10 revision note needs, and it
 * renders with the component the rest of the app already uses.
 *
 * Notes can be created from scratch or captured from something already on
 * screen: an answer, a chapter summary, a passage selected in the reader.
 * `source` records which, so a note made from an AI answer is never mistaken
 * for something the student wrote themselves.
 */

export const NOTE_SOURCES = ["manual", "answer", "summary", "selection", "revision"] as const;
export type NoteSource = (typeof NOTE_SOURCES)[number];

export interface Note {
  id: string;
  title: string;
  /** Markdown. */
  body: string;
  subjectId?: string;
  chapterId?: string;
  /** Free-text labels the student adds. */
  tags: string[];
  source: NoteSource;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

const store = createStore<Note[]>({
  key: "sf_notes",
  version: 1,
  fallback: () => [],
  parse: (raw) =>
    list<Note>(raw, (item) => {
      if (!isObject(item)) return null;
      const id = str(item.id);
      if (!id) return null;
      const note: Note = {
        id,
        title: str(item.title, "Untitled note"),
        body: str(item.body),
        tags: Array.isArray(item.tags)
          ? item.tags.filter((t): t is string => typeof t === "string").slice(0, 12)
          : [],
        source: oneOf(item.source, NOTE_SOURCES, "manual"),
        createdAt: num(item.createdAt, Date.now()),
        updatedAt: num(item.updatedAt, Date.now()),
        pinned: item.pinned === true,
      };
      const subjectId = str(item.subjectId);
      const chapterId = str(item.chapterId);
      if (subjectId) note.subjectId = subjectId;
      if (chapterId) note.chapterId = chapterId;
      return note;
    }),
});

export interface NewNote {
  title: string;
  body: string;
  subjectId?: string;
  chapterId?: string;
  tags?: string[];
  source?: NoteSource;
}

export function createNote(input: NewNote): string {
  const now = Date.now();
  const note: Note = {
    id: newId(),
    title: input.title.trim() || "Untitled note",
    body: input.body,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.chapterId ? { chapterId: input.chapterId } : {}),
    tags: input.tags ?? [],
    source: input.source ?? "manual",
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
  store.set((prev) => [note, ...prev]);
  return note.id;
}

export function updateNote(id: string, patch: Partial<Omit<Note, "id" | "createdAt">>): void {
  store.set((prev) =>
    prev.map((note) =>
      note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note,
    ),
  );
}

export function deleteNote(id: string): void {
  store.set((prev) => prev.filter((note) => note.id !== id));
}

export function togglePinned(id: string): void {
  store.set((prev) =>
    prev.map((note) => (note.id === id ? { ...note, pinned: !note.pinned } : note)),
  );
}

/**
 * Appends to an existing note about the same chapter, or starts a new one.
 *
 * "Add to notes" from an answer should build up one page per chapter rather
 * than scattering twenty one-line notes across the list — that is what makes
 * notes worth opening later.
 */
export function appendToChapterNote(
  input: NewNote & { chapterTitle?: string },
): string {
  const existing = input.chapterId
    ? store.get().find((n) => n.chapterId === input.chapterId && n.source !== "manual")
    : undefined;

  if (existing) {
    updateNote(existing.id, {
      body: `${existing.body.trimEnd()}\n\n---\n\n### ${input.title}\n\n${input.body}`,
    });
    return existing.id;
  }
  return createNote({
    ...input,
    title: input.chapterTitle ?? input.title,
    body: `### ${input.title}\n\n${input.body}`,
  });
}

export function useNotes() {
  const notes = useStore(store);

  return React.useMemo(() => {
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return {
      notes: sorted,
      get: (id: string) => notes.find((n) => n.id === id) ?? null,
      forChapter: (subjectId: string, chapterId: string) =>
        sorted.filter((n) => n.subjectId === subjectId && n.chapterId === chapterId),
      search: (query: string) => {
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q)),
        );
      },
      count: notes.length,
    };
  }, [notes]);
}

export function readNotes(): Note[] {
  return store.get();
}

export function clearNotes(): void {
  store.clear();
}
