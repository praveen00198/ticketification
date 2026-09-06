import { Response, NextFunction } from 'express';
import { ticketService } from '../services/ticket.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';

export class TicketController {
  async generateTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const result = await ticketService.generateTickets(req.body, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAllTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const tickets = await ticketService.getAllTickets(req.query, userId);
      res.json({ success: true, data: tickets });
    } catch (err) {
      next(err);
    }
  }

  async getTicketById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const ticket = await ticketService.getTicketById(req.params.id, userId);
      res.json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  async downloadAllZip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      await ticketService.streamAllTicketsZip(res, userId);
    } catch (err) {
      next(err);
    }
  }

  async downloadSingleTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { filePath, fileName } = await ticketService.getTicketImageFilePath(req.params.id, userId);
      res.download(filePath, fileName);
    } catch (err) {
      next(err);
    }
  }

  async resendTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const result = await ticketService.resendTicket(req.params.id, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const ticketController = new TicketController();

