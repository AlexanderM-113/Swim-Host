import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AppStore,
  type EventFinals,
  type Finalist,
  type Heat,
  type LaneInfo,
  readStore,
  writeStore,
  nextId,
  circleSeeding,
  resultForRound,
  getListFinalsQueryKey,
  getListHeatsQueryKey,
  getListEventsQueryKey,
  getListEntriesQueryKey,
} from "./local-store";

// ─── Finals engine ────────────────────────────────────────────────────────────
// Turns prelim results into championship/consolation finals: rank swimmers by
// their prelim time, bucket the fastest into finals (A = championship, B/C =
// consolation), keep the next fastest as alternates, then seed each final heat
// with circle seeding (fastest swimmer in the centre lane). Scratches between
// sessions promote the next alternate and trigger a re-seed.

const FINAL_NAMES = ["A", "B", "C", "D"];

export function finalNamesFor(numFinals: number): string[] {
  return FINAL_NAMES.slice(0, Math.max(1, numFinals));
}

function emptyLane(laneNumber: number): LaneInfo {
  return {
    laneNumber,
    entryId: null,
    athleteId: null,
    athleteName: "",
    teamName: "",
    seedTime: null,
    finishTime: null,
    place: null,
    dq: false,
    ns: false,
    dnf: false,
  };
}

/** Rank an event's prelim swims (valid times only) fastest-first. */
export function rankPrelims(store: AppStore, eventId: number) {
  const entries = store.entries.filter((e) => e.eventId === eventId && !e.scratched);
  return entries
    .map((en) => {
      const r = resultForRound(store.results, en.id, "prelim");
      const valid = r && !r.dq && !r.ns && !r.dnf && r.finishTime != null;
      const athlete = store.athletes.find((a) => a.id === en.athleteId);
      const team = athlete?.teamId ? store.teams.find((t) => t.id === athlete.teamId) : null;
      return {
        entryId: en.id,
        athleteId: en.athleteId,
        athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : (en.athleteName ?? ""),
        teamName: team?.name ?? en.teamName ?? "",
        time: valid ? (r!.finishTime as number) : null,
      };
    })
    .filter((x) => x.time != null)
    .sort((a, b) => (a.time as number) - (b.time as number));
}

/** Build the finalist list for an event from its prelim ranking. */
export function generateEventFinals(
  store: AppStore,
  eventId: number,
  numFinals: number,
  finalSize: number
): EventFinals {
  const event = store.events.find((e) => e.id === eventId);
  const ranked = rankPrelims(store, eventId);
  const capacity = numFinals * finalSize;
  const names = finalNamesFor(numFinals);
  const maxAlternates = finalSize;

  const finalists: Finalist[] = ranked
    .slice(0, capacity + maxAlternates)
    .map((x, i) => {
      const qualified = i < capacity;
      const bucket = Math.floor(i / finalSize);
      return {
        entryId: x.entryId,
        athleteId: x.athleteId,
        athleteName: x.athleteName,
        teamName: x.teamName,
        prelimTime: x.time,
        prelimRank: i + 1,
        finalName: qualified ? names[bucket] : "",
        qualified,
        alternate: !qualified,
        scratched: false,
      };
    });

  return {
    eventId,
    meetId: event?.meetId ?? 0,
    numFinals,
    finalSize,
    finalists,
    locked: false,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Recompute qualifier/alternate status after scratches: drop scratched
 * swimmers, re-rank the remaining pool by prelim rank, promote alternates into
 * any freed slots, and re-bucket into A/B/C finals.
 */
export function reseedFinalists(prev: EventFinals): EventFinals {
  const capacity = prev.numFinals * prev.finalSize;
  const names = finalNamesFor(prev.numFinals);

  const active = prev.finalists
    .filter((f) => !f.scratched)
    .sort((a, b) => a.prelimRank - b.prelimRank);

  const reassigned = active.map((f, i) => {
    const qualified = i < capacity;
    const bucket = Math.floor(i / prev.finalSize);
    return {
      ...f,
      qualified,
      alternate: !qualified,
      finalName: qualified ? names[bucket] : "",
    };
  });
  const byId = new Map(reassigned.map((f) => [f.entryId, f]));

  const finalists = prev.finalists.map((f) =>
    f.scratched
      ? { ...f, qualified: false, alternate: false, finalName: "" }
      : (byId.get(f.entryId) as Finalist)
  );
  return { ...prev, finalists };
}

/**
 * Produce the finals heats for an event. Heats run slowest final first
 * (e.g. C, then B, then the A championship final last); within each final the
 * fastest qualifier is circle-seeded into the centre lane.
 */
export function buildFinalsHeats(
  store: AppStore,
  finals: EventFinals
): { heats: Heat[]; entryUpdates: Map<number, { heat: number; lane: number }> } {
  const { eventId, meetId, numFinals, finalSize } = finals;
  const names = finalNamesFor(numFinals);
  const runOrder = [...names].reverse(); // slowest final first
  const laneOrder = circleSeeding(finalSize);

  const heats: Heat[] = [];
  const entryUpdates = new Map<number, { heat: number; lane: number }>();
  let heatId = nextId(store.heats.filter((h) => h.eventId !== eventId));

  runOrder.forEach((name, idx) => {
    const members = finals.finalists
      .filter((f) => f.qualified && !f.scratched && f.finalName === name)
      .sort((a, b) => a.prelimRank - b.prelimRank);

    const lanes: LaneInfo[] = Array.from({ length: finalSize }, (_, i) => emptyLane(i + 1));
    members.forEach((m, i) => {
      const laneNumber = laneOrder[i] ?? i + 1;
      lanes[laneNumber - 1] = {
        ...lanes[laneNumber - 1],
        entryId: m.entryId,
        athleteId: m.athleteId,
        athleteName: m.athleteName,
        teamName: m.teamName,
        seedTime: m.prelimTime,
      };
      entryUpdates.set(m.entryId, { heat: idx + 1, lane: laneNumber });
    });

    heats.push({ id: heatId++, eventId, meetId, heatNumber: idx + 1, lanes });
  });

  return { heats, entryUpdates };
}

/** Replace the event's heats with freshly seeded finals heats. */
function writeFinalsHeats(store: AppStore, finals: EventFinals): AppStore {
  const { heats, entryUpdates } = buildFinalsHeats(store, finals);
  const otherHeats = store.heats.filter((h) => h.eventId !== finals.eventId);
  const entries = store.entries.map((e) => {
    const upd = entryUpdates.get(e.id);
    return upd ? { ...e, heat: upd.heat, lane: upd.lane } : e;
  });
  const events = store.events.map((e) =>
    e.id === finals.eventId ? { ...e, status: "seeded" } : e
  );
  return { ...store, heats: [...otherHeats, ...heats], entries, events };
}

function upsertFinals(store: AppStore, finals: EventFinals): EventFinals[] {
  const rest = store.finals.filter((f) => f.eventId !== finals.eventId);
  return [...rest, finals];
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useListFinals(meetId?: number, options?: object) {
  return useQuery({
    queryKey: getListFinalsQueryKey(meetId),
    queryFn: () => {
      const { finals } = readStore();
      return meetId ? finals.filter((f) => f.meetId === meetId) : finals;
    },
    staleTime: 0,
    enabled: meetId !== 0,
    ...(options as object),
  });
}

function invalidateFinals(queryClient: ReturnType<typeof useQueryClient>, finals: EventFinals) {
  queryClient.invalidateQueries({ queryKey: getListFinalsQueryKey(finals.meetId) });
  queryClient.invalidateQueries({ queryKey: getListHeatsQueryKey(finals.eventId) });
  queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(finals.eventId) });
  queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(finals.meetId) });
}

export function useGenerateFinalists() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      numFinals,
      finalSize,
    }: {
      eventId: number;
      numFinals: number;
      finalSize: number;
    }) => {
      const store = readStore();
      const finals = generateEventFinals(store, eventId, numFinals, finalSize);
      if (finals.finalists.length === 0) {
        throw new Error("No prelim results to rank. Import prelim times first.");
      }
      let next: AppStore = { ...store, finals: upsertFinals(store, finals) };
      next = writeFinalsHeats(next, finals);
      writeStore(next);
      invalidateFinals(queryClient, finals);
      return finals;
    },
  });
}

export function useToggleFinalistScratch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, entryId }: { eventId: number; entryId: number }) => {
      const store = readStore();
      const finals = store.finals.find((f) => f.eventId === eventId);
      if (!finals) throw new Error("Finals not generated for this event.");
      if (finals.locked) throw new Error("Finalists are locked.");
      const toggled: EventFinals = {
        ...finals,
        finalists: finals.finalists.map((f) =>
          f.entryId === entryId ? { ...f, scratched: !f.scratched } : f
        ),
      };
      const reseeded = reseedFinalists(toggled);
      let next: AppStore = { ...store, finals: upsertFinals(store, reseeded) };
      next = writeFinalsHeats(next, reseeded);
      writeStore(next);
      invalidateFinals(queryClient, reseeded);
      return reseeded;
    },
  });
}

/** Re-process scratches, promote alternates and re-seed the finals heats. */
export function useReseedFinals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: number }) => {
      const store = readStore();
      const finals = store.finals.find((f) => f.eventId === eventId);
      if (!finals) throw new Error("Finals not generated for this event.");
      const reseeded = reseedFinalists(finals);
      let next: AppStore = { ...store, finals: upsertFinals(store, reseeded) };
      next = writeFinalsHeats(next, reseeded);
      writeStore(next);
      invalidateFinals(queryClient, reseeded);
      return reseeded;
    },
  });
}

export function useSetFinalsLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, locked }: { eventId: number; locked: boolean }) => {
      const store = readStore();
      const finals = store.finals.find((f) => f.eventId === eventId);
      if (!finals) throw new Error("Finals not generated for this event.");
      const updated = { ...finals, locked };
      writeStore({ ...store, finals: upsertFinals(store, updated) });
      invalidateFinals(queryClient, updated);
      return updated;
    },
  });
}

export function useClearFinals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, meetId }: { eventId: number; meetId: number }) => {
      const store = readStore();
      writeStore({ ...store, finals: store.finals.filter((f) => f.eventId !== eventId) });
      queryClient.invalidateQueries({ queryKey: getListFinalsQueryKey(meetId) });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    },
  });
}

/**
 * Auto-process every generated, unlocked final in a meet at the scratch
 * deadline: re-seed (promoting alternates over any scratches) and lock them.
 * Returns the number of events processed.
 */
export function processMeetScratchDeadline(meetId: number): number {
  const store = readStore();
  const targets = store.finals.filter((f) => f.meetId === meetId && !f.locked);
  if (targets.length === 0) return 0;
  let next = store;
  for (const finals of targets) {
    const reseeded = { ...reseedFinalists(finals), locked: true };
    next = { ...next, finals: upsertFinals(next, reseeded) };
    next = writeFinalsHeats(next, reseeded);
  }
  writeStore(next);
  return targets.length;
}
