import { EventType } from '../api/events';

export interface EventCapabilities {
  // Attendee & Ticketing
  registrations: boolean;
  ticketing: boolean;
  checkIn: boolean;

  // Collaborative / Competition Features
  teams: boolean;
  submissions: boolean;

  // Personnel & Evaluation
  mentors: boolean;
  evaluators: boolean;
  judges: boolean;
  results: boolean;

  // Event Programming & Ops
  schedule: boolean;
  venues: boolean;
  communications: boolean;
  analytics: boolean;
  auditLog: boolean;
}

const DEFAULT_CAPABILITIES: EventCapabilities = {
  registrations: true,
  ticketing: true,
  checkIn: true,
  teams: false,
  submissions: false,
  mentors: false,
  evaluators: false,
  judges: false,
  results: false,
  schedule: true,
  venues: true,
  communications: true,
  analytics: true,
  auditLog: true,
};

export const EVENT_CAPABILITY_MATRIX: Record<EventType, EventCapabilities> = {
  HACKATHON: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: true,
    submissions: true,
    mentors: true,
    evaluators: true,
    judges: true,
    results: true,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  CONFERENCE: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  WORKSHOP: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: true,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  CONCERT: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  FESTIVAL: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  COLLEGE_EVENT: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: true,
    submissions: true,
    mentors: true,
    evaluators: true,
    judges: true,
    results: true,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  SPORTS_EVENT: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: true,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: true,
    results: true,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  EXHIBITION: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  AWARD_CEREMONY: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: true,
    mentors: false,
    evaluators: true,
    judges: true,
    results: true,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  CORPORATE_EVENT: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  CULTURAL_EVENT: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: true,
    results: true,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  WEDDING: {
    registrations: true,
    ticketing: true,
    checkIn: true,
    teams: false,
    submissions: false,
    mentors: false,
    evaluators: false,
    judges: false,
    results: false,
    schedule: true,
    venues: true,
    communications: true,
    analytics: true,
    auditLog: true,
  },
  OTHER: {
    ...DEFAULT_CAPABILITIES,
  },
};

/**
 * Returns the capability configuration for a specific event type.
 * Unknown or undefined types safely fall back to the safe baseline.
 */
export function getEventCapabilities(eventType?: string | null): EventCapabilities {
  if (!eventType || !(eventType in EVENT_CAPABILITY_MATRIX)) {
    return { ...DEFAULT_CAPABILITIES };
  }
  return { ...EVENT_CAPABILITY_MATRIX[eventType as EventType] };
}

/**
 * Validates if a specific event type supports a requested capability.
 */
export function hasCapability(
  eventType: string | null | undefined,
  capability: keyof EventCapabilities
): boolean {
  const caps = getEventCapabilities(eventType);
  return !!caps[capability];
}
