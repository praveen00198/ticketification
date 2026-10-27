import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { eventRepository } from '../../events/repositories/event.repository';
import { mongoEventRepository } from '../../events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../../events/repositories/mongo-event-member.repository';
import { isMongoConnected } from '../../../db/mongodb';
import { AuthenticationError, NotFoundError, AuthorizationError } from '../../../middlewares/error.middleware';

export class DashboardController {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      const requestedEventId = (req.query.eventId || req.params.eventId) as string | undefined;
      let targetEventId = requestedEventId;

      if (targetEventId) {
        let isAuthorized = false;
        let eventFound = false;

        // 1. Check MongoDB (Authoritative Store)
        if (isMongoConnected() && mongoose.isValidObjectId(targetEventId)) {
          const mongoEvent = await mongoEventRepository.findById(targetEventId);
          if (mongoEvent) {
            eventFound = true;
            const callerUserId = req.user.id;
            const isOwner =
              mongoEvent.ownerSupabaseId === callerUserId ||
              mongoEvent.ownerId?.toString() === callerUserId ||
              mongoEvent.createdBy?.toString() === callerUserId;

            const isPlatformAdmin =
              req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

            if (isOwner || isPlatformAdmin) {
              isAuthorized = true;
            } else {
              // Check event-level staff membership
              const member = await mongoEventMemberRepository.findByEventAndUser(
                targetEventId,
                callerUserId
              );
              if (
                member &&
                member.status === 'ACTIVE' &&
                (member.role === 'HOST' ||
                  member.role === 'COORDINATOR' ||
                  member.permissions.includes('VIEW_DASHBOARD') ||
                  member.permissions.includes('MANAGE_ATTENDEES'))
              ) {
                isAuthorized = true;
              }
            }
          }
        }

        // 2. Check PostgreSQL (Fallback Store)
        if (!eventFound) {
          try {
            const pgEvent = await eventRepository.findByIdAndOwner(targetEventId, req.user.id);
            if (pgEvent) {
              eventFound = true;
              isAuthorized = true;
            }
          } catch (_pgErr) {
            // Ignore if postgres is unconfigured or fails
          }
        }

        if (!eventFound) {
          throw new NotFoundError('Event not found or unauthorized');
        }

        if (!isAuthorized) {
          throw new AuthorizationError('You are not authorized to view dashboard stats for this event.');
        }
      } else {
        // If no eventId specified, resolve the caller's most recent event
        if (isMongoConnected()) {
          const userEvents = await mongoEventRepository.findByOwner(req.user.id, { limit: 1 });
          if (userEvents && userEvents.events && userEvents.events.length > 0) {
            targetEventId = userEvents.events[0]._id.toString();
          }
        }

        if (!targetEventId) {
          try {
            const userEvents = await eventRepository.findByOwner(req.user.id);
            if (userEvents && userEvents.length > 0) {
              targetEventId = userEvents[0].id;
            }
          } catch (_pgErr) {
            // Ignore if postgres is unconfigured or fails
          }
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
