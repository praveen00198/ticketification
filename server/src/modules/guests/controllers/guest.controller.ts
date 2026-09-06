import { Request, Response, NextFunction } from 'express';
import { guestImportService } from '../services/guest-import.service';
import { AppError } from '../../../middlewares/error.middleware';

export class GuestController {
  async importExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No Excel file uploaded. Please upload a .xlsx or .xls file.', 400);
      }

      const summary = guestImportService.parseAndValidateExcel(req.file.path);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
}

export const guestController = new GuestController();
