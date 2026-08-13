/**
 * One mastery model for the whole product.
 *
 * Before this, "progress" meant six unrelated counters: XP from the server,
 * a per-chapter count of *tools opened* (not work done), a quiz score that
 * vanished when the component unmounted, a map round that reported XP and kept
 * nothing, and nothing at all for elements or flashcards. Nothing could answer
 * "what am I weak at", so nothing could recommend anything.
 *
 * This is deliberately a small, legible model rather than a claim about
 * learning science. It answers one question — *how confident should we be that
 * this student knows this thing right now* — from three signals we genuinely
 * have:
 *
 *   1. how much they have attempted        (attempts)
 *   2. how well they did, recently-weighted (recent)
 *   3. how long ago that was               (lastSeen)
 *
 * The thresholds below are product judgements, not measurements, and they are
 * written out in full so anyone reading the code can disagree with a specific
 * number instead of with a black box. Nothing here is presented to a student as
 * a percentage of "knowledge"; it drives five plain-English states and the
 * order of the "practise this" lists.
 */

export const MASTERY_STATES = [
  "not-started",
  "learning",
  "practising",
  "strong",
  "needs-revision",
] as const;

export type MasteryState = (typeof MASTERY_STATES)[number];

export interface MasteryStateInfo {
  id: MasteryState;
  label: string;
  /** One line a student can act on. */
  hint: string;
  /** Token-based colour classes. Never colour alone — always paired with text. */
  className: string;
  /** Sort weight for "what should I work on" lists: lower = more urgent. */
  urgency: number;
}

export const MASTERY_INFO: Record<MasteryState, MasteryStateInfo> = {
  "needs-revision": {
    id: "needs-revision",
    label: "Needs revision",
    hint: "You knew this — it has been a while.",
    className: "border-warning/35 bg-warning-soft text-warning",
    urgency: 0,
  },
  learning: {
    id: "learning",
    label: "Learning",
    hint: "Early days. Keep going.",
    className: "border-primary/35 bg-primary/10 text-primary",
    urgency: 1,
  },
  practising: {
    id: "practising",
    label: "Practising",
    hint: "Getting there — a few more sets.",
    className: "border-primary/25 bg-primary/8 text-primary",
    urgency: 2,
  },
  strong: {
    id: "strong",
    label: "Strong",
    hint: "Solid. Revisit before the exam.",
    className: "border-success/35 bg-success-soft text-success",
    urgency: 3,
  },
  "not-started": {
    id: "not-started",
    label: "Not started",
    hint: "Nothing attempted yet.",
    className: "border-border bg-muted text-muted-foreground",
    urgency: 4,
  },
};

/** The kinds of thing mastery can be tracked for. */
export type MasteryDomain = "chapter" | "topic" | "element" | "map";

export interface MasteryRecord {
  /** `${domain}:${id}` — see {@link masteryKey}. */
  key: string;
  domain: MasteryDomain;
  /** Human label, stored so lists can render without re-deriving it. */
  label: string;
  /** Present for curriculum domains, so we can link back to the chapter. */
  subjectId?: string;
  chapterId?: string;
  attempts: number;
  correct: number;
  /**
   * Exponentially weighted accuracy, 0–1.
   *
   * A plain lifetime average makes improvement invisible: a student who got
   * 2/10 in September and 9/10 in January still reads as ~55%. Each new result
   * moves this a fixed fraction of the way toward itself, so recent work
   * dominates without a single bad set erasing months of good ones.
   */
  recent: number;
  /** Epoch ms of the last *attempt*. 0 when never attempted. */
  lastSeen: number;
  /** Epoch ms of the last *revision* (read a summary, reviewed flashcards). */
  lastRevised: number;
  /** How many revision passes have touched this. */
  reviews: number;
}

/** How fast `recent` follows new results. 0.4 ≈ the last ~4 sets dominate. */
export const RECENCY_ALPHA = 0.4;

/** Below this many attempts we simply don't claim to know anything. */
export const MIN_ATTEMPTS_FOR_CONFIDENCE = 5;

/** Accuracy at or above this, with enough attempts, reads as "strong". */
export const STRONG_ACCURACY = 0.8;

/** Accuracy at or above this reads as "practising" rather than "learning". */
export const PRACTISING_ACCURACY = 0.55;

/** Strong material stops being trusted after this long untouched. */
export const STRONG_DECAY_DAYS = 21;

/** Weaker material goes stale sooner — there was less to hold on to. */
export const PRACTISING_DECAY_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function masteryKey(domain: MasteryDomain, id: string): string {
  return `${domain}:${id}`;
}

/** The key for a chapter, and for a named topic inside one. */
export function chapterKey(subjectId: string, chapterId: string): string {
  return masteryKey("chapter", `${subjectId}/${chapterId}`);
}

export function topicKey(subjectId: string, chapterId: string, topic: string): string {
  return masteryKey("topic", `${subjectId}/${chapterId}#${topic.trim().toLowerCase()}`);
}

export function emptyRecord(
  key: string,
  domain: MasteryDomain,
  label: string,
  extra?: { subjectId?: string; chapterId?: string },
): MasteryRecord {
  return {
    key,
    domain,
    label,
    ...(extra?.subjectId ? { subjectId: extra.subjectId } : {}),
    ...(extra?.chapterId ? { chapterId: extra.chapterId } : {}),
    attempts: 0,
    correct: 0,
    recent: 0,
    lastSeen: 0,
    lastRevised: 0,
    reviews: 0,
  };
}

/** Folds one practice result into a record. Pure — the store just stores it. */
export function applyAttempt(
  record: MasteryRecord,
  result: { correct: number; total: number; at?: number },
): MasteryRecord {
  if (result.total <= 0) return record;
  const at = result.at ?? Date.now();
  const accuracy = Math.max(0, Math.min(1, result.correct / result.total));
  // The first result seeds `recent` outright; blending it toward 0 would make
  // a perfect first set read as 40%.
  const recent =
    record.attempts === 0
      ? accuracy
      : record.recent + RECENCY_ALPHA * (accuracy - record.recent);
  return {
    ...record,
    attempts: record.attempts + result.total,
    correct: record.correct + Math.max(0, Math.min(result.total, result.correct)),
    recent,
    lastSeen: at,
  };
}

export function applyReview(record: MasteryRecord, at = Date.now()): MasteryRecord {
  return { ...record, reviews: record.reviews + 1, lastRevised: at };
}

/**
 * The state, from the record. The whole rule, in order:
 *
 *   nothing attempted                                    → not started
 *   fewer than 5 questions                               → learning
 *   ≥80% recent, untouched for 3+ weeks                  → needs revision
 *   ≥80% recent                                          → strong
 *   ≥55% recent, untouched for 2+ weeks                  → needs revision
 *   ≥55% recent                                          → practising
 *   otherwise                                            → learning
 *
 * Note what it does *not* do: it never returns "strong" for something with
 * four correct answers behind it, and it never decays something to "needs
 * revision" that was never learned in the first place — a chapter you are bad
 * at is still "learning", not "needs revision", because the advice differs.
 */
export function masteryStateOf(record: MasteryRecord | null | undefined, now = Date.now()): MasteryState {
  if (!record || record.attempts === 0) return "not-started";
  if (record.attempts < MIN_ATTEMPTS_FOR_CONFIDENCE) return "learning";

  const lastTouched = Math.max(record.lastSeen, record.lastRevised);
  const daysSince = lastTouched > 0 ? (now - lastTouched) / DAY_MS : Infinity;

  if (record.recent >= STRONG_ACCURACY) {
    return daysSince > STRONG_DECAY_DAYS ? "needs-revision" : "strong";
  }
  if (record.recent >= PRACTISING_ACCURACY) {
    return daysSince > PRACTISING_DECAY_DAYS ? "needs-revision" : "practising";
  }
  return "learning";
}

/**
 * A 0–100 number for progress bars.
 *
 * Confidence is capped by how much has actually been attempted, so ten
 * questions at 100% does not render a full bar. It is labelled "confidence"
 * everywhere it appears, never "mastery %", because it is an estimate from
 * this app's own quizzes and nothing more.
 */
export function confidenceOf(record: MasteryRecord | null | undefined): number {
  if (!record || record.attempts === 0) return 0;
  const coverage = Math.min(1, record.attempts / 20);
  return Math.round(record.recent * coverage * 100);
}

/** Lifetime accuracy, for the places that should show the plain number. */
export function accuracyOf(record: MasteryRecord | null | undefined): number {
  if (!record || record.attempts === 0) return 0;
  return Math.round((record.correct / record.attempts) * 100);
}

/**
 * Ordering for "what should I work on next".
 *
 * Urgency first (revision-due beats untouched), then lower accuracy, then
 * least-recently seen — so the list is stable and never puts something you
 * just practised back at the top.
 */
export function byPriority(a: MasteryRecord, b: MasteryRecord, now = Date.now()): number {
  const ua = MASTERY_INFO[masteryStateOf(a, now)].urgency;
  const ub = MASTERY_INFO[masteryStateOf(b, now)].urgency;
  if (ua !== ub) return ua - ub;
  if (a.recent !== b.recent) return a.recent - b.recent;
  return a.lastSeen - b.lastSeen;
}
