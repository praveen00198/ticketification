import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import {
  EventCredentialCheckinService,
  eventCredentialCheckinService,
} from '../services/event-credential-checkin.service';

export class EventCredentialCheckinController {
  constructor(
    private checkinService: EventCredentialCheckinService = eventCredentialCheckinService
  ) {}

  /**
   * Verify and atomically check in a credential.
   * POST /api/events/:eventId/credentials/checkin
   */
  verifyAndCheckIn = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { token, gate, workerName, notes } = req.body;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      const result = await this.checkinService.verifyAndCheckIn(
        eventId,
        { token, gate, workerName, notes },
        callerUserId,
        callerPlatformRole
      );

      res.status(200).json({
        success: result.success,
        code: result.code,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Query recent check-in logs with filters.
   * GET /api/events/:eventId/credentials/checkins
   */
  listCheckinLogs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { limit, gate, scanStatus, search } = req.query;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      const logs = await this.checkinService.listCheckinLogs(
        eventId,
        callerUserId,
        callerPlatformRole,
        {
          limit: limit ? Number(limit) : undefined,
          gate: gate ? String(gate) : undefined,
          scanStatus: scanStatus ? String(scanStatus) : undefined,
          search: search ? String(search) : undefined,
        }
      );

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieve live aggregated check-in statistics.
   * GET /api/events/:eventId/credentials/checkin-stats
   */
  getCheckinStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      const stats = await this.checkinService.getCheckinStats(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventCredentialCheckinController =
  new EventCredentialCheckinController();
