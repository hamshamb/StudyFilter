/**
 * Website themes.
 *
 * Six, not twenty. Each one is a considered pair of a background family and an
 * accent that survives on it, and each is defined as a token override in
 * index.css rather than as a set of component classes — so a theme cannot
 * break a layout, only recolour it.
 *
 * Every theme declares whether it is fundamentally a light or a dark surface.
 * That is what lets the existing one-tap "dark mode" control keep working: it
 * swaps to whichever dark theme the student last chose, rather than throwing
 * away their choice and forcing the default.
 *
 * Contrast: each theme's foreground/background pair clears WCAG AA for body
 * text, and each accent is only ever used for fills that carry their own
 * foreground token, never for text on the page background.
 */

export const THEME_IDS = [
  "study-light",
  "study-dark",
  "paper",
  "midnight",
  "forest",
  "ocean",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMode = "light" | "dark";

export interface ThemeSpec {
  id: ThemeId;
  label: string;
  description: string;
  mode: ThemeMode;
  /**
   * Three CSS colours for the preview swatch: background, surface, accent.
   * Literal values on purpose — a preview of a theme you have not applied
   * cannot read that theme's own variables.
   */
  swatch: [string, string, string];
}

export const THEMES: Record<ThemeId, ThemeSpec> = {
  "study-light": {
    id: "study-light",
    label: "Study Light",
    description: "The default desk. Cool paper-white, indigo accent.",
    mode: "light",
    swatch: ["hsl(220 23% 97%)", "hsl(0 0% 100%)", "hsl(243 90% 66%)"],
  },
  "study-dark": {
    id: "study-dark",
    label: "Study Night",
    description: "Near-black slate for late sessions. Easy on tired eyes.",
    mode: "dark",
    swatch: ["hsl(225 11% 7%)", "hsl(223 13% 10%)", "hsl(243 100% 76%)"],
  },
  paper: {
    id: "paper",
    label: "Paper",
    description: "Warm off-white, like a good notebook. Sienna accent.",
    mode: "light",
    swatch: ["hsl(40 32% 95%)", "hsl(42 45% 99%)", "hsl(20 62% 42%)"],
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    description: "Deep navy with a clear blue accent. Calm and low-glare.",
    mode: "dark",
    swatch: ["hsl(224 42% 6%)", "hsl(223 34% 11%)", "hsl(213 92% 70%)"],
  },
  forest: {
    id: "forest",
    label: "Forest",
    description: "Soft sage paper with a deep evergreen accent.",
    mode: "light",
    swatch: ["hsl(140 20% 96%)", "hsl(150 30% 99%)", "hsl(160 52% 30%)"],
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    description: "Deep teal slate with a bright cyan accent.",
    mode: "dark",
    swatch: ["hsl(202 38% 8%)", "hsl(201 30% 12%)", "hsl(187 78% 56%)"],
  },
};

export const ALL_THEMES: ThemeSpec[] = THEME_IDS.map((id) => THEMES[id]);

export const LIGHT_THEMES: ThemeSpec[] = ALL_THEMES.filter((t) => t.mode === "light");
export const DARK_THEMES: ThemeSpec[] = ALL_THEMES.filter((t) => t.mode === "dark");

export const DEFAULT_LIGHT_THEME: ThemeId = "study-light";
export const DEFAULT_DARK_THEME: ThemeId = "study-dark";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
