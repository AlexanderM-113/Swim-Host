const CHANNEL = "swimmanager:run";
const KEY = "swimmanager:activeRun";

export interface ActiveRun {
  meetId: number;
  eventId: number;
  eventNumber: number;
  eventDescription: string;
  updatedAt: string;
}

export function broadcastRun(data: ActiveRun): void {
  localStorage.setItem(KEY, JSON.stringify(data));
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage(data);
    bc.close();
  } catch {}
}

export function clearActiveRun(): void {
  localStorage.removeItem(KEY);
}

export function getActiveRun(): ActiveRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function subscribeToRun(cb: (data: ActiveRun | null) => void): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (e) => cb(e.data as ActiveRun);
  } catch {}

  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      try {
        cb(e.newValue ? JSON.parse(e.newValue) : null);
      } catch {}
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    bc?.close();
    window.removeEventListener("storage", onStorage);
  };
}

// ── Race control + live data sync ──────────────────────────────────────────
// A second channel carries race-control signals (start/stop/reset of a heat)
// and lightweight "data changed" pings so every open screen — Run, Scoreboard,
// Timing — stays in lockstep within the same browser without polling delay.

const SIGNAL_CHANNEL = "swimmanager:signal";
const SIGNAL_KEY = "swimmanager:lastSignal";

export type RaceSignalType = "start" | "stop" | "reset" | "data-changed";

export interface RaceSignal {
  type: RaceSignalType;
  meetId: number;
  /** Present for start/stop/reset; omitted for data-changed. */
  eventId?: number;
  heatNumber?: number;
  /** ISO timestamp of the signal (used as the authoritative race start time). */
  at: string;
  /** Random id so repeated identical signals still register as new events. */
  nonce: string;
}

export function broadcastSignal(signal: Omit<RaceSignal, "nonce">): void {
  const full: RaceSignal = { ...signal, nonce: Math.random().toString(36).slice(2) };
  try {
    localStorage.setItem(SIGNAL_KEY, JSON.stringify(full));
  } catch {}
  try {
    const bc = new BroadcastChannel(SIGNAL_CHANNEL);
    bc.postMessage(full);
    bc.close();
  } catch {}
}

/** Convenience helper: tell other screens this meet's data changed. */
export function broadcastDataChanged(meetId: number): void {
  broadcastSignal({ type: "data-changed", meetId, at: new Date().toISOString() });
}

export function subscribeToSignals(cb: (signal: RaceSignal) => void): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(SIGNAL_CHANNEL);
    bc.onmessage = (e) => cb(e.data as RaceSignal);
  } catch {}

  const onStorage = (e: StorageEvent) => {
    if (e.key === SIGNAL_KEY && e.newValue) {
      try {
        cb(JSON.parse(e.newValue) as RaceSignal);
      } catch {}
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    bc?.close();
    window.removeEventListener("storage", onStorage);
  };
}
