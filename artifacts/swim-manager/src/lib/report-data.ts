// Client-side report data builders.
//
// SwimManager Pro is localStorage-based — there is no live backend that serves
// report payloads. These builders assemble the exact shapes the PDF generators
// in `@/lib/pdf` expect, sourced entirely from `readStore()`. This is what keeps
// the Reports page free of "API error" failures and guarantees every report
// reflects what's currently in the Meet Manager.

import {
  readStore,
  resultForRound,
  type Meet,
  type Team,
  type Athlete,
  type Event,
  type Entry,
  type Result,
  type Heat,
  type Invoice,
  type EventFinals,
} from "@/lib/local-store";

export class ReportError extends Error {}

function fullName(a: Pick<Athlete, "firstName" | "lastName">): string {
  return `${a.firstName} ${a.lastName}`.trim();
}

function teamAbbrev(team: Team | undefined | null): string {
  if (!team) return "UNAT";
  return team.abbreviation || team.shortName || team.name || "UNAT";
}

/** Age as of the meet's age-up date (falls back to meet start, then today). */
function ageAsOf(dob: string | undefined, meet: Meet | null): number | null {
  if (!dob) return null;
  const ref = new Date(meet?.ageUpDate || meet?.startDate || new Date().toISOString());
  const birth = new Date(dob);
  if (isNaN(birth.getTime()) || isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Sort entries slow→fast putting "no time" (NT) entries last. */
function bySeedTime(a: Entry, b: Entry): number {
  const at = a.seedTime ?? Infinity;
  const bt = b.seedTime ?? Infinity;
  return at - bt;
}

function eventName(e: Event): string {
  const g = e.gender === "M" ? "Men" : e.gender === "F" ? "Women" : "Mixed";
  return `${g} ${e.ageGroup || "Open"} ${e.distance} ${e.stroke}`;
}

interface StoreView {
  meets: Meet[];
  teams: Team[];
  athletes: Athlete[];
  events: Event[];
  entries: Entry[];
  heats: Heat[];
  results: Result[];
  invoices: Invoice[];
  finals: EventFinals[];
}

function load(): StoreView {
  const s = readStore();
  return {
    meets: s.meets,
    teams: s.teams,
    athletes: s.athletes,
    events: s.events,
    entries: s.entries,
    heats: s.heats,
    results: s.results,
    invoices: s.invoices,
    finals: s.finals,
  };
}

function requireMeet(s: StoreView, meetId: number): Meet {
  const meet = s.meets.find((m) => m.id === meetId);
  if (!meet) throw new ReportError("Meet not found. Select a meet and try again.");
  return meet;
}

function meetEvents(s: StoreView, meetId: number): Event[] {
  return s.events
    .filter((e) => e.meetId === meetId)
    .sort((a, b) => a.eventNumber - b.eventNumber);
}

interface EntryView {
  rank: number;
  athleteName: string;
  teamAbbreviation: string;
  age: number | null;
  seedTime: number | null;
  seedCourse: string | null;
}

function entryViewsForEvent(s: StoreView, meet: Meet, event: Event): EntryView[] {
  const entries = s.entries
    .filter((e) => e.eventId === event.id && !e.scratched)
    .sort(bySeedTime);
  return entries.map((entry, i) => {
    const athlete = s.athletes.find((a) => a.id === entry.athleteId);
    const team = athlete?.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
    return {
      rank: i + 1,
      athleteName: athlete ? fullName(athlete) : entry.athleteName ?? "Unknown",
      teamAbbreviation: teamAbbrev(team),
      age: ageAsOf(athlete?.dateOfBirth, meet),
      seedTime: entry.seedTime ?? null,
      seedCourse: entry.seedCourse ?? meet.course ?? null,
    };
  });
}

function parseSplits(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const parts = p.split(":");
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const sec = parseFloat(parts[1]);
        return isNaN(m) || isNaN(sec) ? NaN : m * 60 + sec;
      }
      return parseFloat(p);
    })
    .filter((n) => !isNaN(n));
}

// ─── PSYCH SHEET ──────────────────────────────────────────────────────────────
export function buildPsychSheet(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);
  const events = meetEvents(s, meetId).map((event) => ({
    eventNumber: event.eventNumber,
    gender: event.gender,
    ageGroup: event.ageGroup,
    distance: event.distance,
    stroke: event.stroke,
    eventType: event.eventType,
    entries: entryViewsForEvent(s, meet, event),
  }));
  return { meet, events };
}

// ─── HEAT SHEET ───────────────────────────────────────────────────────────────
function heatsForEvent(s: StoreView, meet: Meet, event: Event) {
  return s.heats
    .filter((h) => h.eventId === event.id)
    .sort((a, b) => a.heatNumber - b.heatNumber)
    .map((heat) => ({
      heatNumber: heat.heatNumber,
      lanes: heat.lanes
        .filter((l) => l.entryId != null)
        .map((lane) => {
          const entry = s.entries.find((e) => e.id === lane.entryId);
          const athlete = entry ? s.athletes.find((a) => a.id === entry.athleteId) : null;
          const team = athlete?.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
          const result = entry ? s.results.find((r) => r.entryId === entry.id) : null;
          return {
            lane: lane.laneNumber,
            athleteName: athlete ? fullName(athlete) : lane.athleteName || "Unknown",
            teamAbbreviation: teamAbbrev(team),
            age: ageAsOf(athlete?.dateOfBirth, meet),
            seedTime: lane.seedTime ?? entry?.seedTime ?? null,
            seedCourse: entry?.seedCourse ?? meet.course ?? null,
            finishTime: result?.finishTime ?? null,
            place: result?.place ?? null,
            dq: result?.dq ?? false,
            dqCode: result?.dqCode,
            ns: result?.ns ?? false,
            dnf: result?.dnf ?? false,
            splits: parseSplits(result?.splits),
          };
        }),
    }))
    .filter((h) => h.lanes.length > 0);
}

export function buildHeatSheet(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);
  const events = meetEvents(s, meetId).map((event) => ({
    eventNumber: event.eventNumber,
    gender: event.gender,
    ageGroup: event.ageGroup,
    distance: event.distance,
    stroke: event.stroke,
    heats: heatsForEvent(s, meet, event),
  }));
  return { meet, events };
}

// ─── SPLIT SHEET (same heat shape, used for splits/finish) ─────────────────────
export function buildSplitSheet(meetId: number) {
  return buildHeatSheet(meetId);
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
export function buildResults(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);

  // Prelims and finals are separate rounds. For an event that has finals we emit
  // two result blocks (Finals first, then Prelims) so both are displayed; a
  // timed-final event emits a single block with no round label.
  const buildRow = (entry: Entry, result: Result, prelimTime: number | null) => {
    const athlete = s.athletes.find((a) => a.id === entry.athleteId);
    const team = athlete?.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
    return {
      place: result.place ?? null,
      athleteName: athlete ? fullName(athlete) : entry.athleteName ?? "Unknown",
      teamAbbreviation: teamAbbrev(team),
      age: ageAsOf(athlete?.dateOfBirth, meet),
      seedTime: entry.seedTime ?? null,
      prelimTime,
      finishTime: result.finishTime ?? null,
      points: result.points ?? null,
      dq: result.dq ?? false,
      dqCode: result.dqCode,
      ns: result.ns ?? false,
      dnf: result.dnf ?? false,
    };
  };
  const sortByPlace = <T extends { place: number | null; dq: boolean; ns: boolean; dnf: boolean }>(rows: T[]) =>
    rows.sort((a, b) => {
      const ap = a.dq || a.ns || a.dnf ? 9999 : a.place ?? 9998;
      const bp = b.dq || b.ns || b.dnf ? 9999 : b.place ?? 9998;
      return ap - bp;
    });

  const events: any[] = [];
  for (const event of meetEvents(s, meetId)) {
    const entries = s.entries.filter((e) => e.eventId === event.id && !e.scratched);
    const meta = {
      eventNumber: event.eventNumber,
      gender: event.gender,
      ageGroup: event.ageGroup,
      distance: event.distance,
      stroke: event.stroke,
    };
    const hasFinals = s.finals.some((f) => f.eventId === event.id);

    if (hasFinals) {
      const finalRows = sortByPlace(
        entries
          .map((entry) => {
            const fr = resultForRound(s.results, entry.id, "final");
            if (!fr) return null;
            const pr = resultForRound(s.results, entry.id, "prelim");
            return buildRow(entry, fr, pr?.finishTime ?? null);
          })
          .filter((r): r is NonNullable<typeof r> => r != null)
      );
      const prelimRows = sortByPlace(
        entries
          .map((entry) => {
            const pr = resultForRound(s.results, entry.id, "prelim");
            if (!pr) return null;
            return buildRow(entry, pr, null);
          })
          .filter((r): r is NonNullable<typeof r> => r != null)
      );
      if (finalRows.length) events.push({ ...meta, roundLabel: "Finals", results: finalRows });
      if (prelimRows.length) events.push({ ...meta, roundLabel: "Prelims", results: prelimRows });
    } else {
      const rows = sortByPlace(
        entries
          .map((entry) => {
            const r = resultForRound(s.results, entry.id, "prelim");
            if (!r) return null;
            return buildRow(entry, r, null);
          })
          .filter((r): r is NonNullable<typeof r> => r != null)
      );
      events.push({ ...meta, results: rows });
    }
  }
  return { meet, events };
}

// ─── ENTRY LIST BY TEAM ─────────────────────────────────────────────────────--
export function buildEntryListByTeam(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);
  const events = meetEvents(s, meetId);
  const eventById = new Map(events.map((e) => [e.id, e]));

  // Group non-scratched entries by athlete, then by team.
  const teamGroups = new Map<
    number | "unat",
    {
      team: { id: number | null; name: string; abbreviation: string; coachName?: string };
      athletes: Map<
        number,
        {
          athleteName: string;
          gender: string;
          age: number | null;
          events: { eventNumber: number; eventName: string; seedTime: number | null; seedCourse: string | null }[];
        }
      >;
    }
  >();

  for (const entry of s.entries) {
    if (entry.scratched) continue;
    const event = eventById.get(entry.eventId);
    if (!event) continue;
    const athlete = s.athletes.find((a) => a.id === entry.athleteId);
    if (!athlete) continue;
    const team = athlete.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
    const teamKey: number | "unat" = team ? team.id : "unat";

    if (!teamGroups.has(teamKey)) {
      teamGroups.set(teamKey, {
        team: {
          id: team?.id ?? null,
          name: team?.name ?? "Unattached",
          abbreviation: teamAbbrev(team),
        },
        athletes: new Map(),
      });
    }
    const group = teamGroups.get(teamKey)!;
    if (!group.athletes.has(athlete.id)) {
      group.athletes.set(athlete.id, {
        athleteName: fullName(athlete),
        gender: athlete.gender,
        age: ageAsOf(athlete.dateOfBirth, meet),
        events: [],
      });
    }
    group.athletes.get(athlete.id)!.events.push({
      eventNumber: event.eventNumber,
      eventName: eventName(event),
      seedTime: entry.seedTime ?? null,
      seedCourse: entry.seedCourse ?? meet.course ?? null,
    });
  }

  const teams = Array.from(teamGroups.values())
    .map((g) => ({
      team: g.team,
      athletes: Array.from(g.athletes.values())
        .map((a) => ({
          ...a,
          events: a.events.sort((x, y) => x.eventNumber - y.eventNumber),
        }))
        .sort((a, b) => a.athleteName.localeCompare(b.athleteName)),
    }))
    .sort((a, b) => a.team.name.localeCompare(b.team.name));

  return { meet, teams };
}

// ─── DQ / NS / DNF ──────────────────────────────────────────────────────────--
export function buildDQs(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);
  const events = meetEvents(s, meetId);
  const eventById = new Map(events.map((e) => [e.id, e]));

  const dqs: {
    eventNumber: number;
    eventName: string;
    athleteName: string;
    teamAbbreviation: string;
    heatNumber: number | null;
    lane: number | null;
    dq: boolean;
    ns: boolean;
    dnf: boolean;
    dqCode?: string;
  }[] = [];

  for (const result of s.results) {
    if (!result.dq && !result.ns && !result.dnf) continue;
    const event = eventById.get(result.eventId);
    if (!event) continue;
    const entry = s.entries.find((e) => e.id === result.entryId);
    if (!entry) continue;
    const athlete = s.athletes.find((a) => a.id === entry.athleteId);
    const team = athlete?.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
    dqs.push({
      eventNumber: event.eventNumber,
      eventName: eventName(event),
      athleteName: athlete ? fullName(athlete) : entry.athleteName ?? "Unknown",
      teamAbbreviation: teamAbbrev(team),
      heatNumber: entry.heat ?? null,
      lane: entry.lane ?? null,
      dq: result.dq ?? false,
      ns: result.ns ?? false,
      dnf: result.dnf ?? false,
      dqCode: result.dqCode,
    });
  }

  dqs.sort((a, b) => a.eventNumber - b.eventNumber);
  return { meet, dqs };
}

// ─── AWARD COUNTS ─────────────────────────────────────────────────────────────
export function buildAwardCounts(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);
  const events = meetEvents(s, meetId);
  const eventIds = new Set(events.map((e) => e.id));

  const byTeam = new Map<
    number | "unat",
    { teamName: string; teamAbbreviation: string; counts: number[]; total: number }
  >();

  for (const result of s.results) {
    if (!eventIds.has(result.eventId)) continue;
    if (result.dq || result.ns || result.dnf) continue;
    if (!result.place || result.place < 1 || result.place > 6) continue;
    const entry = s.entries.find((e) => e.id === result.entryId);
    if (!entry) continue;
    const athlete = s.athletes.find((a) => a.id === entry.athleteId);
    const team = athlete?.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
    const key: number | "unat" = team ? team.id : "unat";
    if (!byTeam.has(key)) {
      byTeam.set(key, {
        teamName: team?.name ?? "Unattached",
        teamAbbreviation: teamAbbrev(team),
        counts: [0, 0, 0, 0, 0, 0],
        total: 0,
      });
    }
    const rec = byTeam.get(key)!;
    rec.counts[result.place - 1]++;
    rec.total++;
  }

  const teamAwards = Array.from(byTeam.values())
    .map((t) => ({
      teamName: t.teamName,
      teamAbbreviation: t.teamAbbreviation,
      first: t.counts[0],
      second: t.counts[1],
      third: t.counts[2],
      fourth: t.counts[3],
      fifth: t.counts[4],
      sixth: t.counts[5],
      total: t.total,
    }))
    .sort((a, b) => b.total - a.total);

  return { meet, teamAwards };
}

// ─── AWARD LABELS (reuse results shape) ─────────────────────────────────────--
export function buildAwardLabels(meetId: number) {
  return buildResults(meetId);
}

// ─── TEAM FULL REPORT ─────────────────────────────────────────────────────────
export function buildTeamFullReport(teamId: number) {
  const s = load();
  const team = s.teams.find((t) => t.id === teamId);
  if (!team) throw new ReportError("Team not found. Select a team and try again.");
  const athletes = s.athletes
    .filter((a) => a.teamId === teamId)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  return { team, athletes };
}

// ─── ATHLETE FULL REPORT ──────────────────────────────────────────────────────
export function buildAthleteFullReport(athleteId: number) {
  const s = load();
  const athlete = s.athletes.find((a) => a.id === athleteId);
  if (!athlete) throw new ReportError("Athlete not found. Select an athlete and try again.");
  const team = athlete.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
  const entries = s.entries.filter((e) => e.athleteId === athleteId);
  const invoices = s.invoices.filter((i) => i.athleteId === athleteId);
  return {
    athlete: { ...athlete, teamName: team?.name ?? athlete.teamName ?? undefined },
    entries,
    invoices,
  };
}

// ─── BILLING FULL REPORT ──────────────────────────────────────────────────────
export function buildBillingFullReport() {
  const s = load();
  const invoices = s.invoices.map((inv) => {
    const athlete = inv.athleteId ? s.athletes.find((a) => a.id === inv.athleteId) : null;
    const team = athlete?.teamId ? s.teams.find((t) => t.id === athlete.teamId) : null;
    return {
      ...inv,
      athleteName: inv.athleteName ?? (athlete ? fullName(athlete) : "-"),
      teamName: team?.name ?? "-",
    };
  });
  return { invoices };
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
// Estimated run-order timeline: walks each session in order, lists its events
// with heat counts and a rough cumulative time estimate so officials can plan.

const SECONDS_PER_HEAT_DEFAULT = 90; // conservative average per heat

export interface TimelineEventRow {
  eventNumber: number;
  eventName: string;
  heatCount: number;
  entryCount: number;
  estStart: string | null;
}

export interface TimelineSession {
  name: string;
  sessionType?: string;
  date?: string;
  warmupTime?: string;
  startTime?: string;
  events: TimelineEventRow[];
  estEndMinutes: number;
}

export function buildTimeline(meetId: number) {
  const s = load();
  const meet = requireMeet(s, meetId);
  const store = readStore();
  const sessions = store.sessions
    .filter((sess) => sess.meetId === meetId)
    .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
  const allEvents = meetEvents(s, meetId);

  function parseClock(t: string | undefined): number | null {
    if (!t) return null;
    const m = t.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }
  function fmtClock(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.round(mins % 60);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function eventsForSession(sessionId: number | undefined): Event[] {
    if (sessionId == null) return [];
    return allEvents.filter((e) => e.sessionId === sessionId);
  }

  const timelineSessions: TimelineSession[] = [];

  // Events not tied to any session are grouped into an "Unassigned" bucket.
  const grouped = new Set<number>();

  for (const sess of sessions) {
    const evs = eventsForSession(sess.id);
    evs.forEach((e) => grouped.add(e.id));
    const startMin = parseClock(sess.startTime);
    let cursor = startMin;
    const events: TimelineEventRow[] = evs.map((event) => {
      const heatCount =
        s.heats.filter((h) => h.eventId === event.id).length ||
        Math.max(1, Math.ceil(s.entries.filter((en) => en.eventId === event.id && !en.scratched).length / (meet.lanes || 8)));
      const entryCount = s.entries.filter((en) => en.eventId === event.id && !en.scratched).length;
      const estStart = cursor != null ? fmtClock(cursor) : null;
      if (cursor != null) cursor += (heatCount * SECONDS_PER_HEAT_DEFAULT) / 60;
      return { eventNumber: event.eventNumber, eventName: eventName(event), heatCount, entryCount, estStart };
    });
    timelineSessions.push({
      name: sess.name,
      sessionType: sess.sessionType,
      date: sess.date,
      warmupTime: sess.warmupTime,
      startTime: sess.startTime,
      events,
      estEndMinutes: cursor != null && startMin != null ? cursor - startMin : 0,
    });
  }

  const unassigned = allEvents.filter((e) => !grouped.has(e.id));
  if (unassigned.length > 0) {
    timelineSessions.push({
      name: "Unassigned Events",
      events: unassigned.map((event) => {
        const heatCount =
          s.heats.filter((h) => h.eventId === event.id).length ||
          Math.max(1, Math.ceil(s.entries.filter((en) => en.eventId === event.id && !en.scratched).length / (meet.lanes || 8)));
        const entryCount = s.entries.filter((en) => en.eventId === event.id && !en.scratched).length;
        return { eventNumber: event.eventNumber, eventName: eventName(event), heatCount, entryCount, estStart: null };
      }),
      estEndMinutes: 0,
    });
  }

  return { meet, sessions: timelineSessions };
}
