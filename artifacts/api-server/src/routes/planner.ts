import { Router } from "express";
import { db } from "@workspace/db";
import { studyPlansTable, studyPlanTasksTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  generateSchedule,
  redistributeTasks,
  type ScheduleInput,
  type PlanSubject,
  type PlanChapter,
  type DayAvailability,
  type PlanPreferences,
} from "../lib/scheduler";

import { resolveOwnerKey } from "../lib/owner";
import { istDayKey } from "../lib/day";

const router = Router();

function serializePlan(p: typeof studyPlansTable.$inferSelect) {
  return {
    id: p.id,
    sessionId: p.sessionId,
    title: p.title,
    goalType: p.goalType,
    goalDescription: p.goalDescription,
    startDate: p.startDate,
    targetDate: p.targetDate,
    status: p.status,
    subjects: p.subjectsJson ?? [],
    chapters: p.chaptersJson ?? [],
    availability: p.availabilityJson ?? {},
    preferences: p.preferencesJson ?? {},
    revisionPattern: p.revisionPatternJson ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function serializeTask(t: typeof studyPlanTasksTable.$inferSelect) {
  return {
    id: t.id,
    planId: t.planId,
    sessionId: t.sessionId,
    title: t.title,
    subject: t.subject,
    chapter: t.chapter,
    topic: t.topic,
    taskType: t.taskType,
    scheduledDate: t.scheduledDate,
    startTime: t.startTime,
    estimatedMinutes: t.estimatedMinutes,
    actualMinutes: t.actualMinutes,
    priority: t.priority,
    difficulty: t.difficulty,
    energyRequirement: t.energyRequirement,
    notes: t.notes,
    resourceType: t.resourceType,
    resourceId: t.resourceId,
    revisionCycle: t.revisionCycle,
    isLocked: t.isLocked,
    status: t.status,
    completedAt: t.completedAt,
  };
}

function scheduleInputFromPlan(
  p: typeof studyPlansTable.$inferSelect,
): ScheduleInput {
  return {
    startDate: p.startDate,
    targetDate: p.targetDate,
    subjects: (p.subjectsJson ?? []) as PlanSubject[],
    chapters: (p.chaptersJson ?? []) as PlanChapter[],
    availability: (p.availabilityJson ?? {}) as Record<string, DayAvailability>,
    preferences: (p.preferencesJson ?? {}) as PlanPreferences,
    revisionPattern: (p.revisionPatternJson ?? []) as number[],
  };
}

// GET /api/planner/plans
router.get("/planner/plans", async (req, res) => {
  const sessionId = resolveOwnerKey(req, req.query["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const plans = await db
    .select()
    .from(studyPlansTable)
    .where(eq(studyPlansTable.sessionId, sessionId))
    .orderBy(desc(studyPlansTable.createdAt));
  res.json({ plans: plans.map(serializePlan) });
});

// POST /api/planner/plans — create + generate schedule
router.post("/planner/plans", async (req, res) => {
  try {
    const body = req.body as {
      sessionId: string;
      title: string;
      goalType: string;
      goalDescription?: string | null;
      startDate: string;
      targetDate: string;
      subjects: PlanSubject[];
      chapters: PlanChapter[];
      availability: Record<string, DayAvailability>;
      preferences: PlanPreferences;
      revisionPattern: number[];
    };
    body.sessionId = resolveOwnerKey(req, body.sessionId) ?? "";
    if (
      !body.sessionId ||
      !body.title ||
      !body.startDate ||
      !body.targetDate ||
      !Array.isArray(body.subjects) ||
      !Array.isArray(body.chapters)
    ) {
      res.status(400).json({ error: "Missing required plan fields" });
      return;
    }
    if (body.targetDate <= body.startDate) {
      res.status(400).json({ error: "Target date must be after start date" });
      return;
    }

    const { tasks, warnings } = generateSchedule({
      startDate: body.startDate,
      targetDate: body.targetDate,
      subjects: body.subjects,
      chapters: body.chapters,
      availability: body.availability ?? {},
      preferences: body.preferences ?? {},
      revisionPattern: body.revisionPattern ?? [],
    });

    const [plan] = await db
      .insert(studyPlansTable)
      .values({
        sessionId: body.sessionId,
        title: body.title,
        goalType: body.goalType ?? "custom",
        goalDescription: body.goalDescription ?? null,
        startDate: body.startDate,
        targetDate: body.targetDate,
        status: "active",
        subjectsJson: body.subjects,
        chaptersJson: body.chapters,
        availabilityJson: body.availability ?? {},
        preferencesJson: body.preferences ?? {},
        revisionPatternJson: body.revisionPattern ?? [],
      })
      .returning();
    if (!plan) {
      res.status(500).json({ error: "Failed to create plan" });
      return;
    }

    let insertedTasks: (typeof studyPlanTasksTable.$inferSelect)[] = [];
    if (tasks.length > 0) {
      insertedTasks = await db
        .insert(studyPlanTasksTable)
        .values(
          tasks.map((t) => ({
            planId: plan.id,
            sessionId: body.sessionId,
            title: t.title,
            subject: t.subject,
            chapter: t.chapter,
            topic: t.topic,
            taskType: t.taskType,
            scheduledDate: t.scheduledDate,
            startTime: t.startTime,
            estimatedMinutes: t.estimatedMinutes,
            priority: t.priority,
            difficulty: t.difficulty,
            revisionCycle: t.revisionCycle,
          })),
        )
        .returning();
    }

    res.status(201).json({
      plan: serializePlan(plan),
      tasks: insertedTasks.map(serializeTask),
      warnings,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create study plan");
    res.status(500).json({ error: "Failed to create study plan" });
  }
});

// PUT /api/planner/plans/:planId
router.put("/planner/plans/:planId", async (req, res) => {
  const planId = Number(req.params.planId);
  const body = req.body as {
    sessionId: string;
    title?: string;
    status?: string;
    targetDate?: string;
    availability?: Record<string, DayAvailability>;
    preferences?: PlanPreferences;
    revisionPattern?: number[];
  };
  if (!body.sessionId || !Number.isFinite(planId)) {
    res.status(400).json({ error: "sessionId and planId are required" });
    return;
  }
  const updates: Partial<typeof studyPlansTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.title !== undefined) updates.title = body.title;
  if (body.status !== undefined) updates.status = body.status;
  if (body.targetDate !== undefined) updates.targetDate = body.targetDate;
  if (body.availability !== undefined)
    updates.availabilityJson = body.availability;
  if (body.preferences !== undefined)
    updates.preferencesJson = body.preferences;
  if (body.revisionPattern !== undefined)
    updates.revisionPatternJson = body.revisionPattern;

  const [plan] = await db
    .update(studyPlansTable)
    .set(updates)
    .where(
      and(
        eq(studyPlansTable.id, planId),
        eq(studyPlansTable.sessionId, body.sessionId),
      ),
    )
    .returning();
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const tasks = await db
    .select()
    .from(studyPlanTasksTable)
    .where(eq(studyPlanTasksTable.planId, planId));
  res.json({ plan: serializePlan(plan), tasks: tasks.map(serializeTask) });
});

// POST /api/planner/plans/:planId/delete
router.post("/planner/plans/:planId/delete", async (req, res) => {
  const planId = Number(req.params.planId);
  const sessionId = resolveOwnerKey(req, req.body?.sessionId);
  if (!sessionId || !Number.isFinite(planId)) {
    res.status(400).json({ error: "sessionId and planId are required" });
    return;
  }
  await db
    .delete(studyPlanTasksTable)
    .where(
      and(
        eq(studyPlanTasksTable.planId, planId),
        eq(studyPlanTasksTable.sessionId, sessionId),
      ),
    );
  await db
    .delete(studyPlansTable)
    .where(
      and(
        eq(studyPlansTable.id, planId),
        eq(studyPlansTable.sessionId, sessionId),
      ),
    );
  res.status(204).end();
});

// POST /api/planner/plans/:planId/reschedule
router.post("/planner/plans/:planId/reschedule", async (req, res) => {
  try {
    const planId = Number(req.params.planId);
    const { fromDate } = req.body as { fromDate?: string | null };
    const sessionId = resolveOwnerKey(req, req.body?.sessionId);
    if (!sessionId || !Number.isFinite(planId)) {
      res.status(400).json({ error: "sessionId and planId are required" });
      return;
    }
    const [plan] = await db
      .select()
      .from(studyPlansTable)
      .where(
        and(
          eq(studyPlansTable.id, planId),
          eq(studyPlansTable.sessionId, sessionId),
        ),
      )
      .limit(1);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    const today = istDayKey();
    const start = fromDate ?? today;

    const pending = await db
      .select()
      .from(studyPlanTasksTable)
      .where(
        and(
          eq(studyPlanTasksTable.planId, planId),
          eq(studyPlanTasksTable.sessionId, sessionId),
        ),
      );
    const toMove = pending.filter(
      (t) =>
        (t.status === "pending" ||
          t.status === "missed" ||
          t.status === "rescheduled") &&
        t.scheduledDate < start,
    );
    const future = pending.filter(
      (t) =>
        (t.status === "pending" || t.status === "rescheduled") &&
        t.scheduledDate >= start,
    );

    const { moves, warnings } = redistributeTasks(
      scheduleInputFromPlan(plan),
      start,
      [...toMove, ...future].map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        chapter: t.chapter,
        taskType: t.taskType,
        estimatedMinutes: t.estimatedMinutes,
        priority: t.priority,
        isLocked: t.isLocked,
        scheduledDate: t.scheduledDate,
      })),
    );

    for (const m of moves) {
      await db
        .update(studyPlanTasksTable)
        .set({
          scheduledDate: m.scheduledDate,
          startTime: m.startTime,
          status: "rescheduled",
          updatedAt: new Date(),
        })
        .where(eq(studyPlanTasksTable.id, m.id));
    }

    const tasks = await db
      .select()
      .from(studyPlanTasksTable)
      .where(eq(studyPlanTasksTable.planId, planId));
    res.json({
      plan: serializePlan(plan),
      tasks: tasks.map(serializeTask),
      warnings,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to reschedule plan");
    res.status(500).json({ error: "Failed to reschedule plan" });
  }
});

// GET /api/planner/tasks
router.get("/planner/tasks", async (req, res) => {
  const { planId, fromDate, toDate, status } = req.query as Record<
    string,
    string | undefined
  >;
  const sessionId = resolveOwnerKey(req, req.query["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const conditions = [eq(studyPlanTasksTable.sessionId, sessionId)];
  if (planId) conditions.push(eq(studyPlanTasksTable.planId, Number(planId)));
  if (fromDate) conditions.push(gte(studyPlanTasksTable.scheduledDate, fromDate));
  if (toDate) conditions.push(lte(studyPlanTasksTable.scheduledDate, toDate));
  if (status) conditions.push(eq(studyPlanTasksTable.status, status));
  const tasks = await db
    .select()
    .from(studyPlanTasksTable)
    .where(and(...conditions))
    .orderBy(studyPlanTasksTable.scheduledDate, studyPlanTasksTable.startTime);
  res.json({ tasks: tasks.map(serializeTask) });
});

// POST /api/planner/tasks
router.post("/planner/tasks", async (req, res) => {
  const body = req.body as {
    sessionId: string;
    planId: number;
    title: string;
    subject?: string | null;
    chapter?: string | null;
    topic?: string | null;
    taskType: string;
    scheduledDate: string;
    startTime?: string | null;
    estimatedMinutes: number;
    priority?: string;
    difficulty?: number | null;
    notes?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    isLocked?: boolean;
  };
  if (
    !body.sessionId ||
    !body.planId ||
    !body.title ||
    !body.scheduledDate ||
    !body.estimatedMinutes
  ) {
    res.status(400).json({ error: "Missing required task fields" });
    return;
  }
  const [task] = await db
    .insert(studyPlanTasksTable)
    .values({
      planId: body.planId,
      sessionId: body.sessionId,
      title: body.title,
      subject: body.subject ?? null,
      chapter: body.chapter ?? null,
      topic: body.topic ?? null,
      taskType: body.taskType ?? "custom",
      scheduledDate: body.scheduledDate,
      startTime: body.startTime ?? null,
      estimatedMinutes: body.estimatedMinutes,
      priority: body.priority ?? "medium",
      difficulty: body.difficulty ?? null,
      notes: body.notes ?? null,
      resourceType: body.resourceType ?? null,
      resourceId: body.resourceId ?? null,
      isLocked: body.isLocked ?? false,
    })
    .returning();
  res.status(201).json({ task: serializeTask(task!) });
});

// PUT /api/planner/tasks/:taskId
router.put("/planner/tasks/:taskId", async (req, res) => {
  const taskId = Number(req.params.taskId);
  const body = req.body as Record<string, unknown> & { sessionId: string };
  body.sessionId = resolveOwnerKey(req, body.sessionId) ?? "";
  if (!body.sessionId || !Number.isFinite(taskId)) {
    res.status(400).json({ error: "sessionId and taskId are required" });
    return;
  }
  const updates: Partial<typeof studyPlanTasksTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  const fields = [
    "title",
    "subject",
    "chapter",
    "topic",
    "taskType",
    "scheduledDate",
    "startTime",
    "estimatedMinutes",
    "actualMinutes",
    "priority",
    "difficulty",
    "notes",
    "resourceType",
    "resourceId",
    "isLocked",
    "status",
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) {
      (updates as Record<string, unknown>)[f] = body[f];
    }
  }
  if (body.status === "completed") {
    updates.completedAt = new Date();
  }
  const [task] = await db
    .update(studyPlanTasksTable)
    .set(updates)
    .where(
      and(
        eq(studyPlanTasksTable.id, taskId),
        eq(studyPlanTasksTable.sessionId, body.sessionId),
      ),
    )
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ task: serializeTask(task) });
});

// POST /api/planner/tasks/:taskId/delete
router.post("/planner/tasks/:taskId/delete", async (req, res) => {
  const taskId = Number(req.params.taskId);
  const sessionId = resolveOwnerKey(req, req.body?.sessionId);
  if (!sessionId || !Number.isFinite(taskId)) {
    res.status(400).json({ error: "sessionId and taskId are required" });
    return;
  }
  await db
    .delete(studyPlanTasksTable)
    .where(
      and(
        eq(studyPlanTasksTable.id, taskId),
        eq(studyPlanTasksTable.sessionId, sessionId),
      ),
    );
  res.status(204).end();
});

export default router;
