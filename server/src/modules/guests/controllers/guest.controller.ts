import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { guestService } from '../services/guest.service';
import { guestImportService } from '../services/guest-import.service';
import { AuthenticationError, ValidationError } from '../../../middlewares/error.middleware';
import {
  validateCreateGuestInput,
  validateUpdateGuestInput,
  validateGuestQueryOptions,
} from '../guest.validation';
import {
  validateImportConfig,
  validateConfirmConfig,
  validateEventIdParam,
} from '../guest-import.validation';

export class GuestController {
  // --- Single Guest CRUD ---

  async createGuest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const { eventId } = req.params;
      const validatedData = validateCreateGuestInput(req.body);
      const guest = await guestService.createGuest(eventId, req.user.id, validatedData);

      res.status(201).json({
        success: true,
        data: guest,
      });
    } catch (err) {
      next(err);
    }
  }

  async listGuests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const { eventId } = req.params;
      const options = validateGuestQueryOptions(req.query);
      const result = await guestService.getGuestsByEvent(eventId, req.user.id, options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getGuest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const { eventId, guestId } = req.params;
      const guest = await guestService.getGuestById(eventId, guestId, req.user.id);

      res.status(200).json({
        success: true,
        data: guest,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateGuest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const { eventId, guestId } = req.params;
      const validatedData = validateUpdateGuestInput(req.body);
      const updated = await guestService.updateGuest(eventId, guestId, req.user.id, validatedData);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteGuest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const { eventId, guestId } = req.params;
      await guestService.deleteGuest(eventId, guestId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Guest deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Excel Import Endpoints ---

  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();
      if (!req.file) {
        throw new ValidationError('No file uploaded', [
          { field: 'file', message: 'An Excel (.xlsx, .xls) or CSV (.csv) file is required' },
        ]);
      }

      const eventId = validateEventIdParam(req.params.eventId);
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

  async validate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId);
      const config = validateImportConfig(req.body);

      const result = await guestImportService.validateImport(eventId, req.user.id, config);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId);
      const dto = validateConfirmConfig(req.body);

      const result = await guestImportService.confirmImport(eventId, req.user.id, dto);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listImports(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId);
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
