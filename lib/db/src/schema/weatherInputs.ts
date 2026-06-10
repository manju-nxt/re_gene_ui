import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plantsTable } from "./plants";

export const weatherInputUploadsTable = pgTable("weather_input_uploads", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id),
  date: text("date").notNull(),           // YYYY-MM-DD
  type: text("type").notNull(),           // day_ahead | intra_day
  filename: text("filename").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  status: text("status").notNull().default("processed"), // processed | failed
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  notes: text("notes"),
});

export const insertWeatherInputUploadSchema = createInsertSchema(weatherInputUploadsTable).omit({ id: true, uploadedAt: true });
export type InsertWeatherInputUpload = z.infer<typeof insertWeatherInputUploadSchema>;
export type WeatherInputUpload = typeof weatherInputUploadsTable.$inferSelect;
