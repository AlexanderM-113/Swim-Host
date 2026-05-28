import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, athletesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

router.get("/teams", async (req, res): Promise<void> => {
  const rows = await db.select().from(teamsTable);
  const counts = await db
    .select({ teamId: athletesTable.teamId, cnt: count() })
    .from(athletesTable)
    .groupBy(athletesTable.teamId);
  const countMap = Object.fromEntries(counts.map(c => [c.teamId, c.cnt]));
  res.json(rows.map(r => ({ ...r, athleteCount: countMap[r.id] ?? 0 })));
});

router.post("/teams", async (req, res): Promise<void> => {
  const [row] = await db.insert(teamsTable).values(req.body).returning();
  res.status(201).json({ ...row, athleteCount: 0 });
});

router.get("/teams/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Team not found" }); return; }
  const cnt = await db.select({ cnt: count() }).from(athletesTable).where(eq(athletesTable.teamId, id));
  res.json({ ...rows[0], athleteCount: cnt[0].cnt });
});

router.patch("/teams/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(teamsTable).set(req.body).where(eq(teamsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Team not found" }); return; }
  const cnt = await db.select({ cnt: count() }).from(athletesTable).where(eq(athletesTable.teamId, id));
  res.json({ ...row, athleteCount: cnt[0].cnt });
});

router.delete("/teams/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).end();
});

export default router;
