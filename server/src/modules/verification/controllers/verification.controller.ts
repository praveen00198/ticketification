import { Request, Response, NextFunction } from 'express';
import { verificationService } from '../services/verification.service';

export class VerificationController {
  async verifyToken(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await verificationService.verifyToken(req.params.token);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { verifiedBy } = req.body;
      const result = await verificationService.checkInTicket(id, verifiedBy);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const verificationController = new VerificationController();
