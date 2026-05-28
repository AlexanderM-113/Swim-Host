import { Router } from "express";
import { db } from "@workspace/db";
import { resultsTable, entriesTable, athletesTable, teamsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";

const router = Router();

const PLACE_POINTS: Record<number, number> = {
  1: 20, 2: 17, 3: 16, 4: 15, 5: 14,
  6: 13, 7: 12, 8: 11, 9: 9, 10: 7,
  11: 6, 12: 5, 13: 4, 14: 3, 15: 2, 16: 1,
};

router.get("/entries/:entryId/result", async (req, res): Promise<void> => {
  const entryId = parseInt(req.params.entryId);
  const rows = await db.select().from(resultsTable).where(eq(resultsTable.entryId, entryId)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Result not found" }); return; }
  const entry = await db.select().from(entriesTable).where(eq(entriesTable.id, entryId)).limit(1);
  let athleteName = null, teamName = null;
  if (entry[0]) {
    const athlete = await db.select().from(athletesTable).where(eq(athletesTable.id, entry[0].athleteId)).limit(1);
    athleteName = athlete[0] ? `${athlete[0].firstName} ${athlete[0].lastName}` : null;
    if (entry[0].teamId) {
      const team = await db.select().from(teamsTable).where(eq(teamsTable.id, entry[0].teamId)).limit(1);
      teamName = team[0]?.name ?? null;
    }
  }
  res.json({
    ...rows[0],
    athleteId: entry[0]?.athleteId ?? null,
    athleteName,
    teamName,
    heatNumber: entry[0]?.heatNumber ?? null,
    lane: entry[0]?.lane ?? null,
  });
});

router.put("/entries/:entryId/result", async (req, res): Promise<void> => {
  const entryId = parseInt(req.params.entryId);
  const entry = await db.select().from(entriesTable).where(eq(entriesTable.id, entryId)).limit(1);
  if (entry.length === 0) { res.status(404).json({ error: "Entry not found" }); return; }

  const body = req.body;
  const points = body.place ? (PLACE_POINTS[body.place] ?? 0) : (body.points ?? 0);

  const existing = await db.select().from(resultsTable).where(eq(resultsTable.entryId, entryId)).limit(1);
  let row: typeof resultsTable.$inferSelect;

  if (existing.length > 0) {
    [row] = await db.update(resultsTable).set({ ...body, points }).where(eq(resultsTable.id, existing[0].id)).returning();
  } else {
    [row] = await db.insert(resultsTable).values({ ...body, entryId, eventId: entry[0].eventId, points }).returning();
  }

  res.json({
    ...row,
    athleteId: entry[0].athleteId,
    athleteName: null,
    teamName: null,
    heatNumber: entry[0].heatNumber,
    lane: entry[0].lane,
  });
});

router.get("/events/:eventId/results", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);

  const rows = await db
    .select({
      id: resultsTable.id,
      entryId: resultsTable.entryId,
      eventId: resultsTable.eventId,
      finishTime: resultsTable.finishTime,
      place: resultsTable.place,
      points: resultsTable.points,
      dq: resultsTable.dq,
      dqCode: resultsTable.dqCode,
      ns: resultsTable.ns,
      dnf: resultsTable.dnf,
      splits: resultsTable.splits,
      athleteId: athletesTable.id,
      athleteFirstName: athletesTable.firstName,
      athleteLastName: athletesTable.lastName,
      teamName: teamsTable.name,
      heatNumber: entriesTable.heatNumber,
      lane: entriesTable.lane,
    })
    .from(resultsTable)
    .leftJoin(entriesTable, eq(resultsTable.entryId, entriesTable.id))
    .leftJoin(athletesTable, eq(entriesTable.athleteId, athletesTable.id))
    .leftJoin(teamsTable, eq(entriesTable.teamId, teamsTable.id))
    .where(eq(resultsTable.eventId, eventId))
    .orderBy(asc(resultsTable.place));

  res.json(rows.map(r => ({
    id: r.id,
    entryId: r.entryId,
    eventId: r.eventId,
    finishTime: r.finishTime,
    place: r.place,
    points: r.points,
    dq: r.dq,
    dqCode: r.dqCode,
    ns: r.ns,
    dnf: r.dnf,
    splits: r.splits,
    athleteId: r.athleteId ?? null,
    athleteName: r.athleteFirstName ? `${r.athleteFirstName} ${r.athleteLastName}` : null,
    teamName: r.teamName ?? null,
    heatNumber: r.heatNumber ?? null,
    lane: r.lane ?? null,
  })));
});

export default router;
