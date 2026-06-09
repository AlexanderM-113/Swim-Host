import { parseTime } from "./format-time";

// ─── Timing-system connector layer ─────────────────────────────────────────────
// Browsers can't open raw serial/TCP sockets, so a popular timing console (CTS
// Dolphin, Daktronics OmniSport, Omega ARES) is bridged to a small WebSocket
// relay on the scoring PC. This module normalises whatever the bridge forwards —
// either structured JSON (recommended) or the vendors' line-based ASCII output —
// into a single `TimingEvent` stream, and manages the socket with automatic
// reconnect + heartbeat so a flaky link recovers on its own.

export type HardwareMode = "manual" | "cts" | "daktronics" | "omega" | "sim";

export type TimingEvent =
  | { kind: "start" }
  | { kind: "reset" }
  | { kind: "touch"; lane: number; time: number | null }
  | { kind: "split"; lane: number; index: number; time: number }
  | { kind: "dq"; lane: number };

export const VENDOR_DEFAULT_PORT: Record<HardwareMode, string> = {
  manual: "",
  sim: "",
  cts: "5100",
  daktronics: "21",
  omega: "5100",
};

// Ports each vendor's bridge is commonly exposed on, tried in order when
// auto-detecting. The default port is listed first.
export const VENDOR_CANDIDATE_PORTS: Record<HardwareMode, string[]> = {
  manual: [],
  sim: [],
  cts: ["5100", "10000", "20000", "30000"],
  daktronics: ["21", "5000", "5100", "23"],
  omega: ["5100", "6000", "5000"],
};

/**
 * Attempt a WebSocket handshake and resolve whether it opened within the
 * timeout. Used to check a bridge is actually reachable before "connecting",
 * so the console never shows a phantom connection or spins a reconnect loop
 * against a port nothing is listening on.
 */
export function probeWebSocket(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch {}
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch {
      finish(false);
      return;
    }
    ws.onopen = () => finish(true);
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
}

/**
 * Probe each candidate port for a vendor and return the first reachable one,
 * or null if none respond.
 */
export async function autoDetectPort(
  mode: HardwareMode,
  ip: string,
  timeoutMs = 1500
): Promise<string | null> {
  for (const port of VENDOR_CANDIDATE_PORTS[mode] ?? []) {
    if (await probeWebSocket(`ws://${ip}:${port}`, timeoutMs)) return port;
  }
  return null;
}

// Field separators each vendor's ASCII output commonly uses.
const DELIMS: Record<string, RegExp> = {
  cts: /[;,]/,
  daktronics: /[\s,]+/,
  omega: /[;,\s]+/,
};

function parseClock(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // mm:ss.hh / m:ss.hh / ss.hh — handled by the shared parser.
  if (/[:.]/.test(s)) return parseTime(s);
  // Bare integer = hundredths of a second (e.g. Daktronics "6234" → 62.34s).
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n >= 3000 ? n / 100 : n; // ≥30.00s looks like hundredths; else seconds
  }
  return null;
}

const START_TOKENS = /^(start|begin|b|race|go)\b/i;
const RESET_TOKENS = /^(reset|clear|armed|ready)\b/i;
const DQ_TOKENS = /^(dq|disq)\b/i;

/** Parse a single ASCII line into one normalized event (or null). */
function parseLine(mode: HardwareMode, line: string): TimingEvent | null {
  const text = line.trim();
  if (!text) return null;
  if (START_TOKENS.test(text)) return { kind: "start" };
  if (RESET_TOKENS.test(text)) return { kind: "reset" };

  const delim = DELIMS[mode] ?? /[;,\s]+/;
  // Tokens like "L1" or "c3" carry the lane; pull the first integer as the lane.
  const tokens = text.split(delim).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;

  const laneTok = tokens.find((t) => /\d/.test(t));
  if (!laneTok) return null;
  const lane = parseInt((laneTok.match(/\d+/) as RegExpMatchArray)[0], 10);
  if (!lane) return null;

  if (DQ_TOKENS.test(text)) return { kind: "dq", lane };

  // The last token that looks like a clock value is the finish time.
  let time: number | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const v = parseClock(tokens[i]);
    if (v != null && tokens[i] !== laneTok) { time = v; break; }
  }
  return { kind: "touch", lane, time };
}

/** Normalise one raw WebSocket message into zero or more timing events. */
export function parseTimingMessage(mode: HardwareMode, raw: string): TimingEvent[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1) Structured JSON (recommended bridge format) — object or array.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : [data];
      const out: TimingEvent[] = [];
      for (const d of arr) {
        const type = String(d.type ?? d.kind ?? "").toLowerCase();
        if (type === "start") out.push({ kind: "start" });
        else if (type === "reset") out.push({ kind: "reset" });
        else if (type === "dq" && d.lane) out.push({ kind: "dq", lane: Number(d.lane) });
        else if (type === "split" && d.lane)
          out.push({ kind: "split", lane: Number(d.lane), index: Number(d.index ?? d.split ?? 1), time: Number(d.time) });
        else if ((type === "touch" || type === "finish" || type === "time") && d.lane)
          out.push({ kind: "touch", lane: Number(d.lane), time: d.time != null ? Number(d.time) : null });
      }
      return out;
    } catch {
      return [];
    }
  }

  // 2) Vendor ASCII — one event per non-empty line.
  return trimmed
    .split(/[\r\n]+/)
    .map((line) => parseLine(mode, line))
    .filter((e): e is TimingEvent => e != null);
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface ConnectionCallbacks {
  onEvent: (e: TimingEvent) => void;
  onStatus: (s: ConnectionStatus, detail?: string) => void;
}

/**
 * Manages a WebSocket to a timing bridge with automatic, backing-off reconnect.
 * Reconnection stops once `close()` is called explicitly.
 */
export class TimingConnection {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  lastMessageAt: number | null = null;

  constructor(
    private mode: HardwareMode,
    private url: string,
    private cbs: ConnectionCallbacks
  ) {}

  connect() {
    this.closedByUser = false;
    this.open();
  }

  private open() {
    this.cbs.onStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      this.cbs.onStatus("error", String(err));
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.cbs.onStatus("connected");
    };
    ws.onmessage = (evt) => {
      this.lastMessageAt = Date.now();
      const data = typeof evt.data === "string" ? evt.data : "";
      for (const e of parseTimingMessage(this.mode, data)) this.cbs.onEvent(e);
    };
    ws.onerror = () => {
      this.cbs.onStatus("error", "socket error");
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closedByUser) return;
    this.attempt += 1;
    const delay = Math.min(15_000, 1000 * 2 ** Math.min(this.attempt, 4)); // 2s→15s cap
    this.cbs.onStatus("reconnecting", `retry ${this.attempt} in ${Math.round(delay / 1000)}s`);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  /** Send a command to a connected start system (e.g. relay the meet's start). */
  send(payload: object): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.cbs.onStatus("idle");
  }
}
