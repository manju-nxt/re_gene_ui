import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plantsTable } from "./plants";

export const forecastRunsTable = pgTable("forecast_runs", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id),
  type: text("type").notNull(), // day_ahead | intra_day
  targetDate: text("target_date").notNull(), // YYYY-MM-DD
  runAt: timestamp("run_at").defaultNow().notNull(),
  totalForecastMwh: real("total_forecast_mwh").notNull().default(0),
  status: text("status").notNull().default("available"), // available | superseded
  revisionNumber: integer("revision_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const forecastSlotsTable = pgTable("forecast_slots", {
  id: serial("id").primaryKey(),
  forecastRunId: integer("forecast_run_id").notNull().references(() => forecastRunsTable.id),
  slotNumber: integer("slot_number").notNull(), // 1–96
  slotStart: text("slot_start").notNull(), // ISO datetime string
  slotEnd: text("slot_end").notNull(),
  forecastMw: real("forecast_mw").notNull(),
  lowerBoundMw: real("lower_bound_mw").notNull(),
  upperBoundMw: real("upper_bound_mw").notNull(),
  irradianceForecast: real("irradiance_forecast"),
  // Model input parameters (populated from uploaded weather data or API lookups)
  temperature: real("temperature"),        // Ambient temperature °C
  moduleTemperature: real("module_temperature"), // Module surface temperature °C
  humidity: real("humidity"),              // Relative humidity %
  // Post-hoc actuals recorded after the block elapses
  actualMw: real("actual_mw"),             // Actual generation MW (null until block has passed)
});

export const insertForecastRunSchema = createInsertSchema(forecastRunsTable).omit({ id: true, createdAt: true });
export type InsertForecastRun = z.infer<typeof insertForecastRunSchema>;
export type ForecastRun = typeof forecastRunsTable.$inferSelect;

export const insertForecastSlotSchema = createInsertSchema(forecastSlotsTable).omit({ id: true });
export type InsertForecastSlot = z.infer<typeof insertForecastSlotSchema>;
export type ForecastSlot = typeof forecastSlotsTable.$inferSelect;
