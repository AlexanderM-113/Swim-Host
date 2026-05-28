import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { meetsTable } from "./meets";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  meetId: integer("meet_id").references(() => meetsTable.id).notNull(),
  name: text("name").notNull(),
  sessionNumber: integer("session_number").notNull(),
  date: text("date"),
  startTime: text("start_time"),
  sessionType: text("session_type").notNull().default("timed_final"),
  warmupTime: text("warmup_time"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
