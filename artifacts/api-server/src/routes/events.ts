import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, entriesTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

const router = Router();

router.get("/meets/:meetId/events", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const events = await db.select().from(eventsTable).where(eq(eventsTable.meetId, meetId));

  const eventIds = events.map(e => e.id);
  let entryCounts: Record<number, number> = {};

  if (eventIds.length > 0) {
    const counts = await db
      .select({ eventId: entriesTable.eventId, cnt: count() })
      .from(entriesTable)
      .where(sql`${entriesTable.eventId} = ANY(${sql`ARRAY[${sql.join(eventIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`)
      .groupBy(entriesTable.eventId);
    entryCounts = Object.fromEntries(counts.map(c => [c.eventId, c.cnt]));
  }

  res.json(events.map(e => ({
    ...e,
    entryCount: entryCounts[e.id] ?? 0,
    heatCount: null,
  })));
});

router.post("/meets/:meetId/events", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [row] = await db.insert(eventsTable).values({ ...req.body, meetId }).returning();
  res.status(201).json({ ...row, entryCount: 0, heatCount: null });
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Event not found" }); return; }
  const cnt = await db.select({ cnt: count() }).from(entriesTable).where(eq(entriesTable.eventId, id));
  res.json({ ...rows[0], entryCount: cnt[0].cnt, heatCount: null });
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(eventsTable).set(req.body).where(eq(eventsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Event not found" }); return; }
  const cnt = await db.select({ cnt: count() }).from(entriesTable).where(eq(entriesTable.eventId, id));
  res.json({ ...row, entryCount: cnt[0].cnt, heatCount: null });
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  res.status(204).end();
});

export default router;
