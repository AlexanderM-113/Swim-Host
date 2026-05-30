import { Router } from "express";
import { db } from "@workspace/db";
import { officialsTable, insertOfficialSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/meets/:meetId/officials", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const officials = await db.select().from(officialsTable)
    .where(eq(officialsTable.meetId, meetId))
    .orderBy(officialsTable.role, officialsTable.name);
  res.json(officials);
});

router.post("/meets/:meetId/officials", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const parsed = insertOfficialSchema.safeParse({ ...req.body, meetId });
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [official] = await db.insert(officialsTable).values(parsed.data).returning();
  res.status(201).json(official);
});

router.patch("/officials/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [official] = await db.update(officialsTable).set(req.body)
    .where(eq(officialsTable.id, id)).returning();
  if (!official) { res.status(404).json({ error: "Not found" }); return; }
  res.json(official);
});

router.delete("/officials/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(officialsTable).where(eq(officialsTable.id, id));
  res.status(204).end();
});

export default router;
