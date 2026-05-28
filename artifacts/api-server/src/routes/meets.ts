import { Router } from "express";
import { db } from "@workspace/db";
import { meetsTable, eventsTable, entriesTable, teamsTable, resultsTable } from "@workspace/db";
import { eq, count, and, sql } from "drizzle-orm";

const router = Router();

router.get("/meets", async (req, res): Promise<void> => {
  const { status } = req.query as Record<string, string>;
  const rows = status
    ? await db.select().from(meetsTable).where(eq(meetsTable.status, status))
    : await db.select().from(meetsTable);
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/meets", async (req, res): Promise<void> => {
  const [row] = await db.insert(meetsTable).values(req.body).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/meets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(meetsTable).where(eq(meetsTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Meet not found" }); return; }
  res.json({ ...rows[0], createdAt: rows[0].createdAt.toISOString() });
});

router.patch("/meets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(meetsTable).set(req.body).where(eq(meetsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Meet not found" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/meets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(meetsTable).where(eq(meetsTable.id, id));
  res.status(204).end();
});

router.get("/meets/:id/summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const events = await db.select().from(eventsTable).where(eq(eventsTable.meetId, id));
  const eventIds = events.map(e => e.id);
  
  let totalEntries = 0;
  const athleteIds = new Set<number>();
  const teamIds = new Set<number>();

  if (eventIds.length > 0) {
    const entries = await db.select().from(entriesTable).where(
      sql`${entriesTable.eventId} = ANY(${sql`ARRAY[${sql.join(eventIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`
    );
    totalEntries = entries.length;
    entries.forEach(e => {
      athleteIds.add(e.athleteId);
      if (e.teamId) teamIds.add(e.teamId);
    });
  }

  const completed = events.filter(e => e.status === "completed").length;

  res.json({
    meetId: id,
    totalAthletes: athleteIds.size,
    totalEvents: events.length,
    totalEntries,
    totalTeams: teamIds.size,
    completedEvents: completed,
    pendingEvents: events.length - completed,
    totalHeats: 0,
  });
});

router.get("/meets/:id/team-scores", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const events = await db.select().from(eventsTable).where(eq(eventsTable.meetId, id));
  const eventIds = events.map(e => e.id);

  if (eventIds.length === 0) {
    res.json([]);
    return;
  }

  const entries = await db.select().from(entriesTable).where(
    sql`${entriesTable.eventId} = ANY(${sql`ARRAY[${sql.join(eventIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`
  );
  const entryIds = entries.map(e => e.id);

  const scoreMap: Record<number, { teamId: number; points: number }> = {};

  if (entryIds.length > 0) {
    const results = await db.select().from(resultsTable).where(
      sql`${resultsTable.entryId} = ANY(${sql`ARRAY[${sql.join(entryIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`
    );

    for (const result of results) {
      const entry = entries.find(e => e.id === result.entryId);
      if (!entry?.teamId || !result.points) continue;
      if (!scoreMap[entry.teamId]) scoreMap[entry.teamId] = { teamId: entry.teamId, points: 0 };
      scoreMap[entry.teamId].points += result.points;
    }
  }

  const teams = await db.select().from(teamsTable);
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const scores = Object.values(scoreMap)
    .sort((a, b) => b.points - a.points)
    .map((s, i) => ({
      teamId: s.teamId,
      teamName: teamMap[s.teamId]?.name ?? "Unknown",
      teamAbbreviation: teamMap[s.teamId]?.abbreviation ?? null,
      points: s.points,
      place: i + 1,
    }));

  res.json(scores);
});

export default router;
