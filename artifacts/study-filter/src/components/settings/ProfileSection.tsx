import React from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProfileAvatar, SYMBOL_ART } from "@/components/ui/profile-avatar";
import {
  AVATAR_PALETTES,
  AVATAR_SYMBOLS,
  avatarSeedFor,
  checkUsername,
  normalizeUsername,
  paletteFor,
  resolveAvatar,
  USERNAME_MAX,
  type AvatarSymbol,
} from "@/lib/avatar";

export interface ProfileValues {
  username: string | null;
  avatarSymbol: string | null;
  avatarColor: string | null;
}

export interface ProfileSectionProps {
  sessionId: string;
  values: ProfileValues;
  onChange: (next: Partial<ProfileValues>) => void;
  /** Called when a value should be persisted — on blur for text, on click for the pickers. */
  onCommit: (next: Partial<ProfileValues>) => void;
}

/**
 * Avatar and handle.
 *
 * The avatar picker shows the student's actual avatar updating live rather
 * than a swatch grid alone — the thing being chosen is the combination of
 * symbol and colour, and picking them blind against two separate lists means
 * discovering the result only after saving.
 */
export function ProfileSection({ sessionId, values, onChange, onCommit }: ProfileSectionProps) {
  const seed = avatarSeedFor(sessionId);
  const current = resolveAvatar(
    { avatarSymbol: values.avatarSymbol, avatarColor: values.avatarColor },
    seed,
  );

  const [touched, setTouched] = React.useState(false);
  const username = values.username ?? "";
  const check = username ? checkUsername(username) : { ok: true as const };
  const showError = touched && username.length > 0 && !check.ok;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ProfileAvatar
          seed={seed}
          symbol={current.symbol}
          color={current.color}
          size="xl"
          label="Your avatar"
        />
        <div className="min-w-0">
          <p className="text-lg font-semibold">
            {username ? `@${username}` : "Your profile"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            This is what other students see on the leaderboard.
          </p>
        </div>
      </div>

      {/* ── Symbol ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs">Symbol</Label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_SYMBOLS.map((symbol) => {
            const active = current.symbol === symbol;
            return (
              <button
                key={symbol}
                type="button"
                aria-label={symbol}
                aria-pressed={active}
                onClick={() => {
                  onChange({ avatarSymbol: symbol });
                  onCommit({ avatarSymbol: symbol });
                }}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {SYMBOL_ART[symbol as AvatarSymbol]}
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Colour ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs">Colour</Label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_PALETTES.map((palette) => {
            const active = current.color === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                aria-label={palette.label}
                aria-pressed={active}
                onClick={() => {
                  onChange({ avatarColor: palette.id });
                  onCommit({ avatarColor: palette.id });
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-transform",
                  // A ring offset from the swatch, so the indicator reads on
                  // both the light and dark page background.
                  active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                )}
                style={{ backgroundColor: paletteFor(palette.id).bg }}
              >
                {active && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Username ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-username" className="text-xs">
          Username
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            @
          </span>
          <Input
            id="profile-username"
            value={username}
            // Normalising as they type means the field can never hold
            // something the server would reject — no submit-then-fail.
            onChange={(e) => onChange({ username: normalizeUsername(e.target.value) || null })}
            onBlur={() => {
              setTouched(true);
              if (!username || checkUsername(username).ok) {
                onCommit({ username: username || null });
              }
            }}
            placeholder="studyquest"
            maxLength={USERNAME_MAX}
            className="pl-7"
            aria-invalid={showError || undefined}
            aria-describedby="profile-username-help"
          />
        </div>
        <p
          id="profile-username-help"
          className={cn("text-xs", showError ? "text-destructive" : "text-muted-foreground")}
        >
          {showError
            ? check.error
            : "Optional. Lowercase letters, numbers and underscores — pick something that isn't your real name."}
        </p>
      </div>
    </div>
  );
}
