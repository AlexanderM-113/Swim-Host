// Minimal SDIF parser for server-side import processing
// Mirrors the frontend sdif.ts library but as a CommonJS-compatible module

export interface SDIFFile {
  fileDescription?: { orgCode: string; createdDate: string; fileName: string; softwareVersion: string; programName: string };
  meet?: { orgCode: string; name: string; facility: string; startDate: string; endDate: string; course: string; altitude: number };
  teams: SDIFTeam[];
}

export interface SDIFTeam {
  code: string; abbreviation: string; name: string; lsc: string; country: string; entries: SDIFEntry[];
}

export interface SDIFEntry {
  athleteLastName: string; athleteFirstName: string; middleInitial: string; ussNumber: string;
  dateOfBirth: string; ageMin: number; ageMax: number; gender: string;
  eventNumber: number; eventGender: string; distance: number; stroke: string;
  seedTime: number | null; seedCourse: string;
  result?: { finishTime: number | null; course: string; place: number | null; points: number; dq: boolean; dqCode: string; ns: boolean; dnf: boolean; splits: number[] };
}

function parseSdifDate(s: string): string {
  if (!s || s.trim() === "") return "";
  return `${s.substring(4, 8)}-${s.substring(0, 2)}-${s.substring(2, 4)}`;
}

function parseSdifTime(s: string): number | null {
  if (!s || s.trim() === "" || s.trim() === "NT") return null;
  const clean = s.trim().replace(":", "");
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx === -1) { const v = parseFloat(clean); return isNaN(v) ? null : v; }
  const whole = clean.substring(0, dotIdx);
  const frac = clean.substring(dotIdx + 1);
  const hundredths = parseInt(frac.padEnd(2, "0").substring(0, 2)) / 100;
  const wholeNum = parseInt(whole) || 0;
  if (wholeNum >= 100) { const mins = Math.floor(wholeNum / 100); const secs = wholeNum % 100; return mins * 60 + secs + hundredths; }
  return wholeNum + hundredths;
}

const STROKE_CODE_TO_NAME: Record<number, string> = {
  1: "Freestyle", 2: "Backstroke", 3: "Breaststroke", 4: "Butterfly",
  5: "Individual Medley", 6: "Freestyle Relay", 7: "Medley Relay", 8: "Diving",
};

export function parseSDIF(text: string): SDIFFile {
  const result: SDIFFile = { teams: [] };
  const lines = text.split(/\r?\n/);
  let currentTeam: SDIFTeam | null = null;
  let currentEntry: SDIFEntry | null = null;

  for (const rawLine of lines) {
    if (rawLine.length < 2) continue;
    const code = rawLine.substring(0, 2);
    const line = rawLine.padEnd(200, " ");
    switch (code) {
      case "A0":
        result.fileDescription = { orgCode: line[2], createdDate: parseSdifDate(line.substring(3, 11)), fileName: line.substring(11, 29).trim(), softwareVersion: line.substring(29, 41).trim(), programName: line.substring(41, 45).trim() };
        break;
      case "B1":
        result.meet = { orgCode: line[2], name: line.substring(11, 30).trim(), facility: line.substring(30, 65).trim(), startDate: parseSdifDate(line.substring(65, 73)), endDate: parseSdifDate(line.substring(73, 81)), altitude: parseInt(line.substring(81, 85)) || 0, course: line[85]?.trim() || "Y" };
        break;
      case "C1":
        if (currentTeam) { if (currentEntry) { currentTeam.entries.push(currentEntry); currentEntry = null; } result.teams.push(currentTeam); }
        currentEntry = null;
        currentTeam = { code: line.substring(3, 7).trim(), abbreviation: line.substring(7, 19).trim(), name: line.substring(19, 44).trim(), lsc: line.substring(44, 48).trim(), country: line.substring(48, 51).trim(), entries: [] };
        break;
      case "D0":
        if (currentTeam && currentEntry) currentTeam.entries.push(currentEntry);
        currentEntry = { athleteLastName: line.substring(3, 21).trim(), athleteFirstName: line.substring(21, 29).trim(), middleInitial: line[29]?.trim() ?? "", ussNumber: line.substring(30, 42).trim(), dateOfBirth: parseSdifDate(line.substring(43, 51)), ageMin: parseInt(line.substring(51, 53)) || 0, ageMax: parseInt(line.substring(53, 55)) || 0, gender: line[55]?.trim() || "M", eventNumber: parseInt(line.substring(56, 60)) || 0, eventGender: line[60]?.trim() || "M", distance: parseInt(line.substring(61, 65)) || 0, stroke: STROKE_CODE_TO_NAME[parseInt(line.substring(65, 67))] ?? "Freestyle", seedTime: parseSdifTime(line.substring(73, 80)), seedCourse: line[80]?.trim() ?? "Y" };
        break;
      case "D3":
        if (currentTeam && currentEntry) {
          currentEntry.result = { finishTime: parseSdifTime(line.substring(73, 80)), course: line[80]?.trim() ?? "Y", place: parseInt(line.substring(81, 85)) || null, points: parseFloat(line.substring(85, 89)) || 0, dq: line[89]?.trim() === "1", dqCode: line.substring(90, 92).trim(), ns: line[92]?.trim() === "1", dnf: line[93]?.trim() === "1", splits: [] };
        }
        break;
      case "Z0":
        if (currentTeam) { if (currentEntry) { currentTeam.entries.push(currentEntry); currentEntry = null; } result.teams.push(currentTeam); currentTeam = null; }
        break;
    }
  }
  if (currentTeam) { if (currentEntry) currentTeam.entries.push(currentEntry); result.teams.push(currentTeam); }
  return result;
}

export interface SDIFImportSummary {
  meetName: string; course: string; startDate: string; teamCount: number; entryCount: number;
  teams: Array<{ code: string; name: string; entryCount: number }>;
  entries: Array<{ teamCode: string; athleteFirstName: string; athleteLastName: string; gender: string; dateOfBirth: string; ussNumber: string; distance: number; stroke: string; eventNumber: number; eventGender: string; ageMin: number; ageMax: number; seedTime: number | null; seedCourse: string; result?: SDIFEntry["result"] }>;
}

const COURSE_CODE_TO_NAME: Record<string, string> = { Y: "SCY", S: "SCM", L: "LCM" };

export function summarizeSDIF(sdif: SDIFFile): SDIFImportSummary {
  const entries: SDIFImportSummary["entries"] = [];
  for (const team of sdif.teams) {
    for (const e of team.entries) {
      entries.push({ teamCode: team.code, athleteFirstName: e.athleteFirstName, athleteLastName: e.athleteLastName, gender: e.gender, dateOfBirth: e.dateOfBirth, ussNumber: e.ussNumber, distance: e.distance, stroke: e.stroke, eventNumber: e.eventNumber, eventGender: e.eventGender, ageMin: e.ageMin, ageMax: e.ageMax, seedTime: e.seedTime, seedCourse: e.seedCourse, result: e.result });
    }
  }
  return { meetName: sdif.meet?.name ?? "Unknown Meet", course: COURSE_CODE_TO_NAME[sdif.meet?.course ?? "Y"] ?? "SCY", startDate: sdif.meet?.startDate ?? "", teamCount: sdif.teams.length, entryCount: entries.length, teams: sdif.teams.map((t) => ({ code: t.code, name: t.name || t.abbreviation || t.code, entryCount: t.entries.length })), entries };
}
