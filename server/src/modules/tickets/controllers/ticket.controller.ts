import { Response, NextFunction } from 'express';
import { ticketService } from '../services/ticket.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';

export class TicketController {
  async generateTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const eventId = (req.params.eventId || req.body.eventId) as string;
      if (!eventId) {
        throw new AppError('Event ID is required for ticket generation', 400);
      }

      const result = await ticketService.generateTicketsForEvent(eventId, req.user.id);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async generateWorkerTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const eventId = (req.params.eventId || req.body.eventId) as string;
      const count = parseInt(req.body.count, 10) || 10;
      const ticketTypeName = req.body.ticketTypeName || 'WORKER';

      if (!eventId) {
        throw new AppError('Event ID is required', 400);
      }

      const result = await ticketService.generateUnassignedWorkerTickets(
        eventId,
        req.user.id,
        count,
        ticketTypeName
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAllTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const eventId = (req.params.eventId || req.query.eventId) as string;
      if (!eventId) {
        return res.json({ success: true, data: { tickets: [], total: 0 } });
      }

      const status = req.query.status as string;
      const ticketTypeId = req.query.ticketTypeId as string;
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string, 10) || 1000;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await ticketService.getTicketsByEvent(eventId, req.user.id, {
        status,
        ticketTypeId,
        search,
        limit,
        offset,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getTicketById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await ticketService.getTicketById(req.params.id);
      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }
      res.json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  async exportTicketsZip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const eventId = (req.params.eventId || req.query.eventId) as string;
      if (!eventId) {
        throw new AppError('Event ID is required', 400);
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="tickets-export.zip"`);

      await ticketService.streamTicketsZip(eventId, req.user.id, res);
    } catch (err) {
      next(err);
    }
  }
}

export const ticketController = new TicketController();
