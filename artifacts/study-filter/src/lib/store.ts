/**
 * One local-storage store, made once.
 *
 * Before this file, `use-bookmarks`, `use-history` and `use-chapter-progress`
 * each hand-rolled the same four things: a JSON read wrapped in try/catch, a
 * validator, a write that swallows quota errors, and some way of telling other
 * components on the page that the value changed. The three implementations
 * disagreed — bookmarks used a custom window event, chapter progress used a
 * module-level cache with `useSyncExternalStore`, and history simply didn't
 * notify anyone, so two components reading history could show different lists.
 *
 * Every new feature in this pass (quiz sessions, flashcards, notes, mastery,
 * recents, preferences, map and element progress) needs exactly this. So it is
 * one factory, with the good version of the behaviour:
 *
 * - a module-level cache, so a render never touches localStorage
 * - `useSyncExternalStore`, so React never tears between two readers
 * - `storage` events, so a second tab studying the same account stays in sync
 * - a validator, so a half-written or outdated value degrades to the default
 *   rather than crashing a page
 * - a `version`, so a shape change discards old data instead of pretending to
 *   understand it
 *
 * This is *device-local* state by design. It is the trail of what a student
 * did on this browser; nothing here is authoritative over what the server
 * knows, and losing it degrades a feature to "empty", never to "wrong".
 */

import { useCallback, useSyncExternalStore } from "react";

export interface StoreOptions<T> {
  /** localStorage key. Prefix everything with `sf_`. */
  key: string;
  /** Returned when nothing is stored, or when what is stored fails `parse`. */
  fallback: () => T;
  /**
   * Narrows unknown JSON to T. Return null to reject — the fallback is used
   * and the bad value is left in place rather than thrown away, so a bug here
   * never silently destroys a student's work.
   */
  parse: (raw: unknown) => T | null;
  /**
   * Bump when the stored shape changes incompatibly. A stored value written
   * under a different version is ignored.
   */
  version?: number;
}

export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  /** Stable server snapshot — this data only exists in the browser. */
  serverSnapshot: () => T;
}

interface Envelope {
  v: number;
  d: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Envelope).v === "number" &&
    "d" in (value as Envelope)
  );
}

export function createStore<T>(options: StoreOptions<T>): Store<T> {
  const { key, fallback, parse, version = 1 } = options;

  let cache: T | undefined;
  let serverValue: T | undefined;
  const listeners = new Set<() => void>();

  function read(): T {
    if (typeof window === "undefined") return fallback();
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback();
      const parsed: unknown = JSON.parse(raw);
      // Values written before this factory existed have no envelope. Give the
      // validator a chance at the bare value so nothing is lost on upgrade.
      const payload = isEnvelope(parsed)
        ? parsed.v === version
          ? parsed.d
          : undefined
        : parsed;
      if (payload === undefined) return fallback();
      return parse(payload) ?? fallback();
    } catch {
      return fallback();
    }
  }

  function get(): T {
    if (cache === undefined) cache = read();
    return cache;
  }

  function emit(next: T): void {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify({ v: version, d: next }));
    } catch {
      // Quota exceeded or private-mode denial. The in-memory value still
      // updates so the current session behaves correctly; it just won't
      // survive a reload. Failing loudly here would interrupt studying to
      // report a problem the student cannot act on.
    }
    for (const listener of listeners) listener();
  }

  function set(next: T | ((prev: T) => T)): void {
    const value =
      typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
    emit(value);
  }

  function clear(): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing we can do, and nothing worth telling the student */
    }
    cache = fallback();
    for (const listener of listeners) listener();
  }

  function onStorage(event: StorageEvent): void {
    if (event.key !== key) return;
    cache = read();
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }

  function serverSnapshot(): T {
    // Must be referentially stable or useSyncExternalStore loops forever.
    if (serverValue === undefined) serverValue = fallback();
    return serverValue;
  }

  return { get, set, clear, subscribe, serverSnapshot };
}

/** Subscribe a component to a store. Re-renders on every change, in any tab. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.serverSnapshot);
}

/** The value plus its setter, in the shape `useState` already taught everyone. */
export function useStoreState<T>(store: Store<T>): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useStore(store);
  const set = useCallback((next: T | ((prev: T) => T)) => store.set(next), [store]);
  return [value, set];
}

// ── Small validators, shared by every store below ────────────────────────────

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function str(value: unknown, fallbackValue = ""): string {
  return typeof value === "string" ? value : fallbackValue;
}

export function num(value: unknown, fallbackValue = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallbackValue;
}

export function bool(value: unknown, fallbackValue = false): boolean {
  return typeof value === "boolean" ? value : fallbackValue;
}

/** Keeps a value inside a known set of literals, falling back when it isn't. */
export function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallbackValue: T[number],
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallbackValue;
}

/** Maps an unknown array through a per-item parser, dropping items that fail. */
export function list<T>(value: unknown, parseItem: (raw: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const parsed = parseItem(item);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/**
 * `crypto.randomUUID` is unavailable on http:// origins in some browsers, and
 * several of these stores create ids while the app is being previewed over
 * plain HTTP. Falls back to something unique enough for local keys.
 */
export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
