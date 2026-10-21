import { ValidationError } from '../../middlewares/error.middleware';
import {
  CreateEventDTO,
  UpdateEventDTO,
  CreateTicketTypeDTO,
  CreateEventWizardDTO,
  UpdateEventDraftDTO,
  EventType,
  AttendanceMode,
  VenueType,
  HostingType,
  DEFAULT_CREDENTIAL_TERMINOLOGY,
} from './event.types';
import {
  EVENT_TYPES,
  ATTENDANCE_MODES,
  VENUE_TYPES,
  IEventVenue,
} from '../../db/mongo/models/event.model';

/**
 * Validates whether a timezone identifier is a valid IANA timezone.
 */
function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates wizard event creation payload for Phase 4.
 */
export function validateEventWizardInput(body: any): CreateEventWizardDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  // 1. Event Type
  const rawEventType = body.eventType as EventType;
  if (!rawEventType || !EVENT_TYPES.includes(rawEventType)) {
    throw new ValidationError(
      `Invalid or missing eventType: "${rawEventType}". Allowed types: ${EVENT_TYPES.join(', ')}`
    );
  }
  const eventType = rawEventType;

  // 2. Name
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    throw new ValidationError('Event name is required.');
  }
  if (name.length < 2 || name.length > 120) {
    throw new ValidationError('Event name must be between 2 and 120 characters.');
  }

  // 3. Description (Optional)
  let description: string | undefined;
  if (body.description !== undefined && body.description !== null) {
    const rawDesc = String(body.description).trim();
    if (rawDesc.length > 2000) {
      throw new ValidationError('Event description cannot exceed 2000 characters.');
    }
    description = rawDesc.length > 0 ? rawDesc : undefined;
  }

  // 4. Banner URL (Optional)
  let bannerUrl: string | undefined;
  if (body.bannerUrl !== undefined && body.bannerUrl !== null) {
    const rawUrl = String(body.bannerUrl).trim();
    if (rawUrl.length > 0) {
      if (rawUrl.length > 500) {
        throw new ValidationError('Banner URL cannot exceed 500 characters.');
      }
      try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new ValidationError('Banner URL must use http:// or https://.');
        }
        bannerUrl = parsed.toString();
      } catch (err: any) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError('Invalid banner URL format.');
      }
    }
  }

  // 5. Credential Terminology
  let credentialTerminology = DEFAULT_CREDENTIAL_TERMINOLOGY[eventType];
  if (body.credentialTerminology !== undefined && body.credentialTerminology !== null) {
    const rawTerm = String(body.credentialTerminology).trim();
    if (rawTerm.length > 0) {
      if (rawTerm.length < 2 || rawTerm.length > 50) {
        throw new ValidationError('Credential terminology must be between 2 and 50 characters.');
      }
      credentialTerminology = rawTerm;
    }
  }

  // 6. Attendance Mode
  const rawMode = body.attendanceMode as AttendanceMode;
  if (!rawMode || !ATTENDANCE_MODES.includes(rawMode)) {
    throw new ValidationError(
      `Invalid attendanceMode: "${rawMode}". Allowed: ${ATTENDANCE_MODES.join(', ')}`
    );
  }
  const attendanceMode = rawMode;

  // 7. Venue Configuration
  if (!body.venue || typeof body.venue !== 'object') {
    throw new ValidationError('Venue configuration object is required.');
  }

  const rawVenueType = body.venue.type as VenueType;
  if (!rawVenueType || !VENUE_TYPES.includes(rawVenueType)) {
    throw new ValidationError(
      `Invalid venue type: "${rawVenueType}". Allowed: ${VENUE_TYPES.join(', ')}`
    );
  }

  const venue: IEventVenue = { type: rawVenueType };

  if (rawVenueType === 'PHYSICAL' || rawVenueType === 'HYBRID') {
    const vName = typeof body.venue.name === 'string' ? body.venue.name.trim() : '';
    if (!vName || vName.length < 2) {
      throw new ValidationError('Physical venue name is required (minimum 2 characters).');
    }
    if (vName.length > 150) {
      throw new ValidationError('Venue name cannot exceed 150 characters.');
    }
    venue.name = vName;

    const city = typeof body.venue.city === 'string' ? body.venue.city.trim() : '';
    if (!city) {
      throw new ValidationError('Venue city is required for physical/hybrid events.');
    }
    venue.city = city;

    const country = typeof body.venue.country === 'string' ? body.venue.country.trim() : '';
    if (!country) {
      throw new ValidationError('Venue country is required for physical/hybrid events.');
    }
    venue.country = country;

    if (body.venue.address) venue.address = String(body.venue.address).trim().substring(0, 200);
    if (body.venue.region) venue.region = String(body.venue.region).trim().substring(0, 100);
    if (body.venue.postalCode) venue.postalCode = String(body.venue.postalCode).trim().substring(0, 20);
  }

  if (rawVenueType === 'ONLINE' || rawVenueType === 'HYBRID') {
    if (body.venue.onlineDescription) {
      const desc = String(body.venue.onlineDescription).trim();
      if (desc.length > 500) {
        throw new ValidationError('Online meeting description cannot exceed 500 characters.');
      }
      venue.onlineDescription = desc;
    }
  }

  // 8. Schedule Configuration
  if (!body.schedule || typeof body.schedule !== 'object') {
    throw new ValidationError('Schedule configuration object is required.');
  }

  const { startAt, endAt, timezone } = body.schedule;

  if (!startAt || isNaN(Date.parse(startAt))) {
    throw new ValidationError('Valid schedule.startAt timestamp is required.');
  }
  if (!endAt || isNaN(Date.parse(endAt))) {
    throw new ValidationError('Valid schedule.endAt timestamp is required.');
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (endDate.getTime() <= startDate.getTime()) {
    throw new ValidationError('Event schedule.endAt must be strictly later than schedule.startAt.');
  }

  const tz = typeof timezone === 'string' ? timezone.trim() : 'UTC';
  if (!isValidTimezone(tz)) {
    throw new ValidationError(`Invalid IANA timezone identifier: "${tz}".`);
  }

  const schedule = {
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    timezone: tz,
  };

  // 9. Registration / Attendance intent
  let registration: CreateEventWizardDTO['registration'];
  if (attendanceMode === 'TICKETIFICATION_REGISTRATION') {
    const rawPricing = body.registration?.pricingModel?.toUpperCase();
    const pricingModel: 'FREE' | 'PAID' = rawPricing === 'PAID' ? 'PAID' : 'FREE';
    const registrationRequired = body.registration?.registrationRequired !== false;

    let capacity: number | undefined;
    if (body.registration?.capacity !== undefined && body.registration?.capacity !== null) {
      const cap = Number(body.registration.capacity);
      if (isNaN(cap) || cap < 1) {
        throw new ValidationError('Registration capacity must be a positive integer.');
      }
      capacity = Math.floor(cap);
    }

    registration = {
      pricingModel,
      registrationRequired,
      ...(capacity !== undefined ? { capacity } : {}),
    };
  }

  // 10. Hosting Type & Organization
  let hostingType: HostingType = 'INDIVIDUAL';
  if (body.hostingType !== undefined && body.hostingType !== null) {
    const rawHostType = String(body.hostingType).trim().toUpperCase();
    if (!['INDIVIDUAL', 'ORGANIZATION'].includes(rawHostType)) {
      throw new ValidationError(`Invalid hostingType: "${body.hostingType}". Allowed: INDIVIDUAL, ORGANIZATION.`);
    }
    hostingType = rawHostType as HostingType;
  }

  let organization: CreateEventWizardDTO['organization'];
  if (hostingType === 'ORGANIZATION') {
    if (!body.organization || typeof body.organization !== 'object') {
      throw new ValidationError('Organization details are required for organization-hosted events.');
    }
    const orgName = typeof body.organization.name === 'string' ? body.organization.name.trim() : '';
    if (!orgName || orgName.length < 2 || orgName.length > 150) {
      throw new ValidationError('Organization name is required and must be between 2 and 150 characters.');
    }

    let officialEmail = body.organization.officialEmail ? String(body.organization.officialEmail).trim().toLowerCase() : undefined;
    if (officialEmail && !/^\S+@\S+\.\S+$/.test(officialEmail)) {
      throw new ValidationError('Invalid official institutional email format.');
    }

    organization = {
      name: orgName,
      institutionType: body.organization.institutionType ? String(body.organization.institutionType).trim() : undefined,
      institutionName: body.organization.institutionName ? String(body.organization.institutionName).trim() : undefined,
      officialEmail,
      department: body.organization.department ? String(body.organization.department).trim() : undefined,
      designation: body.organization.designation ? String(body.organization.designation).trim() : undefined,
      websiteUrl: body.organization.websiteUrl ? String(body.organization.websiteUrl).trim() : undefined,
      documentUrls: Array.isArray(body.organization.documentUrls) ? body.organization.documentUrls : [],
    };
  }

  return {
    eventType,
    name,
    description,
    bannerUrl,
    credentialTerminology,
    attendanceMode,
    venue,
    schedule,
    registration,
    hostingType,
    organization,
  };
}

/**
 * Validates updates to an existing draft event.
 */
export function validateEventDraftUpdate(body: any): UpdateEventDraftDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  // Guard against attempts to mutate protected fields
  if (body.status !== undefined && body.status !== 'DRAFT') {
    throw new ValidationError('Event status cannot be changed via draft update.');
  }
  if (body.ownerId !== undefined || body.ownerSupabaseId !== undefined || body.id !== undefined || body._id !== undefined) {
    throw new ValidationError('Owner and ID fields cannot be modified.');
  }

  const updates: UpdateEventDraftDTO = {};

  if (body.eventType !== undefined) {
    if (!EVENT_TYPES.includes(body.eventType)) {
      throw new ValidationError(`Invalid eventType: "${body.eventType}".`);
    }
    updates.eventType = body.eventType;
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length < 2 || name.length > 120) {
      throw new ValidationError('Event name must be between 2 and 120 characters.');
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    const desc = body.description ? String(body.description).trim() : '';
    if (desc.length > 2000) {
      throw new ValidationError('Event description cannot exceed 2000 characters.');
    }
    updates.description = desc.length > 0 ? desc : undefined;
  }

  if (body.bannerUrl !== undefined) {
    if (body.bannerUrl) {
      const rawUrl = String(body.bannerUrl).trim();
      try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new ValidationError('Banner URL must use http:// or https://.');
        }
        updates.bannerUrl = parsed.toString();
      } catch (err: any) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError('Invalid banner URL format.');
      }
    } else {
      updates.bannerUrl = undefined;
    }
  }

  if (body.credentialTerminology !== undefined) {
    const term = String(body.credentialTerminology).trim();
    if (term.length < 2 || term.length > 50) {
      throw new ValidationError('Credential terminology must be between 2 and 50 characters.');
    }
    updates.credentialTerminology = term;
  }

  if (body.attendanceMode !== undefined) {
    if (!ATTENDANCE_MODES.includes(body.attendanceMode)) {
      throw new ValidationError(`Invalid attendanceMode: "${body.attendanceMode}".`);
    }
    updates.attendanceMode = body.attendanceMode;
  }

  if (body.venue !== undefined) {
    if (typeof body.venue !== 'object' || !body.venue) {
      throw new ValidationError('Venue update must be an object.');
    }
    const venueType = body.venue.type as VenueType;
    if (venueType && !VENUE_TYPES.includes(venueType)) {
      throw new ValidationError(`Invalid venue type: "${venueType}".`);
    }
    updates.venue = body.venue;
  }

  if (body.schedule !== undefined) {
    if (typeof body.schedule !== 'object' || !body.schedule) {
      throw new ValidationError('Schedule update must be an object.');
    }
    const { startAt, endAt, timezone } = body.schedule;
    if (startAt && isNaN(Date.parse(startAt))) {
      throw new ValidationError('Invalid schedule.startAt timestamp.');
    }
    if (endAt && isNaN(Date.parse(endAt))) {
      throw new ValidationError('Invalid schedule.endAt timestamp.');
    }
    if (startAt && endAt) {
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        throw new ValidationError('Event schedule.endAt must be strictly later than schedule.startAt.');
      }
    }
    if (timezone && !isValidTimezone(timezone)) {
      throw new ValidationError(`Invalid IANA timezone identifier: "${timezone}".`);
    }
    updates.schedule = body.schedule;
  }

  if (body.registration !== undefined) {
    if (typeof body.registration !== 'object' || !body.registration) {
      throw new ValidationError('Registration update must be an object.');
    }
    updates.registration = body.registration;
  }

  return updates;
}

// ==========================================
// Legacy Validation Functions for Backward Compatibility
// ==========================================

export function validateCreateEventInput(body: any): CreateEventDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const date = typeof body.date === 'string' ? body.date.trim() : '';

  if (!name) {
    throw new ValidationError('Event name is required.');
  }
  if (name.length < 2 || name.length > 200) {
    throw new ValidationError('Event name must be between 2 and 200 characters.');
  }

  if (!date) {
    throw new ValidationError('Event date is required.');
  }
  if (isNaN(Date.parse(date))) {
    throw new ValidationError('Event date must be a valid date format (YYYY-MM-DD).');
  }

  return {
    name,
    date,
    time: typeof body.time === 'string' ? body.time.trim() : null,
    venue: typeof body.venue === 'string' ? body.venue.trim() : null,
    description: typeof body.description === 'string' ? body.description.trim() : null,
    organizerName: typeof body.organizerName === 'string' ? body.organizerName.trim() : null,
    logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl.trim() : null,
    ticketTemplateUrl: typeof body.ticketTemplateUrl === 'string' ? body.ticketTemplateUrl.trim() : null,
    status: typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'UPCOMING',
    eventType: body.eventType,
    credentialTerminology: body.credentialTerminology,
    attendanceMode: body.attendanceMode,
  };
}

export function validateUpdateEventInput(body: any): UpdateEventDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const result: UpdateEventDTO = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Event name cannot be empty.');
    result.name = name;
  }

  if (body.date !== undefined) {
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    if (!date || isNaN(Date.parse(date))) {
      throw new ValidationError('Event date must be a valid date format.');
    }
    result.date = date;
  }

  if (body.time !== undefined) {
    result.time = typeof body.time === 'string' ? body.time.trim() : null;
  }

  if (body.venue !== undefined) {
    result.venue = typeof body.venue === 'string' ? body.venue.trim() : null;
  }

  if (body.description !== undefined) {
    result.description = typeof body.description === 'string' ? body.description.trim() : null;
  }

  if (body.organizerName !== undefined) {
    result.organizerName = typeof body.organizerName === 'string' ? body.organizerName.trim() : null;
  }

  if (body.logoUrl !== undefined) {
    result.logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : null;
  }

  if (body.ticketTemplateUrl !== undefined) {
    result.ticketTemplateUrl = typeof body.ticketTemplateUrl === 'string' ? body.ticketTemplateUrl.trim() : null;
  }

  if (body.status !== undefined) {
    result.status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : undefined;
  }

  return result;
}

export function validateCreateTicketTypeInput(body: any): CreateTicketTypeDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const name = typeof body.name === 'string' ? body.name.trim().toUpperCase() : '';
  if (!name) {
    throw new ValidationError('Ticket type name is required.');
  }

  let usagePolicy: 'SINGLE_USE' | 'REUSABLE' = 'SINGLE_USE';
  if (body.usagePolicy) {
    const policy = String(body.usagePolicy).trim().toUpperCase();
    if (!['SINGLE_USE', 'REUSABLE'].includes(policy)) {
      throw new ValidationError('usagePolicy must be either SINGLE_USE or REUSABLE.');
    }
    usagePolicy = policy as 'SINGLE_USE' | 'REUSABLE';
  }

  return {
    name,
    label: typeof body.label === 'string' ? body.label.trim() : name,
    usagePolicy,
  };
}
