import React from "react";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  THEMES,
  isThemeId,
  type ThemeId,
  type ThemeMode,
} from "@/lib/themes";
import { bool, createStore, isObject, oneOf, useStore } from "@/lib/store";

/**
 * Theme state, in the shape the app already used plus the part that was
 * missing.
 *
 * `theme` still reads "light" | "dark" | "system" and `setTheme` still accepts
 * those, because a dozen call sites — the sidebar toggle, the command palette,
 * Settings — depend on it. What is new is that "light" and "dark" are no longer
 * two fixed palettes: they resolve to whichever light and dark *theme* the
 * student picked, so choosing Paper and then tapping the moon gives them their
 * dark choice back rather than resetting them to the default.
 *
 * Migration: the previous value was the bare string "light" | "dark" |
 * "system" under `sf_theme`. That key is read once on first load and mapped
 * onto the new shape, so nobody's existing preference is lost.
 */

interface ThemeState {
  /** Follow the OS rather than a fixed mode. */
  followSystem: boolean;
  /** Which theme is active when the resolved mode is light. */
  light: ThemeId;
  /** Which theme is active when the resolved mode is dark. */
  dark: ThemeId;
  /** The mode chosen when not following the system. */
  mode: ThemeMode;
}

const LEGACY_KEY = "sf_theme";

function migrateLegacy(): ThemeState {
  let followSystem = true;
  let mode: ThemeMode = "light";
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy === "dark") {
      followSystem = false;
      mode = "dark";
    } else if (legacy === "light") {
      followSystem = false;
      mode = "light";
    }
  } catch {
    /* no stored preference — follow the system, which is the right default */
  }
  return { followSystem, mode, light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME };
}

const store = createStore<ThemeState>({
  key: "sf_theme_v2",
  version: 1,
  fallback: migrateLegacy,
  parse: (raw) => {
    if (!isObject(raw)) return null;
    return {
      followSystem: bool(raw.followSystem, true),
      mode: oneOf(raw.mode, ["light", "dark"] as const, "light"),
      light: isThemeId(raw.light) ? raw.light : DEFAULT_LIGHT_THEME,
      dark: isThemeId(raw.dark) ? raw.dark : DEFAULT_DARK_THEME,
    };
  },
});

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveMode(state: ThemeState, systemDark: boolean): ThemeMode {
  return state.followSystem ? (systemDark ? "dark" : "light") : state.mode;
}

function activeTheme(state: ThemeState, systemDark: boolean): ThemeId {
  return resolveMode(state, systemDark) === "dark" ? state.dark : state.light;
}

/**
 * Writes the theme onto <html>.
 *
 * Two attributes, deliberately: the `dark` class keeps every existing
 * `dark:` Tailwind utility working, and `data-theme` selects the palette. A
 * dark theme therefore always also carries `.dark`, so a component written
 * against dark mode behaves correctly under Midnight and Ocean without
 * knowing they exist.
 */
function applyToDocument(themeId: ThemeId): void {
  const root = document.documentElement;
  const mode = THEMES[themeId].mode;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.dataset.theme = themeId;
  root.style.colorScheme = mode;
}

/**
 * Applied once, at the root. Keeping the DOM write in one place means a
 * component that merely *reads* the theme can't accidentally re-apply it.
 */
export function useThemeSideEffects(): void {
  const state = useStore(store);
  const [systemDark, setSystemDark] = React.useState(systemPrefersDark);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    setSystemDark(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  React.useEffect(() => {
    applyToDocument(activeTheme(state, systemDark));
  }, [state, systemDark]);
}

export interface UseTheme {
  /** Backwards-compatible: "light" | "dark" | "system". */
  theme: "light" | "dark" | "system";
  setTheme: (next: "light" | "dark" | "system") => void;
  /** The concrete mode in effect right now. */
  mode: ThemeMode;
  /** The concrete theme in effect right now. */
  themeId: ThemeId;
  /** Choose a named theme. Also switches mode to match that theme. */
  setThemeId: (id: ThemeId) => void;
  /** The student's remembered light/dark choices, for the Settings picker. */
  lightThemeId: ThemeId;
  darkThemeId: ThemeId;
}

export function useTheme(): UseTheme {
  const state = useStore(store);
  const [systemDark, setSystemDark] = React.useState(systemPrefersDark);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const mode = resolveMode(state, systemDark);
  const themeId = activeTheme(state, systemDark);

  const setTheme = React.useCallback((next: "light" | "dark" | "system") => {
    store.set((prev) =>
      next === "system"
        ? { ...prev, followSystem: true }
        : { ...prev, followSystem: false, mode: next },
    );
  }, []);

  const setThemeId = React.useCallback((id: ThemeId) => {
    const spec = THEMES[id];
    store.set((prev) => ({
      ...prev,
      followSystem: false,
      mode: spec.mode,
      // Remember it as this student's choice for that mode, so toggling
      // light/dark later returns to it rather than to the default.
      [spec.mode]: id,
    }));
  }, []);

  return {
    theme: state.followSystem ? "system" : state.mode,
    setTheme,
    mode,
    themeId,
    setThemeId,
    lightThemeId: state.light,
    darkThemeId: state.dark,
  };
}
