/**
 * EV3 / HY-TEK Meet Manager event file parser
 *
 * EV3 is a fixed-width text format used by Hy-Tek for exchanging
 * swimmer entry data between clubs and meet hosts.
 *
 * Record types we handle:
 *   A0  – File header
 *   B1  – Meet information
 *   C1  – Team / club record
 *   D1  – Individual athlete record
 *   D3  – Individual entry record
 *   E1  – Relay team record
 *   E3  – Relay entry record
 *   Z0  – File trailer
 */

export interface Ev3Team {
  abbr: string;
  name: string;
  shortName: string;
  lscId: string;
}

export interface Ev3Athlete {
  teamAbbr: string;
  preferredName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  sex: "M" | "F" | "X";
  birthDate: string; // MMDDYYYY
  age: number | null;
  ussNumber: string;
  attachCode: string;
}

export interface Ev3Entry {
  teamAbbr: string;
  athleteLastName: string;
  athleteFirstName: string;
  sex: "M" | "F";
  eventSex: "M" | "F" | "X";
  eventAge: string;
  eventDistance: number;
  eventStroke: string;
  seedTime: number | null; // seconds
  seedCourse: "Y" | "S" | "L" | "";
  eventNumber: string;
  ageGroup: string;
}

export interface Ev3RelayEntry {
  teamAbbr: string;
  teamName: string;
  sex: "M" | "F" | "X";
  eventAge: string;
  eventDistance: number;
  eventStroke: string;
  seedTime: number | null;
  seedCourse: string;
  eventNumber: string;
}

export interface Ev3Meet {
  name: string;
  facility: string;
  startDate: string;
  endDate: string;
  lscId: string;
}

export interface Ev3ParseResult {
  meet: Ev3Meet | null;
  teams: Ev3Team[];
  athletes: Ev3Athlete[];
  entries: Ev3Entry[];
  relayEntries: Ev3RelayEntry[];
  errors: string[];
}

// stroke code → readable name
const STROKE_MAP: Record<string, string> = {
  "1": "Freestyle",
  "2": "Backstroke",
  "3": "Breaststroke",
  "4": "Butterfly",
  "5": "Individual Medley",
  "6": "Freestyle Relay",
  "7": "Medley Relay",
};

// Parse a Hy-Tek time string (e.g. "  15432" = 1:54.32) to seconds
// Format is either blank/zeros (NT) or right-justified integer (hundredths of seconds * 100? no — tenths of seconds)
// In SDIF/EV3 the time is stored as tenths-of-seconds in a 7-char field
function parseHytekTime(raw: string): number | null {
  const s = raw.trim();
  if (!s || s === "0" || s === "000000" || parseInt(s, 10) === 0) return null;
  const hundredths = parseInt(s, 10);
  if (isNaN(hundredths) || hundredths === 0) return null;
  // EV3 stores time as hundredths of a second
  return hundredths / 100;
}

function parseDate(raw: string): string {
  // MMDDYYYY → YYYY-MM-DD
  const s = raw.trim();
  if (s.length !== 8) return s;
  return `${s.slice(4, 8)}-${s.slice(0, 2)}-${s.slice(2, 4)}`;
}

function col(line: string, start: number, end: number): string {
  return (line.substring(start, end) ?? "").trimEnd();
}

export function parseEv3(content: string): Ev3ParseResult {
  const result: Ev3ParseResult = {
    meet: null,
    teams: [],
    athletes: [],
    entries: [],
    relayEntries: [],
    errors: [],
  };

  const lines = content.split(/\r?\n/);
  let currentTeamAbbr = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 2) continue;
    const recType = line.substring(0, 2).toUpperCase();

    try {
      switch (recType) {
        case "B1": {
          // Meet record: cols 3-32 name, 33-62 facility, 63-70 start, 71-78 end, 167-170 LSC
          result.meet = {
            name: col(line, 2, 32).trim(),
            facility: col(line, 32, 62).trim(),
            startDate: parseDate(col(line, 62, 70)),
            endDate: parseDate(col(line, 70, 78)),
            lscId: col(line, 166, 170).trim(),
          };
          break;
        }
        case "C1": {
          // Team: cols 3-7 abbr, 8-37 name, 38-47 short, 168-171 LSC
          const abbr = col(line, 2, 7).trim();
          currentTeamAbbr = abbr;
          result.teams.push({
            abbr,
            name: col(line, 7, 37).trim(),
            shortName: col(line, 37, 47).trim(),
            lscId: col(line, 167, 171).trim(),
          });
          break;
        }
        case "D1": {
          // Athlete: cols 3 sex, 4-23 last, 24-33 first, 34-37 middle, 38-45 birthdate, 46-47 age, 65-79 USS#, 3 team
          const sex = col(line, 2, 3).toUpperCase();
          const lastName = col(line, 3, 23).trim();
          const firstName = col(line, 23, 33).trim();
          const middleName = col(line, 33, 37).trim();
          const birthDate = col(line, 37, 45).trim();
          const ageStr = col(line, 45, 47).trim();
          const ussNumber = col(line, 64, 80).trim();
          const attachCode = col(line, 80, 81).trim();
          const teamAbbrD1 = col(line, 149, 154).trim() || currentTeamAbbr;
          result.athletes.push({
            teamAbbr: teamAbbrD1,
            preferredName: firstName,
            lastName,
            firstName,
            middleName,
            sex: (sex === "M" || sex === "F") ? sex : "X",
            birthDate,
            age: ageStr ? parseInt(ageStr, 10) : null,
            ussNumber,
            attachCode,
          });
          break;
        }
        case "D3": {
          // Entry: cols 3 sex, 4-23 last, 24-33 first, 34 event sex, 35-38 age group, 39-42 distance, 43 stroke, 
          //        44-50 seed time (hundredths), 51 course, 52-55 event number
          const sex = col(line, 2, 3).toUpperCase();
          const lastName = col(line, 3, 23).trim();
          const firstName = col(line, 23, 33).trim();
          const eventSex = col(line, 33, 34).toUpperCase();
          const ageGroup = col(line, 34, 38).trim();
          const distStr = col(line, 38, 42).trim();
          const strokeCode = col(line, 42, 43).trim();
          const seedTimeRaw = col(line, 43, 50).trim();
          const seedCourse = col(line, 50, 51).trim().toUpperCase();
          const eventNumber = col(line, 51, 55).trim();
          const teamAbbrD3 = col(line, 149, 154).trim() || currentTeamAbbr;

          const distance = parseInt(distStr, 10) || 0;
          const strokeName = STROKE_MAP[strokeCode] || strokeCode;
          const seedTime = parseHytekTime(seedTimeRaw);

          result.entries.push({
            teamAbbr: teamAbbrD3,
            athleteLastName: lastName,
            athleteFirstName: firstName,
            sex: (sex === "M" || sex === "F") ? sex : "F",
            eventSex: (eventSex === "M" || eventSex === "F" || eventSex === "X") ? eventSex as "M" | "F" | "X" : "X",
            eventAge: ageGroup,
            eventDistance: distance,
            eventStroke: strokeName,
            seedTime,
            seedCourse: (seedCourse === "Y" || seedCourse === "S" || seedCourse === "L") ? seedCourse : "",
            eventNumber,
            ageGroup,
          });
          break;
        }
        case "E1": {
          // Relay team: cols 3 sex, 4-7 team abbr, 8-37 team name, 34 event sex, 35-38 age, 39-42 distance, 43 stroke, 
          //             44-50 seed time, 51 course, 52-55 event number
          const sex = col(line, 2, 3).toUpperCase();
          const teamAbbrE1 = col(line, 3, 7).trim() || currentTeamAbbr;
          const teamName = col(line, 7, 37).trim();
          const eventSex = col(line, 33, 34).toUpperCase();
          const ageGroup = col(line, 34, 38).trim();
          const distStr = col(line, 38, 42).trim();
          const strokeCode = col(line, 42, 43).trim();
          const seedTimeRaw = col(line, 43, 50).trim();
          const seedCourse = col(line, 50, 51).trim().toUpperCase();
          const eventNumber = col(line, 51, 55).trim();

          result.relayEntries.push({
            teamAbbr: teamAbbrE1,
            teamName,
            sex: (sex === "M" || sex === "F" || sex === "X") ? sex as "M" | "F" | "X" : "X",
            eventAge: ageGroup,
            eventDistance: parseInt(distStr, 10) || 0,
            eventStroke: STROKE_MAP[strokeCode] || strokeCode,
            seedTime: parseHytekTime(seedTimeRaw),
            seedCourse,
            eventNumber,
          });
          break;
        }
        // A0, E3, Z0 — skip
        default:
          break;
      }
    } catch (e: any) {
      result.errors.push(`Line ${i + 1} (${recType}): ${e?.message ?? e}`);
    }
  }

  return result;
}

/** Convert an Ev3ParseResult into a summary string for display */
export function ev3Summary(r: Ev3ParseResult): string {
  const parts: string[] = [];
  if (r.meet) parts.push(`Meet: ${r.meet.name}`);
  parts.push(`${r.teams.length} team(s)`);
  parts.push(`${r.athletes.length} athlete(s)`);
  parts.push(`${r.entries.length} individual entr${r.entries.length === 1 ? "y" : "ies"}`);
  if (r.relayEntries.length) parts.push(`${r.relayEntries.length} relay entr${r.relayEntries.length === 1 ? "y" : "ies"}`);
  if (r.errors.length) parts.push(`${r.errors.length} parse error(s)`);
  return parts.join(" · ");
}
