import { Request, Response, NextFunction } from 'express';
import {
  eventVerificationService,
  EventVerificationService,
} from '../services/event-verification.service';
import { AppError } from '../../../middlewares/error.middleware';

export class EventVerificationController {
  constructor(
    private verificationService: EventVerificationService = eventVerificationService
  ) {}

  /**
   * GET /api/events/:eventId/verification
   */
  async getVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;
      const role = (req as any).user?.role;
      const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

      const data = await this.verificationService.getVerification(eventId, userId, isAdmin);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/events/:eventId/verification/draft
   */
  async saveDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;

      const verification = await this.verificationService.saveDraft(eventId, userId, req.body);
      res.status(200).json({
        success: true,
        data: verification,
        message: 'Verification details saved as draft.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/events/:eventId/verification/retry
   */
  async retryVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;

      const verification = await this.verificationService.retryVerificationInitialization(eventId, userId);
      res.status(200).json({
        success: true,
        data: verification,
        message: 'Verification initialized successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/events/:eventId/verification/send-otp
   */
  async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;
      const { officialEmail } = req.body;

      const result = await this.verificationService.sendOtp(eventId, userId, officialEmail);
      res.status(200).json({
        success: true,
        message: result.message,
        devOtp: result.devOtp,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/events/:eventId/verification/verify-otp
   */
  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;
      const { code } = req.body;

      const result = await this.verificationService.verifyOtp(eventId, userId, code);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/events/:eventId/verification/document
   */
  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;

      if (!req.file) {
        throw new AppError('No document file was uploaded.', 400);
      }

      const result = await this.verificationService.uploadDocument(
        eventId,
        userId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Document uploaded successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/events/:eventId/verification/document
   */
  async removeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;
      const { documentUrl } = req.body;

      if (!documentUrl) {
        throw new AppError('Document URL is required.', 400);
      }

      await this.verificationService.removeDocument(eventId, userId, documentUrl);
      res.status(200).json({
        success: true,
        message: 'Document removed.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/events/:eventId/verification/submit
   */
  async submitVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const userId = (req as any).user?.id;

      const result = await this.verificationService.submitVerification(eventId, userId);
      res.status(200).json({
        success: true,
        data: result.verification,
        riskTier: result.riskTier,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/verifications (Admin only)
   */
  async adminListVerifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, riskTier, page, limit } = req.query;

      const result = await this.verificationService.listAdminVerifications({
        status: status as any,
        riskTier: riskTier as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.verifications,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/verifications/:eventId/review (Admin only)
   */
  async adminReviewVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const adminUserId = (req as any).user?.id;
      const { decision, reviewNotes } = req.body;

      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        throw new AppError('Decision must be either APPROVED or REJECTED.', 400);
      }

      const result = await this.verificationService.reviewVerification(
        eventId,
        adminUserId,
        decision,
        reviewNotes
      );

      res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const eventVerificationController = new EventVerificationController();
