import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const meetsTable = pgTable("meets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  facility: text("facility"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postalCode: text("postal_code"),
  course: text("course").notNull().default("SCY"),
  meetType: text("meet_type").notNull().default("Standard"),
  meetStyle: text("meet_style").notNull().default("Standard"),
  meetClass: text("meet_class"),
  idFormat: text("id_format"),
  hostLsc: text("host_lsc"),
  altitude: integer("altitude"),
  entryDeadline: text("entry_deadline"),
  ageUpDate: text("age_up_date"),
  status: text("status").notNull().default("upcoming"),
  scoringRules: text("scoring_rules"),
  lanes: integer("lanes").notNull().default(8),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMeetSchema = createInsertSchema(meetsTable).omit({ id: true, createdAt: true });
export type InsertMeet = z.infer<typeof insertMeetSchema>;
export type Meet = typeof meetsTable.$inferSelect;
