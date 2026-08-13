import { useState, useEffect, useCallback } from "react";
import type { StudyAnswer } from "@workspace/api-client-react";

export interface Bookmark {
  id: string;
  question: string;
  classLevel: string;
  answer: StudyAnswer;
  timestamp: number;
}

const STORAGE_KEY = "sf_bookmarks";
const BOOKMARK_EVENT = "sf_bookmarks_change";
const MAX_ENTRIES = 100;

function isValidAnswer(a: unknown): a is StudyAnswer {
  if (!a || typeof a !== "object") return false;
  const ans = a as Record<string, unknown>;
  const quiz = ans.quickQuiz as Record<string, unknown> | undefined;
  return (
    typeof ans.examReadyAnswer === "string" &&
    typeof ans.shortAnswer === "string" &&
    typeof ans.answerSource === "string" &&
    typeof ans.confidence === "string" &&
    Array.isArray(ans.stepByStep) &&
    !!quiz &&
    typeof quiz === "object"
  );
}

function isValidBookmark(e: unknown): e is Bookmark {
  if (!e || typeof e !== "object") return false;
  const b = e as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.question === "string" &&
    typeof b.classLevel === "string" &&
    typeof b.timestamp === "number" &&
    isValidAnswer(b.answer)
  );
}

function readBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBookmark).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(next: Bookmark[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  window.dispatchEvent(new Event(BOOKMARK_EVENT));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    const sync = () => setBookmarks(readBookmarks());
    sync();
    window.addEventListener(BOOKMARK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BOOKMARK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isBookmarked = useCallback(
    (question: string) => readBookmarks().some((b) => b.question === question),
    [],
  );

  const toggleBookmark = useCallback(
    (entry: Omit<Bookmark, "id" | "timestamp">) => {
      const current = readBookmarks();
      const existing = current.find((b) => b.question === entry.question);
      if (existing) {
        write(current.filter((b) => b.id !== existing.id));
        return false;
      }
      write(
        [
          { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
          ...current,
        ].slice(0, MAX_ENTRIES),
      );
      return true;
    },
    [],
  );

  const removeBookmark = useCallback((id: string) => {
    write(readBookmarks().filter((b) => b.id !== id));
  }, []);

  const clearBookmarks = useCallback(() => {
    write([]);
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks };
}
