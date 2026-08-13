export interface PlanSubject {
  name: string;
  priority?: "low" | "medium" | "high";
  strength?: "weak" | "average" | "strong";
  examDate?: string | null;
}

export interface PlanChapter {
  subject: string;
  chapter: string;
  topics?: string[];
  confidence?: number;
  difficulty?: number;
  priority?: boolean;
  completed?: boolean;
}

export interface AvailabilityWindow {
  start: string;
  end: string;
}

export interface DayAvailability {
  available: boolean;
  windows: AvailabilityWindow[];
}

export interface PlanPreferences {
  preferredTaskMinutes?: number;
  maxTaskMinutes?: number;
  breakMinutes?: number;
  maxDailyMinutes?: number;
  subjectsPerDay?: number;
  energyPeriod?: "morning" | "afternoon" | "evening";
  mockExamFrequencyDays?: number;
  restDays?: string[];
  bufferDays?: number;
  pomodoroMinutes?: number;
}

export interface ScheduleInput {
  startDate: string;
  targetDate: string;
  subjects: PlanSubject[];
  chapters: PlanChapter[];
  availability: Record<string, DayAvailability>;
  preferences: PlanPreferences;
  revisionPattern: number[];
}

export interface GeneratedTask {
  title: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  taskType: string;
  scheduledDate: string;
  startTime: string | null;
  estimatedMinutes: number;
  priority: "low" | "medium" | "high";
  difficulty: number | null;
  revisionCycle: number | null;
}

export interface ScheduleResult {
  tasks: GeneratedTask[];
  warnings: string[];
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function toDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

function windowMinutes(w: AvailabilityWindow): number {
  const [sh = 0, sm = 0] = w.start.split(":").map(Number);
  const [eh = 0, em = 0] = w.end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

interface DaySlot {
  date: string;
  capacity: number;
  used: number;
  windows: AvailabilityWindow[];
  cursor: { windowIndex: number; offset: number };
  subjects: Set<string>;
}

function buildDays(input: ScheduleInput): DaySlot[] {
  const days: DaySlot[] = [];
  const maxDaily = input.preferences.maxDailyMinutes ?? 240;
  const restDays = new Set(
    (input.preferences.restDays ?? []).map((d) => d.toLowerCase()),
  );
  let cur = input.startDate;
  const end = input.targetDate;
  let guard = 0;
  while (cur <= end && guard < 400) {
    guard++;
    const weekday = WEEKDAYS[toDate(cur).getDay()]!;
    const avail = input.availability[weekday];
    if (avail?.available && !restDays.has(weekday)) {
      const total = avail.windows.reduce((s, w) => s + windowMinutes(w), 0);
      const capacity = Math.min(total, maxDaily);
      if (capacity >= 15) {
        days.push({
          date: cur,
          capacity,
          used: 0,
          windows: avail.windows,
          cursor: { windowIndex: 0, offset: 0 },
          subjects: new Set(),
        });
      }
    }
    cur = addDays(cur, 1);
  }
  return days;
}

function nextStartTime(day: DaySlot, minutes: number): string | null {
  while (day.cursor.windowIndex < day.windows.length) {
    const w = day.windows[day.cursor.windowIndex]!;
    const remaining = windowMinutes(w) - day.cursor.offset;
    if (remaining >= Math.min(minutes, 15)) {
      const [sh = 0, sm = 0] = w.start.split(":").map(Number);
      const startMin = sh * 60 + sm + day.cursor.offset;
      day.cursor.offset += minutes;
      const h = Math.floor(startMin / 60) % 24;
      const m = startMin % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    day.cursor.windowIndex++;
    day.cursor.offset = 0;
  }
  return null;
}

function placeTask(
  days: DaySlot[],
  fromIndex: number,
  task: Omit<GeneratedTask, "scheduledDate" | "startTime">,
  maxSubjectsPerDay: number,
  out: GeneratedTask[],
): number {
  for (let i = Math.max(0, fromIndex); i < days.length; i++) {
    const day = days[i]!;
    if (day.used + task.estimatedMinutes > day.capacity) continue;
    if (
      task.subject &&
      !day.subjects.has(task.subject) &&
      day.subjects.size >= maxSubjectsPerDay
    )
      continue;
    const startTime = nextStartTime(day, task.estimatedMinutes);
    day.used += task.estimatedMinutes;
    if (task.subject) day.subjects.add(task.subject);
    out.push({ ...task, scheduledDate: day.date, startTime });
    return i;
  }
  return -1;
}

export function generateSchedule(input: ScheduleInput): ScheduleResult {
  const warnings: string[] = [];
  const prefs = input.preferences;
  const preferred = prefs.preferredTaskMinutes ?? 45;
  const maxTask = prefs.maxTaskMinutes ?? 90;
  const subjectsPerDay = prefs.subjectsPerDay ?? 3;
  const bufferDays = prefs.bufferDays ?? 2;
  const pattern =
    input.revisionPattern.length > 0 ? input.revisionPattern : [1, 3, 7, 14];

  const allDays = buildDays(input);
  if (allDays.length === 0) {
    return {
      tasks: [],
      warnings: ["No available study days between start and target date."],
    };
  }

  const bufferStartIndex = Math.max(1, allDays.length - bufferDays);
  const days = allDays.slice(0, bufferStartIndex);
  const buffer = allDays.slice(bufferStartIndex);

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const subjectRank = new Map<string, number>();
  input.subjects.forEach((s) => {
    subjectRank.set(s.name, priorityRank[s.priority ?? "medium"]);
  });

  // Build per-subject learning queues
  const queues = new Map<
    string,
    { chapter: PlanChapter; minutes: number; difficulty: number }[]
  >();
  for (const ch of input.chapters) {
    if (ch.completed) continue;
    const difficulty = ch.difficulty ?? 3;
    const confidence = ch.confidence ?? 3;
    const minutes = 60 + difficulty * 15 + (5 - confidence) * 10;
    if (!queues.has(ch.subject)) queues.set(ch.subject, []);
    queues.get(ch.subject)!.push({ chapter: ch, minutes, difficulty });
  }
  // Priority chapters first within each subject
  for (const q of queues.values()) {
    q.sort((a, b) => Number(b.chapter.priority) - Number(a.chapter.priority));
  }

  const subjectOrder = [...queues.keys()].sort(
    (a, b) => (subjectRank.get(a) ?? 1) - (subjectRank.get(b) ?? 1),
  );

  const totalLearnMinutes = [...queues.values()]
    .flat()
    .reduce((s, c) => s + c.minutes, 0);
  const totalCapacity = days.reduce((s, d) => s + d.capacity, 0);
  const revisionEstimate = input.chapters.length * pattern.length * 25;
  if (totalLearnMinutes + revisionEstimate > totalCapacity) {
    warnings.push(
      `Estimated workload (${Math.round((totalLearnMinutes + revisionEstimate) / 60)}h) exceeds available time (${Math.round(totalCapacity / 60)}h). Consider extending the target date, adding daily time, or reducing chapters.`,
    );
  }

  const tasks: GeneratedTask[] = [];
  const revisionQueue: { afterDate: string; task: GeneratedTask }[] = [];

  // Round-robin subjects across days
  let dayIndex = 0;
  let active = subjectOrder.filter((s) => (queues.get(s)?.length ?? 0) > 0);
  while (active.length > 0 && dayIndex < days.length) {
    for (const subject of [...active]) {
      const q = queues.get(subject)!;
      const item = q[0];
      if (!item) {
        active = active.filter((s) => s !== subject);
        continue;
      }
      let chunk = Math.min(
        Math.max(preferred, Math.min(item.minutes, maxTask)),
        item.minutes,
        maxTask,
      );
      // Absorb small remainders so no chapter leaves a <15 min leftover chunk
      if (item.minutes - chunk > 0 && item.minutes - chunk < 15) {
        chunk = Math.min(item.minutes, maxTask);
      }
      const placedAt = placeTask(
        days,
        dayIndex,
        {
          title: `Learn: ${item.chapter.chapter}`,
          subject,
          chapter: item.chapter.chapter,
          topic: null,
          taskType: "learn_topic",
          estimatedMinutes: chunk,
          priority: item.chapter.priority ? "high" : "medium",
          difficulty: item.difficulty,
          revisionCycle: null,
        },
        subjectsPerDay,
        tasks,
      );
      if (placedAt === -1) {
        // Out of room — stop learning placement
        active = [];
        warnings.push(
          "Not every chapter fits before the buffer period; remaining chapters were left unscheduled. Reschedule or extend the plan to include them.",
        );
        break;
      }
      item.minutes -= chunk;
      if (item.minutes <= 0) {
        // Chapter finished learning — queue revisions
        const learnedDate = tasks[tasks.length - 1]!.scheduledDate;
        pattern.forEach((offset, idx) => {
          revisionQueue.push({
            afterDate: addDays(learnedDate, offset),
            task: {
              title: `Revise: ${item.chapter.chapter}`,
              subject,
              chapter: item.chapter.chapter,
              topic: null,
              taskType: "revision",
              scheduledDate: "",
              startTime: null,
              estimatedMinutes: 25,
              priority: "medium",
              difficulty: item.difficulty,
              revisionCycle: idx + 1,
            },
          });
        });
        q.shift();
      }
      // Advance the day pointer softly so work spreads forward
      while (dayIndex < days.length && days[dayIndex]!.used >= days[dayIndex]!.capacity - 10) {
        dayIndex++;
      }
    }
    active = active.filter((s) => (queues.get(s)?.length ?? 0) > 0);
  }

  // Place revisions
  for (const rev of revisionQueue) {
    const idx = days.findIndex((d) => d.date >= rev.afterDate);
    const from = idx === -1 ? days.length - 1 : idx;
    placeTask(
      days,
      from,
      {
        title: rev.task.title,
        subject: rev.task.subject,
        chapter: rev.task.chapter,
        topic: null,
        taskType: rev.task.taskType,
        estimatedMinutes: rev.task.estimatedMinutes,
        priority: rev.task.priority,
        difficulty: rev.task.difficulty,
        revisionCycle: rev.task.revisionCycle,
      },
      99,
      tasks,
    );
  }

  // Mock exams in the second half of the plan
  const mockFreq = prefs.mockExamFrequencyDays ?? 0;
  if (mockFreq > 0 && days.length > 6) {
    const half = Math.floor(days.length / 2);
    for (let i = half; i < days.length; i += mockFreq) {
      const day = days[i]!;
      const minutes = Math.min(120, Math.max(60, day.capacity - day.used));
      if (day.capacity - day.used >= 60) {
        const startTime = nextStartTime(day, minutes);
        day.used += minutes;
        tasks.push({
          title: "Mock exam practice",
          subject: null,
          chapter: null,
          topic: null,
          taskType: "mock_exam",
          scheduledDate: day.date,
          startTime,
          estimatedMinutes: minutes,
          priority: "high",
          difficulty: null,
          revisionCycle: null,
        });
        const next = days[i + 1];
        if (next && next.capacity - next.used >= 30) {
          const st = nextStartTime(next, 30);
          next.used += 30;
          tasks.push({
            title: "Review mock exam mistakes",
            subject: null,
            chapter: null,
            topic: null,
            taskType: "review_mistakes",
            scheduledDate: next.date,
            startTime: st,
            estimatedMinutes: 30,
            priority: "high",
            difficulty: null,
            revisionCycle: null,
          });
        }
      }
    }
  }

  // Buffer days → rapid revision per subject
  for (const day of buffer) {
    let remaining = day.capacity;
    for (const subject of subjectOrder) {
      if (remaining < 30) break;
      const st = nextStartTime(day, 30);
      remaining -= 30;
      day.used += 30;
      tasks.push({
        title: `Rapid revision: ${subject}`,
        subject,
        chapter: null,
        topic: null,
        taskType: "rapid_revision",
        scheduledDate: day.date,
        startTime: st,
        estimatedMinutes: 30,
        priority: "high",
        difficulty: null,
        revisionCycle: null,
      });
    }
  }

  tasks.sort((a, b) =>
    a.scheduledDate === b.scheduledDate
      ? (a.startTime ?? "99").localeCompare(b.startTime ?? "99")
      : a.scheduledDate.localeCompare(b.scheduledDate),
  );

  return { tasks, warnings };
}

/**
 * Redistribute missed + pending tasks from a given date forward,
 * respecting locked tasks and daily capacity.
 */
export function redistributeTasks(
  input: ScheduleInput,
  fromDate: string,
  pending: {
    id: number;
    title: string;
    subject: string | null;
    chapter: string | null;
    taskType: string;
    estimatedMinutes: number;
    priority: string;
    isLocked: boolean;
    scheduledDate: string;
  }[],
): {
  moves: { id: number; scheduledDate: string; startTime: string | null }[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const days = buildDays({ ...input, startDate: fromDate });
  // Account for locked tasks first
  for (const t of pending.filter((t) => t.isLocked)) {
    const day = days.find((d) => d.date === t.scheduledDate);
    if (day) day.used += t.estimatedMinutes;
  }
  const movable = pending
    .filter((t) => !t.isLocked)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const moves: { id: number; scheduledDate: string; startTime: string | null }[] =
    [];
  const overflow: typeof movable = [];
  for (const t of movable) {
    let placed = false;
    for (const day of days) {
      if (day.used + t.estimatedMinutes <= day.capacity) {
        const st = nextStartTime(day, t.estimatedMinutes);
        day.used += t.estimatedMinutes;
        moves.push({ id: t.id, scheduledDate: day.date, startTime: st });
        placed = true;
        break;
      }
    }
    if (!placed) overflow.push(t);
  }
  if (overflow.length > 0) {
    warnings.push(
      `${overflow.length} task(s) could not fit before the target date. They stay on their original dates — consider extending the target date or increasing daily time.`,
    );
  }
  return { moves, warnings };
}
