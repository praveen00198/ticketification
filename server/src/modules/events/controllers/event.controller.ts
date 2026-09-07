import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { eventService } from '../services/event.service';
import { AuthenticationError } from '../../../middlewares/error.middleware';
import {
  validateCreateEventInput,
  validateUpdateEventInput,
  validateCreateTicketTypeInput,
} from '../event.validation';

export class EventController {
  async listMyEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const events = await eventService.getEventsByOwner(req.user.id);
      res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }

  async getEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const event = await eventService.getEventById(eventId, req.user.id);

      res.status(200).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const validatedData = validateCreateEventInput(req.body);
      const event = await eventService.createEvent(req.user.id, validatedData);

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const validatedData = validateUpdateEventInput(req.body);
      const updated = await eventService.updateEvent(eventId, req.user.id, validatedData);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      await eventService.deleteEvent(eventId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async listTicketTypes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const ticketTypes = await eventService.getTicketTypes(eventId, req.user.id);

      res.status(200).json({
        success: true,
        data: ticketTypes,
      });
    } catch (err) {
      next(err);
    }
  }

  async createTicketType(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const eventId = req.params.eventId || req.params.id;
      const validatedData = validateCreateTicketTypeInput(req.body);
      const newType = await eventService.addTicketType(eventId, req.user.id, validatedData);

      res.status(201).json({
        success: true,
        data: newType,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const eventController = new EventController();
