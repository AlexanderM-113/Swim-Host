// Hy-Tek MEET MANAGER ".ev3" events-file parser.
//
// Unlike SDIF (.sd3/.hy3/.cl2 — fixed-column records), a Hy-Tek ".ev3" events
// export is a semicolon-delimited text file. The first line is the meet header;
// every following line describes one event. A sample record:
//
//   1;1;F;1;I;W;0;109;1500;A;0;;;N;8.5;;19:57.09;;19:23.99;;19:39.09;1;1;1;08:00AM;L;1;1;0;0*>
//
// Field layout (0-based, 30 fields; the final token carries a "*>" terminator):
//    0  event number
//    1  event number (duplicate / score key)
//    2  round type:     F = timed/final, P = prelims (→ finals)
//    3  number of rounds (1 = timed final, 2 = prelims + finals)
//    4  I = individual, R = relay
//    5  gender:         W = women, M = men, X = mixed
//    6  low age         (0 = no minimum)
//    7  high age        (109 = no maximum / "open")
//    8  distance
//    9  stroke code:    A Free, B Back, C Breast, D Fly, E IM (E = Medley for relays)
//   14  entry fee
//   16/18/20  qualifying-standard times (individual events)
//   21  session number
//   22  order within session
//   23  day number
//   24  session start time (e.g. 08:00AM)
//   25  course:         L = LCM, S = SCM, Y = SCY
//   29  relay leg count (0 for individual)

export type Ev3Round = "prelim" | "final";
export type Ev3Gender = "M" | "F" | "X";

export interface Ev3MeetHeader {
  name: string;
  facility: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  ageUpDate?: string;
  software?: string;
  sanctionNumber?: string;
  city?: string;
  state?: string;
}

export interface Ev3Event {
  eventNumber: number;
  round: Ev3Round;
  rounds: number;
  isRelay: boolean;
  gender: Ev3Gender;
  lowAge: number;
  highAge: number;
  ageGroup: string;
  distance: number;
  strokeCode: string;
  stroke: string;
  eventType: string;
  entryFee: number | null;
  standards: number[];
  sessionNumber: number | null;
  orderInSession: number | null;
  day: number | null;
  sessionStart: string | null;
  course: string | null;
  relayLegs: number;
}

export interface ParsedEv3 {
  meet: Ev3MeetHeader;
  events: Ev3Event[];
  warnings: string[];
}

const STROKE_INDIVIDUAL: Record<string, string> = {
  A: "Freestyle",
  B: "Backstroke",
  C: "Breaststroke",
  D: "Butterfly",
  E: "Individual Medley",
};

const STROKE_RELAY: Record<string, string> = {
  A: "Freestyle Relay",
  E: "Medley Relay",
  // medley relays occasionally encode a leading stroke; fall back to Medley
  B: "Medley Relay",
  C: "Medley Relay",
  D: "Medley Relay",
};

const COURSE_MAP: Record<string, string> = { L: "LCM", S: "SCM", Y: "SCY", M: "SCM" };

/** Parse a Hy-Tek MM/DD/YYYY date into ISO yyyy-mm-dd (empty → ""). */
function parseHytekDate(s: string | undefined): string {
  if (!s) return "";
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return "";
  const [, mm, dd, yy] = m;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** Parse a Hy-Tek time string ("19:57.09", "1:02.49", "58.09") into seconds. */
export function parseHytekTime(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t === "0" || t === "NT") return null;
  const m = t.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const seconds = parseFloat(m[2]);
  if (Number.isNaN(seconds)) return null;
  return Math.round((minutes * 60 + seconds) * 100) / 100;
}

function ageGroupLabel(low: number, high: number): string {
  const noLow = !low || low <= 0;
  const noHigh = !high || high >= 100;
  if (noLow && noHigh) return "Open";
  if (noLow) return `${high} & Under`;
  if (noHigh) return `${low} & Over`;
  return `${low}-${high}`;
}

function mapGender(code: string): Ev3Gender {
  const c = (code || "").toUpperCase();
  if (c === "M" || c === "B") return "M";
  if (c === "W" || c === "F" || c === "G") return "F";
  return "X";
}

function strip(value: string | undefined): string {
  return (value ?? "").replace(/\*>?\s*$/, "").trim();
}

function parseHeader(fields: string[]): Ev3MeetHeader {
  return {
    name: strip(fields[0]) || "Imported Meet",
    facility: strip(fields[1]),
    startDate: parseHytekDate(fields[2]),
    endDate: parseHytekDate(fields[3]) || parseHytekDate(fields[2]),
    ageUpDate: parseHytekDate(fields[4]) || undefined,
    software: strip(fields[9]) || undefined,
    sanctionNumber: strip(fields[14]) || undefined,
    city: strip(fields[26]) || undefined,
    state: strip(fields[27]) || undefined,
  };
}

function parseEventLine(line: string, warnings: string[]): Ev3Event | null {
  const f = line.split(";");
  if (f.length < 10) {
    warnings.push(`Skipped malformed event line: "${line.slice(0, 40)}…"`);
    return null;
  }

  const eventNumber = parseInt(strip(f[0]), 10);
  if (Number.isNaN(eventNumber)) {
    warnings.push(`Skipped event line with no event number: "${line.slice(0, 40)}…"`);
    return null;
  }

  const roundType = strip(f[2]).toUpperCase();
  const rounds = parseInt(strip(f[3]), 10) || (roundType === "P" ? 2 : 1);
  const isRelay = strip(f[4]).toUpperCase() === "R";
  const gender = mapGender(strip(f[5]));
  const lowAge = parseInt(strip(f[6]), 10) || 0;
  const highAge = parseInt(strip(f[7]), 10) || 0;
  const distance = parseInt(strip(f[8]), 10) || 0;
  const strokeCode = strip(f[9]).toUpperCase();
  const stroke = (isRelay ? STROKE_RELAY : STROKE_INDIVIDUAL)[strokeCode] ?? "Freestyle";

  const entryFee = (() => {
    const v = parseFloat(strip(f[14]));
    return Number.isNaN(v) ? null : v;
  })();

  const standards = [f[16], f[18], f[20]]
    .map((s) => parseHytekTime(strip(s)))
    .filter((n): n is number => n != null);

  const sessionNumber = parseInt(strip(f[21]), 10) || null;
  const orderInSession = parseInt(strip(f[22]), 10) || null;
  const day = parseInt(strip(f[23]), 10) || null;
  const sessionStart = strip(f[24]) || null;
  const courseCode = strip(f[25]).toUpperCase();
  const course = COURSE_MAP[courseCode] ?? (courseCode || null);
  const relayLegs = parseInt(strip(f[f.length - 1]), 10) || (isRelay ? 4 : 0);

  // "P" events run prelims then finals; "F" events are timed finals.
  const round: Ev3Round = roundType === "P" ? "prelim" : "final";
  const eventType = roundType === "P" ? "Prelims" : "Timed Finals";

  return {
    eventNumber,
    round,
    rounds,
    isRelay,
    gender,
    lowAge,
    highAge,
    ageGroup: ageGroupLabel(lowAge, highAge),
    distance,
    strokeCode,
    stroke,
    eventType,
    entryFee,
    standards,
    sessionNumber,
    orderInSession,
    day,
    sessionStart,
    course,
    relayLegs,
  };
}

/** Parse the full text of a Hy-Tek ".ev3" events file. */
export function parseEv3(text: string): ParsedEv3 {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\*>\s*$/, "").trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("The .ev3 file is empty.");
  }

  const headerFields = lines[0].split(";");
  if (headerFields.length < 4) {
    throw new Error("This does not look like a Hy-Tek .ev3 events file (unexpected header).");
  }
  const meet = parseHeader(headerFields);

  const events: Ev3Event[] = [];
  for (let i = 1; i < lines.length; i++) {
    const evt = parseEventLine(lines[i], warnings);
    if (evt) events.push(evt);
  }

  if (events.length === 0) {
    warnings.push("No events were found in the file.");
  }

  return { meet, events, warnings };
}

export interface Ev3Summary {
  meetName: string;
  dateRange: string;
  totalEvents: number;
  individualEvents: number;
  relayEvents: number;
  prelimEvents: number;
  timedFinalEvents: number;
  sessions: number;
}

export function summarizeEv3(parsed: ParsedEv3): Ev3Summary {
  const sessions = new Set(parsed.events.map((e) => e.sessionNumber).filter((n) => n != null));
  return {
    meetName: parsed.meet.name,
    dateRange:
      parsed.meet.startDate && parsed.meet.endDate
        ? `${parsed.meet.startDate} → ${parsed.meet.endDate}`
        : parsed.meet.startDate || "",
    totalEvents: parsed.events.length,
    individualEvents: parsed.events.filter((e) => !e.isRelay).length,
    relayEvents: parsed.events.filter((e) => e.isRelay).length,
    prelimEvents: parsed.events.filter((e) => e.round === "prelim").length,
    timedFinalEvents: parsed.events.filter((e) => e.round === "final").length,
    sessions: sessions.size,
  };
}
