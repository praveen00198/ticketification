import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { guestImportService } from '../services/guest-import.service';
import { AppError } from '../../../middlewares/error.middleware';

export class GuestController {
  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);
      if (!req.file) throw new AppError('No file uploaded', 400);

      const { eventId } = req.params;
      const result = await guestImportService.uploadAndAnalyze(
        eventId,
        req.user.id,
        req.file.path,
        req.file.originalname
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async validate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const { eventId } = req.params;
      const { importId, columnMapping, requiredFields, categoryMapping, defaultCategory } = req.body;

      if (!importId) throw new AppError('Import ID is required', 400);
      if (!columnMapping) throw new AppError('Column mapping is required', 400);

      const result = await guestImportService.validateImport(eventId, req.user.id, {
        importId,
        columnMapping,
        requiredFields,
        categoryMapping,
        defaultCategory,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const { eventId } = req.params;
      const { importId, skipDuplicates } = req.body;

      if (!importId) throw new AppError('Import ID is required', 400);

      const result = await guestImportService.confirmImport(eventId, req.user.id, importId, {
        skipDuplicates: !!skipDuplicates,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listGuests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const { eventId } = req.params;
      const limit = parseInt(req.query.limit as string, 10) || 500;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await guestImportService.listGuests(eventId, req.user.id, limit, offset);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listImports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const { eventId } = req.params;
      const result = await guestImportService.listImports(eventId, req.user.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const guestController = new GuestController();
