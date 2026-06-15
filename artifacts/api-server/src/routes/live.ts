import { Router } from "express";

const router = Router();

interface LiveData {
  meetId: string;
  updatedAt: string;
  events: any[];
  scratchRequests: ScratchRequest[];
}

interface ScratchRequest {
  id: string;
  fullName: string;
  dob: string;
  eventNumber: string;
  eventName: string;
  reason: string;
  signature: string;
  timestamp: string;
  meetId: string;
  status: "pending" | "approved" | "denied";
}

const liveStore = new Map<string, LiveData>();
const scratchStore = new Map<string, ScratchRequest[]>();

router.get("/live/:meetId", (req, res) => {
  const { meetId } = req.params;
  const data = liveStore.get(meetId);
  if (!data) {
    return res.json({ meetId, updatedAt: null, events: [], scratchRequests: [] });
  }
  return res.json(data);
});

router.post("/live/:meetId", (req, res) => {
  const { meetId } = req.params;
  const payload = req.body;
  liveStore.set(meetId, {
    meetId,
    updatedAt: new Date().toISOString(),
    events: payload.events ?? [],
    scratchRequests: scratchStore.get(meetId) ?? [],
  });
  res.json({ ok: true, meetId, updatedAt: liveStore.get(meetId)!.updatedAt });
});

router.get("/live/:meetId/scratchings", (req, res) => {
  const { meetId } = req.params;
  res.json(scratchStore.get(meetId) ?? []);
});

router.post("/live/:meetId/scratch", (req, res) => {
  const { meetId } = req.params;
  const body = req.body;
  const request: ScratchRequest = {
    id: `scratch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fullName: body.fullName ?? "",
    dob: body.dob ?? "",
    eventNumber: body.eventNumber ?? "",
    eventName: body.eventName ?? "",
    reason: body.reason ?? "",
    signature: body.signature ?? "",
    timestamp: body.timestamp ?? new Date().toISOString(),
    meetId,
    status: "pending",
  };
  const existing = scratchStore.get(meetId) ?? [];
  scratchStore.set(meetId, [...existing, request]);
  const live = liveStore.get(meetId);
  if (live) {
    live.scratchRequests = scratchStore.get(meetId)!;
  }
  res.json({ ok: true, id: request.id });
});

router.patch("/live/:meetId/scratch/:scratchId", (req, res) => {
  const { meetId, scratchId } = req.params;
  const { status } = req.body;
  const existing = scratchStore.get(meetId) ?? [];
  const updated = existing.map((s) =>
    s.id === scratchId ? { ...s, status: status ?? s.status } : s
  );
  scratchStore.set(meetId, updated);
  const live = liveStore.get(meetId);
  if (live) live.scratchRequests = updated;
  res.json({ ok: true });
});

export default router;
