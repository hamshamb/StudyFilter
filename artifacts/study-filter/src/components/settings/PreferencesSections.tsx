import React from "react";
import { Accessibility, Check, Palette, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/primitives";
import { useTheme } from "@/hooks/use-theme";
import { ALL_THEMES, type ThemeId } from "@/lib/themes";
import {
  ANSWER_MODES,
  DENSITIES,
  DIAGRAM_MODES,
  EXAMPLE_LEVELS,
  EXPLANATION_STYLES,
  EXPLANATION_TIMING,
  QUIZ_DIFFICULTIES,
  usePreferences,
  type Preferences,
} from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";

/**
 * The settings that change how StudyFilter behaves, as opposed to the ones
 * that change what it remembers.
 *
 * Every control here names its effect in the hint underneath, because a
 * preference whose consequence isn't stated is a preference nobody will touch.
 * Nothing in this file writes a value that isn't read somewhere — see
 * hooks/use-preferences.ts, where each field records its consumer.
 */

function Section({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function Choice<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Chip key={option} active={value === option} onClick={() => onChange(option)}>
            {format ? format(option) : option[0]!.toUpperCase() + option.slice(1)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ── Appearance ───────────────────────────────────────────────────────────────

export function AppearanceSection() {
  const { themeId, setThemeId, theme, setTheme } = useTheme();
  const { prefs, set } = usePreferences();
  const [preview, setPreview] = React.useState<ThemeId | null>(null);

  return (
    <Section
      title="Appearance"
      icon={Palette}
      description="Six themes, each designed as a pair of surfaces and an accent that stays readable on them."
    >
      <div>
        <Label className="text-xs">Theme</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ALL_THEMES.map((spec) => {
            const active = themeId === spec.id;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => setThemeId(spec.id)}
                onMouseEnter={() => setPreview(spec.id)}
                onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(spec.id)}
                onBlur={() => setPreview(null)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/8" : "border-border hover:bg-muted/50",
                )}
                data-testid={`button-theme-${spec.id}`}
              >
                {/*
                  Literal colours, not tokens: a swatch for a theme you have
                  not applied cannot read that theme's own variables.
                */}
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
                  style={{ background: spec.swatch[0] }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded"
                    style={{ background: spec.swatch[1] }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: spec.swatch[2] }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {spec.label}
                    {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {spec.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {preview
            ? `${ALL_THEMES.find((t) => t.id === preview)?.label} — ${ALL_THEMES.find((t) => t.id === preview)?.mode} surface`
            : "Your choice is remembered for light and for dark separately, so the day/night toggle keeps both."}
        </p>
      </div>

      <Toggle
        label="Follow my device"
        hint="Switch between your light and dark themes when the phone or laptop does."
        checked={theme === "system"}
        onChange={(on) => setTheme(on ? "system" : themeId.includes("dark") || themeId === "midnight" || themeId === "ocean" ? "dark" : "light")}
      />

      <Choice
        label="Density"
        hint="Compact tightens page and card padding. Nothing moves except the spacing."
        options={DENSITIES}
        value={prefs.density}
        onChange={(v) => set("density", v)}
      />
    </Section>
  );
}

// ── Learning ─────────────────────────────────────────────────────────────────

export function LearningSection() {
  const { prefs, set, reset } = usePreferences();

  return (
    <Section
      title="Learning preferences"
      icon={Sparkles}
      description="These change what StudyFilter produces, not just how it looks."
    >
      <Choice
        label="Default explanation depth"
        hint="Where the Explain page starts. You can still change it per explanation."
        options={EXPLANATION_STYLES}
        value={prefs.explanationStyle}
        onChange={(v) => set("explanationStyle", v)}
      />

      <Choice
        label="Answer style"
        hint="Learn the concept, write it for marks, or just get the answer."
        options={ANSWER_MODES}
        value={prefs.answerMode}
        onChange={(v) => set("answerMode", v)}
        format={(v) => ({ learn: "Learn the concept", exam: "Exam answer", quick: "Quick answer" })[v]}
      />

      <Choice
        label="Default quiz difficulty"
        hint="Adaptive reads how you have actually been doing in that chapter and picks the level up from it."
        options={QUIZ_DIFFICULTIES}
        value={prefs.quizDifficulty}
        onChange={(v) => set("quizDifficulty", v)}
      />

      <Choice
        label="Quiz explanations"
        hint="Straight after each question, or all together at the end."
        options={EXPLANATION_TIMING}
        value={prefs.quizExplanations}
        onChange={(v) => set("quizExplanations", v)}
        format={(v) => (v === "immediate" ? "As I answer" : "At the end")}
      />

      <Choice
        label="Default number of questions"
        hint="Pre-selected on the quiz builder."
        options={["5", "10", "15", "20"] as const}
        value={String(prefs.quizCount) as "5" | "10" | "15" | "20"}
        onChange={(v) => set("quizCount", Number(v) as Preferences["quizCount"])}
      />

      <Toggle
        label="Timer on by default"
        hint="One minute per question, unless you turn it off when building the quiz."
        checked={prefs.quizTimer}
        onChange={(v) => set("quizTimer", v)}
      />

      <Choice
        label="Worked examples"
        hint="How many examples explanations should include."
        options={EXAMPLE_LEVELS}
        value={prefs.examples}
        onChange={(v) => set("examples", v)}
      />

      <Choice
        label="Diagrams"
        hint="StudyFilter only draws a diagram when it can compute it correctly from real values."
        options={DIAGRAM_MODES}
        value={prefs.diagrams}
        onChange={(v) => set("diagrams", v)}
        format={(v) => ({ auto: "Show when useful", ask: "Ask first", minimal: "Keep them rare" })[v]}
      />

      <Toggle
        label="Revision reminders"
        hint="Show the “due for revision” card on your home screen when something has gone stale."
        checked={prefs.revisionReminders}
        onChange={(v) => set("revisionReminders", v)}
      />

      <button
        type="button"
        onClick={reset}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Reset learning preferences to their defaults
      </button>
    </Section>
  );
}

// ── Accessibility ────────────────────────────────────────────────────────────

export function AccessibilitySection() {
  const { prefs, set } = usePreferences();

  return (
    <Section
      title="Accessibility"
      icon={Accessibility}
      description="These apply across the whole app, including the reader, the quiz and the maps."
    >
      <Toggle
        label="Reduce motion"
        hint="Stops transitions and animations. Already on automatically if your device asks for it — this only ever adds restraint."
        checked={prefs.reduceMotion}
        onChange={(v) => set("reduceMotion", v)}
      />
      <Toggle
        label="Stronger borders"
        hint="Raises contrast on outlines and the keyboard focus ring, without repainting the theme you chose."
        checked={prefs.highContrast}
        onChange={(v) => set("highContrast", v)}
      />
      <Toggle
        label="Hide XP and streaks"
        hint="Removes the score counters from the sidebar and the home screen."
        checked={prefs.hideStats}
        onChange={(v) => set("hideStats", v)}
      />
    </Section>
  );
}
