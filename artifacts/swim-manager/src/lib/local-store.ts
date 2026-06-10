import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Meet {
  id: number;
  name: string;
  startDate: string;
  endDate?: string;
  facility?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  course: string;
  meetType: string;
  meetStyle?: string;
  meetClass?: string;
  idFormat?: string;
  hostLsc?: string;
  altitude?: number;
  entryDeadline?: string;
  ageUpDate?: string;
  status: string;
  scoringRules?: string;
  lanes: number;
  notes?: string;
  createdAt: string;
}

export interface Athlete {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string;
  teamId?: number;
  teamName?: string;
  // When set, this athlete belongs only to a hosted meet's roster (Meet
  // Manager) and is kept separate from the global Team Manager roster.
  // undefined = a Team Manager / club athlete.
  meetId?: number;
  idNumber?: string;
  idFormat?: string;
  phone?: string;
  email?: string;
  website?: string;
  trainingGroup?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  healthNotes?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  abbreviation?: string;
  lsc?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  createdAt: string;
}

export interface Event {
  id: number;
  meetId: number;
  sessionId?: number;
  eventNumber: number;
  gender: string;
  ageGroup?: string;
  distance: number;
  stroke: string;
  course?: string;
  eventType?: string;
  heatOrder?: string;
  isRelay?: boolean;
  status: string;
  entryCount?: number;
  heatCount?: number;
  createdAt: string;
}

export interface Entry {
  id: number;
  meetId: number;
  eventId: number;
  athleteId: number;
  athleteName?: string;
  teamName?: string;
  seedTime?: number;
  seedCourse?: string;
  lane?: number;
  heat?: number;
  scratched: boolean;
  createdAt: string;
}

export interface LaneInfo {
  laneNumber: number;
  entryId: number | null;
  athleteId: number | null;
  athleteName: string;
  teamName: string;
  seedTime: number | null;
  finishTime: number | null;
  place: number | null;
  dq: boolean;
  dqCode?: string;
  ns: boolean;
  dnf: boolean;
  splits?: string;
}

export interface Heat {
  id: number;
  eventId: number;
  meetId: number;
  heatNumber: number;
  lanes: LaneInfo[];
}

export interface Result {
  id: number;
  entryId: number;
  eventId: number;
  finishTime?: number;
  place?: number;
  points?: number;
  dq: boolean;
  dqCode?: string;
  ns: boolean;
  dnf: boolean;
  splits?: string;
  // Which round this result belongs to. Undefined = legacy/timed-final (treated
  // as a prelim). Prelims and finals are stored as separate Result rows for the
  // same entry so a finals swim never overwrites the prelim swim.
  round?: ResultRound;
}

export type ResultRound = "prelim" | "final";

export interface Session {
  id: number;
  meetId: number;
  sessionNumber?: number;
  sessionType?: string;
  name: string;
  date?: string;
  startTime?: string;
  warmupTime?: string;
  notes?: string;
}

// A single athlete's standing in an event's finals (championship / consolation
// / alternate). `prelimTime`/`prelimRank` are snapshots taken when finalists
// were generated so re-seeding stays stable even after finals times overwrite
// the prelim result for the same entry.
export interface Finalist {
  entryId: number;
  athleteId: number;
  athleteName: string;
  teamName: string;
  prelimTime: number | null;
  prelimRank: number;
  finalName: string; // "A" | "B" | "C" | "" (alternate)
  qualified: boolean;
  alternate: boolean;
  scratched: boolean;
}

export interface EventFinals {
  eventId: number;
  meetId: number;
  numFinals: number; // number of final heats (1 = A only, 2 = A+B, 3 = A+B+C)
  finalSize: number; // lanes per final
  finalists: Finalist[];
  locked: boolean;
  generatedAt: string;
}

export interface RelayLeg {
  legNumber: number;
  stroke: string; // "Freestyle" for a free relay; Back/Breast/Fly/Free for medley
  athleteId: number | null;
  athleteName: string;
  seedTime: number | null; // athlete's best time for this leg's stroke + distance
}

export interface RelayTeam {
  id: number;
  eventId: number;
  meetId: number;
  teamId: number;
  teamName: string;
  letter: string; // "A" | "B" | "C" …
  legs: RelayLeg[];
  totalSeedTime: number | null; // sum of leg times (null if any leg has no time)
}

export interface Workout {
  id: number;
  name: string;
  date?: string;
  focus?: string;
  sets?: string;
  notes?: string;
  teamId?: number;
  createdAt: string;
}

export interface Invoice {
  id: number;
  athleteId?: number;
  athleteName?: string;
  amount: number;
  dueDate?: string;
  status: string;
  description?: string;
  invoiceType?: string;
  createdAt: string;
}

export interface PaymentPlan {
  id: number;
  athleteId?: number;
  athleteName?: string;
  planName: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly" | "weekly";
  startDate: string;
  nextDueDate: string;
  status: "active" | "paused" | "cancelled";
  description?: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  invoiceId?: number;
  athleteId?: number;
  athleteName?: string;
  amount: number;
  // "stripe" | "square" | "paypal" | "manual"
  provider: string;
  // e.g. "card", "cash", "check", "online"
  method: string;
  // External transaction / reference id (check #, Stripe session id, etc.)
  reference?: string;
  status: "succeeded" | "pending" | "refunded";
  note?: string;
  createdAt: string;
}

export interface TimeStandard {
  id: number;
  name: string;
  course: string;
  gender: string;
  ageMin: number;
  ageMax: number;
  distance: number;
  stroke: string;
  cutTime: number;
  tier: string;
  createdAt: string;
}

export interface Club {
  id: number;
  name: string;
  abbreviation?: string;
  lsc?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  entityId?: number | null;
  entityName?: string | null;
}

// ─── Store shape ─────────────────────────────────────────────────────────────

export interface AppStore {
  meets: Meet[];
  athletes: Athlete[];
  teams: Team[];
  events: Event[];
  entries: Entry[];
  heats: Heat[];
  results: Result[];
  sessions: Session[];
  finals: EventFinals[];
  relayTeams: RelayTeam[];
  workouts: Workout[];
  invoices: Invoice[];
  paymentPlans: PaymentPlan[];
  payments: Payment[];
  timeStandards: TimeStandard[];
  club: Club;
}

const SAMPLE_WORKOUTS: Workout[] = [
  {
    id: 1,
    name: "Aerobic Base Builder",
    date: new Date().toISOString().split("T")[0],
    focus: "Aerobic",
    sets: JSON.stringify([
      { setOrder: 1, repetitions: 1, distance: 400, stroke: "Freestyle", description: "Warm-up easy freestyle", restInterval: "30s", intensity: "Easy" },
      { setOrder: 2, repetitions: 4, distance: 100, stroke: "Individual Medley", description: "IM drill work, focus on turns", restInterval: "20s", intensity: "Moderate" },
      { setOrder: 3, repetitions: 8, distance: 100, stroke: "Freestyle", description: "Main set — descend pace each 100", restInterval: "15s", intensity: "Moderate-Hard" },
      { setOrder: 4, repetitions: 4, distance: 50, stroke: "Backstroke", description: "Cool-down, relaxed backstroke", restInterval: "30s", intensity: "Easy" },
    ]),
    notes: "Focus on steady aerobic effort. Keep stroke rate controlled.",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Sprint Power Session",
    date: new Date().toISOString().split("T")[0],
    focus: "Speed",
    sets: JSON.stringify([
      { setOrder: 1, repetitions: 1, distance: 300, stroke: "Freestyle", description: "Warm-up with build last 100", restInterval: "45s", intensity: "Easy" },
      { setOrder: 2, repetitions: 6, distance: 50, stroke: "Freestyle", description: "Dive starts, full sprint — race pace", restInterval: "60s", intensity: "Max" },
      { setOrder: 3, repetitions: 4, distance: 25, stroke: "Butterfly", description: "Fly explosions off the wall", restInterval: "45s", intensity: "Max" },
      { setOrder: 4, repetitions: 1, distance: 200, stroke: "Freestyle", description: "Easy cool-down", restInterval: "", intensity: "Easy" },
    ]),
    notes: "Full rest between reps. Quality over quantity. Time every sprint.",
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: "Dryland Strength Training",
    date: new Date().toISOString().split("T")[0],
    focus: "Strength",
    sets: JSON.stringify([
      { setOrder: 1, repetitions: 3, distance: 0, stroke: "N/A", description: "Push-ups — 20 reps each set", restInterval: "60s", intensity: "Moderate" },
      { setOrder: 2, repetitions: 3, distance: 0, stroke: "N/A", description: "Pull-ups / Lat pulldowns — 10 reps", restInterval: "90s", intensity: "Hard" },
      { setOrder: 3, repetitions: 3, distance: 0, stroke: "N/A", description: "Plank hold — 45 seconds each", restInterval: "30s", intensity: "Moderate" },
      { setOrder: 4, repetitions: 3, distance: 0, stroke: "N/A", description: "Squat jumps — 15 reps explosive", restInterval: "60s", intensity: "Hard" },
      { setOrder: 5, repetitions: 2, distance: 0, stroke: "N/A", description: "Resistance band freestyle pulls — 20 each arm", restInterval: "30s", intensity: "Moderate" },
    ]),
    notes: "Dryland session. Focus on swimming-specific muscle groups — lats, core, legs.",
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: "Threshold Training",
    date: new Date().toISOString().split("T")[0],
    focus: "Threshold",
    sets: JSON.stringify([
      { setOrder: 1, repetitions: 1, distance: 500, stroke: "Mixed", description: "Warm-up 100 free/100 back/100 breast/100 fly/100 free", restInterval: "60s", intensity: "Easy" },
      { setOrder: 2, repetitions: 3, distance: 300, stroke: "Freestyle", description: "Threshold pace — hold consistent split across all 300s", restInterval: "30s", intensity: "Hard" },
      { setOrder: 3, repetitions: 6, distance: 50, stroke: "Freestyle", description: "Kick-only with board, build each", restInterval: "20s", intensity: "Moderate" },
      { setOrder: 4, repetitions: 1, distance: 200, stroke: "Freestyle", description: "Cool-down easy", restInterval: "", intensity: "Easy" },
    ]),
    notes: "Threshold = comfortably hard. Should be able to talk in short sentences.",
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_STORE: AppStore = {
  meets: [],
  athletes: [],
  teams: [],
  events: [],
  entries: [],
  heats: [],
  results: [],
  sessions: [],
  finals: [],
  relayTeams: [],
  workouts: SAMPLE_WORKOUTS,
  invoices: [],
  paymentPlans: [],
  payments: [],
  timeStandards: [],
  club: { id: 1, name: "My Swimming Club" },
};

export interface AppSettings {
  backupUrl: string;
  backupIntervalMinutes: number;
  lastBackupAt: string | null;
  lastBackupStatus: "success" | "error" | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  backupUrl: "",
  backupIntervalMinutes: 30,
  lastBackupAt: null,
  lastBackupStatus: null,
};

const STORE_KEY = "swimmanager_data";
const SETTINGS_KEY = "swimmanager_settings";

// ─── Raw read / write ─────────────────────────────────────────────────────────

export function readStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_STORE;
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_STORE, ...parsed };
    // Back-fill sample workouts if none exist (new installs that had empty default)
    if (!parsed.workouts || parsed.workouts.length === 0) {
      merged.workouts = SAMPLE_WORKOUTS;
    }
    return merged;
  } catch {
    return DEFAULT_STORE;
  }
}

export function writeStore(store: AppStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function nextId(items: { id: number }[]): number {
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Query key factories ──────────────────────────────────────────────────────

export const getListEventsQueryKey = (meetId?: number) =>
  ["events", meetId] as const;
export const getListHeatsQueryKey = (eventId?: number) =>
  ["heats", eventId] as const;
export const getListSessionsQueryKey = (meetId?: number) =>
  ["sessions", meetId] as const;
export const getListEntriesQueryKey = (eventId?: number) =>
  ["entries", eventId] as const;
export const getGetMeetQueryKey = (id?: number) => ["meet", id] as const;
export const getGetAthleteQueryKey = (id?: number) =>
  ["athlete", id] as const;
export const getGetTeamQueryKey = (id?: number) => ["team", id] as const;
export const getGetWorkoutQueryKey = (id?: number) =>
  ["workout", id] as const;
export const getGetMeetTeamScoresQueryKey = (meetId?: number) =>
  ["meetTeamScores", meetId] as const;
export const getListFinalsQueryKey = (meetId?: number) =>
  ["finals", meetId] as const;
export const getListRelayTeamsQueryKey = (meetId?: number) =>
  ["relayTeams", meetId] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrichAthletes(athletes: Athlete[], teams: Team[]): Athlete[] {
  return athletes.map((a) => ({
    ...a,
    teamName: a.teamId
      ? (teams.find((t) => t.id === a.teamId)?.name ?? undefined)
      : undefined,
  }));
}

function enrichEvents(events: Event[], entries: Entry[], heats: Heat[]): Event[] {
  return events.map((e) => ({
    ...e,
    entryCount: entries.filter((en) => en.eventId === e.id && !en.scratched).length,
    heatCount: heats.filter((h) => h.eventId === e.id).length,
  }));
}

/** The round a Result belongs to (legacy/undefined → prelim). */
export function roundOf(r: Result): ResultRound {
  return r.round === "final" ? "final" : "prelim";
}

/** True once finals have been generated for an event (its live heats are finals). */
export function eventHasFinals(store: AppStore, eventId: number): boolean {
  return store.finals.some((f) => f.eventId === eventId);
}

/** Find an entry's result for a specific round. */
export function resultForRound(
  results: Result[],
  entryId: number,
  round: ResultRound
): Result | undefined {
  return results.find((r) => r.entryId === entryId && roundOf(r) === round);
}

/**
 * The result used for placing / scoring / standings: the finals swim when one
 * exists, otherwise the prelim/timed-final swim.
 */
export function effectiveResult(results: Result[], entryId: number): Result | undefined {
  const rs = results.filter((r) => r.entryId === entryId);
  return rs.find((r) => roundOf(r) === "final") ?? rs.find((r) => roundOf(r) === "prelim");
}

function populateHeatLanes(
  heats: Heat[],
  entries: Entry[],
  athletes: Athlete[],
  teams: Team[],
  results: Result[],
  finalsEventIds: Set<number>
): Heat[] {
  return heats.map((heat) => {
    const round: ResultRound = finalsEventIds.has(heat.eventId) ? "final" : "prelim";
    return {
    ...heat,
    lanes: heat.lanes.map((lane) => {
      if (!lane.entryId) return lane;
      const entry = entries.find((e) => e.id === lane.entryId);
      const athlete = entry ? athletes.find((a) => a.id === entry.athleteId) : null;
      const team = athlete?.teamId ? teams.find((t) => t.id === athlete.teamId) : null;
      const result = entry ? resultForRound(results, entry.id, round) : null;
      return {
        ...lane,
        athleteName: athlete
          ? `${athlete.firstName} ${athlete.lastName}`
          : lane.athleteName,
        teamName: team?.name ?? lane.teamName,
        finishTime: result?.finishTime ?? null,
        place: result?.place ?? null,
        dq: result?.dq ?? false,
        dqCode: result?.dqCode,
        ns: result?.ns ?? false,
        dnf: result?.dnf ?? false,
        splits: result?.splits,
      };
    }),
    };
  });
}

// ─── Meets ────────────────────────────────────────────────────────────────────

export function useListMeets() {
  return useQuery({
    queryKey: ["meets"],
    queryFn: () => readStore().meets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    staleTime: 0,
  });
}

export function useGetMeet(id: number, options?: object) {
  return useQuery({
    queryKey: getGetMeetQueryKey(id),
    queryFn: () => readStore().meets.find((m) => m.id === id) ?? null,
    staleTime: 0,
    enabled: !!id,
    ...(options as object),
  });
}

export function useCreateMeet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Meet, "id" | "createdAt" | "status"> }) => {
      const store = readStore();
      const meet: Meet = {
        ...data,
        id: nextId(store.meets),
        status: "scheduled",
        createdAt: now(),
      };
      writeStore({ ...store, meets: [...store.meets, meet] });
      return meet;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meets"] }),
  });
}

export function useUpdateMeet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Meet> }) => {
      const store = readStore();
      const meets = store.meets.map((m) => (m.id === id ? { ...m, ...data } : m));
      writeStore({ ...store, meets });
      return meets.find((m) => m.id === id)!;
    },
    onSuccess: (_r, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["meets"] });
      queryClient.invalidateQueries({ queryKey: getGetMeetQueryKey(id) });
    },
  });
}

export function useDeleteMeet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const store = readStore();
      writeStore({ ...store, meets: store.meets.filter((m) => m.id !== id) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meets"] }),
  });
}

// ─── Athletes ─────────────────────────────────────────────────────────────────

export function useListAthletes() {
  return useQuery({
    queryKey: ["athletes"],
    queryFn: () => {
      const { athletes, teams } = readStore();
      // Team Manager only shows club athletes — meet-scoped roster athletes
      // (those with a meetId) are managed inside the meet's Meet Roster.
      return enrichAthletes(athletes.filter((a) => a.meetId == null), teams);
    },
    staleTime: 0,
  });
}

export const getMeetRosterAthletesQueryKey = (meetId?: number) =>
  ["meet-roster-athletes", meetId] as const;

/** Athletes that make up a hosted meet's roster (the entry pool for the meet). */
export function useListMeetRosterAthletes(meetId?: number) {
  return useQuery({
    queryKey: getMeetRosterAthletesQueryKey(meetId),
    queryFn: () => {
      const { athletes, teams } = readStore();
      return enrichAthletes(athletes.filter((a) => a.meetId === meetId), teams);
    },
    staleTime: 0,
    enabled: meetId != null,
  });
}

/** Add a single athlete directly to a meet's roster (meet-scoped). */
export function useAddMeetRosterAthlete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetId, data }: { meetId: number; data: Omit<Athlete, "id" | "createdAt" | "meetId"> }) => {
      const store = readStore();
      const athlete: Athlete = {
        ...data,
        id: nextId(store.athletes),
        meetId,
        active: data.active ?? true,
        createdAt: now(),
      };
      writeStore({ ...store, athletes: [...store.athletes, athlete] });
      return athlete;
    },
    onSuccess: (_r, { meetId }) =>
      queryClient.invalidateQueries({ queryKey: getMeetRosterAthletesQueryKey(meetId) }),
  });
}

/**
 * Copy selected Team Manager (club) athletes into a meet's roster as new
 * meet-scoped records. The originals stay in Team Manager untouched; this just
 * makes them available as entries for the hosted meet.
 */
export function useImportAthletesFromTeamManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetId, athleteIds }: { meetId: number; athleteIds: number[] }) => {
      const store = readStore();
      const ids = new Set(athleteIds);
      const existingKeys = new Set(
        store.athletes
          .filter((a) => a.meetId === meetId)
          .map((a) => `${a.firstName.toLowerCase()}:${a.lastName.toLowerCase()}:${a.teamId ?? ""}`)
      );
      const copies: Athlete[] = [];
      let nextAthleteId = nextId(store.athletes);
      for (const src of store.athletes) {
        if (src.meetId != null || !ids.has(src.id)) continue;
        const key = `${src.firstName.toLowerCase()}:${src.lastName.toLowerCase()}:${src.teamId ?? ""}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        copies.push({
          ...src,
          id: nextAthleteId++,
          meetId,
          createdAt: now(),
        });
      }
      writeStore({ ...store, athletes: [...store.athletes, ...copies] });
      return { imported: copies.length };
    },
    onSuccess: (_r, { meetId }) =>
      queryClient.invalidateQueries({ queryKey: getMeetRosterAthletesQueryKey(meetId) }),
  });
}

/**
 * Remove an athlete from a meet's roster, along with any entries that
 * referenced them. Only affects meet-scoped athletes.
 */
export function useDeleteMeetRosterAthlete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetId, athleteId }: { meetId: number; athleteId: number }) => {
      const store = readStore();
      const target = store.athletes.find((a) => a.id === athleteId);
      if (!target || target.meetId !== meetId) return;
      const removedEventIds = new Set(
        store.entries.filter((e) => e.athleteId === athleteId).map((e) => e.eventId)
      );
      writeStore({
        ...store,
        athletes: store.athletes.filter((a) => a.id !== athleteId),
        entries: store.entries.filter((e) => e.athleteId !== athleteId),
        results: store.results.filter((r) => {
          const entry = store.entries.find((e) => e.id === r.entryId);
          return entry ? entry.athleteId !== athleteId : true;
        }),
      });
      return { removedEventIds: [...removedEventIds] };
    },
    onSuccess: (_r, { meetId }) => {
      queryClient.invalidateQueries({ queryKey: getMeetRosterAthletesQueryKey(meetId) });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(meetId) });
    },
  });
}

export function useGetAthlete(id: number) {
  return useQuery({
    queryKey: getGetAthleteQueryKey(id),
    queryFn: () => {
      const { athletes, teams } = readStore();
      const a = athletes.find((a) => a.id === id);
      if (!a) return null;
      return enrichAthletes([a], teams)[0];
    },
    staleTime: 0,
    enabled: !!id,
  });
}

export function useCreateAthlete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Athlete, "id" | "createdAt"> }) => {
      const store = readStore();
      const athlete: Athlete = {
        ...data,
        id: nextId(store.athletes),
        active: data.active ?? true,
        createdAt: now(),
      };
      writeStore({ ...store, athletes: [...store.athletes, athlete] });
      return athlete;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["athletes"] }),
  });
}

export function useUpdateAthlete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Athlete> }) => {
      const store = readStore();
      const athletes = store.athletes.map((a) => (a.id === id ? { ...a, ...data } : a));
      writeStore({ ...store, athletes });
      return athletes.find((a) => a.id === id)!;
    },
    onSuccess: (_r, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["athletes"] });
      queryClient.invalidateQueries({ queryKey: getGetAthleteQueryKey(id) });
    },
  });
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export function useListTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => readStore().teams,
    staleTime: 0,
  });
}

export function useGetTeam(id: number) {
  return useQuery({
    queryKey: getGetTeamQueryKey(id),
    queryFn: () => readStore().teams.find((t) => t.id === id) ?? null,
    staleTime: 0,
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Team, "id" | "createdAt"> }) => {
      const store = readStore();
      const team: Team = { ...data, id: nextId(store.teams), createdAt: now() };
      writeStore({ ...store, teams: [...store.teams, team] });
      return team;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Team> }) => {
      const store = readStore();
      const teams = store.teams.map((t) => (t.id === id ? { ...t, ...data } : t));
      writeStore({ ...store, teams });
      return teams.find((t) => t.id === id)!;
    },
    onSuccess: (_r, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(id) });
    },
  });
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function useListEvents(meetId?: number, options?: object) {
  return useQuery({
    queryKey: getListEventsQueryKey(meetId),
    queryFn: () => {
      const store = readStore();
      const events = meetId
        ? store.events.filter((e) => e.meetId === meetId)
        : store.events;
      return enrichEvents(
        events.sort((a, b) => a.eventNumber - b.eventNumber),
        store.entries,
        store.heats
      );
    },
    staleTime: 0,
    enabled: meetId !== 0,
    ...(options as object),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Event, "id" | "createdAt" | "status" | "entryCount" | "heatCount"> }) => {
      const store = readStore();
      const event: Event = {
        ...data,
        id: nextId(store.events),
        status: "pending",
        createdAt: now(),
      };
      writeStore({ ...store, events: [...store.events, event] });
      return event;
    },
    onSuccess: (_r, { data }) => {
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(data.meetId) });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Event> }) => {
      const store = readStore();
      const events = store.events.map((e) => (e.id === id ? { ...e, ...data } : e));
      writeStore({ ...store, events });
      const evt = events.find((e) => e.id === id)!;
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(evt.meetId) });
      return evt;
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const store = readStore();
      const evt = store.events.find((e) => e.id === id);
      writeStore({
        ...store,
        events: store.events.filter((e) => e.id !== id),
        entries: store.entries.filter((e) => e.eventId !== id),
        heats: store.heats.filter((h) => h.eventId !== id),
      });
      if (evt) queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(evt.meetId) });
    },
  });
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export function useListEntries(eventId?: number, options?: object) {
  return useQuery({
    queryKey: getListEntriesQueryKey(eventId),
    queryFn: () => {
      const store = readStore();
      const entries = eventId
        ? store.entries.filter((e) => e.eventId === eventId)
        : store.entries;
      return entries.map((entry) => {
        const athlete = store.athletes.find((a) => a.id === entry.athleteId);
        const team = athlete?.teamId
          ? store.teams.find((t) => t.id === athlete.teamId)
          : null;
        return {
          ...entry,
          athleteName: athlete
            ? `${athlete.firstName} ${athlete.lastName}`
            : entry.athleteName,
          teamName: team?.name ?? entry.teamName,
        };
      });
    },
    staleTime: 0,
    enabled: eventId !== 0,
    ...(options as object),
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
    }: {
      data: Omit<Entry, "id" | "createdAt" | "scratched" | "athleteName" | "teamName">;
    }) => {
      const store = readStore();
      const athlete = store.athletes.find((a) => a.id === data.athleteId);
      const team = athlete?.teamId
        ? store.teams.find((t) => t.id === athlete.teamId)
        : null;
      const entry: Entry = {
        ...data,
        id: nextId(store.entries),
        scratched: false,
        athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : undefined,
        teamName: team?.name,
        createdAt: now(),
      };
      writeStore({ ...store, entries: [...store.entries, entry] });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(data.eventId) });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(data.meetId) });
      return entry;
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Entry> }) => {
      const store = readStore();
      const entries = store.entries.map((e) => (e.id === id ? { ...e, ...data } : e));
      writeStore({ ...store, entries });
      const entry = entries.find((e) => e.id === id)!;
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(entry.eventId) });
      return entry;
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const store = readStore();
      const entry = store.entries.find((e) => e.id === id);
      writeStore({
        ...store,
        entries: store.entries.filter((e) => e.id !== id),
        results: store.results.filter((r) => r.entryId !== id),
      });
      if (entry) {
        queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(entry.eventId) });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(entry.meetId) });
      }
    },
  });
}

// ─── Heats / Seeding ──────────────────────────────────────────────────────────

export function useListHeats(eventId?: number, options?: object) {
  return useQuery({
    queryKey: getListHeatsQueryKey(eventId),
    queryFn: () => {
      const store = readStore();
      const heats = eventId
        ? store.heats.filter((h) => h.eventId === eventId)
        : store.heats;
      return populateHeatLanes(
        heats.sort((a, b) => a.heatNumber - b.heatNumber),
        store.entries,
        store.athletes,
        store.teams,
        store.results,
        new Set(store.finals.map((f) => f.eventId))
      );
    },
    staleTime: 0,
    enabled: eventId !== 0,
    ...(options as object),
  });
}

export function circleSeeding(numLanes: number): number[] {
  const mid = Math.ceil(numLanes / 2);
  const order: number[] = [mid];
  for (let i = 1; i <= numLanes; i++) {
    if (mid + i <= numLanes) order.push(mid + i);
    if (mid - i >= 1) order.push(mid - i);
    if (order.length >= numLanes) break;
  }
  return order;
}

export function useSeedEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: number;
      data: { lanes?: number; order?: string; circleSeeding?: boolean };
    }) => {
      const store = readStore();
      const event = store.events.find((e) => e.id === eventId);
      if (!event) throw new Error("Event not found");

      const numLanes = data.lanes ?? (event as any).lanes ?? 8;
      const slowToFast = (data.order ?? "slow_to_fast") === "slow_to_fast";
      const useCircle = data.circleSeeding !== false;

      const eventEntries = store.entries.filter(
        (e) => e.eventId === eventId && !e.scratched
      );

      const sorted = [...eventEntries].sort((a, b) => {
        const aTime = a.seedTime ?? (slowToFast ? 0 : Infinity);
        const bTime = b.seedTime ?? (slowToFast ? 0 : Infinity);
        return slowToFast ? aTime - bTime : bTime - aTime;
      });

      const numHeats = Math.ceil(sorted.length / numLanes);
      const laneOrder = useCircle ? circleSeeding(numLanes) : Array.from({ length: numLanes }, (_, i) => i + 1);
      const newHeats: Heat[] = [];
      const updatedEntries = [...store.entries];

      for (let h = 0; h < numHeats; h++) {
        const heatEntries = sorted.slice(h * numLanes, (h + 1) * numLanes);
        const lanes: LaneInfo[] = Array.from({ length: numLanes }, (_, i) => ({
          laneNumber: i + 1,
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
        }));

        heatEntries.forEach((entry, idx) => {
          const lane = laneOrder[idx] - 1;
          lanes[lane] = {
            ...lanes[lane],
            entryId: entry.id,
            athleteId: entry.athleteId,
            athleteName: entry.athleteName ?? "",
            teamName: entry.teamName ?? "",
            seedTime: entry.seedTime ?? null,
          };
          const ei = updatedEntries.findIndex((e) => e.id === entry.id);
          if (ei >= 0) {
            updatedEntries[ei] = {
              ...updatedEntries[ei],
              heat: h + 1,
              lane: laneOrder[idx],
            };
          }
        });

        newHeats.push({
          id: nextId([...store.heats, ...newHeats]),
          eventId,
          meetId: event.meetId,
          heatNumber: h + 1,
          lanes,
        });
      }

      const filteredHeats = store.heats.filter((h) => h.eventId !== eventId);
      const updatedEvents = store.events.map((e) =>
        e.id === eventId ? { ...e, status: "seeded" } : e
      );

      writeStore({
        ...store,
        heats: [...filteredHeats, ...newHeats],
        entries: updatedEntries,
        events: updatedEvents,
      });

      queryClient.invalidateQueries({ queryKey: getListHeatsQueryKey(eventId) });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(event.meetId) });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(eventId) });
      return newHeats;
    },
  });
}

// ─── Results ──────────────────────────────────────────────────────────────────

export function useSetResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: number;
      data: {
        entryId: number;
        finishTime?: number;
        place?: number;
        dq?: boolean;
        dqCode?: string;
        ns?: boolean;
        dnf?: boolean;
        splits?: string;
      };
    }) => {
      const store = readStore();
      // Results are entered into the event's current round. Once finals have
      // been generated the live heats are finals, so the entry's prelim swim is
      // preserved and the finals swim is stored as a separate Result row.
      const round: ResultRound = eventHasFinals(store, eventId) ? "final" : "prelim";
      const existing = store.results.find(
        (r) => r.entryId === data.entryId && roundOf(r) === round
      );
      let results: Result[];
      if (existing) {
        results = store.results.map((r) =>
          r.id === existing.id
            ? {
                ...r,
                ...data,
                round,
                dq: data.dq ?? false,
                ns: data.ns ?? false,
                dnf: data.dnf ?? false,
              }
            : r
        );
      } else {
        const newResult: Result = {
          id: nextId(store.results),
          entryId: data.entryId,
          eventId,
          round,
          finishTime: data.finishTime,
          place: data.place,
          dq: data.dq ?? false,
          dqCode: data.dqCode,
          ns: data.ns ?? false,
          dnf: data.dnf ?? false,
          splits: data.splits,
        };
        results = [...store.results, newResult];
      }

      const event = store.events.find((e) => e.id === eventId);
      let events = store.events;
      if (event && event.status === "seeded") {
        events = store.events.map((e) =>
          e.id === eventId ? { ...e, status: "completed" } : e
        );
      }

      writeStore({ ...store, results, events });
      queryClient.invalidateQueries({ queryKey: getListHeatsQueryKey(eventId) });
      if (event) queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(event.meetId) });
      return results.find((r) => r.entryId === data.entryId && roundOf(r) === round)!;
    },
  });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useListSessions(meetId?: number, options?: object) {
  return useQuery({
    queryKey: getListSessionsQueryKey(meetId),
    queryFn: () => {
      const { sessions } = readStore();
      return meetId ? sessions.filter((s) => s.meetId === meetId) : sessions;
    },
    staleTime: 0,
    enabled: meetId !== 0,
    ...(options as object),
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Session, "id"> }) => {
      const store = readStore();
      const session: Session = { ...data, id: nextId(store.sessions) };
      writeStore({ ...store, sessions: [...store.sessions, session] });
      return session;
    },
    onSuccess: (_r, { data }) =>
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(data.meetId) }),
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Session> }) => {
      const store = readStore();
      const sessions = store.sessions.map((s) => (s.id === id ? { ...s, ...data } : s));
      writeStore({ ...store, sessions });
      return sessions.find((s) => s.id === id)!;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(session.meetId) });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const store = readStore();
      const session = store.sessions.find((s) => s.id === id);
      writeStore({ ...store, sessions: store.sessions.filter((s) => s.id !== id) });
      return session;
    },
    onSuccess: (session) => {
      if (session) queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey(session.meetId) });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

// ─── Time Standards ───────────────────────────────────────────────────────────

export function useListTimeStandards() {
  return useQuery({ queryKey: ["timeStandards"], queryFn: () => [], staleTime: Infinity });
}

// ─── Team Scores ──────────────────────────────────────────────────────────────

export function useGetMeetTeamScores(meetId?: number, options?: object) {
  return useQuery({
    queryKey: getGetMeetTeamScoresQueryKey(meetId),
    queryFn: () => {
      if (!meetId) return [];
      const store = readStore();
      const scoreMap = new Map<number, { teamId: number; teamName: string; score: number }>();
      const meetEvents = store.events.filter((e) => e.meetId === meetId).map((e) => e.id);
      // Score one result per entry: the finals swim when present, else the
      // prelim/timed-final swim — so a swimmer is never counted twice.
      const scoredByEntry = new Map<number, Result>();
      for (const result of store.results) {
        if (!meetEvents.includes(result.eventId)) continue;
        const cur = scoredByEntry.get(result.entryId);
        if (!cur || (roundOf(result) === "final" && roundOf(cur) !== "final")) {
          scoredByEntry.set(result.entryId, result);
        }
      }
      Array.from(scoredByEntry.values()).forEach((result) => {
        if (result.dq || result.ns || result.dnf) return;
        const entry = store.entries.find((e) => e.id === result.entryId);
        if (!entry) return;
        const athlete = store.athletes.find((a) => a.id === entry.athleteId);
        if (!athlete?.teamId) return;
        const team = store.teams.find((t) => t.id === athlete.teamId);
        if (!team) return;
        const points = result.points ?? pointsForPlace(result.place);
        const existing = scoreMap.get(athlete.teamId);
        if (existing) existing.score += points;
        else scoreMap.set(athlete.teamId, { teamId: athlete.teamId, teamName: team.name, score: points });
      });
      return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
    },
    staleTime: 0,
    ...(options as object),
  });
}

function pointsForPlace(place?: number): number {
  if (!place) return 0;
  const pts: Record<number, number> = { 1: 9, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
  return pts[place] ?? 0;
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export function useListWorkouts() {
  return useQuery({
    queryKey: ["workouts"],
    queryFn: () => readStore().workouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    staleTime: 0,
  });
}

export function useGetWorkout(id: number) {
  return useQuery({
    queryKey: getGetWorkoutQueryKey(id),
    queryFn: () => readStore().workouts.find((w) => w.id === id) ?? null,
    staleTime: 0,
    enabled: !!id,
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Workout, "id" | "createdAt"> }) => {
      const store = readStore();
      const workout: Workout = { ...data, id: nextId(store.workouts), createdAt: now() };
      writeStore({ ...store, workouts: [...store.workouts, workout] });
      return workout;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Workout> }) => {
      const store = readStore();
      const workouts = store.workouts.map((w) => (w.id === id ? { ...w, ...data } : w));
      writeStore({ ...store, workouts });
      return workouts.find((w) => w.id === id)!;
    },
    onSuccess: (_r, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(id) });
    },
  });
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export function useListInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: () => readStore().invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    staleTime: 0,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Invoice, "id" | "createdAt"> }) => {
      const store = readStore();
      const athlete = data.athleteId
        ? store.athletes.find((a) => a.id === data.athleteId)
        : null;
      const invoice: Invoice = {
        ...data,
        id: nextId(store.invoices),
        athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : data.athleteName,
        createdAt: now(),
      };
      writeStore({ ...store, invoices: [...store.invoices, invoice] });
      return invoice;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useGetBillingSummary() {
  return useQuery({
    queryKey: ["billingSummary"],
    queryFn: () => {
      const { invoices } = readStore();
      return {
        total: invoices.reduce((s, i) => s + i.amount, 0),
        outstanding: invoices
          .filter((i) => i.status === "outstanding")
          .reduce((s, i) => s + i.amount, 0),
        paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0),
        count: invoices.length,
        overdueCount: invoices.filter((i) => {
          if (i.status !== "outstanding") return false;
          if (!i.dueDate) return false;
          return new Date(i.dueDate) < new Date();
        }).length,
      };
    },
    staleTime: 0,
  });
}

export function useListPayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: () => (readStore().payments ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    staleTime: 0,
  });
}

/**
 * Record a payment against an invoice (or standalone) and, when it succeeds,
 * mark the linked invoice paid. Used by both the online-checkout flow
 * ("pending" until confirmed) and manual cash/check entry ("succeeded").
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Omit<Payment, "id" | "createdAt"> }) => {
      const store = readStore();
      const athlete = data.athleteId ? store.athletes.find((a) => a.id === data.athleteId) : null;
      const payment: Payment = {
        ...data,
        id: nextId(store.payments ?? []),
        athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : data.athleteName,
        createdAt: now(),
      };
      let invoices = store.invoices;
      if (data.invoiceId != null && data.status === "succeeded") {
        invoices = invoices.map((inv) => (inv.id === data.invoiceId ? { ...inv, status: "paid" } : inv));
      }
      writeStore({ ...store, payments: [...(store.payments ?? []), payment], invoices });
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billingSummary"] });
    },
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useGetDashboardStats() {
  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: () => {
      const store = readStore();
      const today = new Date().toISOString().split("T")[0];
      return {
        totalMeets: store.meets.length,
        activeMeets: store.meets.filter((m) => m.status === "in_progress").length,
        upcomingMeets: store.meets.filter((m) => m.startDate > today).length,
        totalAthletes: store.athletes.filter((a) => a.active).length,
        totalTeams: store.teams.length,
        totalWorkouts: store.workouts.length,
        outstandingBilling: store.invoices
          .filter((i) => i.status === "outstanding")
          .reduce((s, i) => s + i.amount, 0),
      };
    },
    staleTime: 0,
  });
}

export function useGetRecentActivity() {
  return useQuery({
    queryKey: ["recentActivity"],
    queryFn: (): ActivityItem[] => {
      const store = readStore();
      const items: ActivityItem[] = [];
      store.meets.slice(-5).forEach((m) =>
        items.push({ id: `meet-${m.id}`, type: "meet", description: `Meet "${m.name}" created`, timestamp: m.createdAt, entityId: m.id, entityName: m.name })
      );
      store.athletes.slice(-5).forEach((a) =>
        items.push({ id: `athlete-${a.id}`, type: "athlete", description: `Athlete ${a.firstName} ${a.lastName} added`, timestamp: a.createdAt, entityId: a.id, entityName: `${a.firstName} ${a.lastName}` })
      );
      return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10);
    },
    staleTime: 0,
  });
}

// ─── Club / Settings ──────────────────────────────────────────────────────────

export function useGetClub() {
  return useQuery({
    queryKey: ["club"],
    queryFn: () => readStore().club,
    staleTime: 0,
  });
}

export function useUpdateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Partial<Club> }) => {
      const store = readStore();
      const club = { ...store.club, ...data };
      writeStore({ ...store, club });
      return club;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["club"] }),
  });
}

// ─── Settings (backup config) ─────────────────────────────────────────────────

export function useGetSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => readSettings(),
    staleTime: 0,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const settings = { ...readSettings(), ...data };
      writeSettings(settings);
      return settings;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ─── Data export / import ─────────────────────────────────────────────────────

export function exportAllData(): string {
  return JSON.stringify({ store: readStore(), settings: readSettings() }, null, 2);
}

export function importAllData(json: string): void {
  const parsed = JSON.parse(json);
  if (parsed.store) writeStore({ ...DEFAULT_STORE, ...parsed.store });
  if (parsed.settings) writeSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
}

export function clearAllData(): void {
  writeStore(DEFAULT_STORE);
}
