import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  EventModel,
  IEventDocument,
  EventStatus,
  IEventStatusHistory,
} from '../../../db/mongo/models/event.model';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  mongoUserRepository,
  MongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';

export const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'SUSPENDED'],
  APPROVED: ['PUBLISHED', 'SUSPENDED'],
  REJECTED: ['DRAFT'],
  PUBLISHED: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'EVENT_LIVE', 'CANCELLED', 'SUSPENDED'],
  REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'EVENT_LIVE', 'CANCELLED', 'SUSPENDED'],
  REGISTRATION_CLOSED: ['REGISTRATION_OPEN', 'EVENT_LIVE', 'CANCELLED', 'SUSPENDED'],
  EVENT_LIVE: ['COMPLETED', 'SUSPENDED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [], // Terminal read-only state
  SUSPENDED: ['APPROVED', 'PUBLISHED', 'REGISTRATION_OPEN', 'DRAFT'], // Reinstatement targets
  CANCELLED: [], // Terminal cancelled state
};

export class EventLifecycleService {
  constructor(
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Authoritative status transition engine.
   * Validates caller permissions, legal state graph paths, business preconditions,
   * and appends an immutable status history entry.
   */
  async transitionStatus(
    eventId: string,
    callerSupabaseId: string,
    targetStatus: EventStatus,
    reason?: string
  ): Promise<{ event: IEventDocument; message: string }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // Zero-trust ownership authorization
    if (event.ownerSupabaseId !== callerSupabaseId) {
      throw new AppError('You do not have permission to manage this event.', 403);
    }

    const currentStatus = event.status;

    // Check if target status is allowed from current status
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new AppError(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'.`,
        400
      );
    }

    // Business precondition: Pre-Publish verification gate
    if (targetStatus === 'PUBLISHED') {
      if (event.verificationStatus !== 'VERIFIED') {
        throw new AppError(
          'Event must be officially verified and approved before it can be published.',
          400
        );
      }
    }

    // Business precondition: Schedule checks for registration
    if (targetStatus === 'REGISTRATION_OPEN') {
      const now = new Date();
      if (event.schedule?.endAt && new Date(event.schedule.endAt) < now) {
        throw new AppError(
          'Cannot open registration for an event whose end date has already passed.',
          400
        );
      }
    }

    // Resolve caller MongoDB ID for audit trail
    const callerMongoUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    const callerMongoId = callerMongoUser?._id
      ? new mongoose.Types.ObjectId(callerMongoUser._id)
      : event.ownerId;

    const historyEntry: IEventStatusHistory = {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      changedBy: callerMongoId,
      changedBySupabaseId: callerSupabaseId,
      reason: reason?.trim() || undefined,
      timestamp: new Date(),
    };

    const extraUpdates: Record<string, any> = {};
    if (targetStatus === 'CANCELLED') {
      extraUpdates.cancellationReason = reason?.trim() || 'Cancelled by host';
      extraUpdates.cancelledAt = new Date();
    }

    const updated = await this.eventRepo.transitionStatus(
      eventId,
      targetStatus,
      historyEntry,
      extraUpdates
    );

    return {
      event: updated!,
      message: `Event successfully transitioned to ${targetStatus}.`,
    };
  }

  /**
   * Publish an approved event.
   */
  async publishEvent(eventId: string, callerSupabaseId: string) {
    return this.transitionStatus(eventId, callerSupabaseId, 'PUBLISHED', 'Published by host');
  }

  /**
   * Open attendee registrations.
   */
  async openRegistration(eventId: string, callerSupabaseId: string) {
    return this.transitionStatus(eventId, callerSupabaseId, 'REGISTRATION_OPEN', 'Registrations opened');
  }

  /**
   * Close attendee registrations (e.g. capacity reached or deadline).
   */
  async closeRegistration(eventId: string, callerSupabaseId: string) {
    return this.transitionStatus(eventId, callerSupabaseId, 'REGISTRATION_CLOSED', 'Registrations closed');
  }

  /**
   * Mark event live (day of event, scanning begins).
   */
  async startLiveEvent(eventId: string, callerSupabaseId: string) {
    return this.transitionStatus(eventId, callerSupabaseId, 'EVENT_LIVE', 'Event marked live');
  }

  /**
   * Mark event completed after event concludes.
   */
  async completeEvent(eventId: string, callerSupabaseId: string) {
    return this.transitionStatus(eventId, callerSupabaseId, 'COMPLETED', 'Event concluded');
  }

  /**
   * Archive event records (read-only historical seal).
   */
  async archiveEvent(eventId: string, callerSupabaseId: string) {
    return this.transitionStatus(eventId, callerSupabaseId, 'ARCHIVED', 'Event records sealed');
  }

  /**
   * Cancel an event by host.
   */
  async cancelEvent(eventId: string, callerSupabaseId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new AppError('Cancellation reason is required.', 400);
    }
    return this.transitionStatus(eventId, callerSupabaseId, 'CANCELLED', reason.trim());
  }

  /**
   * Platform Administrator Emergency Circuit Breaker: Suspend event.
   */
  async suspendEvent(eventId: string, adminSupabaseId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new AppError('Suspension reason is required.', 400);
    }

    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.status === 'ARCHIVED' || event.status === 'CANCELLED') {
      throw new AppError(`Cannot suspend an event that is already ${event.status}.`, 400);
    }

    const currentStatus = event.status;
    const adminUser = await this.userRepo.findBySupabaseId(adminSupabaseId);
    const adminMongoId = adminUser?._id
      ? new mongoose.Types.ObjectId(adminUser._id)
      : new mongoose.Types.ObjectId();

    const historyEntry: IEventStatusHistory = {
      fromStatus: currentStatus,
      toStatus: 'SUSPENDED',
      changedBy: adminMongoId,
      changedBySupabaseId: adminSupabaseId,
      reason: reason.trim(),
      timestamp: new Date(),
    };

    const extraUpdates: Record<string, any> = {
      suspensionReason: reason.trim(),
      suspendedAt: new Date(),
      suspendedBy: adminMongoId,
    };

    const updated = await this.eventRepo.transitionStatus(
      eventId,
      'SUSPENDED',
      historyEntry,
      extraUpdates
    );

    return {
      event: updated!,
      message: 'Event has been suspended by platform administration.',
    };
  }

  /**
   * Platform Administrator Reinstatement of a suspended event.
   */
  async reinstateEvent(
    eventId: string,
    adminSupabaseId: string,
    targetStatus: EventStatus = 'APPROVED',
    reason?: string
  ) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.status !== 'SUSPENDED') {
      throw new AppError('Only suspended events can be reinstated.', 400);
    }

    const allowed = ALLOWED_TRANSITIONS.SUSPENDED;
    if (!allowed.includes(targetStatus)) {
      throw new AppError(`Cannot reinstate to status '${targetStatus}'.`, 400);
    }

    const adminUser = await this.userRepo.findBySupabaseId(adminSupabaseId);
    const adminMongoId = adminUser?._id
      ? new mongoose.Types.ObjectId(adminUser._id)
      : new mongoose.Types.ObjectId();

    const historyEntry: IEventStatusHistory = {
      fromStatus: 'SUSPENDED',
      toStatus: targetStatus,
      changedBy: adminMongoId,
      changedBySupabaseId: adminSupabaseId,
      reason: reason?.trim() || 'Reinstated by platform administrator',
      timestamp: new Date(),
    };

    const extraUpdates: Record<string, any> = {
      suspensionReason: null,
      suspendedAt: null,
      suspendedBy: null,
    };

    const updated = await this.eventRepo.transitionStatus(
      eventId,
      targetStatus,
      historyEntry,
      extraUpdates
    );

    return {
      event: updated!,
      message: `Event has been reinstated to ${targetStatus}.`,
    };
  }

  /**
   * Retrieve immutable status transition history.
   */
  async getStatusHistory(eventId: string, callerSupabaseId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.ownerSupabaseId !== callerSupabaseId) {
      throw new AppError('You do not have permission to view this event history.', 403);
    }

    return {
      statusHistory: event.statusHistory || [],
      currentStatus: event.status,
    };
  }

  /**
   * Central circuit breaker assertion.
   * Throws explicit errors if an event is suspended, cancelled, or archived.
   */
  assertEventOperational(event: IEventDocument): void {
    if (event.status === 'SUSPENDED') {
      throw new AppError(
        `This event is currently suspended by platform administration: ${event.suspensionReason || 'Policy review'}`,
        403,
        'EVENT_SUSPENDED'
      );
    }
    if (event.status === 'CANCELLED') {
      throw new AppError('This event has been cancelled by the host.', 400, 'EVENT_CANCELLED');
    }
    if (event.status === 'ARCHIVED') {
      throw new AppError('This event has been archived and is read-only.', 400, 'EVENT_ARCHIVED');
    }
  }
}

export const eventLifecycleService = new EventLifecycleService();
export default eventLifecycleService;
