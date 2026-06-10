// CSV import/export for high-school style meets.
//
// USA-Swimming software speaks SDIF (.sd3); high-school meets are usually
// shuffled around as plain spreadsheets. This module reads a flexible entries
// CSV into an existing meet (creating teams / athletes / events / entries as
// needed) and exports a meet's entries and events back out as CSV.

import { readStore, writeStore, nextId } from "./local-store";
import type { Team, Athlete, Event, Entry } from "./local-store";
import { formatTime, parseTime } from "./format-time";

// ─── Generic CSV parse / serialize ───────────────────────────────────────────

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF/CR/LF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully empty rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const v = cell == null ? "" : String(cell);
          return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(",")
    )
    .join("\r\n");
}

/** Trigger a browser download of CSV text. */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Header matching ─────────────────────────────────────────────────────────

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function headerIndex(headers: string[], ...aliases: string[]): number {
  const norm = headers.map(normHeader);
  for (const a of aliases) {
    const idx = norm.indexOf(normHeader(a));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ─── Event label parsing ─────────────────────────────────────────────────────

export interface ParsedEvent {
  gender?: string; // "M" | "F" | "X" (mixed) — undefined falls back to athlete
  distance: number;
  stroke: string;
  isRelay: boolean;
}

/**
 * Parse a free-form event label like "Boys 200 IM", "100 Free",
 * "Girls 400 Medley Relay" into structured gender/distance/stroke.
 */
export function parseEventLabel(label: string): ParsedEvent | null {
  const s = label.trim();
  if (!s) return null;
  const distMatch = s.match(/(\d{2,4})/);
  const distance = distMatch ? parseInt(distMatch[1], 10) : 0;
  if (!distance) return null;

  const isRelay = /relay/i.test(s);
  let stroke: string;
  if (/medley/i.test(s)) stroke = isRelay ? "Medley Relay" : "Individual Medley";
  else if (/back/i.test(s)) stroke = "Backstroke";
  else if (/breast/i.test(s)) stroke = "Breaststroke";
  else if (/fly|butter/i.test(s)) stroke = "Butterfly";
  else if (/\bim\b/i.test(s)) stroke = "Individual Medley";
  else stroke = isRelay ? "Freestyle Relay" : "Freestyle";

  let gender: string | undefined;
  if (/\b(girls?|women|female)\b/i.test(s)) gender = "F";
  else if (/\b(boys?|men|male)\b/i.test(s)) gender = "M";
  else if (/\bmixed\b/i.test(s)) gender = "X";

  return { gender, distance, stroke, isRelay };
}

function normGender(raw: string | undefined): string {
  const g = (raw ?? "").trim().toUpperCase();
  if (g.startsWith("F") || g.startsWith("W") || g.startsWith("G")) return "F";
  if (g.startsWith("M") || g.startsWith("B")) return "M";
  if (g.startsWith("X")) return "X";
  return "M";
}

// ─── Entries CSV import ──────────────────────────────────────────────────────

export interface CSVImportResult {
  events: number;
  athletes: number;
  teams: number;
  entries: number;
  skipped: number;
  errors: string[];
}

/**
 * Import an entries CSV into an existing meet. Recognised columns (header names
 * are matched case/punctuation-insensitively, with aliases):
 *   - Last Name / First Name  (or a single "Name" / "Athlete" column)
 *   - Gender / Sex
 *   - Team / School / Club
 *   - Event / Event Name      (e.g. "Boys 200 IM", "100 Free")
 *   - Seed Time / Time        (e.g. "1:02.34", "58.10", "NT")
 *   - Course                  (SCY / SCM / LCM — optional)
 */
export function importMeetEntriesCSV(meetId: number, text: string): CSVImportResult {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("CSV has no data rows (need a header row plus at least one entry).");

  const headers = rows[0];
  const iLast = headerIndex(headers, "last name", "lastname", "last");
  const iFirst = headerIndex(headers, "first name", "firstname", "first");
  const iFull = headerIndex(headers, "name", "athlete", "swimmer");
  const iGender = headerIndex(headers, "gender", "sex");
  const iTeam = headerIndex(headers, "team", "school", "club", "team code", "teamcode", "team name");
  const iEvent = headerIndex(headers, "event", "event name", "eventname", "event number");
  const iSeed = headerIndex(headers, "seed time", "seedtime", "time", "entry time", "seed");
  const iCourse = headerIndex(headers, "course");

  if (iEvent < 0) throw new Error('Missing an "Event" column.');
  if (iLast < 0 && iFull < 0) throw new Error('Missing a name column ("Last Name" / "First Name" or "Name").');

  const store = readStore();
  const meet = store.meets.find((m) => m.id === meetId);
  if (!meet) throw new Error("Target meet not found.");

  const newTeams: Team[] = [];
  const newAthletes: Athlete[] = [];
  const newEvents: Event[] = [];
  const newEntries: Entry[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const teamByKey = new Map<string, number>();
  const athleteByKey = new Map<string, number>();
  const eventByKey = new Map<string, number>();

  function findOrCreateTeam(name: string): number {
    const clean = name.trim() || "UNAT";
    const key = clean.toLowerCase();
    if (teamByKey.has(key)) return teamByKey.get(key)!;
    const existing = store.teams.find(
      (t) => t.name.toLowerCase() === key || t.abbreviation?.toLowerCase() === key
    );
    if (existing) { teamByKey.set(key, existing.id); return existing.id; }
    const team: Team = {
      id: nextId([...store.teams, ...newTeams]),
      name: clean,
      abbreviation: clean.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "UNAT",
      createdAt: new Date().toISOString(),
    };
    newTeams.push(team);
    teamByKey.set(key, team.id);
    return team.id;
  }

  function findOrCreateAthlete(first: string, last: string, gender: string, teamId: number): number {
    const key = `${first.toLowerCase()}:${last.toLowerCase()}:${teamId}`;
    if (athleteByKey.has(key)) return athleteByKey.get(key)!;
    // CSV-imported entries feed a hosted meet, so created athletes are
    // meet-scoped (part of the Meet Roster), separate from Team Manager.
    // Only dedupe against athletes already in this meet's roster.
    const existing = store.athletes.find(
      (a) =>
        a.meetId === meetId &&
        a.firstName.toLowerCase() === first.toLowerCase() &&
        a.lastName.toLowerCase() === last.toLowerCase() &&
        a.teamId === teamId
    );
    if (existing) { athleteByKey.set(key, existing.id); return existing.id; }
    const athlete: Athlete = {
      id: nextId([...store.athletes, ...newAthletes]),
      firstName: first,
      lastName: last,
      gender,
      teamId,
      meetId,
      active: true,
      createdAt: new Date().toISOString(),
    };
    newAthletes.push(athlete);
    athleteByKey.set(key, athlete.id);
    return athlete.id;
  }

  function findOrCreateEvent(parsed: ParsedEvent, fallbackGender: string): number {
    const gender = parsed.gender ?? fallbackGender;
    const key = `${gender}:${parsed.distance}:${parsed.stroke}`;
    if (eventByKey.has(key)) return eventByKey.get(key)!;
    const existing = store.events.find(
      (e) =>
        e.meetId === meetId &&
        e.gender === gender &&
        e.distance === parsed.distance &&
        e.stroke === parsed.stroke
    );
    if (existing) { eventByKey.set(key, existing.id); return existing.id; }
    const allEvents = [...store.events, ...newEvents];
    const meetEventNums = allEvents.filter((e) => e.meetId === meetId).map((e) => e.eventNumber);
    const nextNum = (meetEventNums.length ? Math.max(...meetEventNums) : 0) + 1;
    const event: Event = {
      id: nextId(allEvents),
      meetId,
      eventNumber: nextNum,
      gender,
      distance: parsed.distance,
      stroke: parsed.stroke,
      isRelay: parsed.isRelay,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    newEvents.push(event);
    eventByKey.set(key, event.id);
    return event.id;
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : "");

    let first = get(iFirst);
    let last = get(iLast);
    if (!first && !last && iFull >= 0) {
      const full = get(iFull);
      if (full.includes(",")) {
        const [l, f] = full.split(",");
        last = (l ?? "").trim();
        first = (f ?? "").trim();
      } else {
        const parts = full.split(/\s+/);
        first = parts.shift() ?? "";
        last = parts.join(" ");
      }
    }
    const eventLabel = get(iEvent);
    if (!eventLabel) { skipped++; continue; }

    const parsed = parseEventLabel(eventLabel);
    if (!parsed) { errors.push(`Row ${r + 1}: couldn't read event "${eventLabel}".`); skipped++; continue; }

    // Relay rows without a swimmer still create the event so it shows up.
    if (!first && !last) {
      if (parsed.isRelay) { findOrCreateEvent(parsed, normGender(get(iGender))); }
      skipped++;
      continue;
    }

    const gender = normGender(get(iGender) || parsed.gender);
    const teamId = findOrCreateTeam(get(iTeam));
    const athleteId = findOrCreateAthlete(first, last, gender, teamId);
    const eventId = findOrCreateEvent(parsed, gender);

    const seedRaw = get(iSeed);
    const seedTime = seedRaw && !/^nt$/i.test(seedRaw) ? parseTime(seedRaw) : null;
    const seedCourse = get(iCourse) || meet.course || "SCY";

    // Skip exact duplicate (same athlete already entered in this event).
    const dup =
      newEntries.some((e) => e.eventId === eventId && e.athleteId === athleteId) ||
      store.entries.some((e) => e.eventId === eventId && e.athleteId === athleteId);
    if (dup) { skipped++; continue; }

    newEntries.push({
      id: nextId([...store.entries, ...newEntries]),
      meetId,
      eventId,
      athleteId,
      seedTime: seedTime ?? undefined,
      seedCourse,
      scratched: false,
      createdAt: new Date().toISOString(),
    });
  }

  writeStore({
    ...store,
    teams: [...store.teams, ...newTeams],
    athletes: [...store.athletes, ...newAthletes],
    events: [...store.events, ...newEvents],
    entries: [...store.entries, ...newEntries],
  });

  return {
    events: newEvents.length,
    athletes: newAthletes.length,
    teams: newTeams.length,
    entries: newEntries.length,
    skipped,
    errors,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

function eventLabel(e: Event): string {
  const g = e.gender === "F" ? "Girls" : e.gender === "M" ? "Boys" : "Mixed";
  return `${g} ${e.distance} ${e.stroke}`;
}

export function exportMeetEntriesCSV(meetId: number): string {
  const store = readStore();
  const events = store.events
    .filter((e) => e.meetId === meetId)
    .sort((a, b) => a.eventNumber - b.eventNumber);
  const rows: (string | number)[][] = [
    ["Event #", "Event", "Last Name", "First Name", "Gender", "Team", "Seed Time", "Course", "Scratched"],
  ];
  for (const event of events) {
    const entries = store.entries
      .filter((en) => en.eventId === event.id)
      .sort((a, b) => (a.seedTime ?? Infinity) - (b.seedTime ?? Infinity));
    for (const en of entries) {
      const athlete = store.athletes.find((a) => a.id === en.athleteId);
      const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
      rows.push([
        event.eventNumber,
        eventLabel(event),
        athlete?.lastName ?? "",
        athlete?.firstName ?? "",
        athlete?.gender ?? event.gender,
        team?.name ?? "",
        en.seedTime != null ? formatTime(en.seedTime) : "NT",
        en.seedCourse ?? "",
        en.scratched ? "Y" : "",
      ]);
    }
  }
  return toCSV(rows);
}

export function exportMeetEventsCSV(meetId: number): string {
  const store = readStore();
  const events = store.events
    .filter((e) => e.meetId === meetId)
    .sort((a, b) => a.eventNumber - b.eventNumber);
  const rows: (string | number)[][] = [
    ["Event #", "Gender", "Age Group", "Distance", "Stroke", "Relay", "Entries"],
  ];
  for (const event of events) {
    const entryCount = store.entries.filter((en) => en.eventId === event.id && !en.scratched).length;
    rows.push([
      event.eventNumber,
      event.gender,
      event.ageGroup ?? "Open",
      event.distance,
      event.stroke,
      event.isRelay ? "Y" : "",
      entryCount,
    ]);
  }
  return toCSV(rows);
}
