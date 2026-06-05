import { Router } from "express";
import { db } from "@workspace/db";
import {
  schedulesTable,
  scheduleSlotsTable,
  submissionLogsTable,
  plantsTable,
  forecastRunsTable,
  forecastSlotsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  ListSchedulesQueryParams,
  CreateScheduleBody,
  GetScheduleParams,
  UpdateScheduleParams,
  UpdateScheduleBody,
  SubmitScheduleParams,
  ListSubmissionsParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

const ADJUSTMENT_CAP_PCT = 15;

function formatSchedule(s: typeof schedulesTable.$inferSelect, plantName: string) {
  return {
    id: s.id,
    plantId: s.plantId,
    plantName,
    forecastId: s.forecastId ?? null,
    date: s.date,
    type: s.type,
    status: s.status,
    revisionNumber: s.revisionNumber,
    totalScheduledMwh: s.totalScheduledMwh,
    totalForecastMwh: s.totalForecastMwh,
    deadlineAt: s.deadlineAt ?? null,
    lastSubmittedAt: s.lastSubmittedAt ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function formatSlot(slot: typeof scheduleSlotsTable.$inferSelect) {
  return {
    id: slot.id,
    slotNumber: slot.slotNumber,
    slotStart: slot.slotStart,
    slotEnd: slot.slotEnd,
    forecastMw: slot.forecastMw,
    scheduledMw: slot.scheduledMw,
    adjustmentMw: slot.adjustmentMw,
    adjustmentPct: slot.adjustmentPct,
    maxAllowedMw: slot.maxAllowedMw,
    minAllowedMw: slot.minAllowedMw,
  };
}

router.get("/schedules", async (req, res) => {
  const parsed = ListSchedulesQueryParams.safeParse({
    plantId: req.query.plantId ? Number(req.query.plantId) : undefined,
    date: req.query.date,
    status: req.query.status,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { plantId, date, status } = parsed.data;

  const schedules = await db
    .select()
    .from(schedulesTable)
    .orderBy(desc(schedulesTable.createdAt));
  const plants = await db.select().from(plantsTable);
  const plantMap = Object.fromEntries(plants.map((p) => [p.id, p.name]));

  const filtered = schedules.filter((s) => {
    if (plantId !== undefined && plantId !== null && s.plantId !== plantId) return false;
    if (date && s.date !== date) return false;
    if (status && s.status !== status) return false;
    return true;
  });

  res.json(filtered.map((s) => formatSchedule(s, plantMap[s.plantId] ?? "Unknown")));
});

router.post("/schedules", async (req, res) => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { plantId, date, type, forecastId, notes } = parsed.data;

  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, plantId));
  if (!plant) {
    res.status(400).json({ error: "Plant not found" });
    return;
  }

  // Determine deadline (10:00 AM IST next day for day-ahead)
  const deadline = type === "day_ahead" ? `${date}T10:00:00+05:30` : null;

  // Get forecast total MWh if linked
  let totalForecastMwh = 0;
  let linkedForecastId = forecastId ?? null;

  if (forecastId) {
    const [run] = await db
      .select()
      .from(forecastRunsTable)
      .where(eq(forecastRunsTable.id, forecastId));
    if (run) totalForecastMwh = run.totalForecastMwh;
  }

  const [schedule] = await db
    .insert(schedulesTable)
    .values({
      plantId,
      forecastId: linkedForecastId,
      date,
      type,
      status: "draft",
      revisionNumber: 1,
      totalScheduledMwh: totalForecastMwh,
      totalForecastMwh,
      deadlineAt: deadline,
      notes: notes ?? null,
    })
    .returning();

  if (!schedule) {
    res.status(500).json({ error: "Failed to create schedule" });
    return;
  }

  // Seed slots from forecast if available
  if (linkedForecastId) {
    const forecastSlots = await db
      .select()
      .from(forecastSlotsTable)
      .where(eq(forecastSlotsTable.forecastRunId, linkedForecastId))
      .orderBy(forecastSlotsTable.slotNumber);

    if (forecastSlots.length > 0) {
      const slotValues = forecastSlots.map((fs) => {
        const maxAllowed = Math.min(fs.forecastMw * (1 + ADJUSTMENT_CAP_PCT / 100), plant.capacityMw);
        const minAllowed = Math.max(fs.forecastMw * (1 - ADJUSTMENT_CAP_PCT / 100), 0);
        return {
          scheduleId: schedule.id,
          slotNumber: fs.slotNumber,
          slotStart: fs.slotStart,
          slotEnd: fs.slotEnd,
          forecastMw: fs.forecastMw,
          scheduledMw: fs.forecastMw,
          adjustmentMw: 0,
          adjustmentPct: ADJUSTMENT_CAP_PCT,
          maxAllowedMw: maxAllowed,
          minAllowedMw: minAllowed,
        };
      });
      await db.insert(scheduleSlotsTable).values(slotValues);
    }
  } else {
    // Generate 96 blank slots for the date
    const slotValues = generateBlankSlots(schedule.id, date, plant.capacityMw);
    await db.insert(scheduleSlotsTable).values(slotValues);
  }

  res.status(201).json(formatSchedule(schedule, plant.name));
});

router.get("/schedules/:scheduleId", async (req, res) => {
  const parsed = GetScheduleParams.safeParse({ scheduleId: Number(req.params.scheduleId) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid schedule id" });
    return;
  }
  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(eq(schedulesTable.id, parsed.data.scheduleId));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, schedule.plantId));
  const slots = await db
    .select()
    .from(scheduleSlotsTable)
    .where(eq(scheduleSlotsTable.scheduleId, schedule.id))
    .orderBy(scheduleSlotsTable.slotNumber);

  res.json({
    schedule: formatSchedule(schedule, plant?.name ?? "Unknown"),
    slots: slots.map(formatSlot),
  });
});

router.patch("/schedules/:scheduleId", async (req, res) => {
  const paramsParsed = UpdateScheduleParams.safeParse({
    scheduleId: Number(req.params.scheduleId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid schedule id" });
    return;
  }
  const bodyParsed = UpdateScheduleBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const scheduleId = paramsParsed.data.scheduleId;
  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(eq(schedulesTable.id, scheduleId));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, schedule.plantId));

  // Fetch existing slots
  const existingSlots = await db
    .select()
    .from(scheduleSlotsTable)
    .where(eq(scheduleSlotsTable.scheduleId, scheduleId));

  const slotMap = Object.fromEntries(existingSlots.map((s) => [s.slotNumber, s]));

  // Apply updates
  let totalScheduledMwh = 0;
  for (const update of bodyParsed.data.slots) {
    const existing = slotMap[update.slotNumber];
    if (!existing) continue;

    const capped = Math.max(existing.minAllowedMw, Math.min(existing.maxAllowedMw, update.scheduledMw));
    const adjustment = capped - existing.forecastMw;

    await db
      .update(scheduleSlotsTable)
      .set({
        scheduledMw: capped,
        adjustmentMw: adjustment,
      })
      .where(eq(scheduleSlotsTable.id, existing.id));

    totalScheduledMwh += capped * (15 / 60);
  }

  // Add up unchanged slots
  for (const slot of existingSlots) {
    const hasUpdate = bodyParsed.data.slots.some((u) => u.slotNumber === slot.slotNumber);
    if (!hasUpdate) totalScheduledMwh += slot.scheduledMw * (15 / 60);
  }

  const [updated] = await db
    .update(schedulesTable)
    .set({
      totalScheduledMwh,
      updatedAt: new Date(),
      notes: bodyParsed.data.notes ?? schedule.notes,
    })
    .where(eq(schedulesTable.id, scheduleId))
    .returning();

  const refreshedSlots = await db
    .select()
    .from(scheduleSlotsTable)
    .where(eq(scheduleSlotsTable.scheduleId, scheduleId))
    .orderBy(scheduleSlotsTable.slotNumber);

  res.json({
    schedule: formatSchedule(updated!, plant?.name ?? "Unknown"),
    slots: refreshedSlots.map(formatSlot),
  });
});

router.post("/schedules/:scheduleId/submit", async (req, res) => {
  const parsed = SubmitScheduleParams.safeParse({ scheduleId: Number(req.params.scheduleId) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid schedule id" });
    return;
  }

  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(eq(schedulesTable.id, parsed.data.scheduleId));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  const now = new Date();
  const ackId = `SLDC-${schedule.date.replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const newRevision = schedule.revisionNumber + (schedule.status === "submitted" ? 1 : 0);

  await db
    .update(schedulesTable)
    .set({
      status: schedule.status === "submitted" ? "revised" : "submitted",
      lastSubmittedAt: now.toISOString(),
      revisionNumber: newRevision,
      updatedAt: now,
    })
    .where(eq(schedulesTable.id, schedule.id));

  await db.insert(submissionLogsTable).values({
    scheduleId: schedule.id,
    submittedAt: now,
    status: "success",
    revisionNumber: newRevision,
    acknowledgementId: ackId,
    notes: `Submitted to ${schedule.type === "day_ahead" ? "SLDC" : "SLDC (Intra-Day Revision)"} successfully`,
  });

  res.json({
    success: true,
    message: `Schedule submitted to SLDC successfully. Revision ${newRevision}.`,
    submittedAt: now.toISOString(),
    acknowledgementId: ackId,
    scheduleId: schedule.id,
  });
});

router.get("/schedules/:scheduleId/submissions", async (req, res) => {
  const parsed = ListSubmissionsParams.safeParse({
    scheduleId: Number(req.params.scheduleId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid schedule id" });
    return;
  }

  const logs = await db
    .select()
    .from(submissionLogsTable)
    .where(eq(submissionLogsTable.scheduleId, parsed.data.scheduleId))
    .orderBy(desc(submissionLogsTable.submittedAt));

  res.json(
    logs.map((l) => ({
      id: l.id,
      scheduleId: l.scheduleId,
      submittedAt: l.submittedAt.toISOString(),
      status: l.status,
      revisionNumber: l.revisionNumber,
      acknowledgementId: l.acknowledgementId ?? null,
      notes: l.notes ?? null,
    })),
  );
});

function generateBlankSlots(
  scheduleId: number,
  date: string,
  capacityMw: number,
): {
  scheduleId: number;
  slotNumber: number;
  slotStart: string;
  slotEnd: string;
  forecastMw: number;
  scheduledMw: number;
  adjustmentMw: number;
  adjustmentPct: number;
  maxAllowedMw: number;
  minAllowedMw: number;
}[] {
  const slots = [];
  for (let i = 0; i < 96; i++) {
    const startMin = i * 15;
    const endMin = startMin + 15;
    const slotStart = `${date}T${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}:00+05:30`;
    const slotEnd = `${date}T${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}:00+05:30`;
    slots.push({
      scheduleId,
      slotNumber: i + 1,
      slotStart,
      slotEnd,
      forecastMw: 0,
      scheduledMw: 0,
      adjustmentMw: 0,
      adjustmentPct: ADJUSTMENT_CAP_PCT,
      maxAllowedMw: capacityMw,
      minAllowedMw: 0,
    });
  }
  return slots;
}

export default router;
