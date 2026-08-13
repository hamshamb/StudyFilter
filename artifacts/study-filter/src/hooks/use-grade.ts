import { useState, useEffect, useCallback } from "react";

const GRADE_KEY = "sf_grade";
const GRADE_EVENT = "sf_grade_change";

export const ALL_GRADES = ["9", "10", "11", "12"] as const;
export const AVAILABLE_GRADES = ["10"] as const;

export function isGradeAvailable(grade: string): boolean {
  return (AVAILABLE_GRADES as readonly string[]).includes(grade);
}

function readGrade(): string | null {
  try {
    const stored = localStorage.getItem(GRADE_KEY);
    return stored && isGradeAvailable(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function useGrade() {
  const [grade, setGradeState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setGradeState(readGrade());
      setReady(true);
    };
    sync();
    window.addEventListener(GRADE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GRADE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setGrade = useCallback((g: string) => {
    try {
      localStorage.setItem(GRADE_KEY, g);
    } catch {
      // ignore quota errors
    }
    window.dispatchEvent(new Event(GRADE_EVENT));
  }, []);

  return { grade, setGrade, ready, needsOnboarding: ready && !grade };
}
