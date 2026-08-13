/**
 * Profile avatars, generated in-app.
 *
 * Deliberately not DiceBear, Gravatar or any other avatar service. Those are
 * third-party requests carrying a user identifier, fired from every page that
 * shows an avatar — for a product whose entire audience is ~15-year-olds,
 * that is student data leaving the site for no reason. Everything here is
 * drawn locally from a symbol set authored for this app.
 *
 * A student who has never opened Settings still gets a stable, distinct
 * avatar: `defaultAvatarFor` hashes their session id into the same symbol and
 * colour every time. Choosing one explicitly just overrides that.
 */

export const AVATAR_SYMBOLS = [
  "spark",
  "atom",
  "leaf",
  "gem",
  "wave",
  "hex",
  "bloom",
  "arc",
  "grid",
  "bolt",
  "moon",
  "book",
] as const;

export type AvatarSymbol = (typeof AVATAR_SYMBOLS)[number];

export interface AvatarPalette {
  id: string;
  label: string;
  /** Background fill. */
  bg: string;
  /** Symbol stroke/fill — white on every palette, all of which are mid-tone. */
  fg: string;
}

/**
 * Mid-tone, saturated backgrounds with white symbols.
 *
 * Fixed hsl() rather than theme tokens on purpose: an avatar has to stay
 * recognisably *the same avatar* in light mode, dark mode and reading mode.
 * A student who picks the teal one should not find it has become a different
 * colour because the page around it changed.
 */
export const AVATAR_PALETTES: readonly AvatarPalette[] = [
  { id: "teal", label: "Teal", bg: "hsl(188, 45%, 36%)", fg: "hsl(0, 0%, 100%)" },
  { id: "indigo", label: "Indigo", bg: "hsl(231, 40%, 52%)", fg: "hsl(0, 0%, 100%)" },
  { id: "plum", label: "Plum", bg: "hsl(283, 30%, 48%)", fg: "hsl(0, 0%, 100%)" },
  { id: "rose", label: "Rose", bg: "hsl(345, 46%, 52%)", fg: "hsl(0, 0%, 100%)" },
  { id: "amber", label: "Amber", bg: "hsl(30, 60%, 45%)", fg: "hsl(0, 0%, 100%)" },
  { id: "moss", label: "Moss", bg: "hsl(142, 28%, 36%)", fg: "hsl(0, 0%, 100%)" },
  { id: "slate", label: "Slate", bg: "hsl(211, 20%, 42%)", fg: "hsl(0, 0%, 100%)" },
  { id: "clay", label: "Clay", bg: "hsl(14, 44%, 48%)", fg: "hsl(0, 0%, 100%)" },
] as const;

export type AvatarColor = string;

export interface AvatarChoice {
  symbol: AvatarSymbol;
  color: AvatarColor;
}

/**
 * FNV-1a. Chosen over anything cryptographic because this only needs to be
 * stable and well-spread across a dozen buckets — and because it has to give
 * the identical answer on the server and in the browser.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A public, one-way seed derived from an owner key.
 *
 * The leaderboard must never ship raw owner keys to the browser — for a
 * signed-in student that is their Clerk user id, which identifies them
 * across the whole product. But an unpicked avatar still has to look the
 * same on the leaderboard as it does in their own sidebar, which means both
 * sides must seed from the same value.
 *
 * So the server sends this derived seed instead, computed with an identical
 * FNV-1a in routes/leaderboard.ts. Change one and you must change the other,
 * or students' avatars will differ between the two screens.
 */
export function avatarSeedFor(ownerKey: string): string {
  return hashString(ownerKey).toString(36);
}

/** The avatar a student gets before they ever choose one. */
export function defaultAvatarFor(seed: string): AvatarChoice {
  const hash = hashString(seed || "studyfilter");
  return {
    symbol: AVATAR_SYMBOLS[hash % AVATAR_SYMBOLS.length]!,
    // Shifted by a different factor so symbol and colour don't move together
    // — otherwise two seeds one apart give visibly related avatars.
    color: AVATAR_PALETTES[(hash >>> 8) % AVATAR_PALETTES.length]!.id,
  };
}

export function isAvatarSymbol(value: unknown): value is AvatarSymbol {
  return typeof value === "string" && (AVATAR_SYMBOLS as readonly string[]).includes(value);
}

export function isAvatarColor(value: unknown): boolean {
  return typeof value === "string" && AVATAR_PALETTES.some((p) => p.id === value);
}

export function paletteFor(colorId: string | null | undefined): AvatarPalette {
  return AVATAR_PALETTES.find((p) => p.id === colorId) ?? AVATAR_PALETTES[0]!;
}

/**
 * Resolves what to actually draw: an explicit choice where one exists,
 * otherwise the seeded default. Each field falls back independently, so
 * picking only a colour keeps the seeded symbol rather than resetting it.
 */
export function resolveAvatar(
  stored: { avatarSymbol?: string | null; avatarColor?: string | null } | null | undefined,
  seed: string,
): AvatarChoice {
  const fallback = defaultAvatarFor(seed);
  return {
    symbol: isAvatarSymbol(stored?.avatarSymbol) ? stored.avatarSymbol : fallback.symbol,
    color: isAvatarColor(stored?.avatarColor) ? stored!.avatarColor! : fallback.color,
  };
}

// ── Usernames ───────────────────────────────────────────────────────────────

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/**
 * Letters, digits, underscore. No leading/trailing underscore, no runs.
 *
 * Deliberately narrow: this string is shown to other students on the
 * leaderboard, so it should not be able to carry whitespace tricks,
 * right-to-left overrides or lookalike padding used to impersonate someone
 * else's name.
 */
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|_(?!_)){1,18}[a-z0-9]$/;

export interface UsernameCheck {
  ok: boolean;
  /** Present when ok is false — safe to show directly to the student. */
  error?: string;
}

export function checkUsername(raw: string): UsernameCheck {
  const value = raw.trim().toLowerCase();
  if (value.length < USERNAME_MIN) {
    return { ok: false, error: `At least ${USERNAME_MIN} characters.` };
  }
  if (value.length > USERNAME_MAX) {
    return { ok: false, error: `At most ${USERNAME_MAX} characters.` };
  }
  if (!USERNAME_RE.test(value)) {
    return {
      ok: false,
      error: "Letters, numbers and single underscores only — and it can't start or end with one.",
    };
  }
  return { ok: true };
}

/** Lowercases and strips anything the pattern would reject, for live input. */
export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, USERNAME_MAX);
}
