import { Router } from "express";
import { db } from "@workspace/db";
import { timeStandardSetsTable, timeStandardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/timestandards", async (req, res): Promise<void> => {
  const sets = await db.select().from(timeStandardSetsTable);
  const standards = await db.select().from(timeStandardsTable);
  res.json(sets.map(s => ({
    ...s,
    standards: standards.filter(t => t.setId === s.id),
  })));
});

router.post("/timestandards", async (req, res): Promise<void> => {
  const [row] = await db.insert(timeStandardSetsTable).values(req.body).returning();
  res.status(201).json({ ...row, standards: [] });
});

router.delete("/timestandards/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(timeStandardsTable).where(eq(timeStandardsTable.setId, id));
  await db.delete(timeStandardSetsTable).where(eq(timeStandardSetsTable.id, id));
  res.status(204).end();
});

export default router;
