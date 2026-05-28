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
  try {
    const meetId = parseInt(req.params.meetId);
    
    if (!meetId || isNaN(meetId)) {
      res.status(400).json({ error: "Invalid meet ID" });
      return;
    }

    const { eventNumber, gender, distance, stroke, eventType, heatOrder, isRelay, ageGroup, sessionId } = req.body;

    // Validate required fields
    if (eventNumber === undefined || eventNumber === null) {
      res.status(400).json({ error: "Missing required field: eventNumber" });
      return;
    }
    if (!gender) {
      res.status(400).json({ error: "Missing required field: gender" });
      return;
    }
    if (distance === undefined || distance === null) {
      res.status(400).json({ error: "Missing required field: distance" });
      return;
    }
    if (!stroke) {
      res.status(400).json({ error: "Missing required field: stroke" });
      return;
    }

    const [row] = await db.insert(eventsTable).values({
      meetId,
      eventNumber: Number(eventNumber),
      gender,
      distance: Number(distance),
      stroke,
      eventType: eventType || "standard",
      heatOrder: heatOrder || "slow_to_fast",
      isRelay: isRelay ?? false,
      ageGroup: ageGroup || undefined,
      sessionId: sessionId ? Number(sessionId) : undefined,
    }).returning();
    
    res.status(201).json({ ...row, entryCount: 0, heatCount: null });
  } catch (error: any) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: error?.message || "Failed to create event" });
  }
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
