import React from "react";
import { useLocation, useSearch } from "wouter";
import { GRADE, type SubjectId } from "@workspace/cbse-content";
import {
  EMPTY_SCOPE,
  resolveScope,
  scopeFromSearch,
  scopeToSearch,
  type ResolvedScope,
  type StudyScope,
} from "@/lib/scope";
import { createStore, isObject, num, str, useStore } from "@/lib/store";

/**
 * The sticky scope — the last chapter the student was actually working in.
 *
 * Persisted rather than held in React state on purpose: it has to survive a
 * refresh, because "open StudyFilter, hit Quiz, get a quiz on the chapter I
 * was reading yesterday" is the whole point.
 */
const scopeStore = createStore<StudyScope>({
  key: "sf_scope",
  version: 1,
  fallback: () => ({ ...EMPTY_SCOPE, classLevel: GRADE }),
  parse: (raw) => {
    if (!isObject(raw)) return null;
    return {
      board: "CBSE",
      classLevel: num(raw.classLevel, GRADE),
      subjectId: (str(raw.subjectId) || null) as SubjectId | null,
      chapterId: str(raw.chapterId) || null,
      topic: str(raw.topic) || null,
    };
  },
});

export function readStickyScope(): StudyScope {
  return scopeStore.get();
}

/**
 * Records where the student is. Called by the pages that *are* a location —
 * a chapter page, a subject page, the reader — not by the feature pages that
 * merely consume it.
 */
export function rememberScope(next: Partial<StudyScope>): void {
  scopeStore.set((prev) => {
    const merged = { ...prev, ...next };
    // Changing subject without naming a chapter must not leave the previous
    // subject's chapter attached — that produced "Mathematics · Electricity".
    if (next.subjectId !== undefined && next.subjectId !== prev.subjectId && next.chapterId === undefined) {
      merged.chapterId = null;
      merged.topic = null;
    }
    if (next.chapterId !== undefined && next.chapterId !== prev.chapterId && next.topic === undefined) {
      merged.topic = null;
    }
    return merged;
  });
}

/** The sticky scope, resolved, re-rendering whenever it changes. */
export function useStickyScope(): ResolvedScope {
  const scope = useStore(scopeStore);
  return React.useMemo(() => resolveScope(scope), [scope]);
}

/**
 * Marks a page as *being* a scope. Records it on mount and whenever it
 * changes, so every feature opened afterwards inherits it.
 */
export function useRememberScope(next: Partial<StudyScope>): void {
  const { subjectId, chapterId, topic } = next;
  React.useEffect(() => {
    rememberScope({ subjectId, chapterId, topic });
  }, [subjectId, chapterId, topic]);
}

export interface ScopedRoute {
  /** URL scope layered over the sticky scope, resolved. */
  scope: ResolvedScope;
  /**
   * Changes the scope *and* the URL together, so the address bar always
   * describes what is on screen and Back does what it looks like it does.
   */
  setScope: (next: Partial<StudyScope>, options?: { replace?: boolean }) => void;
  /** True when the URL named a scope, rather than it being inherited. */
  fromUrl: boolean;
}

/**
 * For feature routes (`/quiz`, `/revise`, `/explain`, …).
 *
 * The URL is authoritative; the sticky scope fills the gaps. Selecting a
 * different chapter inside the feature rewrites the URL, which is what makes
 * these pages shareable and refresh-safe.
 */
export function useScopedRoute(path: string): ScopedRoute {
  const search = useSearch();
  const [, navigate] = useLocation();
  const sticky = useStore(scopeStore);

  const urlScope = React.useMemo(() => scopeFromSearch(search), [search]);
  const fromUrl = urlScope.subjectId !== undefined || urlScope.chapterId !== undefined;

  const merged = React.useMemo<StudyScope>(() => {
    if (!fromUrl) return sticky;
    // A URL that names a subject but no chapter means "this subject, no
    // chapter" — inheriting the sticky chapter here would silently answer a
    // different question than the link asked for.
    return {
      board: "CBSE",
      classLevel: sticky.classLevel,
      subjectId: urlScope.subjectId ?? null,
      chapterId: urlScope.chapterId ?? null,
      topic: urlScope.topic ?? null,
    };
  }, [fromUrl, sticky, urlScope]);

  const resolved = React.useMemo(() => resolveScope(merged), [merged]);

  const setScope = React.useCallback(
    (next: Partial<StudyScope>, options?: { replace?: boolean }) => {
      const candidate: StudyScope = { ...merged, ...next };
      if (next.subjectId !== undefined && next.subjectId !== merged.subjectId && next.chapterId === undefined) {
        candidate.chapterId = null;
        candidate.topic = null;
      }
      rememberScope(candidate);
      navigate(`${path}${scopeToSearch(candidate)}`, { replace: options?.replace ?? false });
    },
    [merged, navigate, path],
  );

  return { scope: resolved, setScope, fromUrl };
}

/**
 * A scope that never changes with the URL — for panels and dialogs opened on
 * top of a page that already knows its chapter (the reader's study workspace,
 * a chapter page's quiz launcher).
 */
export function useFixedScope(input: Partial<StudyScope>): ResolvedScope {
  const sticky = useStore(scopeStore);
  return React.useMemo(
    () =>
      resolveScope({
        board: "CBSE",
        classLevel: input.classLevel ?? sticky.classLevel,
        subjectId: input.subjectId ?? null,
        chapterId: input.chapterId ?? null,
        topic: input.topic ?? null,
      }),
    [input.classLevel, input.subjectId, input.chapterId, input.topic, sticky.classLevel],
  );
}
