import {
  SupabaseStorageService,
  supabaseStorageService,
} from '../../tickets/services/supabase-storage.service';
import { EventJobModel } from '../../../db/mongo/models/event-job.model';
import { AppError } from '../../../middlewares/error.middleware';

export interface StorageFolderBreakdown {
  count: number;
  bytes: number;
  formatted: string;
}

export interface ExportFileTelemetry {
  name: string;
  storagePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  isStale: boolean;
}

export interface EventStorageMetrics {
  eventId: string;
  totalBytes: number;
  totalBytesFormatted: string;
  quotaBytes: number;
  quotaBytesFormatted: string;
  usedPercentage: number;
  isNearQuota: boolean;
  isQuotaExceeded: boolean;
  breakdown: {
    credentials: StorageFolderBreakdown;
    exports: StorageFolderBreakdown;
    templates: StorageFolderBreakdown;
  };
  recentExports: ExportFileTelemetry[];
}

export interface StorageCleanupResult {
  deletedCount: number;
  reclaimedBytes: number;
  reclaimedFormatted: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export class EventStorageGovernanceService {
  /**
   * Standard event storage allowance: 1024 MB (1 GB).
   */
  private readonly defaultQuotaBytes = 1024 * 1024 * 1024;

  constructor(
    private storageService: SupabaseStorageService = supabaseStorageService
  ) {}

  /**
   * Calculates comprehensive storage telemetry and quota status for an event.
   */
  public async getEventStorageMetrics(eventId: string): Promise<EventStorageMetrics> {
    const quotaBytes = this.defaultQuotaBytes;

    if (!this.storageService.isConfigured()) {
      return {
        eventId,
        totalBytes: 0,
        totalBytesFormatted: '0 B',
        quotaBytes,
        quotaBytesFormatted: formatBytes(quotaBytes),
        usedPercentage: 0,
        isNearQuota: false,
        isQuotaExceeded: false,
        breakdown: {
          credentials: { count: 0, bytes: 0, formatted: '0 B' },
          exports: { count: 0, bytes: 0, formatted: '0 B' },
          templates: { count: 0, bytes: 0, formatted: '0 B' },
        },
        recentExports: [],
      };
    }

    // 1. Fetch files in credentials / tickets folder
    const [legacyTickets, modernCredentials, exportsList, templatesList] = await Promise.all([
      this.storageService.listFolder(`events/${eventId}/tickets`),
      this.storageService.listFolder(`events/${eventId}/credentials`),
      this.storageService.listFolder(`events/${eventId}/exports`),
      this.storageService.listFolder(`events/${eventId}/templates`),
    ]);

    const allCredentials = [...legacyTickets, ...modernCredentials];
    const credBytes = allCredentials.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
    const expBytes = exportsList.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
    const tmplBytes = templatesList.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

    const totalBytes = credBytes + expBytes + tmplBytes;
    const usedPercentage = parseFloat(Math.min(100, (totalBytes / quotaBytes) * 100).toFixed(2));
    const isNearQuota = usedPercentage >= 80;
    const isQuotaExceeded = totalBytes >= quotaBytes;

    const now = Date.now();
    const staleThresholdMs = 24 * 60 * 60 * 1000; // 24 hours

    const recentExports: ExportFileTelemetry[] = exportsList.map((exp) => {
      const fileCreated = new Date(exp.createdAt).getTime();
      const ageMs = now - fileCreated;
      return {
        name: exp.name,
        storagePath: exp.storagePath,
        sizeBytes: exp.sizeBytes,
        sizeFormatted: formatBytes(exp.sizeBytes),
        createdAt: exp.createdAt,
        isStale: ageMs > staleThresholdMs,
      };
    });

    return {
      eventId,
      totalBytes,
      totalBytesFormatted: formatBytes(totalBytes),
      quotaBytes,
      quotaBytesFormatted: formatBytes(quotaBytes),
      usedPercentage,
      isNearQuota,
      isQuotaExceeded,
      breakdown: {
        credentials: {
          count: allCredentials.length,
          bytes: credBytes,
          formatted: formatBytes(credBytes),
        },
        exports: {
          count: exportsList.length,
          bytes: expBytes,
          formatted: formatBytes(expBytes),
        },
        templates: {
          count: templatesList.length,
          bytes: tmplBytes,
          formatted: formatBytes(tmplBytes),
        },
      },
      recentExports,
    };
  }

  /**
   * Deletes stale export archives (ZIP, XLSX, CSV) older than retentionHours (default 24h).
   */
  public async cleanupStaleExports(
    eventId: string,
    retentionHours = 24
  ): Promise<StorageCleanupResult> {
    if (!this.storageService.isConfigured()) {
      return { deletedCount: 0, reclaimedBytes: 0, reclaimedFormatted: '0 B' };
    }

    const exportsList = await this.storageService.listFolder(`events/${eventId}/exports`);
    if (!exportsList.length) {
      return { deletedCount: 0, reclaimedBytes: 0, reclaimedFormatted: '0 B' };
    }

    const now = Date.now();
    const thresholdMs = retentionHours * 60 * 60 * 1000;

    const staleFiles = exportsList.filter((f) => {
      const fileCreated = new Date(f.createdAt).getTime();
      return now - fileCreated > thresholdMs;
    });

    if (!staleFiles.length) {
      return { deletedCount: 0, reclaimedBytes: 0, reclaimedFormatted: '0 B' };
    }

    const pathsToDelete = staleFiles.map((f) => f.storagePath);
    const reclaimedBytes = staleFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

    const deleteResult = await this.storageService.deleteFiles(pathsToDelete);

    // Invalidate expired download URLs in event_jobs
    try {
      await EventJobModel.updateMany(
        {
          eventId,
          jobType: 'EXPORT_CREDENTIALS',
          'result.storagePath': { $in: pathsToDelete },
        },
        {
          $set: {
            'result.downloadUrl': null,
          },
        }
      );
    } catch (err: any) {
      console.warn('[EventStorageGovernanceService] Note updating stale jobs:', err?.message);
    }

    return {
      deletedCount: deleteResult.deletedCount || staleFiles.length,
      reclaimedBytes,
      reclaimedFormatted: formatBytes(reclaimedBytes),
    };
  }

  /**
   * Validates that adding estimatedIncomingBytes will not breach the event quota.
   */
  public async assertStorageAllowance(
    eventId: string,
    estimatedIncomingBytes = 0
  ): Promise<void> {
    const metrics = await this.getEventStorageMetrics(eventId);
    if (metrics.totalBytes + estimatedIncomingBytes > metrics.quotaBytes) {
      throw new AppError(
        `Event storage quota limit exceeded (${metrics.quotaBytesFormatted} limit, currently using ${metrics.totalBytesFormatted}). Clean up stale export archives to reclaim storage.`,
        400
      );
    }
  }
}

export const eventStorageGovernanceService = new EventStorageGovernanceService();
