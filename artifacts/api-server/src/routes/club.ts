import { Router } from "express";
import { db } from "@workspace/db";
import { clubTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/club", async (req, res): Promise<void> => {
  const rows = await db.select().from(clubTable).limit(1);
  if (rows.length === 0) {
    const [created] = await db.insert(clubTable).values({ name: "My Swim Club" }).returning();
    res.json(created);
    return;
  }
  res.json(rows[0]);
});

router.put("/club", async (req, res): Promise<void> => {
  const rows = await db.select().from(clubTable).limit(1);
  if (rows.length === 0) {
    const [created] = await db.insert(clubTable).values({ name: "My Swim Club", ...req.body }).returning();
    res.json(created);
    return;
  }
  const [updated] = await db.update(clubTable).set(req.body).where(eq(clubTable.id, rows[0].id)).returning();
  res.json(updated);
});

export default router;
