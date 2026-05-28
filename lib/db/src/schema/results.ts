import { pgTable, text, serial, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entriesTable } from "./entries";
import { eventsTable } from "./events";

export const resultsTable = pgTable("results", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").references(() => entriesTable.id).notNull().unique(),
  eventId: integer("event_id").references(() => eventsTable.id).notNull(),
  finishTime: real("finish_time"),
  place: integer("place"),
  points: real("points"),
  dq: boolean("dq").notNull().default(false),
  dqCode: text("dq_code"),
  ns: boolean("ns").notNull().default(false),
  dnf: boolean("dnf").notNull().default(false),
  splits: text("splits"),
});

export const insertResultSchema = createInsertSchema(resultsTable).omit({ id: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof resultsTable.$inferSelect;
