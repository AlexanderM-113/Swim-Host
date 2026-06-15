// Hy-Tek Generic Scoreboard Interface.
//
// Byte-accurate implementation of the "Generic Swimming Scoreboard Format"
// (Hy-Tek MEET MANAGER generic serial interface, revised 9 Feb 2006). A
// scoreboard computer sends an 8-byte request over a serial COM port and the
// meet-management computer (this app) answers with one of four fixed-layout
// responses:
//
//   1. Generic Start List          (format "1", 502 bytes)
//   2. Generic Result List         (format "2", 502 bytes)
//   3. Generic Complete Event List (format "6", variable length)
//   4. Generic Team Score          (format "7"/"8"/"9", variable length)
//
// All fields are space-padded ASCII. Times are MM:SS.ss (e.g. "1:29.87").
//
// This module is pure (no DOM / store access) so it can be unit-tested and
// reused by both the in-app scoreboard and the serial bridge.

import { formatTime } from "./format-time";

// ─── Control characters & link settings ───────────────────────────────────────

export const STX = 0x02; // Start of Text  (request framing)
export const ETX = 0x04; // End of Text    (request + response framing)
export const SOH = 0x0d; // Start of Header (per spec, response framing = 0x0D)

// Default COM-port settings from the spec: 9600 baud, 7 data bits, even
// parity, 2 stop bits. Matches the Web Serial `open()` option shape.
export const SCOREBOARD_SERIAL_OPTIONS = {
  baudRate: 9600,
  dataBits: 7 as const,
  parity: "even" as const,
  stopBits: 2 as const,
};

// Format byte → message kind. Start-list / result-list share the request shape
// and are disambiguated by the format byte.
export const SB_FORMAT = {
  START_LIST: "1",
  RESULT_LIST: "2",
  COMPLETE_RESULT: "6",
  TEAM_SCORE_COMBINED: "7",
  TEAM_SCORE_WOMEN: "8",
  TEAM_SCORE_MEN: "9",
} as const;

export type ScoreboardRequestKind =
  | "startList"
  | "resultList"
  | "completeResult"
  | "teamScore";

export interface ScoreboardRequest {
  kind: ScoreboardRequestKind;
  eventNumber: number; // 1..999
  /** Raw 2-char second field: heat (start list), rank set (result list),
   *  round " P"/" S"/" F" (complete result), unused (team score). */
  field2: string;
  format: string; // the raw format byte ("1".."9")
  /** For team-score requests: the gender being scored. */
  scoreGender?: "combined" | "women" | "men";
  raw: string;
}

// ─── Row inputs ────────────────────────────────────────────────────────────────

/** One lane/finisher row for the Start List & Result List (38-byte) layout. */
export interface ResultInfoRow {
  lane: number | null; // 1..10 (10 is encoded as "0")
  name: string; // athlete "Last, First" or, for relays, the team name
  teamAbbr: string;
  place?: number | null; // blank on a start list
  time?: string | null; // pre-formatted MM:SS.ss, "DQ", or blank (start list)
}

/** One finisher row for the Complete Event Result (70-byte) layout. */
export interface AthleteInfoRow {
  rank: number;
  lastName: string; // relay → team abbreviation
  firstName: string; // relay → relay letter ("A"/"B"/…)
  ageOrYear: string; // relay → blank
  teamName: string; // short team name / abbreviation
  time: string; // pre-formatted MM:SS.ss or "DQ"
}

/** One team row for the Team Score (38-byte) layout. */
export interface TeamInfoRow {
  rank: number;
  teamName: string;
  teamAbbr: string;
  score: number;
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

/** Fit a value into a fixed-width, space-padded field (truncating if needed). */
export function fit(
  value: string | number | null | undefined,
  width: number,
  align: "left" | "right" = "left",
): string {
  let s = value == null ? "" : String(value);
  if (s.length > width) s = s.slice(0, width);
  return align === "right" ? s.padStart(width, " ") : s.padEnd(width, " ");
}

/** Format a time in seconds as Hy-Tek MM:SS.ss; blank for null/NT. */
export function hytekTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";
  return formatTime(seconds);
}

/** Team score: 3 digits + "." + 1 digit ("234.5"); 4 digits + "." when >999.9. */
export function hytekScore(score: number): string {
  if (score >= 1000) return `${Math.round(score)}.`;
  return score.toFixed(1);
}

/** Encode an ASCII response string as bytes for the serial port. */
export function toBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// ─── Request parsing ───────────────────────────────────────────────────────────

/**
 * Parse an 8-byte request frame: STX, event#(3), field2(2), format(1), ETX.
 * Accepts a Uint8Array, a number[], or a raw string. Returns null if the frame
 * is malformed.
 */
export function parseScoreboardRequest(
  input: Uint8Array | number[] | string,
): ScoreboardRequest | null {
  const bytes =
    typeof input === "string"
      ? Array.from(input, (c) => c.charCodeAt(0))
      : Array.from(input);
  if (bytes.length < 8) return null;
  if (bytes[0] !== STX || bytes[7] !== ETX) return null;

  const raw = String.fromCharCode(...bytes.slice(0, 8));
  const eventNumber = parseInt(raw.slice(1, 4), 10);
  const field2 = raw.slice(4, 6);
  const format = raw.slice(6, 7);
  if (Number.isNaN(eventNumber)) return null;

  let kind: ScoreboardRequestKind;
  let scoreGender: ScoreboardRequest["scoreGender"];
  switch (format) {
    case SB_FORMAT.START_LIST:
      kind = "startList";
      break;
    case SB_FORMAT.RESULT_LIST:
      kind = "resultList";
      break;
    case SB_FORMAT.COMPLETE_RESULT:
      kind = "completeResult";
      break;
    case SB_FORMAT.TEAM_SCORE_COMBINED:
    case SB_FORMAT.TEAM_SCORE_WOMEN:
    case SB_FORMAT.TEAM_SCORE_MEN:
      kind = "teamScore";
      scoreGender =
        format === SB_FORMAT.TEAM_SCORE_WOMEN
          ? "women"
          : format === SB_FORMAT.TEAM_SCORE_MEN
            ? "men"
            : "combined";
      break;
    default:
      return null;
  }

  return { kind, eventNumber, field2, format, scoreGender, raw };
}

/** Build an 8-byte request frame (used by the in-app preview / tests). */
export function buildScoreboardRequest(
  eventNumber: number,
  field2: string,
  format: string,
): string {
  return (
    String.fromCharCode(STX) +
    fit(eventNumber, 3, "right").replace(/ /g, "0") +
    fit(field2, 2, "right") +
    fit(format, 1) +
    String.fromCharCode(ETX)
  );
}

// ─── Response builders ─────────────────────────────────────────────────────────

const SOH_S = String.fromCharCode(SOH);
const ETX_S = String.fromCharCode(ETX);

function resultInfoField(row: ResultInfoRow): string {
  // Lane: 1..9 as-is, 10 encoded as "0".
  const lane = row.lane == null ? " " : String(row.lane % 10);
  return (
    fit(lane, 1) +
    fit(row.name, 20) +
    fit(row.teamAbbr, 5) +
    fit(row.place ? String(row.place) : "", 3, "right") +
    fit(row.time ?? "", 9, "right")
  );
}

export interface StartResultListInput {
  eventName: string;
  /** Secondary title line (e.g. meet name or "START LIST" / "RESULTS"). */
  title2?: string;
  title3?: string;
  record1?: string;
  record2?: string;
  rows: ResultInfoRow[]; // up to 10; padded with blanks
  eventNumber: number;
  /** Heat (start list) or rank-set (result list) shown in the trailer field. */
  secondField: number;
  /** 7-byte vendor-dependent header (blank by default). */
  vendor?: string;
}

/**
 * Build a 502-byte Start List or Result List response. The two share the exact
 * same layout; a result list simply has place/time populated.
 */
export function buildStartOrResultList(input: StartResultListInput): string {
  const rows = input.rows.slice(0, 10);
  while (rows.length < 10)
    rows.push({ lane: null, name: "", teamAbbr: "", place: null, time: "" });

  const title3 =
    input.title3 ?? `${input.eventName} ${input.title2 ?? ""}`.trim();

  const body =
    SOH_S +
    fit(input.vendor ?? "", 7) +
    fit(input.eventName, 30) +
    fit(input.title2 ?? "Result", 30) +
    fit(title3, 30) +
    fit(input.record1 ?? "", 9, "right") +
    fit(input.record2 ?? "", 9, "right") +
    rows.map(resultInfoField).join("") +
    fit(input.eventNumber, 3, "right") +
    fit(input.secondField, 3, "right");

  // Spec fixes this response at 502 bytes; guard against drift.
  return body.padEnd(502, " ").slice(0, 502);
}

export interface CompleteResultInput {
  eventName: string;
  round: "P" | "S" | "F";
  heatThru: number; // heat number results are complete through
  frameFlag?: number; // rotates 0..9 across frames
  rows: AthleteInfoRow[]; // unlimited
  vendor?: string; // bytes 1-2 of the 7-byte header (blank by default)
}

function athleteInfoField(row: AthleteInfoRow): string {
  return (
    fit(row.rank, 3, "right") +
    fit(row.lastName, 20) +
    fit(row.firstName, 20) +
    fit(row.ageOrYear, 2) +
    fit(row.teamName, 16) +
    fit(row.time, 9, "right")
  );
}

/** Build a Generic Complete Event Result response (variable length). */
export function buildCompleteEventResult(input: CompleteResultInput): string {
  const frame = ((input.frameFlag ?? 0) % 10).toString();
  // 7-byte vendor header: frameflag, 2 vendor bytes, round, 2-digit heat, space.
  const header =
    frame + fit(input.vendor ?? "", 2) + input.round + fit(input.heatThru, 2, "right") + " ";

  return (
    SOH_S +
    fit(header, 7) +
    fit(input.eventName, 30) +
    input.rows.map(athleteInfoField).join("") +
    ETX_S
  );
}

export interface TeamScoreInput {
  /** Header/title line, e.g. "Women thru Event 14". */
  title: string;
  rows: TeamInfoRow[];
  vendor?: string;
}

function teamInfoField(row: TeamInfoRow): string {
  return (
    fit(row.rank, 3, "right") +
    fit(row.teamName, 25) +
    fit(row.teamAbbr, 5) +
    fit(hytekScore(row.score), 5, "right")
  );
}

/** Build a Generic Team Score response (variable length). */
export function buildTeamScore(input: TeamScoreInput): string {
  return (
    SOH_S +
    fit(input.vendor ?? "", 7) +
    fit(input.title, 30) +
    input.rows.map(teamInfoField).join("") +
    ETX_S
  );
}
