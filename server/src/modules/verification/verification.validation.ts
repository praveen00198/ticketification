import { ValidationError } from '../../middlewares/error.middleware';

/**
 * Validates and sanitizes verification token parameter or body field.
 */
export function validateVerificationToken(token: unknown): string {
  if (!token || typeof token !== 'string') {
    throw new ValidationError('Verification token is required and must be a non-empty string.');
  }
  const clean = token.trim();
  if (clean.length === 0) {
    throw new ValidationError('Verification token cannot be empty.');
  }
  if (clean.length > 256) {
    throw new ValidationError('Verification token exceeds maximum length.');
  }
  return clean;
}

/**
 * Validates optional eventId parameter.
 */
export function validateOptionalEventId(eventId: unknown): string | undefined {
  if (eventId === undefined || eventId === null || eventId === '') {
    return undefined;
  }
  if (typeof eventId !== 'string') {
    throw new ValidationError('Event ID must be a string.');
  }
  const clean = eventId.trim();
  return clean.length > 0 ? clean : undefined;
}

/**
 * Validates optional worker name for unassigned worker first check-in.
 */
export function validateOptionalWorkerName(workerName: unknown): string | undefined {
  if (workerName === undefined || workerName === null || workerName === '') {
    return undefined;
  }
  if (typeof workerName !== 'string') {
    throw new ValidationError('Worker name must be a string.');
  }
  const clean = workerName.trim();
  return clean.length > 0 ? clean : undefined;
}
