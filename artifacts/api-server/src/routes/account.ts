import { Router } from "express";
import { db } from "@workspace/db";
import {
  accountSettingsTable,
  activityTable,
  feedbackTable,
  focusSessionsTable,
  mockAttemptsTable,
  pomodoroSettingsTable,
  studentProgressTable,
  studyPlanTasksTable,
  studyPlansTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { currentUserId, clerkOwnerKey, resolveOwnerKey } from "../lib/owner";

const router = Router();

export const USERNAME_HELP =
  "Usernames are 3–20 characters: lowercase letters, numbers and single underscores, not starting or ending with one.";

/**
 * Validated here rather than trusted from the client, because a username is
 * shown to *other* students on the leaderboard. The narrow charset is the
 * point: it makes it impossible to submit a name carrying zero-width joiners,
 * right-to-left overrides or whitespace padding, all of which are used to
 * impersonate another person's handle.
 *
 * Mirrors checkUsername() in the client's lib/avatar.ts, which exists to give
 * live feedback while typing. This copy is the one that actually enforces.
 */
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|_(?!_)){1,18}[a-z0-9]$/;

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return USERNAME_RE.test(trimmed) ? trimmed : null;
}

/**
 * Avatar symbol and colour ids.
 *
 * Deliberately not checked against the list of twelve symbols and eight
 * palettes — that list lives in the client, which is the only thing that
 * draws them, and duplicating it here would create two copies to keep in
 * step. This just bounds what can be stored; the client's resolveAvatar()
 * already falls back to the seeded default for any value it does not
 * recognise, so an unknown token renders as a normal avatar rather than a
 * broken one.
 */
function cleanToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^[a-z]{2,16}$/.test(trimmed) ? trimmed : null;
}

/**
 * Every table that belongs to a student, in the order a merge should touch
 * them. Kept in one place so claim, export and delete can never drift apart —
 * a table missing from delete would leave orphaned personal data behind.
 */
/**
 * Drizzle's table types are deeply generic, so a heterogeneous list of them
 * cannot be iterated without widening — `db.update(t)` on a union of nine
 * table types does not resolve. The structural guarantee this relies on is
 * narrow and verified: every table below has both `id` and `session_id`.
 */
type OwnedTable = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
};

const OWNED_TABLES: OwnedTable[] = [
  { name: "progress", table: studentProgressTable },
  { name: "activity", table: activityTable },
  { name: "studyPlans", table: studyPlansTable },
  { name: "studyPlanTasks", table: studyPlanTasksTable },
  { name: "pomodoroSettings", table: pomodoroSettingsTable },
  { name: "focusSessions", table: focusSessionsTable },
  { name: "mockAttempts", table: mockAttemptsTable },
  { name: "feedback", table: feedbackTable },
  { name: "accountSettings", table: accountSettingsTable },
];

/** Tables with a UNIQUE session_id — at most one row per owner. */
const SINGLETON_TABLES = new Set<string>([
  "progress",
  "pomodoroSettings",
  "accountSettings",
]);

/**
 * POST /api/account/claim
 *
 * Moves anonymous rows onto the signed-in account.
 *
 * Without this, signing in would look to a student exactly like losing
 * everything: their XP, streak and study plan were all keyed to a browser-local
 * id, and a Clerk-keyed account starts empty. Called once on sign-in with the
 * localStorage id the browser was using beforehand.
 *
 * `studentProgressTable` and `pomodoroSettingsTable` have a UNIQUE session_id,
 * so a straight UPDATE would throw if the account already had a row. Those two
 * are skipped when the account is already populated — the signed-in data is
 * treated as authoritative and the anonymous copy is left alone rather than
 * silently overwriting real progress.
 */
router.post("/account/claim", async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const anonymousId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!anonymousId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const ownerKey = clerkOwnerKey(userId);
    if (anonymousId === ownerKey) {
      res.json({ claimed: false, reason: "already-owned" });
      return;
    }

    const moved: Record<string, number> = {};

    for (const { name, table } of OWNED_TABLES) {
      if (SINGLETON_TABLES.has(name)) {
        const existing = await db
          .select()
          .from(table)
          .where(eq(table.sessionId, ownerKey))
          .limit(1);
        if (existing.length > 0) {
          // Account already has real data here — keep it and leave the
          // anonymous row untouched rather than overwrite actual progress.
          moved[name] = 0;
          continue;
        }
      }

      const updated = await db
        .update(table)
        .set({ sessionId: ownerKey })
        .where(eq(table.sessionId, anonymousId))
        .returning({ id: table.id });

      moved[name] = updated.length;
    }

    req.log.info({ userId, moved }, "account claim complete");
    res.json({ claimed: true, moved });
  } catch (err) {
    req.log.error(err, "account claim error");
    res.status(500).json({ error: "Could not link your existing progress" });
  }
});

/** GET /api/account/settings */
router.get("/account/settings", async (req, res) => {
  try {
    const ownerKey = resolveOwnerKey(req, req.query["sessionId"]);
    if (!ownerKey) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const [settings] = await db
      .select()
      .from(accountSettingsTable)
      .where(eq(accountSettingsTable.sessionId, ownerKey))
      .limit(1);

    res.json({
      settings: settings ?? {
        sessionId: ownerKey,
        leaderboardOptIn: false,
        displayName: null,
        username: null,
        avatarSymbol: null,
        avatarColor: null,
        grade: null,
      },
    });
  } catch (err) {
    req.log.error(err, "account settings read error");
    res.status(500).json({ error: "Could not load your settings" });
  }
});

/** PUT /api/account/settings */
router.put("/account/settings", async (req, res) => {
  try {
    const ownerKey = resolveOwnerKey(req, req.body?.sessionId);
    if (!ownerKey) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const { leaderboardOptIn, displayName, username, avatarSymbol, avatarColor, grade } =
      req.body ?? {};

    const trimmedName =
      typeof displayName === "string" ? displayName.trim().slice(0, 24) : null;

    const cleanedUsername = normalizeUsername(username);
    if (username != null && username !== "" && cleanedUsername === null) {
      res.status(400).json({ error: USERNAME_HELP });
      return;
    }

    const values = {
      sessionId: ownerKey,
      leaderboardOptIn: Boolean(leaderboardOptIn),
      displayName: trimmedName || null,
      username: cleanedUsername,
      avatarSymbol: cleanToken(avatarSymbol),
      avatarColor: cleanToken(avatarColor),
      grade: typeof grade === "number" ? grade : null,
      updatedAt: new Date(),
    };

    const [saved] = await db
      .insert(accountSettingsTable)
      .values(values)
      .onConflictDoUpdate({
        target: accountSettingsTable.sessionId,
        set: {
          leaderboardOptIn: values.leaderboardOptIn,
          displayName: values.displayName,
          username: values.username,
          avatarSymbol: values.avatarSymbol,
          avatarColor: values.avatarColor,
          grade: values.grade,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    res.json({ settings: saved });
  } catch (err) {
    req.log.error(err, "account settings write error");
    res.status(500).json({ error: "Could not save your settings" });
  }
});

/**
 * GET /api/account/export — everything held about this student, as JSON.
 * Requires a signed-in account: exporting by raw session id would let anyone
 * who guessed an id download someone else's data.
 */
router.get("/account/export", async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to export your data" });
      return;
    }
    const ownerKey = clerkOwnerKey(userId);

    const data: Record<string, unknown[]> = {};
    for (const { name, table } of OWNED_TABLES) {
      data[name] = await db.select().from(table).where(eq(table.sessionId, ownerKey));
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", 'attachment; filename="studyfilter-data.json"');
    res.end(JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2));
  } catch (err) {
    req.log.error(err, "account export error");
    res.status(500).json({ error: "Could not export your data" });
  }
});

/**
 * POST /api/account/delete — permanently removes this student's rows.
 *
 * Actually deletes rather than flagging: this is minors' data, and "delete my
 * account" has to mean what it says. The Clerk user itself is removed by the
 * client through Clerk, which owns that record.
 */
router.post("/account/delete", async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to delete your data" });
      return;
    }
    if (req.body?.confirm !== "DELETE") {
      res.status(400).json({ error: "Confirmation required" });
      return;
    }

    const ownerKey = clerkOwnerKey(userId);
    const deleted: Record<string, number> = {};

    for (const { name, table } of OWNED_TABLES) {
      const rows = await db
        .delete(table)
        .where(eq(table.sessionId, ownerKey))
        .returning({ id: table.id });
      deleted[name] = rows.length;
    }

    req.log.info({ userId, deleted }, "account data deleted");
    res.json({ deleted });
  } catch (err) {
    req.log.error(err, "account delete error");
    res.status(500).json({ error: "Could not delete your data" });
  }
});

export default router;
