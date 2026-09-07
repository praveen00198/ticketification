/**
 * Production-safe memory diagnostics logger.
 * Logs process.memoryUsage() in a structured format at key lifecycle points.
 *
 * Format: [MEMORY] stage=<name> rss=XXXMB heapUsed=XXXMB heapTotal=XXXMB external=XXXMB arrayBuffers=XXXMB
 */

function toMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export interface MemorySnapshot {
  stage: string;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: string;
}

/**
 * Captures and logs a structured memory snapshot at the given lifecycle stage.
 * Returns the snapshot for programmatic use.
 */
export function logMemory(stage: string, extra?: Record<string, string | number>): MemorySnapshot {
  const mem = process.memoryUsage();
  const snapshot: MemorySnapshot = {
    stage,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    timestamp: new Date().toISOString(),
  };

  let line = `[MEMORY] stage=${stage} rss=${toMB(mem.rss)}MB heapUsed=${toMB(mem.heapUsed)}MB heapTotal=${toMB(mem.heapTotal)}MB external=${toMB(mem.external)}MB arrayBuffers=${toMB(mem.arrayBuffers)}MB`;

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      line += ` ${k}=${v}`;
    }
  }

  console.log(line);
  return snapshot;
}

/**
 * Tracks peak memory across multiple snapshots for a generation run.
 */
export class MemoryTracker {
  private peakRss = 0;
  private peakHeapUsed = 0;
  private peakExternal = 0;
  private peakArrayBuffers = 0;
  private startSnapshot: MemorySnapshot | null = null;
  private startTime = 0;

  start(stage: string): MemorySnapshot {
    this.startTime = Date.now();
    const snap = logMemory(stage);
    this.startSnapshot = snap;
    this.update(snap);
    return snap;
  }

  checkpoint(stage: string, extra?: Record<string, string | number>): MemorySnapshot {
    const snap = logMemory(stage, extra);
    this.update(snap);
    return snap;
  }

  private update(snap: MemorySnapshot) {
    if (snap.rss > this.peakRss) this.peakRss = snap.rss;
    if (snap.heapUsed > this.peakHeapUsed) this.peakHeapUsed = snap.heapUsed;
    if (snap.external > this.peakExternal) this.peakExternal = snap.external;
    if (snap.arrayBuffers > this.peakArrayBuffers) this.peakArrayBuffers = snap.arrayBuffers;
  }

  summarize(ticketsProcessed: number): void {
    const durationMs = Date.now() - this.startTime;
    const startRss = this.startSnapshot?.rss || 0;
    console.log(
      `[MEMORY-SUMMARY] ticketsProcessed=${ticketsProcessed} ` +
      `peakRSS=${toMB(this.peakRss)}MB ` +
      `rssBefore=${toMB(startRss)}MB ` +
      `rssAfter=${toMB(process.memoryUsage().rss)}MB ` +
      `peakHeapUsed=${toMB(this.peakHeapUsed)}MB ` +
      `peakExternal=${toMB(this.peakExternal)}MB ` +
      `peakArrayBuffers=${toMB(this.peakArrayBuffers)}MB ` +
      `durationMs=${durationMs}`
    );
  }
}
