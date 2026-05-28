import { pgTable, text, serial, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { teamsTable } from "./teams";
import { athletesTable } from "./athletes";

export const relaysTable = pgTable("relays", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id).notNull(),
  teamId: integer("team_id").references(() => teamsTable.id).notNull(),
  seedTime: real("seed_time"),
  heatNumber: integer("heat_number"),
  lane: integer("lane"),
  scratched: boolean("scratched").notNull().default(false),
  leg1AthleteId: integer("leg1_athlete_id").references(() => athletesTable.id),
  leg2AthleteId: integer("leg2_athlete_id").references(() => athletesTable.id),
  leg3AthleteId: integer("leg3_athlete_id").references(() => athletesTable.id),
  leg4AthleteId: integer("leg4_athlete_id").references(() => athletesTable.id),
  finishTime: real("finish_time"),
  place: integer("place"),
});

export const insertRelaySchema = createInsertSchema(relaysTable).omit({ id: true });
export type InsertRelay = z.infer<typeof insertRelaySchema>;
export type Relay = typeof relaysTable.$inferSelect;
