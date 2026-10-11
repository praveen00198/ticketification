import {
  EventType,
  AttendanceMode,
  VenueType,
  EventStatus,
  IEventVenue,
  IEventSchedule,
  IEventRegistration,
} from '../../db/mongo/models/event.model';

export { EventType, AttendanceMode, VenueType, EventStatus };

export const DEFAULT_CREDENTIAL_TERMINOLOGY: Record<EventType, string> = {
  CONCERT: 'Ticket',
  CONFERENCE: 'Attendee Pass',
  HACKATHON: 'Participant Pass',
  WORKSHOP: 'Participant Pass',
  FESTIVAL: 'Entry Pass',
  COLLEGE_EVENT: 'Event Pass',
  SPORTS_EVENT: 'Entry Pass',
  EXHIBITION: 'Visitor Pass',
  AWARD_CEREMONY: 'Guest Pass',
  CORPORATE_EVENT: 'Access Pass',
  CULTURAL_EVENT: 'Entry Pass',
  WEDDING: 'Invitation / Entry Pass',
  OTHER: 'Entry Pass',
};

export interface CreateEventWizardDTO {
  eventType: EventType;
  name: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology?: string;
  attendanceMode: AttendanceMode;
  venue: IEventVenue;
  schedule: {
    startAt: string; // ISO string
    endAt: string;   // ISO string
    timezone: string;
  };
  registration?: {
    pricingModel?: 'FREE' | 'PAID';
    registrationRequired?: boolean;
    capacity?: number;
  };
}

export interface UpdateEventDraftDTO {
  eventType?: EventType;
  name?: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology?: string;
  attendanceMode?: AttendanceMode;
  venue?: Partial<IEventVenue>;
  schedule?: {
    startAt?: string;
    endAt?: string;
    timezone?: string;
  };
  registration?: {
    pricingModel?: 'FREE' | 'PAID';
    registrationRequired?: boolean;
    capacity?: number;
  };
}

export interface CanonicalEventResponse {
  id: string;
  ownerId: string;
  ownerSupabaseId: string;
  eventType: EventType;
  name: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology: string;
  attendanceMode: AttendanceMode;
  venue: IEventVenue;
  schedule: {
    startAt: string;
    endAt: string;
    timezone: string;
  };
  registration?: {
    pricingModel: 'FREE' | 'PAID';
    registrationRequired: boolean;
    capacity?: number;
  };
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

// Legacy DTOs preserved for backward compatibility
export interface CreateEventDTO {
  name: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  venue?: string | null;
  description?: string | null;
  organizerName?: string | null;
  logoUrl?: string | null;
  ticketTemplateUrl?: string | null;
  status?: string;
  // Wizard extension fields
  eventType?: EventType;
  credentialTerminology?: string;
  attendanceMode?: AttendanceMode;
}

export interface UpdateEventDTO {
  name?: string;
  date?: string;
  time?: string | null;
  venue?: string | null;
  description?: string | null;
  organizerName?: string | null;
  logoUrl?: string | null;
  ticketTemplateUrl?: string | null;
  status?: string;
  eventType?: EventType;
  credentialTerminology?: string;
  attendanceMode?: AttendanceMode;
}

export interface CreateTicketTypeDTO {
  name: string;
  label?: string;
  usagePolicy?: 'SINGLE_USE' | 'REUSABLE';
}

export interface EventResponse {
  id: string;
  name: string;
  date: string;
  time: string | null;
  venue: string | null;
  description: string | null;
  organizerName: string | null;
  logoUrl: string | null;
  ticketTemplateUrl: string | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  ticketTypes?: TicketTypeResponse[];
  // Enhanced fields
  eventType?: string;
  credentialTerminology?: string;
  attendanceMode?: string;
}

export interface TicketTypeResponse {
  id: string;
  eventId: string;
  name: string;
  label: string;
  usagePolicy: string;
  createdAt: Date;
}
