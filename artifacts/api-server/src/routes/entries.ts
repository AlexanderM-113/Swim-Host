import { Router } from "express";
import { db } from "@workspace/db";
import { entriesTable, athletesTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function enrichEntry(entry: typeof entriesTable.$inferSelect) {
  const athlete = await db.select().from(athletesTable).where(eq(athletesTable.id, entry.athleteId)).limit(1);
  const team = entry.teamId ? await db.select().from(teamsTable).where(eq(teamsTable.id, entry.teamId)).limit(1) : [];
  return {
    ...entry,
    athleteName: athlete[0] ? `${athlete[0].firstName} ${athlete[0].lastName}` : null,
    teamName: team[0]?.name ?? null,
  };
}

router.get("/events/:eventId/entries", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);
  const rows = await db
    .select({
      id: entriesTable.id,
      eventId: entriesTable.eventId,
      athleteId: entriesTable.athleteId,
      teamId: entriesTable.teamId,
      seedTime: entriesTable.seedTime,
      seedCourse: entriesTable.seedCourse,
      heatNumber: entriesTable.heatNumber,
      lane: entriesTable.lane,
      scratched: entriesTable.scratched,
      scratchedReason: entriesTable.scratchedReason,
      athleteFirstName: athletesTable.firstName,
      athleteLastName: athletesTable.lastName,
      teamName: teamsTable.name,
    })
    .from(entriesTable)
    .leftJoin(athletesTable, eq(entriesTable.athleteId, athletesTable.id))
    .leftJoin(teamsTable, eq(entriesTable.teamId, teamsTable.id))
    .where(eq(entriesTable.eventId, eventId));

  res.json(rows.map(r => ({
    id: r.id,
    eventId: r.eventId,
    athleteId: r.athleteId,
    teamId: r.teamId,
    seedTime: r.seedTime,
    seedCourse: r.seedCourse,
    heatNumber: r.heatNumber,
    lane: r.lane,
    scratched: r.scratched,
    scratchedReason: r.scratchedReason,
    athleteName: r.athleteFirstName ? `${r.athleteFirstName} ${r.athleteLastName}` : null,
    teamName: r.teamName,
  })));
});

router.post("/events/:eventId/entries", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);
  const [row] = await db.insert(entriesTable).values({ ...req.body, eventId }).returning();
  const enriched = await enrichEntry(row);
  res.status(201).json(enriched);
});

router.patch("/entries/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(entriesTable).set(req.body).where(eq(entriesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
  const enriched = await enrichEntry(row);
  res.json(enriched);
});

router.delete("/entries/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(entriesTable).where(eq(entriesTable.id, id));
  res.status(204).end();
});

export default router;
