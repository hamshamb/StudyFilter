import { useState, useEffect, useCallback } from "react";

const SIZE_KEY = "sf_reading_size";
const SIZE_EVENT = "sf_reading_size_change";

export const READING_SIZES = ["sm", "md", "lg"] as const;
export type ReadingSize = (typeof READING_SIZES)[number];

const DEFAULT_SIZE: ReadingSize = "md";

/** Base font size AI answers and chapter notes render at, per size step. */
export const READING_SIZE_REM: Record<ReadingSize, string> = {
  sm: "0.9rem",
  md: "1rem",
  lg: "1.15rem",
};

export const READING_SIZE_LABEL: Record<ReadingSize, string> = {
  sm: "Small",
  md: "Standard",
  lg: "Large",
};

function isReadingSize(v: unknown): v is ReadingSize {
  return typeof v === "string" && (READING_SIZES as readonly string[]).includes(v);
}

function readSize(): ReadingSize {
  try {
    const stored = localStorage.getItem(SIZE_KEY);
    return isReadingSize(stored) ? stored : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

/**
 * Text-size preference for AI-generated answers, summaries and notes —
 * mirrors {@link useGrade}'s cross-tab-sync pattern. Deliberately does not
 * touch the PDF reader: those pages are rasterised images, so the reader's
 * own zoom control is the right lever there, not a font-size CSS variable.
 */
export function useReadingSize() {
  const [size, setSizeState] = useState<ReadingSize>(DEFAULT_SIZE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSizeState(readSize());
      setReady(true);
    };
    sync();
    window.addEventListener(SIZE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SIZE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setSize = useCallback((s: ReadingSize) => {
    try {
      localStorage.setItem(SIZE_KEY, s);
    } catch {
      // ignore quota errors
    }
    window.dispatchEvent(new Event(SIZE_EVENT));
  }, []);

  return { size, setSize, ready, fontSize: READING_SIZE_REM[size] };
}
