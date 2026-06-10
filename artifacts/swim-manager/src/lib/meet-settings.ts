import type { Meet } from "./local-store";

/**
 * Per-meet seeding & scoring preferences. Persisted as JSON in the existing
 * `Meet.scoringRules` string field (no schema migration needed).
 */
export interface MeetSeedingScoringSettings {
  /** Default number of lanes used when seeding events. */
  lanes: number;
  /** Heat order for seeding. */
  heatOrder: "slow_to_fast" | "fast_to_slow";
  /** How swimmers are placed into lanes within a heat. */
  laneAssignment: "center" | "dual";
  /** Apply circle (cross-heat) seeding to the fastest heats. */
  circleSeeding: boolean;
  /** Number of fastest heats to circle-seed (championship style). */
  circleSeededHeats: number;
  /** Place → points for individual events (index 0 = 1st place). */
  individualPoints: number[];
  /** Place → points for relay events (index 0 = 1st place). */
  relayPoints: number[];
  /** Only places at or above this depth score (0 = no limit). */
  scoringDepth: number;
  /** Max individual scorers per team per event (0 = no limit). */
  maxScorersPerTeam: number;
}

export const DEFAULT_INDIVIDUAL_POINTS = [9, 7, 6, 5, 4, 3, 2, 1];
export const DEFAULT_RELAY_POINTS = [18, 14, 12, 10, 8, 6, 4, 2];

const HS_DUAL_INDIVIDUAL = [6, 4, 3, 2, 1];
const HS_DUAL_RELAY = [8, 4, 2];

export interface MeetTypePreset {
  key: string;
  label: string;
  description: string;
  settings: MeetSeedingScoringSettings;
}

/**
 * Built-in presets. Keyed by a normalized meet-style/type token; `resolvePreset`
 * maps a meet's free-form style/type strings onto one of these.
 */
export const MEET_TYPE_PRESETS: MeetTypePreset[] = [
  {
    key: "standard",
    label: "Standard Invitational",
    description: "8 lanes, slow→fast, center-out lanes. USA-S 9-7-6-… individual / 18-14-… relay scoring.",
    settings: {
      lanes: 8,
      heatOrder: "slow_to_fast",
      laneAssignment: "center",
      circleSeeding: true,
      circleSeededHeats: 1,
      individualPoints: [...DEFAULT_INDIVIDUAL_POINTS],
      relayPoints: [...DEFAULT_RELAY_POINTS],
      scoringDepth: 8,
      maxScorersPerTeam: 0,
    },
  },
  {
    key: "championship",
    label: "Championship (Prelim/Final)",
    description: "Circle-seed the fastest 2–3 heats; 16-deep scoring.",
    settings: {
      lanes: 8,
      heatOrder: "slow_to_fast",
      laneAssignment: "center",
      circleSeeding: true,
      circleSeededHeats: 3,
      individualPoints: [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1],
      relayPoints: [40, 34, 32, 30, 28, 26, 24, 22, 18, 14, 12, 10, 8, 6, 4, 2],
      scoringDepth: 16,
      maxScorersPerTeam: 0,
    },
  },
  {
    key: "dual",
    label: "Dual Meet (2 teams)",
    description: "Teams alternate lanes; no circle seeding. HS dual 6-4-3-2-1 individual / 8-4-2 relay, 2 scorers/team.",
    settings: {
      lanes: 6,
      heatOrder: "fast_to_slow",
      laneAssignment: "dual",
      circleSeeding: false,
      circleSeededHeats: 0,
      individualPoints: [...HS_DUAL_INDIVIDUAL],
      relayPoints: [...HS_DUAL_RELAY],
      scoringDepth: 5,
      maxScorersPerTeam: 2,
    },
  },
  {
    key: "tri",
    label: "Tri / Multi-team Dual",
    description: "Three+ teams; fast→slow, no circle seeding. 3-team dual style scoring.",
    settings: {
      lanes: 6,
      heatOrder: "fast_to_slow",
      laneAssignment: "center",
      circleSeeding: false,
      circleSeededHeats: 0,
      individualPoints: [7, 5, 4, 3, 2, 1],
      relayPoints: [10, 6, 2],
      scoringDepth: 6,
      maxScorersPerTeam: 3,
    },
  },
  {
    key: "timed_finals",
    label: "Timed Finals",
    description: "Single round, slow→fast, standard scoring.",
    settings: {
      lanes: 8,
      heatOrder: "slow_to_fast",
      laneAssignment: "center",
      circleSeeding: false,
      circleSeededHeats: 0,
      individualPoints: [...DEFAULT_INDIVIDUAL_POINTS],
      relayPoints: [...DEFAULT_RELAY_POINTS],
      scoringDepth: 8,
      maxScorersPerTeam: 0,
    },
  },
];

export function getPresetByKey(key: string): MeetTypePreset {
  return MEET_TYPE_PRESETS.find((p) => p.key === key) ?? MEET_TYPE_PRESETS[0];
}

/** Map a meet's free-form style/type strings onto a preset key. */
export function resolvePresetKey(meet: Pick<Meet, "meetStyle" | "meetType">): string {
  const hay = `${meet.meetStyle ?? ""} ${meet.meetType ?? ""}`.toLowerCase();
  if (hay.includes("prelim") || hay.includes("championship") || hay.includes("final")) return "championship";
  if (hay.includes("3+") || hay.includes("tri") || hay.includes("3 ") || hay.includes("multi")) return "tri";
  if (hay.includes("dual")) return "dual";
  if (hay.includes("timed")) return "timed_finals";
  return "standard";
}

/**
 * Resolve the effective settings for a meet: stored custom settings if present,
 * otherwise the preset implied by the meet's style/type.
 */
export function getMeetSettings(meet: Pick<Meet, "meetStyle" | "meetType" | "scoringRules" | "lanes">): MeetSeedingScoringSettings {
  const preset = getPresetByKey(resolvePresetKey(meet)).settings;
  let stored: Partial<MeetSeedingScoringSettings> | null = null;
  if (meet.scoringRules) {
    try {
      const parsed = JSON.parse(meet.scoringRules);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.individualPoints)) {
        stored = parsed as MeetSeedingScoringSettings;
      }
    } catch {
      stored = null;
    }
  }
  const merged: MeetSeedingScoringSettings = { ...preset, ...(stored ?? {}) };
  // Fall back to the meet's own lane count if no explicit lane setting.
  if (!stored && meet.lanes) merged.lanes = meet.lanes;
  return merged;
}

export function serializeMeetSettings(s: MeetSeedingScoringSettings): string {
  return JSON.stringify(s);
}

/** Points for a finishing place given the meet settings. */
export function pointsForPlace(
  place: number | undefined,
  isRelay: boolean,
  settings: MeetSeedingScoringSettings
): number {
  if (!place || place < 1) return 0;
  if (settings.scoringDepth > 0 && place > settings.scoringDepth) return 0;
  const table = isRelay ? settings.relayPoints : settings.individualPoints;
  return table[place - 1] ?? 0;
}
