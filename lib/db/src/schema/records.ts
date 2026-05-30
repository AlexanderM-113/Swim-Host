import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clubRecordsTable = pgTable("club_records", {
  id: serial("id").primaryKey(),
  stroke: text("stroke").notNull(),
  distance: integer("distance").notNull(),
  course: text("course").notNull(),
  gender: text("gender").notNull(),
  ageGroup: text("age_group").notNull(),
  recordTime: real("record_time").notNull(),
  athleteName: text("athlete_name").notNull(),
  athleteId: integer("athlete_id"),
  teamId: integer("team_id"),
  teamName: text("team_name"),
  meetName: text("meet_name"),
  meetDate: text("meet_date"),
  recordType: text("record_type").notNull().default("Club"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClubRecordSchema = createInsertSchema(clubRecordsTable).omit({ id: true, createdAt: true });
export type InsertClubRecord = z.infer<typeof insertClubRecordSchema>;
export type ClubRecord = typeof clubRecordsTable.$inferSelect;
