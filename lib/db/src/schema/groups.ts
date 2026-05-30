import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { athletesTable } from "./athletes";

export const athleteGroupsTable = pgTable("athlete_groups", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teamsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  coachName: text("coach_name"),
  level: text("level"),
  practiceSchedule: text("practice_schedule"),
  minimumAge: integer("minimum_age"),
  maximumAge: integer("maximum_age"),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembershipsTable = pgTable("group_memberships", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => athleteGroupsTable.id).notNull(),
  athleteId: integer("athlete_id").references(() => athletesTable.id).notNull(),
  joinedDate: text("joined_date"),
  notes: text("notes"),
});

export const insertAthleteGroupSchema = createInsertSchema(athleteGroupsTable).omit({ id: true, createdAt: true });
export const insertGroupMembershipSchema = createInsertSchema(groupMembershipsTable).omit({ id: true });
export type InsertAthleteGroup = z.infer<typeof insertAthleteGroupSchema>;
export type InsertGroupMembership = z.infer<typeof insertGroupMembershipSchema>;
export type AthleteGroup = typeof athleteGroupsTable.$inferSelect;
export type GroupMembership = typeof groupMembershipsTable.$inferSelect;
