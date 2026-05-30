import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { athletesTable } from "./athletes";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").references(() => athletesTable.id).notNull(),
  groupId: integer("group_id"),
  date: text("date").notNull(),
  present: boolean("present").notNull().default(true),
  excused: boolean("excused").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
