import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AppStore,
  type Athlete,
  type Event,
  type RelayLeg,
  type RelayTeam,
  readStore,
  writeStore,
  nextId,
  getListRelayTeamsQueryKey,
} from "./local-store";

// ─── Smart relay builder ──────────────────────────────────────────────────────
// Builds optimal relay lineups from each club's roster. Freestyle relays take
// the fastest 4 swimmers (by their best free time at the leg distance); medley
// relays solve a small assignment problem so the four legs (back/breast/fly/
// free) are filled by the distinct swimmers that minimise the combined time.
// A/B/C teams are produced by removing each team's chosen swimmers and
// repeating with the remaining pool.

export const MEDLEY_ORDER = ["Backstroke", "Breaststroke", "Butterfly", "Freestyle"];

export interface RelayInfo {
  type: "medley" | "free";
  legStrokes: string[];
  legDistance: number;
}

export function relayInfo(event: Event): RelayInfo {
  const isMedley = /medley/i.test(event.stroke);
  const legDistance = Math.max(1, Math.round(event.distance / 4));
  return {
    type: isMedley ? "medley" : "free",
    legStrokes: isMedley ? MEDLEY_ORDER : ["Freestyle", "Freestyle", "Freestyle", "Freestyle"],
    legDistance,
  };
}

function strokeMatches(eventStroke: string, legStroke: string): boolean {
  const e = eventStroke.toLowerCase();
  // The free leg of a medley and a freestyle relay both want plain free swims.
  if (/relay/.test(e)) return false;
  return e.startsWith(legStroke.toLowerCase());
}

/** An athlete's best time for a given stroke at a given distance in this meet. */
export function athleteBestTime(
  store: AppStore,
  meetId: number,
  athleteId: number,
  legStroke: string,
  legDistance: number
): number | null {
  const entries = store.entries.filter((e) => e.meetId === meetId && e.athleteId === athleteId);
  let best: number | null = null;
  for (const entry of entries) {
    const event = store.events.find((ev) => ev.id === entry.eventId);
    if (!event || event.isRelay) continue;
    if (event.distance !== legDistance) continue;
    if (!strokeMatches(event.stroke, legStroke)) continue;
    const resultTime = store.results
      .filter((r) => r.entryId === entry.id && !r.dq && !r.ns && !r.dnf && r.finishTime != null)
      .reduce<number | null>((b, r) => {
        const t = r.finishTime as number;
        return b == null || t < b ? t : b;
      }, null);
    for (const t of [resultTime, entry.seedTime ?? null]) {
      if (t != null && (best == null || t < best)) best = t;
    }
  }
  return best;
}

interface Candidate {
  athlete: Athlete;
  time: number | null;
}

/** Athletes rostered in the meet (have ≥1 entry) eligible for this relay. */
function eligibleAthletes(store: AppStore, event: Event, teamId: number): Athlete[] {
  const enteredIds = new Set(
    store.entries.filter((e) => e.meetId === event.meetId).map((e) => e.athleteId)
  );
  return store.athletes.filter((a) => {
    if (a.teamId !== teamId) return false;
    if (a.active === false) return false;
    if (!enteredIds.has(a.id)) return false;
    if (event.gender === "M" || event.gender === "F") return a.gender === event.gender;
    return true; // Mixed
  });
}

function buildLeg(legNumber: number, stroke: string, c: Candidate | null): RelayLeg {
  return {
    legNumber,
    stroke,
    athleteId: c?.athlete.id ?? null,
    athleteName: c ? `${c.athlete.firstName} ${c.athlete.lastName}` : "",
    seedTime: c?.time ?? null,
  };
}

function totalOf(legs: RelayLeg[]): number | null {
  if (legs.some((l) => l.seedTime == null)) return null;
  return legs.reduce((s, l) => s + (l.seedTime ?? 0), 0);
}

/** Pick the fastest 4 distinct freestyle swimmers from the pool (NT last). */
function pickFreeTeam(pool: Candidate[]): { legs: RelayLeg[]; used: Set<number> } {
  const sorted = [...pool].sort((a, b) => {
    if (a.time == null && b.time == null) return 0;
    if (a.time == null) return 1;
    if (b.time == null) return -1;
    return a.time - b.time;
  });
  const chosen = sorted.slice(0, 4);
  const used = new Set(chosen.map((c) => c.athlete.id));
  const legs = Array.from({ length: 4 }, (_, i) =>
    buildLeg(i + 1, "Freestyle", chosen[i] ?? null)
  );
  return { legs, used };
}

/**
 * Solve the medley assignment: for each of the four strokes choose the distinct
 * swimmer minimising the combined time. Brute-forces over the top candidates per
 * stroke (pools are small), preferring complete teams.
 */
function pickMedleyTeam(
  store: AppStore,
  meetId: number,
  pool: Athlete[],
  legDistance: number
): { legs: RelayLeg[]; used: Set<number> } {
  const TOP = 6;
  const perStroke = MEDLEY_ORDER.map((stroke) => {
    const cands = pool
      .map((a) => ({ athlete: a, time: athleteBestTime(store, meetId, a.id, stroke, legDistance) }))
      .filter((c) => c.time != null)
      .sort((a, b) => (a.time as number) - (b.time as number))
      .slice(0, TOP);
    return cands;
  });

  let bestAssign: (Candidate | null)[] | null = null;
  let bestTotal = Infinity;

  // Each leg may also be left empty (null) so a partial team is still produced
  // when no distinct swimmer is available for some stroke.
  const [a0, a1, a2, a3] = perStroke.map((s) => [...s, null]);
  for (const c0 of a0) {
    for (const c1 of a1) {
      if (c0 && c1 && c0.athlete.id === c1.athlete.id) continue;
      for (const c2 of a2) {
        if (c2 && ((c0 && c0.athlete.id === c2.athlete.id) || (c1 && c1.athlete.id === c2.athlete.id))) continue;
        for (const c3 of a3) {
          if (c3 && ((c0 && c0.athlete.id === c3.athlete.id) || (c1 && c1.athlete.id === c3.athlete.id) || (c2 && c2.athlete.id === c3.athlete.id))) continue;
          const combo = [c0, c1, c2, c3];
          const filled = combo.filter(Boolean).length;
          const sum = combo.reduce((s, c) => s + (c?.time ?? 0), 0);
          // Prefer fuller teams; among equal fill, lowest total.
          const score = (4 - filled) * 1e9 + sum;
          if (score < bestTotal) {
            bestTotal = score;
            bestAssign = combo;
          }
        }
      }
    }
  }

  const assign = bestAssign ?? [null, null, null, null];
  const used = new Set<number>();
  const legs = MEDLEY_ORDER.map((stroke, i) => {
    const c = assign[i];
    if (c) used.add(c.athlete.id);
    return buildLeg(i + 1, stroke, c);
  });
  return { legs, used };
}

/** Build up to `numTeams` relay lineups per club for a relay event. */
export function buildSmartRelays(store: AppStore, eventId: number, numTeams: number): RelayTeam[] {
  const event = store.events.find((e) => e.id === eventId);
  if (!event) return [];
  const info = relayInfo(event);
  const teamIds = [...new Set(store.athletes.map((a) => a.teamId).filter((t): t is number => t != null))];

  const out: RelayTeam[] = [];
  let id = nextId(store.relayTeams);

  for (const teamId of teamIds) {
    const team = store.teams.find((t) => t.id === teamId);
    const teamName = team?.name ?? "Unattached";
    let pool = eligibleAthletes(store, event, teamId);
    if (pool.length === 0) continue;

    for (let n = 0; n < numTeams; n++) {
      if (pool.length === 0) break;
      let legs: RelayLeg[];
      let used: Set<number>;
      if (info.type === "medley") {
        ({ legs, used } = pickMedleyTeam(store, event.meetId, pool, info.legDistance));
      } else {
        const cands: Candidate[] = pool.map((a) => ({
          athlete: a,
          time: athleteBestTime(store, event.meetId, a.id, "Freestyle", info.legDistance),
        }));
        ({ legs, used } = pickFreeTeam(cands));
      }
      if (used.size === 0) break; // nobody left with usable times
      out.push({
        id: id++,
        eventId,
        meetId: event.meetId,
        teamId,
        teamName,
        letter: String.fromCharCode(65 + n),
        legs,
        totalSeedTime: totalOf(legs),
      });
      pool = pool.filter((a) => !used.has(a.id));
    }
  }

  // Order by team then letter for stable display.
  return out.sort((a, b) =>
    a.teamName === b.teamName ? a.letter.localeCompare(b.letter) : a.teamName.localeCompare(b.teamName)
  );
}

/** Candidate athletes (with leg time) for manually filling a leg. */
export function legCandidates(
  store: AppStore,
  eventId: number,
  teamId: number,
  legStroke: string
): { athleteId: number; name: string; time: number | null }[] {
  const event = store.events.find((e) => e.id === eventId);
  if (!event) return [];
  const info = relayInfo(event);
  return eligibleAthletes(store, event, teamId)
    .map((a) => ({
      athleteId: a.id,
      name: `${a.firstName} ${a.lastName}`,
      time: athleteBestTime(store, event.meetId, a.id, legStroke, info.legDistance),
    }))
    .sort((x, y) => {
      if (x.time == null && y.time == null) return x.name.localeCompare(y.name);
      if (x.time == null) return 1;
      if (y.time == null) return -1;
      return x.time - y.time;
    });
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useListRelayTeams(eventId?: number, options?: object) {
  return useQuery({
    queryKey: ["relayTeams", "event", eventId],
    queryFn: () => {
      const { relayTeams } = readStore();
      return eventId ? relayTeams.filter((r) => r.eventId === eventId) : relayTeams;
    },
    staleTime: 0,
    enabled: eventId !== 0,
    ...(options as object),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, eventId: number, meetId: number) {
  queryClient.invalidateQueries({ queryKey: ["relayTeams", "event", eventId] });
  queryClient.invalidateQueries({ queryKey: getListRelayTeamsQueryKey(meetId) });
}

export function useBuildSmartRelays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, numTeams }: { eventId: number; numTeams: number }) => {
      const store = readStore();
      const teams = buildSmartRelays(store, eventId, numTeams);
      const event = store.events.find((e) => e.id === eventId);
      const meetId = event?.meetId ?? 0;
      const others = store.relayTeams.filter((r) => r.eventId !== eventId);
      writeStore({ ...store, relayTeams: [...others, ...teams] });
      invalidate(queryClient, eventId, meetId);
      return teams;
    },
  });
}

export function useUpdateRelayLeg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      relayTeamId,
      legNumber,
      athleteId,
    }: {
      relayTeamId: number;
      legNumber: number;
      athleteId: number | null;
    }) => {
      const store = readStore();
      const rt = store.relayTeams.find((r) => r.id === relayTeamId);
      if (!rt) throw new Error("Relay team not found");
      const event = store.events.find((e) => e.id === rt.eventId);
      const info = event ? relayInfo(event) : null;

      const legs = rt.legs.map((leg) => {
        if (leg.legNumber !== legNumber) return leg;
        if (athleteId == null) return { ...leg, athleteId: null, athleteName: "", seedTime: null };
        const athlete = store.athletes.find((a) => a.id === athleteId);
        const time =
          event && info
            ? athleteBestTime(store, event.meetId, athleteId, leg.stroke, info.legDistance)
            : null;
        return {
          ...leg,
          athleteId,
          athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : "",
          seedTime: time,
        };
      });
      const updated = { ...rt, legs, totalSeedTime: totalOf(legs) };
      const relayTeams = store.relayTeams.map((r) => (r.id === relayTeamId ? updated : r));
      writeStore({ ...store, relayTeams });
      invalidate(queryClient, rt.eventId, rt.meetId);
      return updated;
    },
  });
}

export function useClearRelayTeams() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, meetId }: { eventId: number; meetId: number }) => {
      const store = readStore();
      writeStore({ ...store, relayTeams: store.relayTeams.filter((r) => r.eventId !== eventId) });
      invalidate(queryClient, eventId, meetId);
    },
  });
}
