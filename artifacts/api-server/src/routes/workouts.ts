import { Router } from "express";
import { db } from "@workspace/db";
import { workoutsTable, workoutSetsTable, teamsTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";

const router = Router();

async function enrichWorkout(workout: typeof workoutsTable.$inferSelect) {
  const sets = await db.select().from(workoutSetsTable).where(eq(workoutSetsTable.workoutId, workout.id));
  const team = workout.teamId ? await db.select().from(teamsTable).where(eq(teamsTable.id, workout.teamId)).limit(1) : [];
  return {
    ...workout,
    teamName: team[0]?.name ?? null,
    sets: sets.sort((a, b) => a.setOrder - b.setOrder),
    createdAt: workout.createdAt.toISOString(),
  };
}

router.get("/workouts", async (req, res): Promise<void> => {
  const { teamId, search } = req.query as Record<string, string>;
  const conditions = [];
  if (teamId) conditions.push(eq(workoutsTable.teamId, parseInt(teamId)));
  if (search) conditions.push(sql`${workoutsTable.title} ILIKE ${"%" + search + "%"}`);

  const rows = conditions.length > 0
    ? await db.select().from(workoutsTable).where(and(...conditions))
    : await db.select().from(workoutsTable);

  const enriched = await Promise.all(rows.map(enrichWorkout));
  res.json(enriched);
});

router.post("/workouts", async (req, res): Promise<void> => {
  const { sets, ...workoutData } = req.body;
  const [workout] = await db.insert(workoutsTable).values(workoutData).returning();

  if (sets && Array.isArray(sets)) {
    for (const s of sets) {
      await db.insert(workoutSetsTable).values({ ...s, workoutId: workout.id });
    }
  }

  const enriched = await enrichWorkout(workout);
  res.status(201).json(enriched);
});

router.get("/workouts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(workoutsTable).where(eq(workoutsTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Workout not found" }); return; }
  const enriched = await enrichWorkout(rows[0]);
  res.json(enriched);
});

router.patch("/workouts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { sets, ...workoutData } = req.body;
  const [row] = await db.update(workoutsTable).set(workoutData).where(eq(workoutsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Workout not found" }); return; }
  const enriched = await enrichWorkout(row);
  res.json(enriched);
});

router.delete("/workouts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(workoutSetsTable).where(eq(workoutSetsTable.workoutId, id));
  await db.delete(workoutsTable).where(eq(workoutsTable.id, id));
  res.status(204).end();
});

export default router;
