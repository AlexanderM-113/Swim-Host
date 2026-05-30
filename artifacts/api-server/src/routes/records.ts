import { Router } from "express";
import { db } from "@workspace/db";
import { clubRecordsTable, insertClubRecordSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/records", async (req, res): Promise<void> => {
  const { course, gender, stroke, ageGroup, recordType } = req.query as Record<string, string>;
  let query = db.select().from(clubRecordsTable);
  const conditions = [];
  if (course) conditions.push(eq(clubRecordsTable.course, course));
  if (gender) conditions.push(eq(clubRecordsTable.gender, gender));
  if (stroke) conditions.push(eq(clubRecordsTable.stroke, stroke));
  if (ageGroup) conditions.push(eq(clubRecordsTable.ageGroup, ageGroup));
  if (recordType) conditions.push(eq(clubRecordsTable.recordType, recordType));
  const records = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query
  ).orderBy(clubRecordsTable.stroke, clubRecordsTable.distance, clubRecordsTable.ageGroup);
  res.json(records);
});

router.post("/records", async (req, res): Promise<void> => {
  const parsed = insertClubRecordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [record] = await db.insert(clubRecordsTable).values(parsed.data).returning();
  res.status(201).json(record);
});

router.patch("/records/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [record] = await db.update(clubRecordsTable).set(req.body)
    .where(eq(clubRecordsTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Not found" }); return; }
  res.json(record);
});

router.delete("/records/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(clubRecordsTable).where(eq(clubRecordsTable.id, id));
  res.status(204).end();
});

export default router;
