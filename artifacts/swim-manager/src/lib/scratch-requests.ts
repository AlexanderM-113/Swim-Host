import { broadcastDataChanged } from "./live-broadcast";

// Online scratch declarations submitted from the public meet website. Stored in
// localStorage (per meet) so the public ScratchPad and the Meet Manager review
// queue stay in sync across tabs/screens on the same browser — same model as
// the rest of the app's cross-screen sync. A `data-changed` broadcast pings any
// open Meet Manager screen to refetch immediately.

export interface ScratchRequest {
  id: string;
  meetId: number;
  fullName: string;
  dob: string;
  eventNumber: string;
  eventName: string;
  reason: string;
  signature: string;
  timestamp: string;
  status: "pending" | "approved" | "denied";
}

const KEY = (meetId: number) => `swimmanager_scratch_requests_${meetId}`;

export function readScratchRequests(meetId: number): ScratchRequest[] {
  try {
    const raw = localStorage.getItem(KEY(meetId));
    return raw ? (JSON.parse(raw) as ScratchRequest[]) : [];
  } catch {
    return [];
  }
}

function write(meetId: number, list: ScratchRequest[]): void {
  localStorage.setItem(KEY(meetId), JSON.stringify(list));
  broadcastDataChanged(meetId);
}

export function addScratchRequest(
  meetId: number,
  data: Omit<ScratchRequest, "id" | "meetId" | "status" | "timestamp"> & { timestamp?: string }
): ScratchRequest {
  const request: ScratchRequest = {
    id: `scratch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    meetId,
    fullName: data.fullName,
    dob: data.dob,
    eventNumber: data.eventNumber,
    eventName: data.eventName,
    reason: data.reason,
    signature: data.signature,
    timestamp: data.timestamp ?? new Date().toISOString(),
    status: "pending",
  };
  write(meetId, [...readScratchRequests(meetId), request]);
  return request;
}

export function setScratchStatus(
  meetId: number,
  id: string,
  status: ScratchRequest["status"]
): void {
  write(
    meetId,
    readScratchRequests(meetId).map((r) => (r.id === id ? { ...r, status } : r))
  );
}

/** Subscribe to scratch-request changes for a meet (fires on cross-tab writes). */
export function subscribeScratchRequests(meetId: number, cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY(meetId)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
