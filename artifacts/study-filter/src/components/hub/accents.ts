/**
 * Subject identity.
 *
 * Each subject gets one hue so a student can recognise it at a glance in a
 * list, a breadcrumb or a chip. That is the whole job — the hue is never a
 * page theme, never a card fill, and never competes with the brand colour for
 * "this is the button you press".
 *
 * These used to be raw Tailwind palette classes (bg-emerald-500,
 * dark:bg-purple-950/40 …), which meant five subjects pulled in five colour
 * ramps that no token controlled: they didn't shift with the theme, didn't
 * match anything else in the product, and put saturated 500-level fills next
 * to a calm neutral UI. They read from `--subject-*` now, so a subject's
 * colour is one line in index.css and adapts to light and dark on its own.
 */

export interface AccentStyle {
  /** Solid fill for the subject's initials tile. */
  solid: string;
  /** Soft tinted background, for chips and icon tiles. */
  soft: string;
  /** Foreground text colour. */
  text: string;
  /** Border colour. */
  border: string;
  /** A barely-there wash, for the top of a subject header. */
  gradient: string;
  /** Ring colour for focus / selection. */
  ring: string;
  /** The bare CSS colour, for a left rule or an inline style. */
  css: string;
}

function style(token: string): AccentStyle {
  return {
    solid: `bg-${token} text-white`,
    soft: `bg-${token}/10`,
    text: `text-${token}`,
    border: `border-${token}/25`,
    gradient: `from-${token}/8 to-transparent`,
    ring: `ring-${token}/30`,
    css: `hsl(var(--${token}))`,
  };
}

/*
 * Keyed by the accent name carried in the shared content package
 * (@workspace/cbse-content), which is why the keys are colour words rather
 * than subject ids. Mapping them here rather than renaming the content model
 * keeps this a presentation concern.
 */
const ACCENTS: Record<string, AccentStyle> = {
  emerald: style("subject-science"),
  blue: style("subject-math"),
  orange: style("subject-social"),
  purple: style("subject-english"),
  rose: style("subject-hindi"),
};

const DEFAULT_ACCENT: AccentStyle = {
  solid: "bg-primary text-primary-foreground",
  soft: "bg-primary/10",
  text: "text-primary",
  border: "border-primary/25",
  gradient: "from-primary/8 to-transparent",
  ring: "ring-primary/30",
  css: "hsl(var(--primary))",
};

export function getAccent(accent: string | undefined): AccentStyle {
  return (accent && ACCENTS[accent]) || DEFAULT_ACCENT;
}

/**
 * Tailwind only emits the classes it can see as complete strings in the
 * source. `style()` builds its class names by interpolation, so nothing above
 * is scannable — this list is what actually gets compiled. Every class the
 * five subject styles can produce appears here verbatim, once.
 *
 * @internal
 */
export const SUBJECT_CLASS_SAFELIST = [
  "bg-subject-science", "bg-subject-science/10", "text-subject-science",
  "border-subject-science/25", "from-subject-science/8", "ring-subject-science/30",
  "bg-subject-math", "bg-subject-math/10", "text-subject-math",
  "border-subject-math/25", "from-subject-math/8", "ring-subject-math/30",
  "bg-subject-social", "bg-subject-social/10", "text-subject-social",
  "border-subject-social/25", "from-subject-social/8", "ring-subject-social/30",
  "bg-subject-english", "bg-subject-english/10", "text-subject-english",
  "border-subject-english/25", "from-subject-english/8", "ring-subject-english/30",
  "bg-subject-hindi", "bg-subject-hindi/10", "text-subject-hindi",
  "border-subject-hindi/25", "from-subject-hindi/8", "ring-subject-hindi/30",
  "to-transparent", "text-white",
] as const;
