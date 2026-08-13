import { Router } from "express";
import { db } from "@workspace/db";
import { accountSettingsTable, studentProgressTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { resolveOwnerKey } from "../lib/owner";
import { istWeekAnchorKey, istWeekStart } from "../lib/day";

const router = Router();

/**
 * GET /api/leaderboard
 *
 * Design notes, because the obvious version of this feature is actively
 * discouraging:
 *
 *  - Ranked on XP earned THIS WEEK, not all time. An all-time table is won
 *    permanently by whoever started first, and every new student arrives
 *    already last.
 *  - Scoped to the student's own grade, so a Class 10 student is not measured
 *    against a different syllabus.
 *  - Returns a neighbourhood (top 3 plus the few either side of you) rather
 *    than a global list. Being #4,182 of 5,000 motivates nobody.
 *  - Opt-in only, and only ever shows a chosen display name.
 */

/**
 * FNV-1a, base36 — a one-way seed for a student's default avatar.
 *
 * The owner key itself must never reach the browser (for a signed-in student
 * it is their Clerk user id), but an unpicked avatar has to look identical
 * here and in their own sidebar. Both sides therefore derive from this.
 *
 * PAIRED with avatarSeedFor() in the client's lib/avatar.ts. If this changes,
 * that must change with it, or avatars will differ between the leaderboard
 * and the rest of the app.
 */
function avatarSeedFor(ownerKey: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < ownerKey.length; i++) {
    hash ^= ownerKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Monday 00:00 IST of the current week, as a real instant. */
const startOfWeek = (): Date => istWeekStart();

const NEIGHBOURS = 2; // shown either side of the requesting student

router.get("/leaderboard", async (req, res) => {
  try {
    const ownerKey = resolveOwnerKey(req, req.query["sessionId"]);
    if (!ownerKey) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const [me] = await db
      .select()
      .from(accountSettingsTable)
      .where(eq(accountSettingsTable.sessionId, ownerKey))
      .limit(1);

    if (!me?.leaderboardOptIn) {
      // Not an error — the UI uses this to show the opt-in prompt instead.
      res.json({ optedIn: false, grade: me?.grade ?? null, entries: [], you: null });
      return;
    }

    const grade = me.grade ?? 10;
    const weekStart = startOfWeek();

    // Everyone in this grade who opted in.
    const participants = await db
      .select({
        sessionId: accountSettingsTable.sessionId,
        displayName: accountSettingsTable.displayName,
        username: accountSettingsTable.username,
        avatarSymbol: accountSettingsTable.avatarSymbol,
        avatarColor: accountSettingsTable.avatarColor,
      })
      .from(accountSettingsTable)
      .where(
        and(
          eq(accountSettingsTable.leaderboardOptIn, true),
          eq(accountSettingsTable.grade, grade),
        ),
      );

    if (participants.length === 0) {
      res.json({ optedIn: true, grade, entries: [], you: null });
      return;
    }

    // Weekly XP = total XP minus the total captured at the start of this week.
    // Ranking on the raw `xp` column would rank on lifetime totals, which is
    // the all-time board this design deliberately avoids.
    const keys = new Set(participants.map((p) => p.sessionId));
    const progressRows = await db
      .select({
        sessionId: studentProgressTable.sessionId,
        xp: studentProgressTable.xp,
        streak: studentProgressTable.streak,
        weekAnchorDate: studentProgressTable.weekAnchorDate,
        weekAnchorXp: studentProgressTable.weekAnchorXp,
      })
      .from(studentProgressTable);

    const weekAnchorKey = istWeekAnchorKey();

    const xpByKey = new Map<string, { xp: number; streak: number }>();
    for (const row of progressRows) {
      if (!keys.has(row.sessionId)) continue;
      // A stale anchor means they have not earned anything since the week
      // rolled over — their weekly score is 0 until the next XP write.
      const weeklyXp =
        row.weekAnchorDate === weekAnchorKey ? row.xp - row.weekAnchorXp : 0;
      xpByKey.set(row.sessionId, {
        xp: Math.max(0, weeklyXp),
        streak: row.streak,
      });
    }

    const ranked = participants
      .map((p, index) => ({
        // Never expose the owner key — it is a Clerk user id for signed-in
        // students and would identify them across the whole product.
        id: index,
        displayName: p.displayName?.trim() || "Anonymous",
        // A handle is shown alongside the display name where one is set —
        // it is the stabler identity, since display names repeat freely.
        username: p.username ?? null,
        avatarSymbol: p.avatarSymbol ?? null,
        avatarColor: p.avatarColor ?? null,
        avatarSeed: avatarSeedFor(p.sessionId),
        xp: xpByKey.get(p.sessionId)?.xp ?? 0,
        streak: xpByKey.get(p.sessionId)?.streak ?? 0,
        isYou: p.sessionId === ownerKey,
      }))
      .sort((a, b) => b.xp - a.xp || b.streak - a.streak)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    const myIndex = ranked.findIndex((e) => e.isYou);
    const top = ranked.slice(0, 3);
    const window =
      myIndex >= 0
        ? ranked.slice(
            Math.max(0, myIndex - NEIGHBOURS),
            Math.min(ranked.length, myIndex + NEIGHBOURS + 1),
          )
        : [];

    // De-duplicate where the top three and the neighbourhood overlap.
    const seen = new Set<number>();
    const entries = [...top, ...window].filter((e) => {
      if (seen.has(e.rank)) return false;
      seen.add(e.rank);
      return true;
    });

    res.json({
      optedIn: true,
      grade,
      weekStart: weekStart.toISOString(),
      totalParticipants: ranked.length,
      entries,
      you: myIndex >= 0 ? ranked[myIndex] : null,
    });
  } catch (err) {
    req.log.error(err, "leaderboard error");
    res.status(500).json({ error: "Could not load the leaderboard" });
  }
});

export default router;
