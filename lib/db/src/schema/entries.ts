import { pgTable, text, serial, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { athletesTable } from "./athletes";
import { teamsTable } from "./teams";

export const entriesTable = pgTable("entries", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id).notNull(),
  athleteId: integer("athlete_id").references(() => athletesTable.id).notNull(),
  teamId: integer("team_id").references(() => teamsTable.id),
  seedTime: real("seed_time"),
  seedCourse: text("seed_course"),
  heatNumber: integer("heat_number"),
  lane: integer("lane"),
  scratched: boolean("scratched").notNull().default(false),
  scratchedReason: text("scratched_reason"),
});

export const insertEntrySchema = createInsertSchema(entriesTable).omit({ id: true });
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entriesTable.$inferSelect;
