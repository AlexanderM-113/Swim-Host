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
