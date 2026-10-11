import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { eventDashboardService, EventDashboardService } from '../services/event-dashboard.service';
import { eventJobQueueService, EventJobQueueService } from '../services/event-job-queue.service';
import { AuthenticationError } from '../../../middlewares/error.middleware';

export class EventDashboardController {
  constructor(
    private dashboardService: EventDashboardService = eventDashboardService,
    private authHelper: EventJobQueueService = eventJobQueueService
  ) {}

  /**
   * GET /api/events/:eventId/dashboard-summary
   * Aggregated telemetry and type-aware feature matrix for Host Console.
   */
  public getDashboardSummary = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('Authentication required');
      }

      const { eventId } = req.params;
      const callerUserId = req.user.id || (req.user as any)._id?.toString();
      const callerPlatformRole = req.user.role;

      // Enforce Host or Coordinator authorization boundary
      await this.authHelper.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      const summary = await this.dashboardService.getDashboardSummary(eventId);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const eventDashboardController = new EventDashboardController();
