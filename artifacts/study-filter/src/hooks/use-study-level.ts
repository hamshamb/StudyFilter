import { useState, useEffect, useCallback } from "react";
import {
  STUDY_LEVELS,
  DEFAULT_STUDY_LEVEL_ID,
  isStudyLevelId,
  type StudyLevel,
  type StudyLevelId,
} from "@/lib/study-level";

const LEVEL_KEY = "sf_study_level";
const LEVEL_EVENT = "sf_study_level_change";

function readLevel(): StudyLevelId | null {
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    return stored && isStudyLevelId(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persisted academic study level, mirroring {@link useGrade}'s pattern so the
 * value stays in sync across tabs and components. `level` always resolves to a
 * full config (falling back to the default) so consumers never need null checks;
 * use `levelId` / `needsLevel` to detect whether the student has actually chosen.
 */
export function useStudyLevel() {
  const [levelId, setLevelIdState] = useState<StudyLevelId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setLevelIdState(readLevel());
      setReady(true);
    };
    sync();
    window.addEventListener(LEVEL_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LEVEL_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLevel = useCallback((id: StudyLevelId) => {
    try {
      localStorage.setItem(LEVEL_KEY, id);
    } catch {
      // ignore quota errors
    }
    window.dispatchEvent(new Event(LEVEL_EVENT));
  }, []);

  const level: StudyLevel = STUDY_LEVELS[levelId ?? DEFAULT_STUDY_LEVEL_ID];

  return {
    levelId,
    level,
    setLevel,
    ready,
    needsLevel: ready && !levelId,
  };
}
