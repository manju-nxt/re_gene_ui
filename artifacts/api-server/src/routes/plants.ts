import { Router } from "express";
import { db } from "@workspace/db";
import { plantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetPlantParams } from "@workspace/api-zod";

const router = Router();

router.get("/plants", async (req, res) => {
  const plants = await db.select().from(plantsTable).orderBy(plantsTable.id);
  res.json(
    plants.map((p) => ({
      id: p.id,
      name: p.name,
      state: p.state,
      sldc: p.sldc,
      capacityMw: p.capacityMw,
      type: p.type,
      location: p.location ?? null,
      commissioning_date: p.commissioningDate ?? null,
    })),
  );
});

router.get("/plants/:plantId", async (req, res) => {
  const parsed = GetPlantParams.safeParse({ plantId: Number(req.params.plantId) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plant id" });
    return;
  }
  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(eq(plantsTable.id, parsed.data.plantId));
  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }
  res.json({
    id: plant.id,
    name: plant.name,
    state: plant.state,
    sldc: plant.sldc,
    capacityMw: plant.capacityMw,
    type: plant.type,
    location: plant.location ?? null,
    commissioning_date: plant.commissioningDate ?? null,
  });
});

export default router;
