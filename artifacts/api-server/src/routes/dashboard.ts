import { Router } from "express";
import { db } from "@workspace/db";
import {
  plantsTable,
  schedulesTable,
  forecastRunsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

router.get("/dashboard/summary", async (_req, res) => {
  const today = getToday();
  const tomorrow = getTomorrow();

  const plants = await db.select().from(plantsTable);
  const totalCapacityMw = plants.reduce((sum, p) => sum + p.capacityMw, 0);

  const todayForecasts = await db
    .select()
    .from(forecastRunsTable)
    .where(
      and(
        eq(forecastRunsTable.targetDate, today),
        eq(forecastRunsTable.type, "intra_day"),
        eq(forecastRunsTable.status, "available"),
      ),
    );
  const todayForecastMwh = todayForecasts.reduce((sum, f) => sum + f.totalForecastMwh, 0);

  const todaySchedules = await db
    .select()
    .from(schedulesTable)
    .where(eq(schedulesTable.date, today));

  const pendingSchedules = todaySchedules.filter((s) => s.status === "draft").length;
  const submittedSchedules = todaySchedules.filter(
    (s) => s.status === "submitted" || s.status === "revised",
  ).length;

  // Plants with no schedule today
  const plantsWithSchedule = new Set(todaySchedules.map((s) => s.plantId));
  const alertCount = plants.filter((p) => !plantsWithSchedule.has(p.id)).length;

  // Next day-ahead submission deadline: 10:00 AM IST tomorrow
  const dayAheadSubmissionDeadline = `${tomorrow}T10:00:00+05:30`;

  // Mock 7-day forecast accuracy (would be computed from actual vs forecast)
  const forecastAccuracyPct = 91.4;

  res.json({
    totalPlants: plants.length,
    totalCapacityMw,
    todayForecastMwh,
    pendingSchedules,
    submittedSchedules,
    alertCount,
    dayAheadSubmissionDeadline,
    forecastAccuracyPct,
  });
});

router.get("/dashboard/portfolio", async (_req, res) => {
  const today = getToday();

  const plants = await db.select().from(plantsTable);

  const todayForecasts = await db
    .select()
    .from(forecastRunsTable)
    .where(
      and(
        eq(forecastRunsTable.targetDate, today),
        eq(forecastRunsTable.status, "available"),
      ),
    )
    .orderBy(desc(forecastRunsTable.runAt));

  const todaySchedules = await db
    .select()
    .from(schedulesTable)
    .where(eq(schedulesTable.date, today))
    .orderBy(desc(schedulesTable.updatedAt));

  // Build per-plant status
  const result = plants.map((plant) => {
    // Latest intra-day forecast for today
    const forecast = todayForecasts.find(
      (f) => f.plantId === plant.id && f.type === "intra_day",
    ) ?? todayForecasts.find((f) => f.plantId === plant.id && f.type === "day_ahead");
    const todayForecastMwh = forecast?.totalForecastMwh ?? 0;

    // Latest schedule
    const schedule = todaySchedules.find((s) => s.plantId === plant.id);
    const scheduleStatus = schedule
      ? (schedule.status as "draft" | "submitted" | "revised")
      : ("not_started" as const);

    // Mock forecast accuracy per plant
    const forecastAccuracyPct = 88 + Math.round(plant.id * 1.3) % 10;

    return {
      plantId: plant.id,
      plantName: plant.name,
      capacityMw: plant.capacityMw,
      state: plant.state,
      sldc: plant.sldc,
      todayForecastMwh,
      scheduleStatus,
      lastSubmittedAt: schedule?.lastSubmittedAt ?? null,
      revisionNumber: schedule?.revisionNumber ?? 0,
      forecastAccuracyPct,
    };
  });

  res.json(result);
});

export default router;
