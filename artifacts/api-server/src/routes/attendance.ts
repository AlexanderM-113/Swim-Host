import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, insertAttendanceSchema, athletesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/attendance", async (req, res): Promise<void> => {
  const { athleteId, groupId, date } = req.query as Record<string, string>;
  const conditions = [];
  if (athleteId) conditions.push(eq(attendanceTable.athleteId, parseInt(athleteId)));
  if (groupId) conditions.push(eq(attendanceTable.groupId, parseInt(groupId)));
  if (date) conditions.push(eq(attendanceTable.date, date));

  const rows = await db
    .select({
      id: attendanceTable.id,
      athleteId: attendanceTable.athleteId,
      groupId: attendanceTable.groupId,
      date: attendanceTable.date,
      present: attendanceTable.present,
      excused: attendanceTable.excused,
      notes: attendanceTable.notes,
      firstName: athletesTable.firstName,
      lastName: athletesTable.lastName,
    })
    .from(attendanceTable)
    .innerJoin(athletesTable, eq(attendanceTable.athleteId, athletesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
    .orderBy(attendanceTable.date, athletesTable.lastName);
  res.json(rows);
});

router.post("/attendance", async (req, res): Promise<void> => {
  const parsed = insertAttendanceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [row] = await db.insert(attendanceTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.post("/attendance/bulk", async (req, res): Promise<void> => {
  const { date, groupId, records } = req.body as {
    date: string; groupId?: number; records: { athleteId: number; present: boolean; excused?: boolean; notes?: string }[];
  };
  if (!date || !records?.length) { res.status(400).json({ error: "date and records required" }); return; }
  await db.delete(attendanceTable)
    .where(and(
      eq(attendanceTable.date, date),
      groupId ? eq(attendanceTable.groupId, groupId) : sql`1=1`,
    ));
  const rows = await db.insert(attendanceTable)
    .values(records.map(r => ({ ...r, date, groupId: groupId ?? null })))
    .returning();
  res.status(201).json(rows);
});

router.patch("/attendance/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(attendanceTable).set(req.body)
    .where(eq(attendanceTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/attendance/:id", async (req, res): Promise<void> => {
  await db.delete(attendanceTable).where(eq(attendanceTable.id, parseInt(req.params.id)));
  res.status(204).end();
});

export default router;
