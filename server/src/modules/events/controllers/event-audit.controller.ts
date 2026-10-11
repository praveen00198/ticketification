import { Response, NextFunction } from 'express';
import { auditService, AuditService } from '../services/audit.service';
import {
  eventJobQueueService,
  EventJobQueueService,
} from '../services/event-job-queue.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';

export class EventAuditController {
  constructor(
    private service: AuditService = auditService,
    private authHelper: EventJobQueueService = eventJobQueueService
  ) {}

  public getEventAuditLogs = async (
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

      const filters = {
        action: req.query.action as string | undefined,
        actorId: req.query.actorId as string | undefined,
        targetEntity: req.query.targetEntity as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      const result = await this.service.getEventAuditLogs(eventId, filters, options);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const eventAuditController = new EventAuditController();
