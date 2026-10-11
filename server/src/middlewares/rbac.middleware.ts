import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from './error.middleware';
import { EventPermission } from '../db/mongo/models/event-member.model';
import { mongoEventRepository } from '../modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../modules/events/repositories/mongo-event-member.repository';
import { mongoUserRepository } from '../modules/auth/repositories/mongo-user.repository';

/**
 * Middleware factory to enforce granular event-scoped permissions.
 * Checks event ownership, active event_members permissions, or platform admin status.
 */
export const requireEventPermission = (requiredPermission: EventPermission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.eventId || req.params.id || req.body.eventId;
      if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
        throw new AppError('Valid eventId is required.', 400);
      }

      const callerUser = (req as any).user;
      if (!callerUser || !callerUser.id) {
        throw new AppError('Authentication required.', 401);
      }

      // Platform administrators bypass event-level permission checks
      if (callerUser.role === 'ADMIN' || callerUser.role === 'SUPER_ADMIN') {
        return next();
      }

      // Look up target event
      const event = await mongoEventRepository.findById(eventId);
      if (!event) {
        throw new AppError('Event not found.', 404);
      }

      // Event owner automatically possesses all event permissions
      if (event.ownerSupabaseId === callerUser.id) {
        return next();
      }

      // Resolve caller's MongoDB User record
      const callerMongoUser = await mongoUserRepository.findBySupabaseId(callerUser.id);
      if (!callerMongoUser) {
        throw new AppError('User profile not found.', 403);
      }

      // If ownerId matches MongoDB ObjectId
      if (event.ownerId && event.ownerId.toString() === callerMongoUser._id.toString()) {
        return next();
      }

      // Query active membership in event_members
      const membership = await mongoEventMemberRepository.findByEventAndUser(
        eventId,
        callerMongoUser._id
      );

      if (!membership || membership.status !== 'ACTIVE') {
        throw new AppError('You do not have access to this event.', 403);
      }

      // Check granular permission
      if (!membership.permissions.includes(requiredPermission)) {
        throw new AppError(
          `Insufficient permissions: '${requiredPermission}' is required for this action.`,
          403,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      // Attach active membership to request for downstream handlers
      (req as any).eventMembership = membership;

      next();
    } catch (err) {
      next(err);
    }
  };
};
