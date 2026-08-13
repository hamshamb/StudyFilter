import { useEffect, useState } from "react";
import {
  useGetPomodoroSettings,
  useUpdatePomodoroSettings,
  getGetPomodoroSettingsQueryKey,
  type PomodoroSettingsInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useToast } from "@/hooks/use-toast";
import { ALL_GRADES, isGradeAvailable, useGrade } from "@/hooks/use-grade";
import { useStudyLevel } from "@/hooks/use-study-level";
import { STUDY_LEVEL_IDS, STUDY_LEVELS } from "@/lib/study-level";
import { READING_SIZES, READING_SIZE_LABEL, useReadingSize } from "@/hooks/use-reading-size";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { AccountSection } from "@/components/settings/AccountSection";
import {
  AccessibilitySection,
  AppearanceSection,
  LearningSection,
} from "@/components/settings/PreferencesSections";
import {
  Moon,
  Sun,
  Timer,
  Volume2,
  Goal,
  GraduationCap,
  SlidersHorizontal,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { LoadingBlock, Spinner } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";

const PRESETS = [
  { id: "classic", label: "Classic", focus: 25, short: 5, long: 15 },
  { id: "deep", label: "Deep Work", focus: 50, short: 10, long: 20 },
  { id: "sprint", label: "Study Sprint", focus: 15, short: 3, long: 10 },
  { id: "long", label: "Long Focus", focus: 90, short: 20, long: 30 },
];

export default function Settings() {
  const sessionId = useSession();
  const { theme, setTheme } = useTheme();
  const { grade, setGrade } = useGrade();
  const { levelId, setLevel } = useStudyLevel();
  const { size: readingSize, setSize: setReadingSize } = useReadingSize();
  const timer = useFocusTimer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { sessionId };
  const settingsQuery = useGetPomodoroSettings(params, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetPomodoroSettingsQueryKey(params),
    },
  });

  const [form, setForm] = useState<Omit<PomodoroSettingsInput, "sessionId"> | null>(null);

  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data && seededFor !== sessionId) {
      const { sessionId: _sid, ...rest } = settingsQuery.data;
      setForm(rest);
      setSeededFor(sessionId);
    }
  }, [settingsQuery.data, seededFor, sessionId]);

  const save = useUpdatePomodoroSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetPomodoroSettingsQueryKey(params),
        });
        timer.refreshSettings();
        toast({ title: "Settings saved" });
      },
      onError: () => toast({ title: "Could not save settings", variant: "destructive" }),
    },
  });

  function set<K extends keyof Omit<PomodoroSettingsInput, "sessionId">>(
    key: K,
    value: Omit<PomodoroSettingsInput, "sessionId">[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setForm((f) =>
      f
        ? {
            ...f,
            focusMinutes: p.focus,
            shortBreakMinutes: p.short,
            longBreakMinutes: p.long,
          }
        : f,
    );
  }

  if (settingsQuery.isError) {
    return (
      <PageShell width="narrow" className="text-center">
        <h1 className="text-2xl font-semibold">Couldn&apos;t load settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while fetching your settings. Your saved values are safe.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => settingsQuery.refetch()}>
          Try again
        </Button>
      </PageShell>
    );
  }

  if (settingsQuery.isLoading || !form) {
    return (
      <LoadingBlock full label="Loading your settings…" />
    );
  }

  return (
    <>
      <SeoHead
        title="Settings — StudyFilter"
        description="Configure StudyFilter focus goals, appearance, learning preferences and accessibility options."
        canonical="/settings"
      />
      <PageShell width="narrow">
      <PageHeader
        icon={SlidersHorizontal}
        title="Settings"
        description="Tune your timer, goals and appearance."
      />

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Focus timer</h2>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active =
              form.focusMinutes === p.focus && form.shortBreakMinutes === p.short;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                {p.label} · {p.focus}/{p.short}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Num label="Focus (min)" value={form.focusMinutes ?? 25} onChange={(v) => set("focusMinutes", v)} />
          <Num label="Short break (min)" value={form.shortBreakMinutes ?? 5} onChange={(v) => set("shortBreakMinutes", v)} />
          <Num label="Long break (min)" value={form.longBreakMinutes ?? 15} onChange={(v) => set("longBreakMinutes", v)} />
          <Num label="Long break after (sessions)" value={form.sessionsBeforeLongBreak ?? 4} onChange={(v) => set("sessionsBeforeLongBreak", v)} />
        </div>

        <div className="mt-4 space-y-3">
          <ToggleRow
            label="Auto-start breaks"
            hint="Break timer starts when a focus session ends"
            checked={form.autoStartBreaks ?? false}
            onChange={(v) => set("autoStartBreaks", v)}
          />
          <ToggleRow
            label="Auto-start focus"
            hint="Next focus session starts when a break ends"
            checked={form.autoStartFocus ?? false}
            onChange={(v) => set("autoStartFocus", v)}
          />
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Goal className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Goals</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Num label="Daily focus goal (min)" value={form.dailyGoalMinutes ?? 120} onChange={(v) => set("dailyGoalMinutes", v)} />
          <Num label="Weekly focus goal (min)" value={form.weeklyGoalMinutes ?? 600} onChange={(v) => set("weeklyGoalMinutes", v)} />
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Sound</h2>
        </div>
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="End-of-session sound"
            hint="A gentle chime when a session finishes"
            checked={form.soundEnabled ?? true}
            onChange={(v) => set("soundEnabled", v)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Sound volume</Label>
            <Slider
              aria-label="Sound volume"
              value={[Math.round((form.soundVolume ?? 0.7) * 100)]}
              max={100}
              step={5}
              onValueChange={([v]) => set("soundVolume", v / 100)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ambient volume default</Label>
            <Slider
              aria-label="Ambient volume default"
              value={[Math.round((form.musicVolume ?? 0.5) * 100)]}
              max={100}
              step={5}
              onValueChange={([v]) => set("musicVolume", v / 100)}
            />
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Study setup</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Grade, level and text size — everything that shapes how your answers
          are written, in one place.
        </p>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Class</Label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_GRADES.map((g) => {
              const available = isGradeAvailable(g);
              const active = grade === g;
              return (
                <button
                  key={g}
                  type="button"
                  disabled={!available}
                  onClick={() => available && setGrade(g)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    !available && "cursor-not-allowed border-dashed opacity-50",
                    available && active
                      ? "border-primary bg-primary/10 font-medium"
                      : available
                        ? "border-border text-muted-foreground hover:bg-muted/50"
                        : "",
                  )}
                >
                  Class {g}
                  {!available && <span className="ml-1 text-[10px]">Soon</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Study level</Label>
          <p className="text-xs text-muted-foreground">
            Changes how deep and how fast your generated answers are.
          </p>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {STUDY_LEVEL_IDS.map((id) => {
              const lvl = STUDY_LEVELS[id];
              const active = levelId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLevel(id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <p className="text-xs font-semibold">{lvl.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{lvl.short}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Answer text size</Label>
          <div className="flex gap-1.5">
            {READING_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReadingSize(s)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  readingSize === s
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                {READING_SIZE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <AccountSection />

      {/*
        Appearance used to be one dark-mode switch. It is a theme picker now,
        and the learning preferences beside it are the ones that actually
        change what StudyFilter produces — see components/settings/
        PreferencesSections.tsx, where each control names the feature it
        drives.
      */}
      <AppearanceSection />
      <LearningSection />
      <AccessibilitySection />

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          {theme === "dark" ? (
            <Moon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-muted-foreground" />
          )}
          <h2 className="text-sm font-semibold">Quick day / night</h2>
        </div>
        <div className="mt-4">
          <ToggleRow
            label="Dark mode"
            hint="Switches to whichever dark theme you picked above, and back again"
            checked={theme === "dark"}
            onChange={(v) => setTheme(v ? "dark" : "light")}
          />
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => save.mutate({ data: { sessionId, ...form } })}
          disabled={save.isPending}
        >
          {save.isPending && <Spinner className="mr-2" />}
          Save settings
        </Button>
      </div>
      </PageShell>
    </>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        aria-label={label}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
