/**
 * Day and week boundaries, in India Standard Time.
 *
 * Every student using this product is sitting a CBSE exam in India, so "today"
 * has to mean today *there*. It previously meant the UTC day, which begins at
 * 5:30 AM IST — so a student revising at 1 AM had that work counted toward the
 * previous day. Their streak, daily goal, daily XP cap and leaderboard week all
 * rolled over mid-morning instead of at midnight.
 *
 * It was also not applied consistently. Before this module there were four
 * different notions of a day boundary in the same codebase:
 *
 *   - progress.ts   setHours(0,0,0,0)      — server-local midnight
 *   - analytics.ts  setUTCHours(0,0,0,0)   — UTC midnight
 *   - pomodoro.ts   setHours + toISOString — local midnight, UTC day key
 *   - planner.ts    new Date().toISOString — UTC day key
 *
 * On a UTC-configured server the first three coincide, which is exactly why
 * the mismatch was invisible: it was load-bearing on an environment variable
 * nobody was watching.
 *
 * IST is UTC+05:30 all year — India observes no daylight saving — so a fixed
 * offset is exact rather than an approximation. That is what makes this
 * tractable without a timezone database.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** The same instant, shifted so UTC getters read as IST wall-clock values. */
function toIstClock(at: Date): Date {
  return new Date(at.getTime() + IST_OFFSET_MS);
}

/** `YYYY-MM-DD` of the IST calendar day containing `at`. */
export function istDayKey(at: Date = new Date()): string {
  return toIstClock(at).toISOString().slice(0, 10);
}

/**
 * The UTC instant at which the IST day containing `at` began.
 *
 * Use this for `gte(column, ...)` comparisons against stored timestamps,
 * which are real instants; use istDayKey for grouping into buckets.
 */
export function istDayStart(at: Date = new Date()): Date {
  return new Date(Date.parse(`${istDayKey(at)}T00:00:00.000Z`) - IST_OFFSET_MS);
}

/** `YYYY-MM-DD` of the IST day `n` days before `at`. */
export function istDayKeyAgo(n: number, at: Date = new Date()): string {
  const d = toIstClock(at);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant at which the IST day `n` days before `at` began. */
export function istDayStartAgo(n: number, at: Date = new Date()): Date {
  return new Date(Date.parse(`${istDayKeyAgo(n, at)}T00:00:00.000Z`) - IST_OFFSET_MS);
}

/**
 * `YYYY-MM-DD` of the Monday beginning the IST week containing `at`.
 *
 * Monday, not Sunday. progress.ts, events.ts and leaderboard.ts already
 * anchored weeks to Monday; pomodoro.ts alone used `getDay()` and so ran
 * Sunday–Saturday, meaning "this week's focus minutes" covered a different
 * seven days than the leaderboard a student was comparing it against.
 */
export function istWeekAnchorKey(at: Date = new Date()): string {
  const d = toIstClock(at);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant at which the current IST week (Monday 00:00 IST) began. */
export function istWeekStart(at: Date = new Date()): Date {
  return new Date(Date.parse(`${istWeekAnchorKey(at)}T00:00:00.000Z`) - IST_OFFSET_MS);
}
