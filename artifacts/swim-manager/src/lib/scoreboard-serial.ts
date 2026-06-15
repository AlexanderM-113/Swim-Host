// Hy-Tek Generic Scoreboard bridge.
//
// Connects the in-app meet data to an external vendor scoreboard over a serial
// COM port using the Hy-Tek Generic Scoreboard Interface (see
// `scoreboard-protocol.ts`). The scoreboard computer sends 8-byte requests;
// this bridge answers with the matching fixed-layout response assembled from
// the local store.
//
// Serial I/O uses the Web Serial API (Chrome / Electron). When Web Serial is
// unavailable the protocol/assembler functions are still usable for preview
// and export.

import {
  readStore,
  roundOf,
  type AppStore,
  type Event as MeetEvent,
  type Result,
} from "./local-store";
import {
  parseScoreboardRequest,
  buildStartOrResultList,
  buildCompleteEventResult,
  buildTeamScore,
  hytekTime,
  toBytes,
  SCOREBOARD_SERIAL_OPTIONS,
  STX,
  ETX,
  type ScoreboardRequest,
  type ResultInfoRow,
  type AthleteInfoRow,
  type TeamInfoRow,
} from "./scoreboard-protocol";

// ─── Naming helpers ────────────────────────────────────────────────────────────

export function scoreboardEventName(ev: MeetEvent): string {
  const g = ev.gender === "M" ? "Men" : ev.gender === "F" ? "Women" : "Mixed";
  const age = ev.ageGroup && ev.ageGroup !== "Open" ? `${ev.ageGroup} ` : "";
  return `${g} ${age}${ev.distance} ${ev.stroke}`.trim();
}

function teamAbbr(store: AppStore, teamId?: number, fallback?: string): string {
  if (teamId != null) {
    const t = store.teams.find((tm) => tm.id === teamId);
    if (t) return t.abbreviation || t.shortName || t.name.slice(0, 5);
  }
  return (fallback ?? "").slice(0, 5);
}

function teamFullName(store: AppStore, teamId?: number, fallback?: string): string {
  if (teamId != null) {
    const t = store.teams.find((tm) => tm.id === teamId);
    if (t) return t.name;
  }
  return fallback ?? "";
}

function athleteLastFirst(store: AppStore, athleteId: number): { last: string; first: string } {
  const a = store.athletes.find((ath) => ath.id === athleteId);
  if (!a) return { last: "", first: "" };
  return { last: a.lastName ?? "", first: a.firstName ?? "" };
}

function findEvent(store: AppStore, meetId: number, eventNumber: number): MeetEvent | undefined {
  return store.events.find((e) => e.meetId === meetId && e.eventNumber === eventNumber);
}

// ─── Ranked results for an event/round ──────────────────────────────────────────

interface RankedRow {
  result: Result;
  athleteId: number;
  athleteName: string; // "Last, First" or relay team name
  lastName: string;
  firstName: string;
  teamId?: number;
  teamName: string;
  teamAbbr: string;
  ageOrYear: string;
  lane: number | null;
  heat: number | null;
  isRelay: boolean;
}

function rankedRows(
  store: AppStore,
  event: MeetEvent,
  round: "prelim" | "final" | "current",
): RankedRow[] {
  const all = store.results.filter((r) => r.eventId === event.id);
  let useRound: "prelim" | "final";
  if (round === "current") {
    useRound = all.some((r) => roundOf(r) === "final") ? "final" : "prelim";
  } else {
    useRound = round;
  }
  const rows: RankedRow[] = [];
  for (const result of all) {
    if (roundOf(result) !== useRound) continue;
    const entry = store.entries.find((e) => e.id === result.entryId);
    if (!entry) continue;
    const isRelay = !!event.isRelay;
    if (isRelay) {
      rows.push({
        result,
        athleteId: entry.athleteId,
        athleteName: entry.teamName ?? "",
        lastName: teamAbbr(store, undefined, entry.teamName),
        firstName: "",
        teamName: entry.teamName ?? "",
        teamAbbr: teamAbbr(store, undefined, entry.teamName),
        ageOrYear: "",
        lane: entry.lane ?? null,
        heat: entry.heat ?? null,
        isRelay,
      });
      continue;
    }
    const ath = store.athletes.find((a) => a.id === entry.athleteId);
    const { last, first } = athleteLastFirst(store, entry.athleteId);
    rows.push({
      result,
      athleteId: entry.athleteId,
      athleteName: `${last}, ${first}`.trim().replace(/^,\s*/, ""),
      lastName: last,
      firstName: first,
      teamId: ath?.teamId,
      teamName: teamFullName(store, ath?.teamId, entry.teamName),
      teamAbbr: teamAbbr(store, ath?.teamId, entry.teamName),
      ageOrYear: "",
      lane: entry.lane ?? null,
      heat: entry.heat ?? null,
      isRelay,
    });
  }
  // Order best-first: by place when present, else by time; DQ/NS sink to bottom.
  rows.sort((a, b) => {
    const ar = a.result, br = b.result;
    const aBad = ar.dq || ar.ns || ar.dnf;
    const bBad = br.dq || br.ns || br.dnf;
    if (aBad !== bBad) return aBad ? 1 : -1;
    if (ar.place && br.place) return ar.place - br.place;
    if (ar.place) return -1;
    if (br.place) return 1;
    return (ar.finishTime ?? Infinity) - (br.finishTime ?? Infinity);
  });
  return rows;
}

function rowTime(r: Result): string {
  if (r.dq) return "DQ";
  if (r.ns) return "NS";
  if (r.dnf) return "DNF";
  return hytekTime(r.finishTime);
}

// ─── Response assembly ──────────────────────────────────────────────────────────

const POINTS: Record<number, number> = { 1: 9, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

/** Build the response string for a parsed request against a given meet. */
export function assembleScoreboardResponse(
  req: ScoreboardRequest,
  meetId: number,
  frameFlag = 0,
): string | null {
  const store = readStore();
  const meet = store.meets.find((m) => m.id === meetId);

  if (req.kind === "teamScore") {
    const eventThru = req.eventNumber; // 999 → all events
    const genderFilter = req.scoreGender ?? "combined";
    const scoreMap = new Map<number, { name: string; abbr: string; score: number }>();
    const scoredByEntry = new Map<number, Result>();
    const eligibleEventIds = new Set(
      store.events
        .filter(
          (e) =>
            e.meetId === meetId &&
            e.eventNumber <= eventThru &&
            (genderFilter === "combined" ||
              (genderFilter === "women" && e.gender === "F") ||
              (genderFilter === "men" && e.gender === "M")),
        )
        .map((e) => e.id),
    );
    for (const r of store.results) {
      if (!eligibleEventIds.has(r.eventId)) continue;
      const cur = scoredByEntry.get(r.entryId);
      if (!cur || (roundOf(r) === "final" && roundOf(cur) !== "final")) {
        scoredByEntry.set(r.entryId, r);
      }
    }
    for (const r of scoredByEntry.values()) {
      if (r.dq || r.ns || r.dnf) continue;
      const entry = store.entries.find((e) => e.id === r.entryId);
      if (!entry) continue;
      const ath = store.athletes.find((a) => a.id === entry.athleteId);
      if (!ath?.teamId) continue;
      const team = store.teams.find((t) => t.id === ath.teamId);
      if (!team) continue;
      const pts = r.points ?? POINTS[r.place ?? 0] ?? 0;
      const ex = scoreMap.get(team.id);
      if (ex) ex.score += pts;
      else
        scoreMap.set(team.id, {
          name: team.name,
          abbr: team.abbreviation || team.shortName || team.name.slice(0, 5),
          score: pts,
        });
    }
    const rows: TeamInfoRow[] = Array.from(scoreMap.values())
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((t, i) => ({ rank: i + 1, teamName: t.name, teamAbbr: t.abbr, score: t.score }));
    const genderWord =
      genderFilter === "women" ? "Women" : genderFilter === "men" ? "Men" : "Combined";
    const thru = eventThru >= 999 ? "all events" : `Event ${eventThru}`;
    return buildTeamScore({ title: `${genderWord} Team Scores thru ${thru}`, rows });
  }

  const event = findEvent(store, meetId, req.eventNumber);
  if (!event) return null;
  const eventName = scoreboardEventName(event);
  const lanes = meet?.lanes ?? 8;

  if (req.kind === "startList") {
    const heatNo = parseInt(req.field2, 10) || 1;
    const heat =
      store.heats.find((h) => h.eventId === event.id && h.heatNumber === heatNo) ??
      store.heats.find((h) => h.eventId === event.id);
    const rows: ResultInfoRow[] = (heat?.lanes ?? [])
      .filter((l) => l.entryId != null)
      .sort((a, b) => a.laneNumber - b.laneNumber)
      .map((l) => ({
        lane: l.laneNumber,
        name: l.athleteName,
        teamAbbr: (l.teamName ?? "").slice(0, 5),
        place: null,
        time: "",
      }));
    return buildStartOrResultList({
      eventName,
      title2: "START LIST",
      rows,
      eventNumber: event.eventNumber,
      secondField: heatNo,
    });
  }

  if (req.kind === "resultList") {
    const rankSet = parseInt(req.field2, 10) || 1;
    const ranked = rankedRows(store, event, "current");
    const start = (rankSet - 1) * lanes;
    const slice = ranked.slice(start, start + lanes);
    const rows: ResultInfoRow[] = slice.map((r, i) => ({
      lane: r.lane,
      name: r.athleteName,
      teamAbbr: r.teamAbbr,
      place: r.result.place ?? start + i + 1,
      time: rowTime(r.result),
    }));
    return buildStartOrResultList({
      eventName,
      title2: "RESULTS",
      rows,
      eventNumber: event.eventNumber,
      secondField: rankSet,
    });
  }

  // completeResult
  const roundChar = (req.field2.trim().toUpperCase()[0] as "P" | "S" | "F") || "F";
  const round = roundChar === "F" ? "final" : "prelim";
  const ranked = rankedRows(store, event, round).filter(
    // Complete-event result includes DQ but excludes NT (no result time).
    (r) => r.result.dq || r.result.finishTime != null,
  );
  const heatThru = ranked.reduce((max, r) => Math.max(max, r.heat ?? 0), 0);
  const rows: AthleteInfoRow[] = ranked.map((r, i) => ({
    rank: r.result.place ?? i + 1,
    lastName: r.lastName,
    firstName: r.firstName,
    ageOrYear: r.ageOrYear,
    teamName: r.teamAbbr || r.teamName,
    time: rowTime(r.result),
  }));
  return buildCompleteEventResult({
    eventName,
    round: roundChar,
    heatThru,
    frameFlag,
    rows,
  });
}

// ─── Web Serial bridge ───────────────────────────────────────────────────────────

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export type BridgeStatus = "disconnected" | "connecting" | "connected" | "error";

export interface BridgeLogEntry {
  ts: number;
  dir: "in" | "out" | "info";
  text: string;
}

export interface ScoreboardBridgeCallbacks {
  onStatus?: (status: BridgeStatus, detail?: string) => void;
  onLog?: (entry: BridgeLogEntry) => void;
  /** The meet whose data answers requests. */
  getMeetId: () => number | null;
}

/**
 * Opens a serial port, frames inbound 8-byte requests (STX…ETX), and writes
 * back the assembled Hy-Tek response. Auto-reconnects on transient errors.
 */
export class ScoreboardSerialBridge {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer: number[] = [];
  private frame = 0;
  private running = false;
  private cbs: ScoreboardBridgeCallbacks;

  constructor(cbs: ScoreboardBridgeCallbacks) {
    this.cbs = cbs;
  }

  private log(dir: BridgeLogEntry["dir"], text: string) {
    this.cbs.onLog?.({ ts: Date.now(), dir, text });
  }

  private status(s: BridgeStatus, detail?: string) {
    this.cbs.onStatus?.(s, detail);
  }

  /** Prompt the user to pick a COM port and start serving requests. */
  async connect(): Promise<void> {
    if (!isWebSerialSupported()) {
      this.status("error", "Web Serial not supported in this browser");
      throw new Error("Web Serial not supported");
    }
    try {
      this.status("connecting");
      const port = await navigator.serial.requestPort();
      await port.open(SCOREBOARD_SERIAL_OPTIONS);
      this.port = port;
      this.writer = port.writable?.getWriter() ?? null;
      this.running = true;
      this.status("connected");
      this.log("info", `Connected @ 9600,7,E,2`);
      void this.readLoop();
    } catch (err) {
      this.status("error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.running = false;
    try {
      await this.reader?.cancel();
      this.reader?.releaseLock();
    } catch { /* noop */ }
    try {
      this.writer?.releaseLock();
    } catch { /* noop */ }
    try {
      await this.port?.close();
    } catch { /* noop */ }
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.buffer = [];
    this.status("disconnected");
    this.log("info", "Disconnected");
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();
    try {
      while (this.running) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.ingest(value);
      }
    } catch (err) {
      if (this.running) {
        this.status("error", err instanceof Error ? err.message : String(err));
        this.log("info", "Read error — connection lost");
      }
    } finally {
      try {
        this.reader?.releaseLock();
      } catch { /* noop */ }
    }
  }

  private ingest(chunk: Uint8Array): void {
    for (const b of chunk) {
      if (b === STX) this.buffer = [b];
      else if (this.buffer.length > 0) {
        this.buffer.push(b);
        if (b === ETX) {
          this.handleFrame(this.buffer.slice()).catch((err) => {
            if (this.running) {
              this.log("info", `Write error: ${err instanceof Error ? err.message : String(err)}`);
            }
          });
          this.buffer = [];
        } else if (this.buffer.length > 16) {
          // Runaway frame without ETX — resync.
          this.buffer = [];
        }
      }
    }
  }

  private async handleFrame(bytes: number[]): Promise<void> {
    const req = parseScoreboardRequest(bytes);
    if (!req) {
      this.log("in", `Ignored malformed request (${bytes.length} bytes)`);
      return;
    }
    this.log("in", `Request: ${req.kind} E${req.eventNumber} "${req.field2}" fmt=${req.format}`);
    const meetId = this.cbs.getMeetId();
    if (meetId == null) {
      this.log("info", "No meet selected — cannot answer request");
      return;
    }
    const resp = assembleScoreboardResponse(req, meetId, this.frame++);
    if (resp == null) {
      this.log("info", `No data for event ${req.eventNumber}`);
      return;
    }
    await this.send(resp);
    this.log("out", `Response: ${resp.length} bytes`);
  }

  private async send(resp: string): Promise<void> {
    if (!this.writer) return;
    await this.writer.write(toBytes(resp));
  }
}
