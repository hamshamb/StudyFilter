import React from "react";
import { cn } from "@/lib/utils";
import {
  paletteFor,
  resolveAvatar,
  type AvatarSymbol,
} from "@/lib/avatar";

/**
 * The symbol set, authored for this app.
 *
 * All twelve are drawn on the same 24×24 grid with a 2px round stroke, so
 * they sit at a consistent visual weight next to each other in the picker —
 * a set where some marks read heavier than others looks like clip-art
 * rather than a designed family. Shapes are kept simple enough to stay
 * legible at 24px, which is the size they render at in the sidebar.
 */
const SYMBOL_ART: Record<AvatarSymbol, React.ReactNode> = {
  spark: <path d="M12 3.5l2.1 6.4 6.4 2.1-6.4 2.1-2.1 6.4-2.1-6.4L3.5 12l6.4-2.1z" />,
  // Two crossing rings, not one ring around a dot: a single ellipse with a
  // filled centre reads unmistakably as an eye at 24px.
  atom: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="3.9" transform="rotate(-30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.9" transform="rotate(30 12 12)" />
      <circle cx="12" cy="12" r="1.7" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4c0 8.5-4.6 13-11 13 0-8.5 4.6-13 11-13z" />
      <path d="M9 15l-3.5 5" />
    </>
  ),
  // A diamond rather than the triangle this used to be — a triangle with a
  // vertical bar through it is the universal hazard-warning sign, which is a
  // strange thing to hand someone as their profile picture.
  gem: (
    <>
      <path d="M12 3.2l8.8 8.8-8.8 8.8L3.2 12z" />
      <path d="M12 8.2l3.8 3.8-3.8 3.8-3.8-3.8z" />
    </>
  ),
  wave: (
    <>
      <path d="M3 9.5c2-3.2 4-3.2 6 0s4 3.2 6 0 4-3.2 6 0" />
      <path d="M3 15.5c2-3.2 4-3.2 6 0s4 3.2 6 0 4-3.2 6 0" />
    </>
  ),
  hex: <path d="M12 3.2l7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6z" />,
  bloom: (
    <>
      <circle cx="12" cy="6.6" r="3.1" />
      <circle cx="12" cy="17.4" r="3.1" />
      <circle cx="6.6" cy="12" r="3.1" />
      <circle cx="17.4" cy="12" r="3.1" />
    </>
  ),
  arc: (
    <>
      <path d="M4 18a8 8 0 0 1 16 0" />
      <path d="M8 18a4 4 0 0 1 8 0" />
      <circle cx="12" cy="18" r="0.8" />
    </>
  ),
  grid: (
    <>
      <circle cx="8.5" cy="8.5" r="2.4" />
      <circle cx="15.5" cy="8.5" r="2.4" />
      <circle cx="8.5" cy="15.5" r="2.4" />
      <circle cx="15.5" cy="15.5" r="2.4" />
    </>
  ),
  bolt: <path d="M13.5 3L6 13.2h5L10.5 21 18 10.8h-5z" />,
  moon: <path d="M19.5 14.5A8.2 8.2 0 0 1 9.5 4.5a8.2 8.2 0 1 0 10 10z" />,
  // An open book seen face-on. The earlier version was a rounded rectangle
  // with a spine line that vanished under the stroke, leaving something that
  // read as a speech bubble.
  book: (
    <>
      <path d="M12 6.6C10.4 5.1 7.8 4.5 3.6 4.8v12.6c4.2-.3 6.8.3 8.4 1.8" />
      <path d="M12 6.6c1.6-1.5 4.2-2.1 8.4-1.8v12.6c-4.2-.3-6.8.3-8.4 1.8" />
      <path d="M12 6.6v12.6" />
    </>
  ),
};

/** Every place an avatar appears, at a size from this scale. */
const SIZES = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 72,
} as const;

export type AvatarSize = keyof typeof SIZES;

export interface ProfileAvatarProps {
  /** Stable identifier — session id or username. Drives the seeded default. */
  seed: string;
  /** Explicit choices, when the student has made them. */
  symbol?: string | null;
  color?: string | null;
  size?: AvatarSize;
  className?: string;
  /**
   * Decorative by default: an avatar next to a name that is already text adds
   * nothing for a screen reader, and reading it out twice is worse than
   * silence. Pass a label only where the avatar stands alone.
   */
  label?: string;
}

export function ProfileAvatar({
  seed,
  symbol,
  color,
  size = "md",
  className,
  label,
}: ProfileAvatarProps) {
  const choice = resolveAvatar({ avatarSymbol: symbol, avatarColor: color }, seed);
  const palette = paletteFor(choice.color);
  const px = SIZES[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        // A hairline inset ring rather than a border: it keeps the avatar the
        // exact size asked for, and stops a dark-background avatar from
        // dissolving into a dark page.
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
        className,
      )}
      style={{ width: px, height: px, backgroundColor: palette.bg }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(px * 0.58)}
        height={Math.round(px * 0.58)}
        fill="none"
        stroke={palette.fg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SYMBOL_ART[choice.symbol]}
      </svg>
    </span>
  );
}

/** Exported for the picker, so it renders the real artwork rather than a copy. */
export { SYMBOL_ART };
