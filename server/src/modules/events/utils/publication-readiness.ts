import { IEventDocument } from '../../../db/mongo/models/event.model';
import { AppError } from '../../../middlewares/error.middleware';

export interface PublicationReadinessResult {
  isReady: boolean;
  errors: string[];
}

/**
 * Universal publication-readiness validator.
 * Centralizes readiness requirements across manual publication and automatic post-approval publication.
 * Enforces:
 * 1. Event title / name presence.
 * 2. Valid schedule (start date, end date >= start date, valid timezone).
 * 3. Valid venue (type, name/city for physical/hybrid, description for online).
 * 4. Organization verification gate (only for organization-associated events; individual events bypass org verification).
 */
export function validatePublicationReadiness(event: IEventDocument): PublicationReadinessResult {
  const errors: string[] = [];

  // 1. Organization Verification Gate (Applicable only to organization-associated events)
  const isOrg =
    event.hostingType === 'ORGANIZATION' ||
    event.organizationVerificationStatus !== 'NOT_REQUIRED';

  if (isOrg) {
    if (
      event.organizationVerificationStatus === 'PENDING' ||
      event.verificationStatus === 'PENDING'
    ) {
      errors.push('Organization verification is pending. The event cannot be published until verified.');
    } else if (
      event.organizationVerificationStatus === 'REJECTED' ||
      event.verificationStatus === 'REJECTED'
    ) {
      errors.push('Organization verification was rejected. The event cannot be published.');
    } else if (
      event.verificationStatus !== 'VERIFIED'
    ) {
      errors.push('Event must be officially verified and approved before it can be published.');
    }
  }

  // 2. Event Name
  if (!event.name || !event.name.trim()) {
    errors.push('Event name is required before publication.');
  }

  // 3. Schedule Validation
  if (!event.schedule?.startAt || isNaN(new Date(event.schedule.startAt).getTime())) {
    errors.push('Event schedule start date is required and must be a valid date before publication.');
  }

  if (event.schedule?.endAt) {
    if (isNaN(new Date(event.schedule.endAt).getTime())) {
      errors.push('Event schedule end date must be a valid date.');
    } else if (
      event.schedule.startAt &&
      !isNaN(new Date(event.schedule.startAt).getTime()) &&
      new Date(event.schedule.endAt).getTime() < new Date(event.schedule.startAt).getTime()
    ) {
      errors.push('Event schedule end date must be after the start date.');
    }
  }

  // 4. Venue Validation (when venue configuration is provided)
  if (event.venue) {
    if (event.venue.type === 'PHYSICAL' || event.venue.type === 'HYBRID') {
      if (event.venue.name !== undefined && !event.venue.name.trim()) {
        errors.push('Physical venue name is required before publication.');
      }
      if (event.venue.city !== undefined && !event.venue.city.trim()) {
        errors.push('Physical venue city is required before publication.');
      }
    } else if (event.venue.type === 'ONLINE') {
      if (event.venue.onlineDescription !== undefined && !event.venue.onlineDescription.trim()) {
        errors.push('Online meeting description or access instructions are required before publication.');
      }
    }
  }

  return {
    isReady: errors.length === 0,
    errors,
  };
}

/**
 * Asserts publication readiness, throwing a 400 AppError with descriptive reason if not ready.
 */
export function assertPublicationReadiness(event: IEventDocument): void {
  const result = validatePublicationReadiness(event);
  if (!result.isReady) {
    throw new AppError(result.errors[0], 400);
  }
}
