// Lightweight client-side logger.
//
// SwimManager Pro runs entirely in the browser, so there is no server to ship
// logs to. This module keeps a capped ring buffer of recent log entries,
// persists it to localStorage (so a crash/reload doesn't lose the trail), lets
// the UI subscribe for live updates, and can export the log for support.
//
// It also de-duplicates bursts of the same message so a repeating error doesn't
// flood the buffer (or, via the toast layer, the user's screen).

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  detail?: string;
  /** How many times this same entry repeated back-to-back. */
  count: number;
  ts: string;
}

const STORAGE_KEY = "swimmanager:logs";
const MAX_ENTRIES = 200;

let buffer: LogEntry[] = load();
let nextId = buffer.reduce((m, e) => Math.max(m, e.id), 0) + 1;
const listeners = new Set<(entries: LogEntry[]) => void>();

function load(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // localStorage may be full or unavailable — logging must never throw.
  }
}

function emit() {
  const snapshot = [...buffer];
  listeners.forEach((l) => {
    try {
      l(snapshot);
    } catch {
      /* a broken listener must not break logging */
    }
  });
}

function toDetail(detail: unknown): string | undefined {
  if (detail == null) return undefined;
  if (detail instanceof Error) return detail.stack ?? detail.message;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function record(level: LogLevel, message: string, detail?: unknown) {
  const detailStr = toDetail(detail);

  // Collapse an immediate repeat of the same level+message+detail.
  const last = buffer[buffer.length - 1];
  if (last && last.level === level && last.message === message && last.detail === detailStr) {
    last.count += 1;
    last.ts = new Date().toISOString();
  } else {
    buffer.push({
      id: nextId++,
      level,
      message,
      detail: detailStr,
      count: 1,
      ts: new Date().toISOString(),
    });
    if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  }

  const consoleFn =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[${level}] ${message}`, detail ?? "");

  persist();
  emit();
}

export const logger = {
  debug: (message: string, detail?: unknown) => record("debug", message, detail),
  info: (message: string, detail?: unknown) => record("info", message, detail),
  warn: (message: string, detail?: unknown) => record("warn", message, detail),
  error: (message: string, detail?: unknown) => record("error", message, detail),
};

/** Current snapshot of buffered log entries (oldest first). */
export function getLogs(): LogEntry[] {
  return [...buffer];
}

export function clearLogs() {
  buffer = [];
  persist();
  emit();
}

/** Subscribe to log changes; returns an unsubscribe function. */
export function subscribeToLogs(listener: (entries: LogEntry[]) => void): () => void {
  listeners.add(listener);
  listener([...buffer]);
  return () => listeners.delete(listener);
}

/** Render the buffer as a plain-text log file. */
export function formatLogs(): string {
  if (buffer.length === 0) return "No log entries.";
  return buffer
    .map((e) => {
      const rep = e.count > 1 ? ` (x${e.count})` : "";
      const detail = e.detail ? `\n    ${e.detail.replace(/\n/g, "\n    ")}` : "";
      return `${e.ts} [${e.level.toUpperCase()}]${rep} ${e.message}${detail}`;
    })
    .join("\n");
}

/** Trigger a download of the current log as a .txt file. */
export function downloadLogs() {
  const blob = new Blob([formatLogs()], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `swimmanager-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
