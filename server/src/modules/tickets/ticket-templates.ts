/**
 * Ticket Template Registry — Single source of truth for available ticket templates.
 *
 * The server-side registry is AUTHORITATIVE. The frontend sends only a template ID;
 * the backend resolves it to a known filename here. Arbitrary filesystem paths from
 * the client are never accepted.
 */

export interface TicketTemplate {
  /** Stable identifier sent by the frontend (e.g. "standard", "event_staff") */
  id: string;
  /** Human-readable label for UI display */
  label: string;
  /** Exact filename located in server/assets/ */
  filename: string;
}

export const TICKET_TEMPLATES: readonly TicketTemplate[] = [
  { id: 'standard', label: 'Standard Ticket', filename: 'ticket_template.png' },
  { id: 'event_staff', label: 'Event Staff / Worker', filename: 'event-staff-template.png' },
  { id: 'event_worker', label: 'Event Worker', filename: 'event-worker-template.png' },
] as const;

export const DEFAULT_TEMPLATE_ID = 'standard';

/**
 * Returns the template config for a given ID, or undefined if the ID is not recognized.
 */
export function getTemplateById(id: string): TicketTemplate | undefined {
  return TICKET_TEMPLATES.find((t) => t.id === id);
}

/**
 * Checks whether a given string is a known, allowed template ID.
 */
export function isValidTemplateId(id: string): boolean {
  return TICKET_TEMPLATES.some((t) => t.id === id);
}
