import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { meetsTable } from "./meets";
import { sessionsTable } from "./sessions";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  meetId: integer("meet_id").references(() => meetsTable.id).notNull(),
  sessionId: integer("session_id").references(() => sessionsTable.id),
  eventNumber: integer("event_number").notNull(),
  gender: text("gender").notNull(),
  ageGroup: text("age_group"),
  distance: integer("distance").notNull(),
  stroke: text("stroke").notNull(),
  eventType: text("event_type").notNull().default("standard"),
  heatOrder: text("heat_order").notNull().default("slow_to_fast"),
  isRelay: boolean("is_relay").notNull().default(false),
  status: text("status").notNull().default("pending"),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
