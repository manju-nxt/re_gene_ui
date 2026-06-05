import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plantsTable = pgTable("plants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  sldc: text("sldc").notNull(),
  capacityMw: real("capacity_mw").notNull(),
  type: text("type").notNull().default("solar"),
  location: text("location"),
  commissioningDate: text("commissioning_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlantSchema = createInsertSchema(plantsTable).omit({ id: true, createdAt: true });
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plantsTable.$inferSelect;
