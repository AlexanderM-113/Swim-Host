import { Router } from "express";
import { db } from "@workspace/db";
import { athletesTable, teamsTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";

const router = Router();

router.get("/athletes", async (req, res): Promise<void> => {
  const { teamId, search, gender, ageGroup } = req.query as Record<string, string>;

  const conditions = [];
  if (teamId) conditions.push(eq(athletesTable.teamId, parseInt(teamId)));
  if (gender) conditions.push(eq(athletesTable.gender, gender));
  if (search) {
    conditions.push(
      sql`(${athletesTable.firstName} ILIKE ${"%" + search + "%"} OR ${athletesTable.lastName} ILIKE ${"%" + search + "%"})`
    );
  }

  const rows = await db
    .select({
      id: athletesTable.id,
      firstName: athletesTable.firstName,
      lastName: athletesTable.lastName,
      gender: athletesTable.gender,
      dateOfBirth: athletesTable.dateOfBirth,
      teamId: athletesTable.teamId,
      teamName: teamsTable.name,
      idNumber: athletesTable.idNumber,
      idFormat: athletesTable.idFormat,
      phone: athletesTable.phone,
      email: athletesTable.email,
      parentName: athletesTable.parentName,
      parentPhone: athletesTable.parentPhone,
      parentEmail: athletesTable.parentEmail,
      healthNotes: athletesTable.healthNotes,
      notes: athletesTable.notes,
      active: athletesTable.active,
      createdAt: athletesTable.createdAt,
    })
    .from(athletesTable)
    .leftJoin(teamsTable, eq(athletesTable.teamId, teamsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const result = rows.map(r => ({
    ...r,
    age: r.dateOfBirth ? Math.floor((Date.now() - new Date(r.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/athletes", async (req, res): Promise<void> => {
  const [row] = await db.insert(athletesTable).values(req.body).returning();
  const team = await db.select().from(teamsTable).where(eq(teamsTable.id, row.teamId)).limit(1);
  res.status(201).json({
    ...row,
    teamName: team[0]?.name ?? null,
    age: row.dateOfBirth ? Math.floor((Date.now() - new Date(row.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get("/athletes/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db
    .select({
      id: athletesTable.id,
      firstName: athletesTable.firstName,
      lastName: athletesTable.lastName,
      gender: athletesTable.gender,
      dateOfBirth: athletesTable.dateOfBirth,
      teamId: athletesTable.teamId,
      teamName: teamsTable.name,
      idNumber: athletesTable.idNumber,
      idFormat: athletesTable.idFormat,
      phone: athletesTable.phone,
      email: athletesTable.email,
      parentName: athletesTable.parentName,
      parentPhone: athletesTable.parentPhone,
      parentEmail: athletesTable.parentEmail,
      healthNotes: athletesTable.healthNotes,
      notes: athletesTable.notes,
      active: athletesTable.active,
      createdAt: athletesTable.createdAt,
    })
    .from(athletesTable)
    .leftJoin(teamsTable, eq(athletesTable.teamId, teamsTable.id))
    .where(eq(athletesTable.id, id))
    .limit(1);

  if (rows.length === 0) { res.status(404).json({ error: "Athlete not found" }); return; }
  const r = rows[0];
  res.json({
    ...r,
    age: r.dateOfBirth ? Math.floor((Date.now() - new Date(r.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
    createdAt: r.createdAt.toISOString(),
  });
});

router.patch("/athletes/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(athletesTable).set(req.body).where(eq(athletesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Athlete not found" }); return; }
  const team = await db.select().from(teamsTable).where(eq(teamsTable.id, row.teamId)).limit(1);
  res.json({
    ...row,
    teamName: team[0]?.name ?? null,
    age: row.dateOfBirth ? Math.floor((Date.now() - new Date(row.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/athletes/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(athletesTable).where(eq(athletesTable.id, id));
  res.status(204).end();
});

export default router;
