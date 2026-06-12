/**
 * Monitors timing system health and detects failures within configurable thresholds.
 * Automatically activates backup/manual stopwatch mode when primary system fails.
 */

export interface TimingHealthStatus {
  state: 'healthy' | 'degraded' | 'failed' | 'recovering';
  lastEventAt: number | null;
  failureDetectedAt: number | null;
  eventRate: number; // events per second
  timeSinceLastEvent: number; // milliseconds
}

export interface TimingFailureConfig {
  failureThresholdMs: number; // Time without events before failure declared (default 10,000ms = 10s)
  recoveryThresholdMs: number; // Time of good events needed to recover (default 5,000ms)
  eventRateWindow: number; // Rolling window size for event rate (default 60s)
}

const DEFAULT_CONFIG: TimingFailureConfig = {
  failureThresholdMs: 10000,
  recoveryThresholdMs: 5000,
  eventRateWindow: 60000,
};

export class TimingFailureDetector {
  private lastEventAt: number | null = null;
  private failureDetectedAt: number | null = null;
  private eventTimestamps: number[] = [];
  private state: 'healthy' | 'degraded' | 'failed' | 'recovering' = 'healthy';
  private failureCallbacks: ((status: TimingHealthStatus) => void)[] = [];

  constructor(private config: Partial<TimingFailureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a timing event. Resets failure detection if system was in failed state.
   */
  recordEvent(): void {
    const now = Date.now();
    this.lastEventAt = now;
    this.eventTimestamps.push(now);

    // Trim old events outside the window
    const cutoff = now - this.config.eventRateWindow!;
    this.eventTimestamps = this.eventTimestamps.filter(t => t > cutoff);

    // If we were in failed state and now receiving events, move to recovering
    if (this.state === 'failed') {
      this.state = 'recovering';
      this.failureDetectedAt = null;
      this.notifyStatusChange();
    } else if (this.state === 'recovering' && !this.isInRecovery()) {
      this.state = 'healthy';
      this.notifyStatusChange();
    } else if (this.state === 'degraded' && this.eventTimestamps.length > 5) {
      this.state = 'healthy';
      this.notifyStatusChange();
    }
  }

  /**
   * Check system health without recording an event. Called periodically.
   * Returns true if system has failed.
   */
  checkHealth(): boolean {
    const now = Date.now();
    const timeSinceEvent = this.lastEventAt === null ? now : now - this.lastEventAt;

    // Transition to failed if we've exceeded threshold
    if (timeSinceEvent > this.config.failureThresholdMs! && this.state !== 'failed') {
      this.state = 'failed';
      this.failureDetectedAt = now;
      this.notifyStatusChange();
      return true;
    }

    // Monitor for degradation
    if (timeSinceEvent > this.config.failureThresholdMs! * 0.75 && this.state === 'healthy') {
      this.state = 'degraded';
      this.notifyStatusChange();
    }

    return this.state === 'failed';
  }

  /**
   * Get current health status snapshot.
   */
  getStatus(): TimingHealthStatus {
    const now = Date.now();
    const timeSinceEvent = this.lastEventAt === null ? now : now - this.lastEventAt;
    const eventRate = this.eventTimestamps.length / (this.config.eventRateWindow! / 1000);

    return {
      state: this.state,
      lastEventAt: this.lastEventAt,
      failureDetectedAt: this.failureDetectedAt,
      eventRate,
      timeSinceLastEvent: timeSinceEvent,
    };
  }

  /**
   * Subscribe to health status changes.
   */
  onStatusChange(callback: (status: TimingHealthStatus) => void): () => void {
    this.failureCallbacks.push(callback);
    return () => {
      this.failureCallbacks = this.failureCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Reset detector to healthy state.
   */
  reset(): void {
    this.lastEventAt = null;
    this.failureDetectedAt = null;
    this.eventTimestamps = [];
    this.state = 'healthy';
  }

  private isInRecovery(): boolean {
    if (this.failureDetectedAt === null || this.lastEventAt === null) return false;
    return (this.lastEventAt - this.failureDetectedAt) < this.config.recoveryThresholdMs!;
  }

  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.failureCallbacks.forEach(cb => cb(status));
  }
}
