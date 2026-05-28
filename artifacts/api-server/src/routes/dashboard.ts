import { Router } from "express";
import { db } from "@workspace/db";
import { athletesTable, teamsTable, meetsTable, workoutsTable, invoicesTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [athletes, teams, meets, workouts, invoices] = await Promise.all([
    db.select({ cnt: count() }).from(athletesTable),
    db.select({ cnt: count() }).from(teamsTable),
    db.select().from(meetsTable),
    db.select({ cnt: count() }).from(workoutsTable),
    db.select().from(invoicesTable),
  ]);

  const activeMeets = meets.filter(m => m.status === "active").length;
  const upcomingMeets = meets.filter(m => m.status === "upcoming").length;
  const outstanding = invoices.filter(i => i.status === "pending" || i.status === "overdue");
  const outstandingAmount = outstanding.reduce((s, i) => s + i.amount, 0);

  res.json({
    totalAthletes: athletes[0].cnt,
    totalTeams: teams[0].cnt,
    totalMeets: meets.length,
    activeMeets,
    upcomingMeets,
    totalWorkouts: workouts[0].cnt,
    outstandingBilling: outstandingAmount,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const [recentMeets, recentAthletes, recentWorkouts] = await Promise.all([
    db.select().from(meetsTable).orderBy(meetsTable.createdAt).limit(5),
    db.select().from(athletesTable).orderBy(athletesTable.createdAt).limit(5),
    db.select().from(workoutsTable).orderBy(workoutsTable.createdAt).limit(5),
  ]);

  const activities: {
    id: string; type: string; description: string; timestamp: string;
    entityId: number | null; entityName: string | null;
  }[] = [];

  for (const m of recentMeets) {
    activities.push({
      id: `meet-${m.id}`,
      type: "meet",
      description: `Meet "${m.name}" created`,
      timestamp: m.createdAt.toISOString(),
      entityId: m.id,
      entityName: m.name,
    });
  }
  for (const a of recentAthletes) {
    activities.push({
      id: `athlete-${a.id}`,
      type: "athlete",
      description: `Athlete ${a.firstName} ${a.lastName} registered`,
      timestamp: a.createdAt.toISOString(),
      entityId: a.id,
      entityName: `${a.firstName} ${a.lastName}`,
    });
  }
  for (const w of recentWorkouts) {
    activities.push({
      id: `workout-${w.id}`,
      type: "workout",
      description: `Workout "${w.title}" created`,
      timestamp: w.createdAt.toISOString(),
      entityId: w.id,
      entityName: w.title,
    });
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(activities.slice(0, 15));
});

export default router;
