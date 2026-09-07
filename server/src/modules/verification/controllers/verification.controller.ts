import { Request, Response, NextFunction } from 'express';
import { verificationService } from '../services/verification.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';
import {
  validateVerificationToken,
  validateOptionalEventId,
  validateOptionalWorkerName,
} from '../verification.validation';

export class VerificationController {
  async verifyToken(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.params.token || req.body.token || req.query.token;
      const token = validateVerificationToken(rawToken);
      const eventId = validateOptionalEventId(req.body.eventId || req.query.eventId);

      const result = await verificationService.verifyToken(token, eventId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async checkIn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = validateVerificationToken(req.body.token);
      const eventId = validateOptionalEventId(req.body.eventId);
      const workerName = validateOptionalWorkerName(req.body.workerName);
      const verifiedBy = req.user ? req.user.email : 'Admin Scanner';

      const result = await verificationService.checkInTicket({
        token,
        eventId,
        workerName,
        verifiedBy,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async scanAndCheckIn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rawToken = req.body.token || req.params.token || req.query.token;
      const token = validateVerificationToken(rawToken);
      const eventId = validateOptionalEventId(req.body.eventId || req.query.eventId);
      const workerName = validateOptionalWorkerName(req.body.workerName);
      const verifiedBy = req.user ? req.user.email : 'Admin Scanner';

      const result = await verificationService.scanAndCheckIn({
        token,
        eventId,
        workerName,
        verifiedBy,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRecentCheckins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const eventId = req.params.eventId as string;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      if (!eventId) {
        throw new AppError('Event ID is required', 400);
      }

      const checkins = await verificationService.getRecentCheckins(eventId, limit);
      res.json({
        success: true,
        data: checkins,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const verificationController = new VerificationController();
