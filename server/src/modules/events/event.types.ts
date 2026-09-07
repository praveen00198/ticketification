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
}

export interface TicketTypeResponse {
  id: string;
  eventId: string;
  name: string;
  label: string;
  usagePolicy: string;
  createdAt: Date;
}
