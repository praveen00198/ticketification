/**
 * Memory Budget Governor for resource-constrained cloud containers (e.g., Render 512MB RAM).
 * Monitors process RSS memory against strict thresholds to prevent container OOM killer termination.
 */

export interface MemoryBudgetStatus {
  rssBytes: number;
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  thresholdMb: number;
  headroomMb: number;
  isMemoryConstrained: boolean;
  status: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL';
}

export class MemoryBudgetGovernor {
  /**
   * Safe operational ceiling for 512MB containers.
   * Leaves at least 112MB for native OS processes, network buffers, and libvips overhead.
   */
  private readonly defaultThresholdMb: number = 400;

  /**
   * Warning threshold where proactive garbage collection or delay throttling should occur.
   */
  private readonly elevatedThresholdMb: number = 320;

  constructor(private thresholdMb: number = 400) {
    if (process.env.MEMORY_CEILING_MB) {
      const parsed = parseInt(process.env.MEMORY_CEILING_MB, 10);
      if (!isNaN(parsed) && parsed > 100) {
        this.thresholdMb = parsed;
      }
    }
  }

  /**
   * Retrieves current memory status against container budget.
   */
  public getStatus(): MemoryBudgetStatus {
    const mem = process.memoryUsage();
    const rssMb = parseFloat((mem.rss / 1024 / 1024).toFixed(1));
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1));
    const heapTotalMb = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1));
    const headroomMb = parseFloat(Math.max(0, this.thresholdMb - rssMb).toFixed(1));

    let status: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL' = 'OPTIMAL';
    if (rssMb >= this.thresholdMb) {
      status = 'CRITICAL';
    } else if (rssMb >= this.elevatedThresholdMb) {
      status = 'ELEVATED';
    }

    return {
      rssBytes: mem.rss,
      rssMb,
      heapUsedMb,
      heapTotalMb,
      thresholdMb: this.thresholdMb,
      headroomMb,
      isMemoryConstrained: rssMb >= this.elevatedThresholdMb,
      status,
    };
  }

  /**
   * Suggests or executes V8 garbage collection if runtime allows.
   */
  public triggerGarbageCollection(): boolean {
    if (typeof (global as any).gc === 'function') {
      try {
        (global as any).gc();
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  /**
   * Throttles execution if memory is currently elevated to allow libvips / V8 GC cycles to reclaim memory.
   */
  public async yieldIfConstrained(delayMs: number = 100): Promise<void> {
    const status = this.getStatus();
    if (status.isMemoryConstrained) {
      this.triggerGarbageCollection();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export const memoryBudgetGovernor = new MemoryBudgetGovernor();
