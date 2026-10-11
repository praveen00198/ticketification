import { Response, NextFunction } from 'express';
import {
  eventStorageGovernanceService,
  EventStorageGovernanceService,
} from '../services/event-storage-governance.service';
import {
  eventJobQueueService,
  EventJobQueueService,
} from '../services/event-job-queue.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { auditService } from '../services/audit.service';

export class EventStorageController {
  constructor(
    private governanceService: EventStorageGovernanceService = eventStorageGovernanceService,
    private authHelper: EventJobQueueService = eventJobQueueService
  ) {}

  public getStorageMetrics = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      await this.authHelper.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      const metrics = await this.governanceService.getEventStorageMetrics(eventId);
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  };

  public cleanupStaleStorage = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      await this.authHelper.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      const retentionHours =
        req.body?.retentionHours !== undefined
          ? Math.max(0, Number(req.body.retentionHours))
          : 24;

      const result = await this.governanceService.cleanupStaleExports(eventId, retentionHours);

      // Record immutable audit entry
      await auditService.record({
        actorId: callerUserId,
        actorEmail: req.user?.email || 'host@ticketification.app',
        actorRole: callerPlatformRole || 'HOST',
        eventId,
        action: 'STORAGE_PURGED',
        targetEntity: 'storage',
        targetId: eventId,
        metadata: {
          reclaimedBytes: result.reclaimedBytes,
          reclaimedFormatted: result.reclaimedFormatted,
          deletedCount: result.deletedCount,
          retentionHours,
        },
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        message: `Successfully reclaimed ${result.reclaimedFormatted} across ${result.deletedCount} stale files.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const eventStorageController = new EventStorageController();
