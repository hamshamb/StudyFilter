import { useState, useEffect, useCallback } from "react";
import type { StudyAnswer } from "@workspace/api-client-react";

export interface HistoryEntry {
  id: string;
  question: string;
  classLevel: string;
  subject: string;
  chapter: string;
  answer: StudyAnswer;
  timestamp: number;
}

const STORAGE_KEY = "sf_history";
const MAX_ENTRIES = 10;

function isValidAnswer(a: unknown): a is StudyAnswer {
  if (!a || typeof a !== "object") return false;
  const ans = a as Record<string, unknown>;
  const quiz = ans.quickQuiz as Record<string, unknown> | undefined;
  return (
    typeof ans.examReadyAnswer === "string" &&
    typeof ans.shortAnswer === "string" &&
    typeof ans.keyConcept === "string" &&
    typeof ans.examTip === "string" &&
    typeof ans.commonMistake === "string" &&
    typeof ans.memoryTrick === "string" &&
    typeof ans.answerSource === "string" &&
    typeof ans.confidence === "string" &&
    Array.isArray(ans.stepByStep) &&
    !!quiz &&
    typeof quiz === "object" &&
    typeof quiz.question === "string" &&
    Array.isArray(quiz.options) &&
    typeof quiz.correctAnswer === "string" &&
    typeof quiz.explanation === "string"
  );
}

function isValidEntry(e: unknown): e is HistoryEntry {
  if (!e || typeof e !== "object") return false;
  const entry = e as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.question === "string" &&
    typeof entry.classLevel === "string" &&
    typeof entry.subject === "string" &&
    typeof entry.chapter === "string" &&
    typeof entry.timestamp === "number" &&
    isValidAnswer(entry.answer)
  );
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const addEntry = useCallback(
    (entry: Omit<HistoryEntry, "id" | "timestamp">) => {
      setHistory((prev) => {
        const next: HistoryEntry[] = [
          { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
          ...prev,
        ].slice(0, MAX_ENTRIES);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore quota / serialization errors
        }
        return next;
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, addEntry, clearHistory };
}
