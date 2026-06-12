/**
 * Merges manual stopwatch times with electronic timing data.
 * Handles conflict resolution and audit logging.
 */

export interface TimingRecord {
  lane: number;
  source: 'electronic' | 'manual' | 'merged';
  time: number | null;
  confidence: number; // 0-1 score for merge reliability
  originalTime?: number;
  mergedAt?: number;
  mergeReason?: string;
}

export interface MergeRule {
  strategy: 'prefer-electronic' | 'prefer-manual' | 'average' | 'manual-override' | 'ask-operator';
  timeDeltaThreshold?: number; // milliseconds; times differing by more than this are flagged
}

export interface MergeAuditLog {
  timestamp: number;
  heat: number;
  laneRecords: Array<{
    lane: number;
    electronicTime: number | null;
    manualTime: number | null;
    mergedTime: number | null;
    decision: string;
    confidence: number;
  }>;
}

const DEFAULT_DELTA_THRESHOLD = 500; // 0.5 second

/**
 * Merge electronic times with manual stopwatch times using the given strategy.
 */
export function mergeTimesForHeat(
  electronicTimes: Record<number, number | null>,
  manualTimes: Record<number, number | null>,
  rule: MergeRule,
  heatNumber: number
): { merged: Record<number, TimingRecord>; audit: MergeAuditLog } {
  const merged: Record<number, TimingRecord> = {};
  const auditRecords: MergeAuditLog['laneRecords'] = [];

  const lanes = new Set([
    ...Object.keys(electronicTimes).map(Number),
    ...Object.keys(manualTimes).map(Number),
  ]);

  for (const lane of lanes) {
    const eTim = electronicTimes[lane] ?? null;
    const mTime = manualTimes[lane] ?? null;
    const threshold = rule.timeDeltaThreshold ?? DEFAULT_DELTA_THRESHOLD;

    let result: TimingRecord;
    let decision: string;
    let confidence = 1.0;

    if (eTim === null && mTime === null) {
      // No data
      result = { lane, source: 'merged', time: null, confidence: 0 };
      decision = 'no-data-available';
    } else if (eTim !== null && mTime === null) {
      // Only electronic
      result = { lane, source: 'electronic', time: eTim, confidence: 1.0 };
      decision = 'only-electronic';
    } else if (eTim === null && mTime !== null) {
      // Only manual
      result = { lane, source: 'manual', time: mTime, confidence: 0.8 };
      decision = 'only-manual';
      confidence = 0.8;
    } else if (eTim !== null && mTime !== null) {
      // Both present: apply rule
      const delta = Math.abs(eTim - mTime);
      const flagged = delta > threshold;

      switch (rule.strategy) {
        case 'prefer-electronic':
          result = { lane, source: 'electronic', time: eTim, confidence: flagged ? 0.6 : 0.95, originalTime: mTime };
          decision = flagged ? 'prefer-electronic-delta-flagged' : 'prefer-electronic';
          confidence = flagged ? 0.6 : 0.95;
          break;

        case 'prefer-manual':
          result = { lane, source: 'manual', time: mTime, confidence: flagged ? 0.7 : 0.9, originalTime: eTim };
          decision = flagged ? 'prefer-manual-delta-flagged' : 'prefer-manual';
          confidence = flagged ? 0.7 : 0.9;
          break;

        case 'average':
          const avg = (eTim + mTime) / 2;
          result = { lane, source: 'merged', time: avg, confidence: flagged ? 0.5 : 0.85 };
          decision = flagged ? 'averaged-delta-flagged' : 'averaged';
          confidence = flagged ? 0.5 : 0.85;
          break;

        case 'manual-override':
          result = { lane, source: 'manual', time: mTime, confidence: 0.9, originalTime: eTim };
          decision = flagged ? 'manual-override-delta-flagged' : 'manual-override';
          confidence = flagged ? 0.7 : 0.9;
          break;

        case 'ask-operator':
        default:
          // Return both with lower confidence; operator decides
          result = { lane, source: 'merged', time: eTim, confidence: 0.5 };
          decision = 'requires-operator-decision';
          confidence = 0.5;
          break;
      }
    } else {
      result = { lane, source: 'merged', time: null, confidence: 0 };
      decision = 'unknown';
    }

    merged[lane] = result;
    auditRecords.push({
      lane,
      electronicTime: eTim,
      manualTime: mTime,
      mergedTime: result.time,
      decision,
      confidence,
    });
  }

  const audit: MergeAuditLog = {
    timestamp: Date.now(),
    heat: heatNumber,
    laneRecords: auditRecords,
  };

  return { merged, audit };
}

/**
 * Detect lanes that need operator review due to conflicts.
 */
export function flagConflictLanes(merged: Record<number, TimingRecord>): number[] {
  return Object.entries(merged)
    .filter(([_, record]) => record.confidence < 0.8)
    .map(([lane]) => Number(lane));
}
