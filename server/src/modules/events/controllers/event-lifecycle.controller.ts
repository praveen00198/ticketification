import { Request, Response, NextFunction } from 'express';
import {
  eventLifecycleService,
  EventLifecycleService,
} from '../services/event-lifecycle.service';
import { AppError } from '../../../middlewares/error.middleware';

export class EventLifecycleController {
  constructor(
    private lifecycleService: EventLifecycleService = eventLifecycleService
  ) {}

  /**
   * Generic transition endpoint.
   * POST /api/events/:eventId/lifecycle/transition
   */
  async transition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      const { targetStatus, reason } = req.body;

      if (!targetStatus) {
        throw new AppError('targetStatus is required', 400);
      }

      const result = await this.lifecycleService.transitionStatus(
        eventId,
        callerId,
        targetStatus,
        reason
      );

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Publish event.
   * POST /api/events/:eventId/publish
   */
  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.publishEvent(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Open registrations.
   * POST /api/events/:eventId/registrations/open
   */
  async openRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.openRegistration(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Close registrations.
   * POST /api/events/:eventId/registrations/close
   */
  async closeRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.closeRegistration(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark event live (day-of-event check-in gates open).
   * POST /api/events/:eventId/live
   */
  async startLive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.startLiveEvent(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Complete event.
   * POST /api/events/:eventId/complete
   */
  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.completeEvent(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Archive event.
   * POST /api/events/:eventId/archive
   */
  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.archiveEvent(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancel event.
   * POST /api/events/:eventId/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        throw new AppError('Cancellation reason is required.', 400);
      }

      const result = await this.lifecycleService.cancelEvent(eventId, callerId, reason);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve status transition history.
   * GET /api/events/:eventId/lifecycle/history
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;

      const result = await this.lifecycleService.getStatusHistory(eventId, callerId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Platform Administrator emergency circuit breaker: Suspend event.
   * POST /api/admin/events/:eventId/suspend
   */
  async adminSuspend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const adminId = (req as any).user?.id;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        throw new AppError('Suspension reason is required.', 400);
      }

      const result = await this.lifecycleService.suspendEvent(eventId, adminId, reason);

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Platform Administrator reinstatement.
   * POST /api/admin/events/:eventId/reinstate
   */
  async adminReinstate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const adminId = (req as any).user?.id;
      const { targetStatus, reason } = req.body;

      const result = await this.lifecycleService.reinstateEvent(
        eventId,
        adminId,
        targetStatus || 'APPROVED',
        reason
      );

      res.status(200).json({
        success: true,
        data: result.event,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const eventLifecycleController = new EventLifecycleController();
export default eventLifecycleController;
