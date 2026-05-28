import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  teamId: integer("team_id").references(() => teamsTable.id),
  date: text("date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  totalDistance: integer("total_distance"),
  course: text("course"),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workoutSetsTable = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").references(() => workoutsTable.id).notNull(),
  setOrder: integer("set_order").notNull(),
  repetitions: integer("repetitions"),
  distance: integer("distance"),
  stroke: text("stroke"),
  restInterval: text("rest_interval"),
  description: text("description").notNull(),
  intensity: text("intensity"),
});

export const insertWorkoutSchema = createInsertSchema(workoutsTable).omit({ id: true, createdAt: true });
export const insertWorkoutSetSchema = createInsertSchema(workoutSetsTable).omit({ id: true });
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type Workout = typeof workoutsTable.$inferSelect;
export type WorkoutSet = typeof workoutSetsTable.$inferSelect;
