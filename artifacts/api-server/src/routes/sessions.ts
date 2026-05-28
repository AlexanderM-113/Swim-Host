import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/meets/:meetId/sessions", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.meetId, meetId));
  res.json(rows);
});

router.post("/meets/:meetId/sessions", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [row] = await db.insert(sessionsTable).values({ ...req.body, meetId }).returning();
  res.status(201).json(row);
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(sessionsTable).set(req.body).where(eq(sessionsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(row);
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
  res.status(204).end();
});

export default router;
