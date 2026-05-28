import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timeStandardSetsTable = pgTable("time_standard_sets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  course: text("course"),
  gender: text("gender"),
  ageGroup: text("age_group"),
});

export const timeStandardsTable = pgTable("time_standards", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").references(() => timeStandardSetsTable.id).notNull(),
  label: text("label").notNull(),
  distance: integer("distance").notNull(),
  stroke: text("stroke").notNull(),
  gender: text("gender"),
  ageGroup: text("age_group"),
  time: real("time").notNull(),
});

export const insertTimeStandardSetSchema = createInsertSchema(timeStandardSetsTable).omit({ id: true });
export const insertTimeStandardSchema = createInsertSchema(timeStandardsTable).omit({ id: true });
export type InsertTimeStandardSet = z.infer<typeof insertTimeStandardSetSchema>;
export type InsertTimeStandard = z.infer<typeof insertTimeStandardSchema>;
export type TimeStandardSet = typeof timeStandardSetsTable.$inferSelect;
export type TimeStandard = typeof timeStandardsTable.$inferSelect;
