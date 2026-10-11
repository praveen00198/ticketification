import { Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { eventRepository } from '../../events/repositories/event.repository';
import { AuthenticationError, NotFoundError } from '../../../middlewares/error.middleware';

export class DashboardController {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const requestedEventId = (req.query.eventId || req.params.eventId) as string | undefined;
      let targetEventId = requestedEventId;

      if (targetEventId) {
        const ownedEvent = await eventRepository.findByIdAndOwner(targetEventId, req.user.id);
        if (!ownedEvent) {
          throw new NotFoundError('Event not found or unauthorized');
        }
      } else {
        const userEvents = await eventRepository.findByOwner(req.user.id);
        if (userEvents.length > 0) {
          targetEventId = userEvents[0].id;
        }
      }

      const data = await dashboardService.getDashboardStats(targetEventId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
