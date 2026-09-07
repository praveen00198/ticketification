import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { eventService } from '../services/event.service';
import { AppError } from '../../../middlewares/error.middleware';

export class EventController {
  async listMyEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const events = await eventService.getEventsByOwner(req.user.id);
      res.json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }

  async getEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { eventId } = req.params;
      const event = await eventService.getEventById(eventId, req.user.id);

      res.json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { name, date, time, venue, description, organizerName, logoUrl, ticketTemplateUrl } = req.body;
      const event = await eventService.createEvent(req.user.id, {
        name,
        date,
        time,
        venue,
        description,
        organizerName,
        logoUrl,
        ticketTemplateUrl,
      });

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { eventId } = req.params;
      const updated = await eventService.updateEvent(eventId, req.user.id, req.body);

      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { eventId } = req.params;
      await eventService.deleteEvent(eventId, req.user.id);

      res.json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async listTicketTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { eventId } = req.params;
      const ticketTypes = await eventService.getTicketTypes(eventId, req.user.id);

      res.json({
        success: true,
        data: ticketTypes,
      });
    } catch (err) {
      next(err);
    }
  }

  async createTicketType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { eventId } = req.params;
      const { name, label, usagePolicy } = req.body;

      if (!name) {
        throw new AppError('Ticket type name is required', 400);
      }

      const newType = await eventService.addTicketType(eventId, req.user.id, {
        name,
        label: label || name,
        usagePolicy,
      });

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
