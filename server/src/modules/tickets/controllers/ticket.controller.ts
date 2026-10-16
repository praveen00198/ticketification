import { Response, NextFunction } from 'express';
import { ticketService } from '../services/ticket.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { AuthenticationError } from '../../../middlewares/error.middleware';
import {
  validateEventIdParam,
  validateTicketIdParam,
  validateGenerateWorkerTicketsInput,
  validateTicketFilterQuery,
  validateTemplateId,
} from '../ticket.validation';

export class TicketController {
  async generateTickets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const eventId = validateEventIdParam(req.params.eventId || req.body?.eventId);
      const templateId = validateTemplateId(req.body?.templateId || req.query?.templateId);
      const result = await ticketService.generateTicketsForEvent(eventId, req.user.id, templateId);

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

      const eventId = validateEventIdParam(req.params.eventId || req.body?.eventId);
      const { count, ticketTypeName, templateId } = validateGenerateWorkerTicketsInput(req.body);

      const result = await ticketService.generateUnassignedWorkerTickets(
        eventId,
        req.user.id,
        count,
        ticketTypeName,
        templateId
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
      if (!req.user) throw new AuthenticationError();

      const ticketId = validateTicketIdParam(req.params.id);
      const ticket = await ticketService.getTicketByIdForOwner(ticketId, req.user.id);

      res.status(200).json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  async downloadTicket(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError();

      const ticketId = validateTicketIdParam(req.params.ticketId || req.params.id);
      const rawEventId = req.params.eventId || (req.query.eventId as string | undefined);
      const scopedEventId = rawEventId ? validateEventIdParam(rawEventId) : undefined;
      const wantsRedirect = req.query.redirect === 'true' || req.query.direct === 'true';
      const wantsUrl = req.query.format === 'url';

      const authContext = {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        scopedEventId,
      };

      if (wantsRedirect || wantsUrl) {
        const presigned = await ticketService.getPresignedTicketDownloadUrl(ticketId, authContext);
        if (presigned) {
          if (wantsUrl) {
            res.json({ success: true, downloadUrl: presigned.url, fileName: presigned.fileName });
            return;
          }
          res.redirect(302, presigned.url);
          return;
        }
      }

      const result = await ticketService.downloadTicket(ticketId, authContext);

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
