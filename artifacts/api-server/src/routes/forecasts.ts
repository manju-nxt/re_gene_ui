import { Router } from "express";
import { db } from "@workspace/db";
import {
  forecastRunsTable,
  forecastSlotsTable,
  plantsTable,
  schedulesTable,
  scheduleSlotsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  ListForecastsQueryParams,
  GetForecastParams,
  GetDayAheadForecastQueryParams,
  GetIntraDayForecastQueryParams,
} from "@workspace/api-zod";

const router = Router();

function formatRun(run: typeof forecastRunsTable.$inferSelect, plantName: string) {
  return {
    id: run.id,
    plantId: run.plantId,
    plantName,
    type: run.type,
    targetDate: run.targetDate,
    runAt: run.runAt.toISOString(),
    totalForecastMwh: run.totalForecastMwh,
    status: run.status,
    revisionNumber: run.revisionNumber ?? null,
  };
}

function formatSlot(
  slot: typeof forecastSlotsTable.$inferSelect,
  scheduledMw: number | null = null,
) {
  return {
    id: slot.id,
    slotNumber: slot.slotNumber,
    slotStart: slot.slotStart,
    slotEnd: slot.slotEnd,
    forecastMw: slot.forecastMw,
    lowerBoundMw: slot.lowerBoundMw,
    upperBoundMw: slot.upperBoundMw,
    irradianceForecast: slot.irradianceForecast ?? null,
    temperature: slot.temperature ?? null,
    moduleTemperature: slot.moduleTemperature ?? null,
    humidity: slot.humidity ?? null,
    actualMw: slot.actualMw ?? null,
    scheduledMw,
  };
}

/** Build slotNumber→scheduledMw map for the latest schedule of a plant+date+type */
async function getScheduleSlotMap(
  plantId: number,
  date: string,
  type: string,
): Promise<Record<number, number>> {
  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(
      and(
        eq(schedulesTable.plantId, plantId),
        eq(schedulesTable.date, date),
        eq(schedulesTable.type, type),
      ),
    )
    .orderBy(desc(schedulesTable.updatedAt))
    .limit(1);

  if (!schedule) return {};

  const sslots = await db
    .select()
    .from(scheduleSlotsTable)
    .where(eq(scheduleSlotsTable.scheduleId, schedule.id));

  return Object.fromEntries(sslots.map((ss) => [ss.slotNumber, ss.scheduledMw]));
}

router.get("/forecasts", async (req, res) => {
  const parsed = ListForecastsQueryParams.safeParse({
    plantId: req.query.plantId ? Number(req.query.plantId) : undefined,
    type: req.query.type,
    date: req.query.date,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { plantId, type, date } = parsed.data;

  const runs = await db.select().from(forecastRunsTable).orderBy(desc(forecastRunsTable.runAt));
  const plants = await db.select().from(plantsTable);
  const plantMap = Object.fromEntries(plants.map((p) => [p.id, p.name]));

  const filtered = runs.filter((r) => {
    if (plantId !== undefined && plantId !== null && r.plantId !== plantId) return false;
    if (type && r.type !== type) return false;
    if (date && r.targetDate !== date) return false;
    return true;
  });

  res.json(filtered.map((r) => formatRun(r, plantMap[r.plantId] ?? "Unknown")));
});

router.get("/forecasts/day-ahead", async (req, res) => {
  const parsed = GetDayAheadForecastQueryParams.safeParse({
    plantId: Number(req.query.plantId),
    date: req.query.date,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { plantId, date } = parsed.data;
  const targetDate = date ?? getTomorrow();

  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, plantId));
  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const [run] = await db
    .select()
    .from(forecastRunsTable)
    .where(
      and(
        eq(forecastRunsTable.plantId, plantId),
        eq(forecastRunsTable.type, "day_ahead"),
        eq(forecastRunsTable.targetDate, targetDate),
        eq(forecastRunsTable.status, "available"),
      ),
    )
    .orderBy(desc(forecastRunsTable.runAt))
    .limit(1);

  if (!run) {
    res.status(404).json({ error: "No day-ahead forecast available" });
    return;
  }

  const [slots, scheduleMap] = await Promise.all([
    db
      .select()
      .from(forecastSlotsTable)
      .where(eq(forecastSlotsTable.forecastRunId, run.id))
      .orderBy(forecastSlotsTable.slotNumber),
    getScheduleSlotMap(plantId, targetDate, "day_ahead"),
  ]);

  res.json({
    forecast: formatRun(run, plant.name),
    slots: slots.map((s) => formatSlot(s, scheduleMap[s.slotNumber] ?? null)),
  });
});

router.get("/forecasts/intra-day", async (req, res) => {
  const parsed = GetIntraDayForecastQueryParams.safeParse({
    plantId: Number(req.query.plantId),
    date: req.query.date,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { plantId, date } = parsed.data;
  const targetDate = date ?? getToday();

  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, plantId));
  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const [run] = await db
    .select()
    .from(forecastRunsTable)
    .where(
      and(
        eq(forecastRunsTable.plantId, plantId),
        eq(forecastRunsTable.type, "intra_day"),
        eq(forecastRunsTable.targetDate, targetDate),
        eq(forecastRunsTable.status, "available"),
      ),
    )
    .orderBy(desc(forecastRunsTable.runAt))
    .limit(1);

  if (!run) {
    res.status(404).json({ error: "No intra-day forecast available" });
    return;
  }

  const [slots, scheduleMap] = await Promise.all([
    db
      .select()
      .from(forecastSlotsTable)
      .where(eq(forecastSlotsTable.forecastRunId, run.id))
      .orderBy(forecastSlotsTable.slotNumber),
    getScheduleSlotMap(plantId, targetDate, "intra_day"),
  ]);

  res.json({
    forecast: formatRun(run, plant.name),
    slots: slots.map((s) => formatSlot(s, scheduleMap[s.slotNumber] ?? null)),
  });
});

router.get("/forecasts/:forecastId", async (req, res) => {
  const parsed = GetForecastParams.safeParse({ forecastId: Number(req.params.forecastId) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid forecast id" });
    return;
  }
  const [run] = await db
    .select()
    .from(forecastRunsTable)
    .where(eq(forecastRunsTable.id, parsed.data.forecastId));
  if (!run) {
    res.status(404).json({ error: "Forecast not found" });
    return;
  }
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, run.plantId));
  const slots = await db
    .select()
    .from(forecastSlotsTable)
    .where(eq(forecastSlotsTable.forecastRunId, run.id))
    .orderBy(forecastSlotsTable.slotNumber);

  res.json({
    forecast: formatRun(run, plant?.name ?? "Unknown"),
    slots: slots.map((s) => formatSlot(s)),
  });
});

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default router;
