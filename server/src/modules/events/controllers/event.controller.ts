import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { eventService, EventService } from '../services/event.service';
import { AuthenticationError, ValidationError } from '../../../middlewares/error.middleware';
import config from '../../../config/env';
import {
  validateEventWizardInput,
  validateEventDraftUpdate,
  validateCreateEventInput,
  validateUpdateEventInput,
  validateCreateTicketTypeInput,
} from '../event.validation';

export class EventController {
  constructor(
    private service: EventService = eventService
  ) {}

  /**
   * GET /api/events
   * Retrieve caller's events with pagination and filtering.
   */
  listMyEvents = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const status = req.query.status ? String(req.query.status) : undefined;
      const eventType = req.query.eventType ? String(req.query.eventType) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;

      const result = await this.service.getEventsByOwnerPaginated(req.user.id, {
        page,
        limit,
        status,
        eventType,
        search,
      });

      // If MongoDB returns 0 events and legacy database is configured, check if user has legacy events
      if (result.total === 0 && config.env.databaseUrl) {
        try {
          const legacyEvents = await this.service.getEventsByOwner(req.user.id);
          if (legacyEvents.length > 0) {
            res.status(200).json({
              success: true,
              data: legacyEvents,
              pagination: {
                total: legacyEvents.length,
                page: 1,
                limit: legacyEvents.length,
                totalPages: 1,
              },
            });
            return;
          }
        } catch {
          // Ignore legacy lookup errors
        }
      }

      res.status(200).json({
        success: true,
        data: result.events,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/events/:eventId
   * Retrieve single event by ID with zero-trust ownership enforcement.
   */
  getEvent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const event = await this.service.getEventById(eventId, req.user.id);

      res.status(200).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/events
   * Create an event draft via wizard or legacy payload.
   */
  createEvent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      // Check if this is a Phase 4 Event Creation Wizard request
      if (req.body.eventType || req.body.attendanceMode || req.body.venue) {
        const validatedWizard = validateEventWizardInput(req.body);
        const event = await this.service.createEventWizard(req.user.id, validatedWizard);

        res.status(201).json({
          success: true,
          message: 'Event draft created successfully.',
          data: event,
        });
        return;
      }

      // Legacy fallback
      const validatedData = validateCreateEventInput(req.body);
      const event = await this.service.createEvent(req.user.id, validatedData);

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/events/:eventId
   * Update an existing draft event.
   */
  updateEvent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;

      if (
        mongoose.Types.ObjectId.isValid(eventId) ||
        req.body.eventType !== undefined ||
        req.body.venue !== undefined ||
        req.body.schedule !== undefined ||
        req.body.credentialTerminology !== undefined ||
        req.body.attendanceMode !== undefined ||
        req.body.status !== undefined
      ) {
        const validatedUpdates = validateEventDraftUpdate(req.body);
        const updated = await this.service.updateEventDraft(eventId, req.user.id, validatedUpdates);

        res.status(200).json({
          success: true,
          message: 'Event draft updated successfully.',
          data: updated,
        });
        return;
      }

      // Legacy fallback
      const validatedData = validateUpdateEventInput(req.body);
      const updated = await this.service.updateEvent(eventId, req.user.id, validatedData);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/events/:eventId
   * Delete an event draft.
   */
  deleteEvent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      await this.service.deleteEvent(eventId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Event deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/events/banner
   * Upload event banner image to Supabase Storage.
   */
  uploadBanner = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('Authentication required to upload assets.');
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded. Please attach an image (PNG, JPEG, WEBP).',
        });
        return;
      }

      const result = await this.service.uploadBanner(
        req.user.id,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      res.status(200).json({
        success: true,
        message: 'Event banner uploaded successfully.',
        data: {
          bannerUrl: result.bannerUrl,
          storagePath: result.storagePath,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // Legacy Ticket Types Handlers
  // ==========================================

  listTicketTypes = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const ticketTypes = await this.service.getTicketTypes(eventId, req.user.id);

      res.status(200).json({
        success: true,
        data: ticketTypes,
      });
    } catch (err) {
      next(err);
    }
  };

  createTicketType = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const validatedData = validateCreateTicketTypeInput(req.body);
      const newType = await this.service.addTicketType(eventId, req.user.id, validatedData);

      res.status(201).json({
        success: true,
        data: newType,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventController = new EventController();
export default eventController;
