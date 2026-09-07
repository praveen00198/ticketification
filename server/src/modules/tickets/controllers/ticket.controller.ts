import { Response, NextFunction } from 'express';
import { ticketService } from '../services/ticket.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { AuthenticationError } from '../../../middlewares/error.middleware';
import {
  validateEventIdParam,
  validateTicketIdParam,
  validateGenerateWorkerTicketsInput,
  validateTicketFilterQuery,
} from '../ticket.validation';

export class TicketController {
  async generateTickets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId || req.body.eventId);
      const result = await ticketService.generateTicketsForEvent(eventId, req.user.id);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async generateWorkerTickets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId || req.body.eventId);
      const { count, ticketTypeName } = validateGenerateWorkerTicketsInput(req.body);

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

  async getAllTickets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const rawEventId = req.params.eventId || req.query.eventId;
      if (!rawEventId) {
        res.status(200).json({ success: true, data: { tickets: [], total: 0 } });
        return;
      }

      const eventId = validateEventIdParam(rawEventId);
      const filterOptions = validateTicketFilterQuery(req.query);

      const result = await ticketService.getTicketsByEvent(eventId, req.user.id, filterOptions);

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getTicketById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticketId = validateTicketIdParam(req.params.id);
      const ticket = await ticketService.getTicketById(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ticket not found' },
        });
        return;
      }

      res.status(200).json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  async downloadTicket(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const ticketId = validateTicketIdParam(req.params.ticketId || req.params.id);
      const result = await ticketService.downloadTicket(ticketId, req.user.id);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  }

  async exportTicketsZip(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId || req.query.eventId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="tickets-export.zip"`);

      await ticketService.streamTicketsZip(eventId, req.user.id, res);
    } catch (err) {
      next(err);
    }
  }
}

export const ticketController = new TicketController();
