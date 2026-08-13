import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SUBJECTS } from "@workspace/cbse-content";
import {
  useCreateStudyPlan,
  type StudyPlanInput,
  type StudyPlanSubject,
  type StudyPlanChapter,
  type DayAvailability,
  type StudyPlanPreferences,
} from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Target,
  BookOpen,
  ListChecks,
  CalendarClock,
  SlidersHorizontal,
  Repeat,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Spinner } from "@/components/ui/primitives";

const GOAL_TYPES = [
  { id: "board_exam", label: "Final board exam" },
  { id: "pre_board", label: "Pre-board exam" },
  { id: "school_test", label: "School test" },
  { id: "chapter_completion", label: "Chapter completion" },
  { id: "revision_sprint", label: "Revision sprint" },
  { id: "custom", label: "Custom goal" },
];

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABEL: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const REVISION_PRESETS = [
  { id: "balanced", label: "Balanced", pattern: [1, 3, 7, 14, 30], hint: "Day 1 · 3 · 7 · 14 · 30" },
  { id: "intensive", label: "Intensive", pattern: [0, 2, 5, 10, 20], hint: "Same day · 2 · 5 · 10 · 20" },
  { id: "light", label: "Light", pattern: [2, 7, 21], hint: "Day 2 · 7 · 21" },
];

const STEPS = [
  { title: "Goal", icon: Target },
  { title: "Subjects", icon: BookOpen },
  { title: "Chapters", icon: ListChecks },
  { title: "Availability", icon: CalendarClock },
  { title: "Preferences", icon: SlidersHorizontal },
  { title: "Revision", icon: Repeat },
  { title: "Review", icon: ClipboardCheck },
];

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function defaultAvailability(): Record<string, DayAvailability> {
  const out: Record<string, DayAvailability> = {};
  for (const day of DAYS) {
    const weekend = day === "saturday" || day === "sunday";
    out[day] = {
      available: true,
      windows: weekend
        ? [
            { start: "09:00", end: "11:00" },
            { start: "16:00", end: "18:00" },
          ]
        : [
            { start: "17:00", end: "19:00" },
            { start: "20:00", end: "21:00" },
          ],
    };
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function PlanWizard({ open, onOpenChange, onCreated }: Props) {
  const sessionId = useSession();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState("board_exam");
  const [goalDescription, setGoalDescription] = useState("");
  const [startDate, setStartDate] = useState(isoToday());
  const [targetDate, setTargetDate] = useState(isoToday(45));

  const [subjects, setSubjects] = useState<StudyPlanSubject[]>([]);
  const [chapters, setChapters] = useState<StudyPlanChapter[]>([]);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    defaultAvailability,
  );
  const [prefs, setPrefs] = useState<StudyPlanPreferences>({
    preferredTaskMinutes: 40,
    maxTaskMinutes: 60,
    breakMinutes: 10,
    maxDailyMinutes: 180,
    subjectsPerDay: 2,
    energyPeriod: "evening",
    mockExamFrequencyDays: 14,
    restDays: [],
    bufferDays: 2,
    pomodoroMinutes: 25,
  });
  const [revisionPreset, setRevisionPreset] = useState("balanced");
  const [customPattern, setCustomPattern] = useState("1, 3, 7, 14, 30");

  const createPlan = useCreateStudyPlan({
    mutation: {
      onSuccess: () => {
        toast({ title: "Plan created", description: "Your study schedule is ready." });
        onCreated();
        onOpenChange(false);
        resetWizard();
      },
      onError: () =>
        toast({
          title: "Could not create plan",
          description: "Please check the details and try again.",
          variant: "destructive",
        }),
    },
  });

  function resetWizard() {
    setStep(0);
    setTitle("");
    setGoalDescription("");
    setSubjects([]);
    setChapters([]);
    setAvailability(defaultAvailability());
  }

  const revisionPattern = useMemo(() => {
    if (revisionPreset === "custom") {
      return customPattern
        .split(/[,\s]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .slice(0, 8);
    }
    return REVISION_PRESETS.find((p) => p.id === revisionPreset)?.pattern ?? [1, 3, 7];
  }, [revisionPreset, customPattern]);

  const totalDays = useMemo(() => {
    const ms = new Date(targetDate).getTime() - new Date(startDate).getTime();
    return Math.max(0, Math.round(ms / 86400000)) + 1;
  }, [startDate, targetDate]);

  const weeklyMinutes = useMemo(() => {
    let total = 0;
    for (const day of DAYS) {
      const d = availability[day];
      if (!d?.available) continue;
      for (const w of d.windows) {
        const [sh, sm] = w.start.split(":").map(Number);
        const [eh, em] = w.end.split(":").map(Number);
        total += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
    }
    return total;
  }, [availability]);

  const estimatedHours = Math.round(((weeklyMinutes / 7) * totalDays) / 60);
  const workloadHours = Math.round((chapters.length * 3 * (1 + revisionPattern.length * 0.35)));
  const unrealistic = chapters.length > 0 && workloadHours > estimatedHours && estimatedHours > 0;

  const canNext = (() => {
    switch (step) {
      case 0:
        return title.trim().length > 0 && startDate < targetDate;
      case 1:
        return subjects.length > 0;
      case 2:
        return chapters.length > 0;
      case 3:
        return DAYS.some((d) => availability[d]?.available && availability[d].windows.length > 0);
      case 5:
        return revisionPattern.length > 0;
      default:
        return true;
    }
  })();

  function toggleSubject(name: string) {
    setSubjects((prev) =>
      prev.some((s) => s.name === name)
        ? prev.filter((s) => s.name !== name)
        : [...prev, { name, priority: "medium", strength: "average" }],
    );
    setChapters((prev) => prev.filter((c) => c.subject !== name || subjects.every((s) => s.name !== name)));
  }

  function setSubjectField(name: string, field: "priority" | "strength", value: string) {
    setSubjects((prev) =>
      prev.map((s) => (s.name === name ? { ...s, [field]: value as never } : s)),
    );
  }

  function toggleChapter(subject: string, chapter: string) {
    setChapters((prev) =>
      prev.some((c) => c.subject === subject && c.chapter === chapter)
        ? prev.filter((c) => !(c.subject === subject && c.chapter === chapter))
        : [...prev, { subject, chapter, confidence: 3, difficulty: 3 }],
    );
  }

  function selectAllChapters(subjectName: string) {
    const sub = SUBJECTS.find((s) => s.name === subjectName);
    if (!sub) return;
    const already = chapters.filter((c) => c.subject === subjectName).length;
    if (already === sub.chapters.length) {
      setChapters((prev) => prev.filter((c) => c.subject !== subjectName));
    } else {
      setChapters((prev) => [
        ...prev.filter((c) => c.subject !== subjectName),
        ...sub.chapters.map((ch) => ({
          subject: subjectName,
          chapter: ch.title,
          confidence: 3,
          difficulty: 3,
        })),
      ]);
    }
  }

  function updateWindow(day: string, idx: number, field: "start" | "end", value: string) {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        windows: prev[day].windows.map((w, i) => (i === idx ? { ...w, [field]: value } : w)),
      },
    }));
  }

  function submit() {
    const input: StudyPlanInput = {
      sessionId,
      title: title.trim(),
      goalType,
      goalDescription: goalDescription.trim() || null,
      startDate,
      targetDate,
      subjects,
      chapters,
      availability,
      preferences: prefs,
      revisionPattern,
    };
    createPlan.mutate({ data: input });
  }

  const StepIcon = STEPS[step].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <StepIcon className="h-4 w-4" />
            Step {step + 1} of {STEPS.length} — {STEPS[step].title}
          </div>
          <DialogTitle className="text-2xl">Create a study plan</DialogTitle>
          <DialogDescription>
            A calm, realistic schedule built around your days.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5 mb-2">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GOAL_TYPES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoalType(g.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
                    goalType === g.id
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-title">Plan title</Label>
              <Input
                id="plan-title"
                placeholder="e.g. Board Exam Sprint"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-start">Start date</Label>
                <Input
                  id="plan-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-target">Target date</Label>
                <Input
                  id="plan-target"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-desc">Goal description (optional)</Label>
              <Textarea
                id="plan-desc"
                rows={2}
                placeholder="What do you want to achieve?"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {SUBJECTS.map((sub) => {
              const selected = subjects.find((s) => s.name === sub.name);
              return (
                <div
                  key={sub.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    selected ? "border-primary/50 bg-primary/5" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium"
                      onClick={() => toggleSubject(sub.name)}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center text-[10px]",
                          selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      {sub.name}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {sub.chapters.length} chapters
                    </span>
                  </div>
                  {selected && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Priority</Label>
                        <div className="flex gap-1">
                          {(["low", "medium", "high"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSubjectField(sub.name, "priority", p)}
                              className={cn(
                                "rounded-md px-2 py-1 text-xs capitalize border",
                                selected.priority === p
                                  ? "border-primary bg-primary/10 font-medium"
                                  : "border-border text-muted-foreground",
                              )}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">How confident?</Label>
                        <div className="flex gap-1">
                          {(["weak", "average", "strong"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSubjectField(sub.name, "strength", p)}
                              className={cn(
                                "rounded-md px-2 py-1 text-xs capitalize border",
                                selected.strength === p
                                  ? "border-primary bg-primary/10 font-medium"
                                  : "border-border text-muted-foreground",
                              )}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {subjects.map((s) => {
              const sub = SUBJECTS.find((x) => x.name === s.name);
              if (!sub) return null;
              const count = chapters.filter((c) => c.subject === s.name).length;
              return (
                <div key={s.name} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {count}/{sub.chapters.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => selectAllChapters(s.name)}
                      >
                        {count === sub.chapters.length ? "Clear all" : "Select all"}
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {sub.chapters.map((ch) => {
                      const on = chapters.some(
                        (c) => c.subject === s.name && c.chapter === ch.title,
                      );
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggleChapter(s.name, ch.title)}
                          className={cn(
                            "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            on
                              ? "bg-primary/10 text-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted/50",
                          )}
                        >
                          {ch.number}. {ch.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Mark when you can study each day. Two windows per day keeps things realistic.
            </p>
            {DAYS.map((day) => {
              const d = availability[day];
              return (
                <div key={day} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2 w-20">
                    <Switch
                      aria-label={`${DAY_LABEL[day]} available`}
                      checked={d.available}
                      onCheckedChange={(v) =>
                        setAvailability((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], available: v },
                        }))
                      }
                    />
                    <span className="text-sm font-medium">{DAY_LABEL[day]}</span>
                  </div>
                  {d.available ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {d.windows.map((w, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <Input
                            aria-label={`${DAY_LABEL[day]} window ${i + 1} start time`}
                            type="time"
                            className="h-8 w-[104px] text-xs"
                            value={w.start}
                            onChange={(e) => updateWindow(day, i, "start", e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            aria-label={`${DAY_LABEL[day]} window ${i + 1} end time`}
                            type="time"
                            className="h-8 w-[104px] text-xs"
                            value={w.end}
                            onChange={(e) => updateWindow(day, i, "end", e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Rest day</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Preferred task length (min)"
              value={prefs.preferredTaskMinutes ?? 40}
              onChange={(v) => setPrefs((p) => ({ ...p, preferredTaskMinutes: v }))}
            />
            <NumberField
              label="Max task length (min)"
              value={prefs.maxTaskMinutes ?? 60}
              onChange={(v) => setPrefs((p) => ({ ...p, maxTaskMinutes: v }))}
            />
            <NumberField
              label="Max study per day (min)"
              value={prefs.maxDailyMinutes ?? 180}
              onChange={(v) => setPrefs((p) => ({ ...p, maxDailyMinutes: v }))}
            />
            <NumberField
              label="Subjects per day"
              value={prefs.subjectsPerDay ?? 2}
              onChange={(v) => setPrefs((p) => ({ ...p, subjectsPerDay: v }))}
            />
            <NumberField
              label="Mock exam every (days)"
              value={prefs.mockExamFrequencyDays ?? 14}
              onChange={(v) => setPrefs((p) => ({ ...p, mockExamFrequencyDays: v }))}
            />
            <NumberField
              label="Buffer days before exam"
              value={prefs.bufferDays ?? 2}
              onChange={(v) => setPrefs((p) => ({ ...p, bufferDays: v }))}
            />
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Best study time</Label>
              <div className="flex gap-2">
                {(["morning", "afternoon", "evening"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, energyPeriod: e }))}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm capitalize",
                      prefs.energyPeriod === e
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              After you learn a chapter, revision tasks are spaced on these days.
            </p>
            {REVISION_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRevisionPreset(p.id)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left",
                  revisionPreset === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.hint}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRevisionPreset("custom")}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-left",
                revisionPreset === "custom"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <div className="text-sm font-medium">Custom pattern</div>
              {revisionPreset === "custom" && (
                <Input
                  className="mt-2"
                  value={customPattern}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setCustomPattern(e.target.value)}
                  placeholder="e.g. 1, 4, 10, 21"
                />
              )}
            </button>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ReviewStat label="Days" value={String(totalDays)} />
              <ReviewStat label="Available study time" value={`~${estimatedHours}h`} />
              <ReviewStat label="Subjects" value={String(subjects.length)} />
              <ReviewStat label="Chapters" value={String(chapters.length)} />
              <ReviewStat label="Revision cycles" value={String(revisionPattern.length)} />
              <ReviewStat label="Buffer days" value={String(prefs.bufferDays ?? 0)} />
            </div>
            {unrealistic && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                <p className="font-medium">This plan looks tight.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Estimated workload (~{workloadHours}h) may exceed your available time
                  (~{estimatedHours}h). Consider fewer chapters, a later target date, or
                  more daily time — or continue anyway.
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Your schedule is generated instantly with spaced revision, mock exams and
              buffer days before the target date.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || createPlan.isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={createPlan.isPending}>
              {createPlan.isPending && <Spinner className="mr-2" />}
              Create plan
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
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
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
