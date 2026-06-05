import { Router } from "express";
import { db } from "@workspace/db";
import {
  meetsTable, eventsTable, entriesTable, resultsTable,
  athletesTable, teamsTable, workoutsTable, workoutSetsTable, invoicesTable,
} from "@workspace/db";
import { eq, asc, and, inArray, isNotNull } from "drizzle-orm";

const router = Router();

async function getMeetEvents(meetId: number) {
  return db.select().from(eventsTable)
    .where(eq(eventsTable.meetId, meetId))
    .orderBy(asc(eventsTable.eventNumber));
}

async function getMeetEntries(eventIds: number[]) {
  if (eventIds.length === 0) return [];
  return db.select({
    id: entriesTable.id,
    eventId: entriesTable.eventId,
    athleteId: entriesTable.athleteId,
    teamId: entriesTable.teamId,
    seedTime: entriesTable.seedTime,
    seedCourse: entriesTable.seedCourse,
    heatNumber: entriesTable.heatNumber,
    lane: entriesTable.lane,
    scratched: entriesTable.scratched,
    scratchedReason: entriesTable.scratchedReason,
    firstName: athletesTable.firstName,
    lastName: athletesTable.lastName,
    dateOfBirth: athletesTable.dateOfBirth,
    gender: athletesTable.gender,
    idNumber: athletesTable.idNumber,
    teamName: teamsTable.name,
    teamAbbreviation: teamsTable.abbreviation,
  }).from(entriesTable)
    .leftJoin(athletesTable, eq(entriesTable.athleteId, athletesTable.id))
    .leftJoin(teamsTable, eq(entriesTable.teamId, teamsTable.id))
    .where(inArray(entriesTable.eventId, eventIds));
}

async function getMeetResults(entryIds: number[]) {
  if (entryIds.length === 0) return [];
  return db.select().from(resultsTable)
    .where(inArray(resultsTable.entryId, entryIds));
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "-";
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return String(age);
}

router.get("/reports/meets/:meetId/psych-sheet", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));

  const eventsOut = events.map(event => ({
    ...event,
    entries: entries
      .filter(e => e.eventId === event.id && !e.scratched)
      .sort((a, b) => {
        if (a.seedTime == null) return 1;
        if (b.seedTime == null) return -1;
        return a.seedTime - b.seedTime;
      })
      .map((e, idx) => ({
        rank: idx + 1,
        athleteName: e.firstName ? `${e.firstName} ${e.lastName}` : "Unknown",
        age: calcAge(e.dateOfBirth),
        teamAbbreviation: e.teamAbbreviation ?? e.teamName ?? "-",
        seedTime: e.seedTime,
        seedCourse: e.seedCourse,
        idNumber: e.idNumber,
      })),
  }));

  res.json({ meet, events: eventsOut });
});

router.get("/reports/meets/:meetId/heat-sheet", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));

  const eventsOut = events
    .filter(event => entries.some(e => e.eventId === event.id && e.heatNumber != null))
    .map(event => {
      const eventEntries = entries.filter(e => e.eventId === event.id && !e.scratched && e.heatNumber != null);
      const maxHeat = eventEntries.reduce((m, e) => Math.max(m, e.heatNumber ?? 0), 0);
      const heats = Array.from({ length: maxHeat }, (_, i) => i + 1).map(heatNum => ({
        heatNumber: heatNum,
        lanes: eventEntries
          .filter(e => e.heatNumber === heatNum)
          .sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0))
          .map(e => ({
            lane: e.lane,
            athleteName: e.firstName ? `${e.firstName} ${e.lastName}` : "Unknown",
            age: calcAge(e.dateOfBirth),
            teamAbbreviation: e.teamAbbreviation ?? e.teamName ?? "-",
            seedTime: e.seedTime,
            seedCourse: e.seedCourse,
          })),
      }));
      return { ...event, heats };
    });

  res.json({ meet, events: eventsOut });
});

router.get("/reports/meets/:meetId/results-report", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));
  const results = await getMeetResults(entries.map(e => e.id));

  const eventsOut = events.map(event => {
    const eventEntries = entries.filter(e => e.eventId === event.id);
    const rows = eventEntries.map(entry => {
      const result = results.find(r => r.entryId === entry.id);
      return {
        place: result?.place ?? null,
        athleteName: entry.firstName ? `${entry.firstName} ${entry.lastName}` : "Unknown",
        age: calcAge(entry.dateOfBirth),
        teamAbbreviation: entry.teamAbbreviation ?? entry.teamName ?? "-",
        seedTime: entry.seedTime,
        finishTime: result?.finishTime ?? null,
        points: result?.points ?? null,
        dq: result?.dq ?? false,
        dqCode: result?.dqCode ?? null,
        ns: result?.ns ?? false,
        dnf: result?.dnf ?? false,
        splits: result?.splits ?? null,
        heatNumber: entry.heatNumber,
        lane: entry.lane,
      };
    }).sort((a, b) => {
      if (a.dq || a.ns || a.dnf) return 1;
      if (b.dq || b.ns || b.dnf) return -1;
      if (a.place == null) return 1;
      if (b.place == null) return -1;
      return a.place - b.place;
    });
    return { ...event, results: rows };
  });

  res.json({ meet, events: eventsOut });
});

router.get("/reports/meets/:meetId/dq-report", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));
  const results = await getMeetResults(entries.map(e => e.id));

  const dqs = results
    .filter(r => r.dq || r.ns || r.dnf)
    .map(r => {
      const entry = entries.find(e => e.id === r.entryId);
      const event = events.find(ev => ev.id === r.eventId);
      return {
        eventNumber: event?.eventNumber,
        eventName: event ? `${event.distance} ${event.stroke} ${event.gender}` : "Unknown",
        athleteName: entry?.firstName ? `${entry.firstName} ${entry.lastName}` : "Unknown",
        teamAbbreviation: entry?.teamAbbreviation ?? entry?.teamName ?? "-",
        heatNumber: entry?.heatNumber,
        lane: entry?.lane,
        dq: r.dq,
        dqCode: r.dqCode,
        ns: r.ns,
        dnf: r.dnf,
        finishTime: r.finishTime,
      };
    })
    .sort((a, b) => (a.eventNumber ?? 0) - (b.eventNumber ?? 0));

  res.json({ meet, dqs });
});

router.get("/reports/meets/:meetId/entry-list-by-team", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));
  const teams = await db.select().from(teamsTable);

  const teamIds = [...new Set(entries.map(e => e.teamId).filter(Boolean))];
  const teamGroups = teams
    .filter(t => teamIds.includes(t.id))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map(team => {
      const teamEntries = entries.filter(e => e.teamId === team.id && !e.scratched);
      const athletes = [...new Map(teamEntries.map(e => [e.athleteId, e])).values()];
      return {
        team: {
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
          coachName: team.coachName,
        },
        athletes: athletes.map(a => {
          const athleteEntries = teamEntries.filter(e => e.athleteId === a.athleteId);
          return {
            athleteName: a.firstName ? `${a.firstName} ${a.lastName}` : "Unknown",
            age: calcAge(a.dateOfBirth),
            gender: a.gender,
            events: athleteEntries.map(e => {
              const event = events.find(ev => ev.id === e.eventId);
              return {
                eventNumber: event?.eventNumber,
                eventName: event ? `${event.distance} ${event.stroke} ${event.gender}` : "Unknown",
                seedTime: e.seedTime,
                seedCourse: e.seedCourse,
              };
            }).sort((a, b) => (a.eventNumber ?? 0) - (b.eventNumber ?? 0)),
          };
        }).sort((a, b) => a.athleteName.localeCompare(b.athleteName)),
      };
    });

  res.json({ meet, teams: teamGroups });
});

router.get("/reports/meets/:meetId/award-counts", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));
  const results = await getMeetResults(entries.map(e => e.id));
  const teams = await db.select().from(teamsTable);

  const teamAwardMap: Record<number, { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number }> = {};
  for (const result of results) {
    const entry = entries.find(e => e.id === result.entryId);
    if (!entry?.teamId || !result.place || result.place > 6 || result.dq) continue;
    if (!teamAwardMap[entry.teamId]) {
      teamAwardMap[entry.teamId] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    }
    teamAwardMap[entry.teamId][result.place as 1 | 2 | 3 | 4 | 5 | 6]++;
  }

  const teamAwards = Object.entries(teamAwardMap).map(([teamId, counts]) => {
    const team = teams.find(t => t.id === parseInt(teamId));
    return {
      teamName: team?.name ?? "Unknown",
      teamAbbreviation: team?.abbreviation ?? "-",
      first: counts[1],
      second: counts[2],
      third: counts[3],
      fourth: counts[4],
      fifth: counts[5],
      sixth: counts[6],
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }).sort((a, b) => b.total - a.total);

  res.json({ meet, teamAwards });
});

router.get("/reports/athletes/:athleteId/full-report", async (req, res): Promise<void> => {
  const athleteId = parseInt(req.params.athleteId);
  const [athlete] = await db.select({
    id: athletesTable.id,
    firstName: athletesTable.firstName,
    lastName: athletesTable.lastName,
    gender: athletesTable.gender,
    dateOfBirth: athletesTable.dateOfBirth,
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
    teamId: athletesTable.teamId,
    teamName: teamsTable.name,
    teamAbbreviation: teamsTable.abbreviation,
    coachName: teamsTable.coachName,
  }).from(athletesTable)
    .leftJoin(teamsTable, eq(athletesTable.teamId, teamsTable.id))
    .where(eq(athletesTable.id, athleteId)).limit(1);

  if (!athlete) { res.status(404).json({ error: "Athlete not found" }); return; }

  const entries = await db.select({
    id: entriesTable.id,
    eventId: entriesTable.eventId,
    seedTime: entriesTable.seedTime,
    seedCourse: entriesTable.seedCourse,
    heatNumber: entriesTable.heatNumber,
    lane: entriesTable.lane,
    scratched: entriesTable.scratched,
  }).from(entriesTable).where(eq(entriesTable.athleteId, athleteId));

  const invoices = await db.select().from(invoicesTable)
    .where(eq(invoicesTable.athleteId, athleteId))
    .orderBy(asc(invoicesTable.dueDate));

  res.json({ athlete, entries, invoices });
});

router.get("/reports/teams/:teamId/full-report", async (req, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const athletes = await db.select().from(athletesTable)
    .where(and(eq(athletesTable.teamId, teamId), eq(athletesTable.active, true)))
    .orderBy(asc(athletesTable.lastName));

  res.json({ team, athletes });
});

router.get("/reports/billing/full-report", async (req, res): Promise<void> => {
  const invoices = await db.select({
    id: invoicesTable.id,
    athleteId: invoicesTable.athleteId,
    teamId: invoicesTable.teamId,
    amount: invoicesTable.amount,
    status: invoicesTable.status,
    dueDate: invoicesTable.dueDate,
    paidDate: invoicesTable.paidDate,
    description: invoicesTable.description,
    invoiceType: invoicesTable.invoiceType,
    createdAt: invoicesTable.createdAt,
    athleteFirstName: athletesTable.firstName,
    athleteLastName: athletesTable.lastName,
    teamName: teamsTable.name,
  }).from(invoicesTable)
    .leftJoin(athletesTable, eq(invoicesTable.athleteId, athletesTable.id))
    .leftJoin(teamsTable, eq(invoicesTable.teamId, teamsTable.id))
    .orderBy(asc(invoicesTable.dueDate));

  res.json(invoices.map(i => ({
    ...i,
    athleteName: i.athleteFirstName ? `${i.athleteFirstName} ${i.athleteLastName}` : "Unknown",
    createdAt: i.createdAt.toISOString(),
  })));
});

router.get("/reports/meets/:meetId/split-sheet", async (req, res): Promise<void> => {
  const meetId = parseInt(req.params.meetId);
  const [meet] = await db.select().from(meetsTable).where(eq(meetsTable.id, meetId)).limit(1);
  if (!meet) { res.status(404).json({ error: "Meet not found" }); return; }

  const events = await getMeetEvents(meetId);
  const entries = await getMeetEntries(events.map(e => e.id));
  const results = await getMeetResults(entries.map(e => e.id));

  const eventsOut = events.map(event => {
    const eventEntries = entries.filter(e => e.eventId === event.id && !e.scratched && e.heatNumber != null);
    const maxHeat = eventEntries.reduce((m, e) => Math.max(m, e.heatNumber ?? 0), 0);
    const heats = Array.from({ length: maxHeat }, (_, i) => i + 1).map(heatNum => ({
      heatNumber: heatNum,
      lanes: eventEntries
        .filter(e => e.heatNumber === heatNum)
        .sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0))
        .map(e => {
          const result = results.find(r => r.entryId === e.id);
          const splitsArr = result?.splits ? JSON.parse(result.splits) : null;
          return {
            lane: e.lane,
            athleteName: e.firstName ? `${e.firstName} ${e.lastName}` : "Unknown",
            teamAbbreviation: e.teamAbbreviation ?? e.teamName ?? "-",
            finishTime: result?.finishTime ?? null,
            splits: splitsArr,
            place: result?.place ?? null,
          };
        }),
    }));
    return { ...event, heats };
  });

  res.json({ meet, events: eventsOut });
});

router.post("/reports/scratch-requests", async (req, res): Promise<void> => {
  const { fullName, dob, eventNumber, eventName, reason, signature, timestamp, meetId } = req.body;
  req.log.info({ fullName, eventNumber, meetId, timestamp }, "Scratch request received");
  res.status(201).json({
    success: true,
    message: "Scratch request received. Meet director will process before the next session.",
    data: { fullName, eventNumber, eventName, meetId, timestamp: timestamp ?? new Date().toISOString() },
  });
});

export default router;
