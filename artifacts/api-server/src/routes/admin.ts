import { Router } from "express";
import { db } from "@workspace/db";
import {
  weatherInputUploadsTable,
  forecastRunsTable,
  forecastSlotsTable,
  plantsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { ListWeatherInputUploadsQueryParams, UploadWeatherInputsBody } from "@workspace/api-zod";

const router = Router();

router.get("/admin/weather-inputs", async (req, res) => {
  const parsed = ListWeatherInputUploadsQueryParams.safeParse({
    plantId: req.query.plantId ? Number(req.query.plantId) : undefined,
    date: req.query.date,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const uploads = await db
    .select()
    .from(weatherInputUploadsTable)
    .orderBy(desc(weatherInputUploadsTable.uploadedAt));

  const { plantId, date } = parsed.data;
  const filtered = uploads.filter((u) => {
    if (plantId !== undefined && plantId !== null && u.plantId !== plantId) return false;
    if (date && u.date !== date) return false;
    return true;
  });

  res.json(
    filtered.map((u) => ({
      id: u.id,
      plantId: u.plantId,
      date: u.date,
      type: u.type,
      filename: u.filename,
      rowCount: u.rowCount,
      status: u.status,
      uploadedAt: u.uploadedAt.toISOString(),
      notes: u.notes ?? null,
    })),
  );
});

router.post("/admin/weather-inputs/upload", async (req, res) => {
  const parsed = UploadWeatherInputsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  const { plantId, date, type, filename, rows } = parsed.data;

  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, plantId));
  if (!plant) {
    res.status(400).json({ error: "Plant not found" });
    return;
  }

  // Find all forecast runs for this plant + date + type
  const runs = await db
    .select()
    .from(forecastRunsTable)
    .where(
      and(
        eq(forecastRunsTable.plantId, plantId),
        eq(forecastRunsTable.targetDate, date),
        eq(forecastRunsTable.type, type),
      ),
    );

  let updatedSlots = 0;

  for (const run of runs) {
    for (const row of rows) {
      const result = await db
        .update(forecastSlotsTable)
        .set({
          irradianceForecast: row.irradianceGhi ?? undefined,
          temperature: row.temperature ?? undefined,
          moduleTemperature: row.moduleTemperature ?? undefined,
          humidity: row.humidity ?? undefined,
        })
        .where(
          and(
            eq(forecastSlotsTable.forecastRunId, run.id),
            eq(forecastSlotsTable.slotNumber, row.slotNumber),
          ),
        );
      updatedSlots++;
    }
  }

  const [upload] = await db
    .insert(weatherInputUploadsTable)
    .values({
      plantId,
      date,
      type,
      filename,
      rowCount: rows.length,
      status: "processed",
      notes: `Updated ${updatedSlots} slot(s) across ${runs.length} forecast run(s)`,
    })
    .returning();

  res.json({
    id: upload!.id,
    plantId: upload!.plantId,
    date: upload!.date,
    type: upload!.type,
    filename: upload!.filename,
    rowCount: upload!.rowCount,
    status: upload!.status,
    uploadedAt: upload!.uploadedAt.toISOString(),
    notes: upload!.notes ?? null,
  });
});

export default router;
