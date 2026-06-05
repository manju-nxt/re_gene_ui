import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plantsTable } from "./plants";
import { forecastRunsTable } from "./forecasts";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id),
  forecastId: integer("forecast_id").references(() => forecastRunsTable.id),
  date: text("date").notNull(), // YYYY-MM-DD
  type: text("type").notNull(), // day_ahead | intra_day
  status: text("status").notNull().default("draft"), // draft | submitted | revised
  revisionNumber: integer("revision_number").notNull().default(1),
  totalScheduledMwh: real("total_scheduled_mwh").notNull().default(0),
  totalForecastMwh: real("total_forecast_mwh").notNull().default(0),
  deadlineAt: text("deadline_at"),
  lastSubmittedAt: text("last_submitted_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scheduleSlotsTable = pgTable("schedule_slots", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull().references(() => schedulesTable.id),
  slotNumber: integer("slot_number").notNull(), // 1–96
  slotStart: text("slot_start").notNull(),
  slotEnd: text("slot_end").notNull(),
  forecastMw: real("forecast_mw").notNull(),
  scheduledMw: real("scheduled_mw").notNull(),
  adjustmentMw: real("adjustment_mw").notNull().default(0),
  adjustmentPct: real("adjustment_pct").notNull().default(15),
  maxAllowedMw: real("max_allowed_mw").notNull(),
  minAllowedMw: real("min_allowed_mw").notNull(),
});

export const submissionLogsTable = pgTable("submission_logs", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull().references(() => schedulesTable.id),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  status: text("status").notNull(), // success | failed | pending
  revisionNumber: integer("revision_number").notNull().default(1),
  acknowledgementId: text("acknowledgement_id"),
  notes: text("notes"),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;

export const insertScheduleSlotSchema = createInsertSchema(scheduleSlotsTable).omit({ id: true });
export type InsertScheduleSlot = z.infer<typeof insertScheduleSlotSchema>;
export type ScheduleSlot = typeof scheduleSlotsTable.$inferSelect;

export const insertSubmissionLogSchema = createInsertSchema(submissionLogsTable).omit({ id: true });
export type InsertSubmissionLog = z.infer<typeof insertSubmissionLogSchema>;
export type SubmissionLog = typeof submissionLogsTable.$inferSelect;
