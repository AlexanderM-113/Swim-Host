/**
 * SDIF (Swimming Data Interchange Format) Library
 * Supports: Hy-Tek Meet Manager (.hy3) and Colorado Timing (.cl2) formats
 *
 * SDIF v3.0 — USA Swimming standard fixed-width ASCII records
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SDIFFile {
  fileDescription?: SDIFFileDesc;
  meet?: SDIFMeet;
  teams: SDIFTeam[];
}

export interface SDIFFileDesc {
  orgCode: string;
  createdDate: string;
  fileName: string;
  softwareVersion: string;
  programName: string;
}

export interface SDIFMeet {
  orgCode: string;
  name: string;
  facility: string;
  startDate: string;
  endDate: string;
  course: "Y" | "S" | "L" | string; // Y=SCY, S=SCM, L=LCM
  altitude: number;
}

export interface SDIFTeam {
  code: string;       // 4-char team code
  abbreviation: string;
  name: string;
  lsc: string;
  country: string;
  entries: SDIFEntry[];
}

export interface SDIFEntry {
  athleteLastName: string;
  athleteFirstName: string;
  middleInitial: string;
  ussNumber: string;
  dateOfBirth: string;   // MMDDYYYY
  ageMin: number;
  ageMax: number;
  gender: "M" | "F" | "X";
  eventNumber: number;
  eventGender: "M" | "F" | "X";
  distance: number;
  stroke: SDIFStroke;
  seedTime: number | null;   // seconds
  seedCourse: string;
  result?: SDIFResult;
}

export interface SDIFResult {
  finishTime: number | null;
  course: string;
  place: number | null;
  points: number;
  dq: boolean;
  dqCode: string;
  ns: boolean;
  dnf: boolean;
  splits: number[];
}

// Swimming stroke codes (SDIF spec):
// 01=Freestyle, 02=Backstroke, 03=Breaststroke, 04=Butterfly
// 05=Individual Medley, 06=Freestyle Relay, 07=Medley Relay
// 08=Diving (not used here)
export type SDIFStroke = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const STROKE_CODE_TO_NAME: Record<number, string> = {
  1: "Freestyle",
  2: "Backstroke",
  3: "Breaststroke",
  4: "Butterfly",
  5: "Individual Medley",
  6: "Freestyle Relay",
  7: "Medley Relay",
  8: "Diving",
};

export const STROKE_NAME_TO_CODE: Record<string, number> = {
  "freestyle": 1,
  "backstroke": 2,
  "breaststroke": 3,
  "butterfly": 4,
  "individual medley": 5,
  "im": 5,
  "freestyle relay": 6,
  "medley relay": 7,
  "diving": 8,
};

export const COURSE_CODE_TO_NAME: Record<string, string> = {
  Y: "SCY",
  S: "SCM",
  L: "LCM",
};

export const COURSE_NAME_TO_CODE: Record<string, string> = {
  SCY: "Y",
  SCM: "S",
  LCM: "L",
  "short course yards": "Y",
  "short course meters": "S",
  "long course meters": "L",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(s: string | number, len: number, right = false): string {
  const str = String(s ?? "");
  if (right) return str.substring(0, len).padEnd(len, " ");
  return str.substring(0, len).padStart(len, " ");
}

function sdifDate(dateStr: string): string {
  if (!dateStr) return "        ";
  try {
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}${dd}${yyyy}`;
  } catch {
    return "        ";
  }
}

function parseSdifDate(s: string): string {
  if (!s || s.trim() === "") return "";
  const mm = s.substring(0, 2);
  const dd = s.substring(2, 4);
  const yyyy = s.substring(4, 8);
  if (!mm || !dd || !yyyy) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format time (seconds) as SDIF time string: " MMSScc" (7 chars)
 * Examples: 50.45s -> "  50.45", 1:52.34 -> " 152.34", NT -> "       "
 */
function sdifTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "       ";
  const totalHundredths = Math.round(seconds * 100);
  const hundredths = totalHundredths % 100;
  const totalSecs = Math.floor(totalHundredths / 100);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60);

  const hh = String(hundredths).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  if (mins > 0) {
    return ` ${mins}${ss}.${hh}`;
  } else {
    return `  ${ss}.${hh}`;
  }
}

/**
 * Parse SDIF time string to seconds
 * Format " MMSScc" or "  SScc" etc.
 */
function parseSdifTime(s: string): number | null {
  if (!s || s.trim() === "" || s.trim() === "NT") return null;
  const clean = s.trim().replace(":", "");
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx === -1) {
    const secs = parseFloat(clean);
    return isNaN(secs) ? null : secs;
  }
  const whole = clean.substring(0, dotIdx);
  const frac = clean.substring(dotIdx + 1);
  const hundredths = parseInt(frac.padEnd(2, "0").substring(0, 2)) / 100;
  const wholeNum = parseInt(whole) || 0;

  // "whole" might be encoded as MMSS where MM could be > 59
  if (wholeNum >= 100) {
    const mins = Math.floor(wholeNum / 100);
    const secs = wholeNum % 100;
    return mins * 60 + secs + hundredths;
  }
  return wholeNum + hundredths;
}

function genderCode(g: string): string {
  if (g === "M" || g === "Male" || g === "Boys" || g === "Men") return "M";
  if (g === "F" || g === "Female" || g === "Girls" || g === "Women") return "F";
  return "X";
}

function parseStrokeCode(code: string | number): string {
  const n = typeof code === "string" ? parseInt(code) : code;
  return STROKE_CODE_TO_NAME[n] ?? "Freestyle";
}

function strokeToCode(name: string): number {
  return STROKE_NAME_TO_CODE[name.toLowerCase()] ?? 1;
}

// ─── PARSER ───────────────────────────────────────────────────────────────────

/**
 * Parse SDIF text (from .hy3 or .cl2 file) into structured data.
 * Handles both strict SDIF fixed-width and some looser variants.
 */
export function parseSDIF(text: string): SDIFFile {
  const result: SDIFFile = { teams: [] };
  const lines = text.split(/\r?\n/);
  let currentTeam: SDIFTeam | null = null;
  let currentEntry: SDIFEntry | null = null;

  for (const rawLine of lines) {
    if (rawLine.length < 2) continue;
    const code = rawLine.substring(0, 2);
    // Pad to at least 160 chars for safe slicing
    const line = rawLine.padEnd(200, " ");

    switch (code) {
      case "A0": {
        result.fileDescription = {
          orgCode: line[2] ?? " ",
          createdDate: parseSdifDate(line.substring(3, 11)),
          fileName: line.substring(11, 29).trim(),
          softwareVersion: line.substring(29, 41).trim(),
          programName: line.substring(41, 45).trim(),
        };
        break;
      }

      case "B1": {
        result.meet = {
          orgCode: line[2] ?? " ",
          name: line.substring(11, 30).trim(),
          facility: line.substring(30, 65).trim(),
          startDate: parseSdifDate(line.substring(65, 73)),
          endDate: parseSdifDate(line.substring(73, 81)),
          altitude: parseInt(line.substring(81, 85)) || 0,
          course: line[85]?.trim() || "Y",
        };
        break;
      }

      case "C1": {
        // Push previous team
        if (currentTeam) {
          if (currentEntry) {
            currentTeam.entries.push(currentEntry);
            currentEntry = null;
          }
          result.teams.push(currentTeam);
        }
        currentEntry = null;
        currentTeam = {
          code: line.substring(3, 7).trim(),
          abbreviation: line.substring(7, 19).trim(),
          name: line.substring(19, 44).trim(),
          lsc: line.substring(44, 48).trim(),
          country: line.substring(48, 51).trim(),
          entries: [],
        };
        break;
      }

      case "D0": {
        // Individual event entry (SDIF v3.0 field positions, 1-indexed in spec)
        if (currentTeam && currentEntry) {
          currentTeam.entries.push(currentEntry);
        }
        currentEntry = {
          athleteLastName: line.substring(3, 21).trim(),   // cols 4-21
          athleteFirstName: line.substring(21, 29).trim(), // cols 22-29
          middleInitial: line[29]?.trim() ?? "",           // col 30
          ussNumber: line.substring(30, 42).trim(),        // cols 31-42
          // col 43 = blank/attached flag (skipped)
          dateOfBirth: parseSdifDate(line.substring(43, 51)), // cols 44-51
          ageMin: parseInt(line.substring(51, 53)) || 0,   // cols 52-53
          ageMax: parseInt(line.substring(53, 55)) || 0,   // cols 54-55
          gender: (line[55]?.trim() || "M") as "M" | "F" | "X", // col 56
          eventNumber: parseInt(line.substring(56, 60)) || 0,    // cols 57-60
          eventGender: (line[60]?.trim() || "M") as "M" | "F" | "X", // col 61
          distance: parseInt(line.substring(61, 65)) || 0, // cols 62-65
          stroke: (parseInt(line.substring(65, 67)) || 1) as SDIFStroke, // cols 66-67
          // cols 68-72 = event sex/age/other (skipped)
          seedTime: parseSdifTime(line.substring(72, 79)), // cols 73-79 (7 chars)
          seedCourse: line[79]?.trim() || "Y",             // col 80
        };
        break;
      }

      case "D3": {
        // Individual event result — same header as D0; finish time at same position
        if (currentTeam && currentEntry) {
          // Result for preceding D0 entry
          currentEntry.result = {
            finishTime: parseSdifTime(line.substring(72, 79)), // cols 73-79
            course: line[79]?.trim() || "Y",                   // col 80
            place: parseInt(line.substring(80, 84)) || null,   // cols 81-84
            points: parseFloat(line.substring(84, 88)) || 0,  // cols 85-88
            dq: line[88]?.trim() === "1",                      // col 89
            dqCode: line.substring(89, 91).trim(),             // cols 90-91
            ns: line[91]?.trim() === "1",                      // col 92
            dnf: line[92]?.trim() === "1",                     // col 93
            splits: [],
          };
        } else if (currentTeam) {
          // Standalone result (results-only file without preceding D0)
          // At cols 73-79, D3 has FINISH time (not seed time)
          const finishTime = parseSdifTime(line.substring(72, 79));
          currentEntry = {
            athleteLastName: line.substring(3, 21).trim(),
            athleteFirstName: line.substring(21, 29).trim(),
            middleInitial: line[29]?.trim() ?? "",
            ussNumber: line.substring(30, 42).trim(),
            dateOfBirth: parseSdifDate(line.substring(43, 51)),
            ageMin: parseInt(line.substring(51, 53)) || 0,
            ageMax: parseInt(line.substring(53, 55)) || 0,
            gender: (line[55]?.trim() || "M") as "M" | "F" | "X",
            eventNumber: parseInt(line.substring(56, 60)) || 0,
            eventGender: (line[60]?.trim() || "M") as "M" | "F" | "X",
            distance: parseInt(line.substring(61, 65)) || 0,
            stroke: (parseInt(line.substring(65, 67)) || 1) as SDIFStroke,
            seedTime: null, // D3 only has finish time, no seed time in standalone
            seedCourse: line[79]?.trim() || "Y",
            result: {
              finishTime,
              course: line[79]?.trim() || "Y",
              place: parseInt(line.substring(80, 84)) || null,
              points: parseFloat(line.substring(84, 88)) || 0,
              dq: line[88]?.trim() === "1",
              dqCode: line.substring(89, 91).trim(),
              ns: line[91]?.trim() === "1",
              dnf: line[92]?.trim() === "1",
              splits: [],
            },
          };
        }
        break;
      }

      case "E0":
      case "E1":
      case "E2": {
        // Relay event records — flush pending individual entry and skip relay parsing
        if (currentTeam && currentEntry) {
          currentTeam.entries.push(currentEntry);
          currentEntry = null;
        }
        break;
      }

      case "Z0": {
        // End of file — flush current team
        if (currentTeam) {
          if (currentEntry) {
            currentTeam.entries.push(currentEntry);
            currentEntry = null;
          }
          result.teams.push(currentTeam);
          currentTeam = null;
        }
        break;
      }
    }
  }

  // Flush anything remaining (malformed file without Z0)
  if (currentTeam) {
    if (currentEntry) currentTeam.entries.push(currentEntry);
    result.teams.push(currentTeam);
  }

  return result;
}

// ─── GENERATOR ────────────────────────────────────────────────────────────────

export interface SDIFExportOptions {
  type: "entries" | "results" | "both";
  programName?: string;
  softwareVersion?: string;
}

export interface SDIFExportData {
  meet: {
    name: string;
    facility?: string;
    city?: string;
    startDate: string;
    endDate?: string;
    course: string;
    altitude?: number;
    hostLsc?: string;
  };
  teams: Array<{
    code: string;
    abbreviation?: string;
    name: string;
    lsc?: string;
    entries: Array<{
      athleteLastName: string;
      athleteFirstName: string;
      gender: string;
      dateOfBirth?: string;
      ussNumber?: string;
      ageMin?: number;
      ageMax?: number;
      eventNumber: number;
      eventGender: string;
      distance: number;
      stroke: string;
      seedTime?: number | null;
      seedCourse?: string;
      result?: {
        finishTime?: number | null;
        place?: number | null;
        points?: number;
        dq?: boolean;
        dqCode?: string;
        ns?: boolean;
        dnf?: boolean;
      };
    }>;
  }>;
}

/**
 * Generate SDIF text for .hy3 / .cl2 export.
 */
export function generateSDIF(data: SDIFExportData, opts: SDIFExportOptions = { type: "entries" }): string {
  const lines: string[] = [];
  const now = new Date();
  const today = sdifDate(now.toISOString().split("T")[0]);

  // A0 — File Description (60 chars)
  const prog = pad(opts.programName ?? "SWMP", 4, true);
  const swver = pad(opts.softwareVersion ?? "SwimManager Pro 1.0", 12, true);
  const fname = pad(data.meet.name.substring(0, 18), 18, true);
  const a0 = `A01${today}${fname}${swver}${prog} ${today} 1    `;
  lines.push(a0.substring(0, 60));

  // B1 — Meet record (field sizes per SDIF v3 spec, 1-indexed cols)
  // col 4-11 = reserved (8), col 12-30 = meet name (19), col 31-65 = facility (35)
  // col 66-73 = start date (8), col 74-81 = end date (8), col 82-85 = altitude (4), col 86 = course (1)
  const meetName   = pad(data.meet.name, 19, true);
  const facility   = pad(data.meet.facility ?? data.meet.city ?? "", 35, true);
  const startDt    = sdifDate(data.meet.startDate);
  const endDt      = sdifDate(data.meet.endDate ?? data.meet.startDate);
  const alt        = pad(data.meet.altitude ?? 0, 4);
  const courseCode = COURSE_NAME_TO_CODE[data.meet.course] ?? data.meet.course[0] ?? "Y";
  const b1 = `B11        ${meetName}${facility}${startDt}${endDt}${alt}${courseCode}`;
  lines.push(b1.padEnd(90, " "));

  // C1 + D0/D3 per team/entry
  for (const team of data.teams) {
    // C1 — Team record (field sizes per SDIF v3 spec, 1-indexed cols)
    // col 4-7 = team code (4), col 8-19 = abbr (12), col 20-44 = name (25), col 45-48 = lsc (4), col 49-51 = country (3)
    const tCode    = pad(team.code, 4, true);
    const tAbbr    = pad(team.abbreviation ?? team.code, 12, true);
    const tName    = pad(team.name, 25, true);
    const tLsc     = pad(team.lsc ?? "", 4, true);
    const tCountry = pad("USA", 3, true);
    const c1 = `C11${tCode}${tAbbr}${tName}${tLsc}${tCountry}`;
    lines.push(c1.padEnd(60, " "));

    for (const e of team.entries) {
      // D0/D3 shared athlete header (field sizes per SDIF v3 spec):
      // col 4-21  = last name (18)
      // col 22-29 = first name (8)
      // col 30    = middle initial (1)
      // col 31-42 = USS number (12)
      // col 43    = attached flag (1)
      // col 44-51 = date of birth (8)
      // col 52-53 = age min (2)
      // col 54-55 = age max (2)
      // col 56    = gender (1)
      // col 57-60 = event number (4)
      // col 61    = event gender (1)
      // col 62-65 = distance (4)
      // col 66-67 = stroke (2)
      // col 68-72 = reserved (5)
      // col 73-79 = seed/finish time (7)
      // col 80    = course (1)
      const lname     = pad(e.athleteLastName, 18, true);
      const fname2    = pad(e.athleteFirstName, 8, true);
      const mi        = " ";
      const ussn      = pad(e.ussNumber ?? "", 12, true);
      const attached  = " ";
      const dob       = e.dateOfBirth ? sdifDate(e.dateOfBirth) : "        ";
      const ageMin    = pad(e.ageMin ?? 0, 2);
      const ageMax    = pad(e.ageMax ?? 99, 2);
      const gender    = genderCode(e.gender);
      const evtNum    = pad(e.eventNumber, 4);
      const evtGender = genderCode(e.eventGender);
      const dist      = pad(e.distance, 4);
      const stCode    = pad(strokeToCode(e.stroke), 2);
      const reserved  = "     ";
      const seedTime  = sdifTime(e.seedTime);
      const seedCourse = COURSE_NAME_TO_CODE[e.seedCourse ?? ""] ?? "Y";

      const includeEntry  = opts.type === "entries" || opts.type === "both";
      const includeResult = (opts.type === "results" || opts.type === "both") && e.result;

      if (includeEntry || !includeResult) {
        // D0 — Individual Event Entry (80 chars of meaningful data)
        const d0 = `D01${lname}${fname2}${mi}${ussn}${attached}${dob}${ageMin}${ageMax}${gender}${evtNum}${evtGender}${dist}${stCode}${reserved}${seedTime}${seedCourse}`;
        lines.push(d0.padEnd(116, " "));
      }

      if (includeResult && e.result) {
        // D3 — Individual Event Result (same header, finish time replaces seed time)
        const r         = e.result;
        const finTime   = sdifTime(r.finishTime);
        const finCourse = COURSE_NAME_TO_CODE[data.meet.course] ?? "Y";
        const place     = pad(r.place ?? 0, 4);
        const pts       = pad(r.points ?? 0, 4);
        const dqFlag    = r.dq ? "1" : "0";
        const dqCode    = pad(r.dqCode ?? "", 2, true);
        const nsFlag    = r.ns ? "1" : "0";
        const dnfFlag   = r.dnf ? "1" : "0";
        const d3 = `D31${lname}${fname2}${mi}${ussn}${attached}${dob}${ageMin}${ageMax}${gender}${evtNum}${evtGender}${dist}${stCode}${reserved}${finTime}${finCourse}${place}${pts}${dqFlag}${dqCode}${nsFlag}${dnfFlag}`;
        lines.push(d3.padEnd(120, " "));
      }
    }
  }

  // Z0 — End of file
  lines.push("Z0");

  return lines.join("\r\n") + "\r\n";
}

// ─── Utility: Convert app data to SDIF export data ────────────────────────────

export interface AppMeet {
  id: number;
  name: string;
  facility?: string | null;
  city?: string | null;
  startDate: string;
  endDate?: string | null;
  course: string;
  altitude?: number | null;
  hostLsc?: string | null;
}

export interface AppEvent {
  id: number;
  eventNumber: number;
  gender: string;
  distance: number;
  stroke: string;
  ageGroup?: string | null;
}

export interface AppEntry {
  id: number;
  eventId: number;
  athleteId: number;
  teamId?: number | null;
  seedTime?: number | null;
  seedCourse?: string | null;
  scratched: boolean;
  athleteName?: string | null;
  athleteLastName?: string;
  athleteFirstName?: string;
  teamName?: string | null;
  teamCode?: string | null;
  gender?: string;
  dateOfBirth?: string | null;
  ussNumber?: string | null;
  ageMin?: number;
  ageMax?: number;
  result?: {
    finishTime?: number | null;
    place?: number | null;
    points?: number;
    dq?: boolean;
    dqCode?: string;
    ns?: boolean;
    dnf?: boolean;
  };
}

export function buildSDIFExportData(
  meet: AppMeet,
  events: AppEvent[],
  entries: AppEntry[],
): SDIFExportData {
  // Group entries by team
  const teamMap = new Map<string, SDIFExportData["teams"][0]>();

  for (const entry of entries) {
    if (entry.scratched) continue;

    const event = events.find((e) => e.id === entry.eventId);
    if (!event) continue;

    const teamCode = entry.teamCode ?? "UNAT";
    const teamName = entry.teamName ?? "Unattached";

    if (!teamMap.has(teamCode)) {
      teamMap.set(teamCode, {
        code: teamCode,
        abbreviation: teamCode,
        name: teamName,
        entries: [],
      });
    }

    // Parse athlete name
    let lastName = entry.athleteLastName ?? "";
    let firstName = entry.athleteFirstName ?? "";
    if (!lastName && entry.athleteName) {
      const parts = entry.athleteName.split(" ");
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ") || firstName;
    }

    // Parse age group
    let ageMin = 0;
    let ageMax = 99;
    if (event.ageGroup) {
      const m = event.ageGroup.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) {
        ageMin = parseInt(m[1]);
        ageMax = parseInt(m[2]);
      } else if (/^\d+$/.test(event.ageGroup.trim())) {
        ageMin = ageMax = parseInt(event.ageGroup.trim());
      }
    }

    teamMap.get(teamCode)!.entries.push({
      athleteLastName: lastName,
      athleteFirstName: firstName,
      gender: entry.gender ?? event.gender,
      dateOfBirth: entry.dateOfBirth ?? undefined,
      ussNumber: entry.ussNumber ?? undefined,
      ageMin,
      ageMax,
      eventNumber: event.eventNumber,
      eventGender: event.gender,
      distance: event.distance,
      stroke: event.stroke,
      seedTime: entry.seedTime,
      seedCourse: entry.seedCourse ?? meet.course,
      result: entry.result,
    });
  }

  return {
    meet: {
      name: meet.name,
      facility: meet.facility ?? meet.city ?? undefined,
      city: meet.city ?? undefined,
      startDate: meet.startDate,
      endDate: meet.endDate ?? undefined,
      course: meet.course,
      altitude: meet.altitude ?? undefined,
      hostLsc: meet.hostLsc ?? undefined,
    },
    teams: Array.from(teamMap.values()),
  };
}

// ─── Utility: Import summary ──────────────────────────────────────────────────

export interface SDIFImportSummary {
  meetName: string;
  course: string;
  startDate: string;
  teamCount: number;
  entryCount: number;
  teams: Array<{ code: string; name: string; entryCount: number }>;
  entries: Array<{
    teamCode: string;
    athleteFirstName: string;
    athleteLastName: string;
    gender: string;
    dateOfBirth: string;
    ussNumber: string;
    distance: number;
    stroke: string;
    eventNumber: number;
    eventGender: string;
    ageMin: number;
    ageMax: number;
    seedTime: number | null;
    seedCourse: string;
    result?: SDIFResult;
  }>;
}

export function summarizeSDIF(sdif: SDIFFile): SDIFImportSummary {
  const entries: SDIFImportSummary["entries"] = [];

  for (const team of sdif.teams) {
    for (const e of team.entries) {
      entries.push({
        teamCode: team.code,
        athleteFirstName: e.athleteFirstName,
        athleteLastName: e.athleteLastName,
        gender: e.gender,
        dateOfBirth: e.dateOfBirth,
        ussNumber: e.ussNumber,
        distance: e.distance,
        stroke: parseStrokeCode(e.stroke),
        eventNumber: e.eventNumber,
        eventGender: e.eventGender,
        ageMin: e.ageMin,
        ageMax: e.ageMax,
        seedTime: e.seedTime,
        seedCourse: e.seedCourse,
        result: e.result,
      });
    }
  }

  return {
    meetName: sdif.meet?.name ?? "Unknown Meet",
    course: COURSE_CODE_TO_NAME[sdif.meet?.course ?? "Y"] ?? "SCY",
    startDate: sdif.meet?.startDate ?? "",
    teamCount: sdif.teams.length,
    entryCount: entries.length,
    teams: sdif.teams.map((t) => ({
      code: t.code,
      name: t.name || t.abbreviation || t.code,
      entryCount: t.entries.length,
    })),
    entries,
  };
}
