import { Router } from "express";
import { db } from "@workspace/db";
import {
  athleteGroupsTable, groupMembershipsTable,
  insertAthleteGroupSchema, insertGroupMembershipSchema,
  athletesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/groups", async (req, res): Promise<void> => {
  const { teamId } = req.query as Record<string, string>;
  const groups = await db
    .select({
      id: athleteGroupsTable.id,
      teamId: athleteGroupsTable.teamId,
      name: athleteGroupsTable.name,
      description: athleteGroupsTable.description,
      coachName: athleteGroupsTable.coachName,
      level: athleteGroupsTable.level,
      practiceSchedule: athleteGroupsTable.practiceSchedule,
      minimumAge: athleteGroupsTable.minimumAge,
      maximumAge: athleteGroupsTable.maximumAge,
      color: athleteGroupsTable.color,
      createdAt: athleteGroupsTable.createdAt,
      memberCount: sql<number>`(SELECT COUNT(*) FROM group_memberships WHERE group_id = ${athleteGroupsTable.id})`,
    })
    .from(athleteGroupsTable)
    .where(teamId ? eq(athleteGroupsTable.teamId, parseInt(teamId)) : sql`1=1`)
    .orderBy(athleteGroupsTable.name);
  res.json(groups);
});

router.post("/groups", async (req, res): Promise<void> => {
  const parsed = insertAthleteGroupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [group] = await db.insert(athleteGroupsTable).values(parsed.data).returning();
  res.status(201).json(group);
});

router.patch("/groups/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [group] = await db.update(athleteGroupsTable).set(req.body)
    .where(eq(athleteGroupsTable.id, id)).returning();
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  res.json(group);
});

router.delete("/groups/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(groupMembershipsTable).where(eq(groupMembershipsTable.groupId, id));
  await db.delete(athleteGroupsTable).where(eq(athleteGroupsTable.id, id));
  res.status(204).end();
});

router.get("/groups/:id/members", async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.id);
  const members = await db
    .select({
      membershipId: groupMembershipsTable.id,
      athleteId: groupMembershipsTable.athleteId,
      joinedDate: groupMembershipsTable.joinedDate,
      notes: groupMembershipsTable.notes,
      firstName: athletesTable.firstName,
      lastName: athletesTable.lastName,
      gender: athletesTable.gender,
      dateOfBirth: athletesTable.dateOfBirth,
      active: athletesTable.active,
    })
    .from(groupMembershipsTable)
    .innerJoin(athletesTable, eq(groupMembershipsTable.athleteId, athletesTable.id))
    .where(eq(groupMembershipsTable.groupId, groupId))
    .orderBy(athletesTable.lastName, athletesTable.firstName);
  res.json(members);
});

router.post("/groups/:id/members", async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.id);
  const parsed = insertGroupMembershipSchema.safeParse({ ...req.body, groupId });
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const [membership] = await db.insert(groupMembershipsTable).values(parsed.data).returning();
  res.status(201).json(membership);
});

router.delete("/groups/:id/members/:athleteId", async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.id);
  const athleteId = parseInt(req.params.athleteId);
  await db.delete(groupMembershipsTable)
    .where(and(eq(groupMembershipsTable.groupId, groupId), eq(groupMembershipsTable.athleteId, athleteId)));
  res.status(204).end();
});

export default router;
