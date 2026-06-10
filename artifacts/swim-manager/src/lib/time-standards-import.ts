import { parseTime } from "./format-time";

/**
 * A single parsed time-standard row, ready to be turned into a TimeStandard
 * store record (id/createdAt added by the caller).
 */
export interface ParsedTimeStandard {
  name: string;
  tier: string;
  course: string;
  gender: string;
  ageMin: number;
  ageMax: number;
  distance: number;
  stroke: string;
  cutTime: number;
}

export interface TimeStandardsParseResult {
  standards: ParsedTimeStandard[];
  skipped: number;
  warnings: string[];
}

const STROKE_MAP: Record<string, string> = {
  free: "Freestyle",
  freestyle: "Freestyle",
  fr: "Freestyle",
  back: "Backstroke",
  backstroke: "Backstroke",
  bk: "Backstroke",
  breast: "Breaststroke",
  breaststroke: "Breaststroke",
  br: "Breaststroke",
  fly: "Butterfly",
  butterfly: "Butterfly",
  fl: "Butterfly",
  im: "Individual Medley",
  medley: "Individual Medley",
  "individual medley": "Individual Medley",
};

const COURSE_MAP: Record<string, string> = {
  scy: "SCY", y: "SCY", scm: "SCM", s: "SCM", lcm: "LCM", l: "LCM",
};

function normCourse(token: string): string | null {
  return COURSE_MAP[token.trim().toLowerCase()] ?? null;
}

function normStroke(token: string): string | null {
  const t = token.trim().toLowerCase().replace(/[.]/g, "");
  return STROKE_MAP[t] ?? null;
}

function normGender(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (["m", "male", "men", "mens", "men's", "boy", "boys", "b"].includes(t)) return "M";
  if (["f", "female", "women", "womens", "women's", "girl", "girls", "g", "w"].includes(t)) return "F";
  if (["x", "mixed", "open"].includes(t)) return "X";
  return null;
}

/** Parse age tokens like "10&U", "10 & Under", "11-12", "15-16", "Open", "13&O". */
function parseAge(token: string): { ageMin: number; ageMax: number } | null {
  const t = token.trim().toLowerCase().replace(/\s+/g, "");
  if (!t || t === "open" || t === "all") return { ageMin: 0, ageMax: 99 };
  let m = t.match(/^(\d+)&u(nder)?$/);
  if (m) return { ageMin: 0, ageMax: parseInt(m[1], 10) };
  m = t.match(/^(\d+)&o(ver)?$/);
  if (m) return { ageMin: parseInt(m[1], 10), ageMax: 99 };
  m = t.match(/^(\d+)-(\d+)$/);
  if (m) return { ageMin: parseInt(m[1], 10), ageMax: parseInt(m[2], 10) };
  m = t.match(/^(\d+)$/);
  if (m) { const a = parseInt(m[1], 10); return { ageMin: a, ageMax: a }; }
  return null;
}

const TIME_RE = /^\d{0,2}:?\d{1,2}(\.\d{1,2})?$/;
function looksLikeTime(token: string): boolean {
  const t = token.trim();
  return TIME_RE.test(t) && /\d/.test(t) && (t.includes(":") || t.includes("."));
}

const KNOWN_TIERS = ["B", "BB", "A", "AA", "AAA", "AAAA", "Sectional", "Junior National", "National", "Futures", "OT", "Olympic Trials"];
function normTier(token: string): string | null {
  const t = token.trim();
  const upper = t.toUpperCase();
  const hit = KNOWN_TIERS.find((k) => k.toUpperCase() === upper);
  if (hit) return hit;
  if (/^A{1,4}$|^BB?$/.test(upper)) return upper;
  return null;
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim()).filter(Boolean);
  if (line.includes(",")) return line.split(",").map((s) => s.trim()).filter(Boolean);
  // Whitespace-delimited (collapse runs of spaces).
  return line.trim().split(/\s{2,}|\s(?=\d)|\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Tolerant parser for text-based time-standard files (.std exported as text,
 * .txt, or .csv). Detects columns heuristically per row, so it handles a
 * variety of vendor/USA-Swimming layouts. Binary Hy-Tek .std files are not
 * supported and produce a clear warning.
 */
export function parseTimeStandardsFile(text: string, defaultName = "Imported Standard"): TimeStandardsParseResult {
  const warnings: string[] = [];
  // Detect binary content (Hy-Tek native .std is a binary DB file).
  const sample = text.slice(0, 2000);
  const nonPrintable = (sample.match(/[\x00-\x08\x0e-\x1f]/g) ?? []).length;
  if (nonPrintable > 20) {
    return {
      standards: [],
      skipped: 0,
      warnings: [
        "This looks like a binary Hy-Tek .std file, which can't be read directly. In Team Manager, export the standards as a text/CSV file and import that instead.",
      ],
    };
  }

  const lines = text.split(/\r?\n/);
  const standards: ParsedTimeStandard[] = [];
  let skipped = 0;

  // Try to detect a header row to seed a column map.
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const cols = splitLine(line);
    if (cols.length < 4) { if (line) skipped++; continue; }

    // Skip obvious header rows (no time token present and contains words like "time"/"event").
    const hasTime = cols.some(looksLikeTime);
    if (!hasTime) {
      // Could be a header or section label; skip silently.
      continue;
    }

    let gender: string | null = null;
    let age: { ageMin: number; ageMax: number } | null = null;
    let distance: number | null = null;
    let stroke: string | null = null;
    let course: string | null = null;
    let tier: string | null = null;
    let cutTime: number | null = null;
    const leftovers: string[] = [];

    for (const col of cols) {
      if (cutTime == null && looksLikeTime(col)) { cutTime = parseTime(col); continue; }
      if (gender == null) { const g = normGender(col); if (g) { gender = g; continue; } }
      if (course == null) { const c = normCourse(col); if (c) { course = c; continue; } }
      if (stroke == null) { const s = normStroke(col); if (s) { stroke = s; continue; } }
      if (age == null) { const a = parseAge(col); if (a) { age = a; continue; } }
      if (distance == null && /^\d{2,4}$/.test(col.trim())) { distance = parseInt(col.trim(), 10); continue; }
      if (tier == null) { const t = normTier(col); if (t) { tier = t; continue; } }
      leftovers.push(col);
    }

    if (cutTime == null || distance == null || !stroke) { skipped++; continue; }

    standards.push({
      name: leftovers.join(" ") || defaultName,
      tier: tier ?? "Custom",
      course: course ?? "SCY",
      gender: gender ?? "X",
      ageMin: age?.ageMin ?? 0,
      ageMax: age?.ageMax ?? 99,
      distance,
      stroke,
      cutTime,
    });
  }

  if (standards.length === 0 && skipped > 0) {
    warnings.push("No time standards could be parsed. Expected columns like: Name, Gender, Age, Distance, Stroke, Course, Tier, Time.");
  }

  return { standards, skipped, warnings };
}
