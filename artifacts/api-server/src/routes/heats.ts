import { Router } from "express";
import { db } from "@workspace/db";
import { entriesTable, athletesTable, teamsTable, resultsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";

const router = Router();

router.get("/events/:eventId/heats", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);

  const entries = await db
    .select({
      id: entriesTable.id,
      athleteId: entriesTable.athleteId,
      teamId: entriesTable.teamId,
      seedTime: entriesTable.seedTime,
      heatNumber: entriesTable.heatNumber,
      lane: entriesTable.lane,
      scratched: entriesTable.scratched,
      athleteFirstName: athletesTable.firstName,
      athleteLastName: athletesTable.lastName,
      teamName: teamsTable.name,
    })
    .from(entriesTable)
    .leftJoin(athletesTable, eq(entriesTable.athleteId, athletesTable.id))
    .leftJoin(teamsTable, eq(entriesTable.teamId, teamsTable.id))
    .where(eq(entriesTable.eventId, eventId))
    .orderBy(asc(entriesTable.heatNumber), asc(entriesTable.lane));

  const entryIds = entries.map(e => e.id);
  let resultsMap: Record<number, typeof resultsTable.$inferSelect> = {};
  if (entryIds.length > 0) {
    const results = await db.select().from(resultsTable).where(
      sql`${resultsTable.entryId} = ANY(${sql`ARRAY[${sql.join(entryIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`
    );
    resultsMap = Object.fromEntries(results.map(r => [r.entryId, r]));
  }

  const heatMap: Record<number, { heatNumber: number; lanes: unknown[] }> = {};
  for (const e of entries) {
    if (e.heatNumber == null || e.lane == null) continue;
    if (!heatMap[e.heatNumber]) {
      heatMap[e.heatNumber] = { heatNumber: e.heatNumber, lanes: [] };
    }
    const result = resultsMap[e.id];
    heatMap[e.heatNumber].lanes.push({
      lane: e.lane,
      entryId: e.id,
      athleteId: e.athleteId,
      athleteName: e.athleteFirstName ? `${e.athleteFirstName} ${e.athleteLastName}` : null,
      teamName: e.teamName,
      seedTime: e.seedTime,
      finishTime: result?.finishTime ?? null,
      place: result?.place ?? null,
      dq: result?.dq ?? false,
      ns: result?.ns ?? false,
      dnf: result?.dnf ?? false,
    });
  }

  const heats = Object.values(heatMap)
    .sort((a, b) => a.heatNumber - b.heatNumber)
    .map((h, i) => ({ id: i + 1, eventId, heatNumber: h.heatNumber, status: "pending", lanes: h.lanes }));

  res.json(heats);
});

router.post("/events/:eventId/heats", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId);
  const { lanes = 8, heatOrder = "slow_to_fast", circleSeeding = true } = req.body;

  const entries = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.eventId, eventId));

  const active = entries.filter(e => !e.scratched);
  active.sort((a, b) => {
    const at = a.seedTime ?? 99999;
    const bt = b.seedTime ?? 99999;
    return heatOrder === "slow_to_fast" ? bt - at : at - bt;
  });

  const numLanes = Number(lanes);
  const laneOrder = circleSeeding
    ? getLaneOrder(numLanes)
    : Array.from({ length: numLanes }, (_, i) => i + 1);

  const heatCount = Math.ceil(active.length / numLanes);
  const assignments: { id: number; heatNumber: number; lane: number }[] = [];

  for (let h = 0; h < heatCount; h++) {
    const heatNum = heatCount - h;
    const heatEntries = active.slice(h * numLanes, (h + 1) * numLanes);
    heatEntries.forEach((entry, idx) => {
      assignments.push({ id: entry.id, heatNumber: heatNum, lane: laneOrder[idx] });
    });
  }

  for (const a of assignments) {
    await db.update(entriesTable).set({ heatNumber: a.heatNumber, lane: a.lane }).where(eq(entriesTable.id, a.id));
  }

  const updatedEntries = await db.select().from(entriesTable).where(eq(entriesTable.eventId, eventId));
  const heatMap: Record<number, unknown[]> = {};
  for (const e of updatedEntries) {
    if (e.heatNumber == null || e.lane == null) continue;
    if (!heatMap[e.heatNumber]) heatMap[e.heatNumber] = [];
    heatMap[e.heatNumber].push({ lane: e.lane, entryId: e.id, athleteId: e.athleteId, seedTime: e.seedTime, finishTime: null, place: null, dq: false, ns: false, dnf: false });
  }

  const heats = Object.keys(heatMap).map(k => ({
    id: parseInt(k),
    eventId,
    heatNumber: parseInt(k),
    status: "pending",
    lanes: heatMap[parseInt(k)],
  }));

  res.status(201).json(heats);
});

function getLaneOrder(numLanes: number): number[] {
  const mid = Math.ceil(numLanes / 2);
  const order: number[] = [mid];
  for (let i = 1; i <= numLanes; i++) {
    if (mid - i >= 1) order.push(mid - i);
    if (mid + i <= numLanes) order.push(mid + i);
    if (order.length >= numLanes) break;
  }
  return order;
}

export default router;
