import { Router } from "express";
import { db } from "@workspace/db";
import { relaysTable, teamsTable, athletesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function enrichRelay(relay: typeof relaysTable.$inferSelect) {
  const team = await db.select().from(teamsTable).where(eq(teamsTable.id, relay.teamId)).limit(1);
  const getLeg = async (id: number | null) => {
    if (!id) return null;
    const a = await db.select().from(athletesTable).where(eq(athletesTable.id, id)).limit(1);
    return a[0] ? `${a[0].firstName} ${a[0].lastName}` : null;
  };
  const [l1, l2, l3, l4] = await Promise.all([
    getLeg(relay.leg1AthleteId),
    getLeg(relay.leg2AthleteId),
    getLeg(relay.leg3AthleteId),
    getLeg(relay.leg4AthleteId),
  ]);
  return {
    ...relay,
    teamName: team[0]?.name ?? null,
    leg1AthleteName: l1,
    leg2AthleteName: l2,
    leg3AthleteName: l3,
    leg4AthleteName: l4,
  };
}

router.get("/events/:eventId/relays", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);
  const rows = await db.select().from(relaysTable).where(eq(relaysTable.eventId, eventId));
  const enriched = await Promise.all(rows.map(enrichRelay));
  res.json(enriched);
});

router.post("/events/:eventId/relays", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);
  const [row] = await db.insert(relaysTable).values({ ...req.body, eventId }).returning();
  const enriched = await enrichRelay(row);
  res.status(201).json(enriched);
});

router.patch("/relays/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(relaysTable).set(req.body).where(eq(relaysTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Relay not found" }); return; }
  const enriched = await enrichRelay(row);
  res.json(enriched);
});

router.delete("/relays/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(relaysTable).where(eq(relaysTable.id, id));
  res.status(204).end();
});

export default router;
