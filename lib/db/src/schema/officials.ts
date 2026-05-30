import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { meetsTable } from "./meets";

export const officialsTable = pgTable("officials", {
  id: serial("id").primaryKey(),
  meetId: integer("meet_id").references(() => meetsTable.id).notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  lscId: text("lsc_id"),
  certification: text("certification"),
  phone: text("phone"),
  email: text("email"),
  assignedLanes: text("assigned_lanes"),
  sessionNumber: integer("session_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOfficialSchema = createInsertSchema(officialsTable).omit({ id: true, createdAt: true });
export type InsertOfficial = z.infer<typeof insertOfficialSchema>;
export type Official = typeof officialsTable.$inferSelect;
