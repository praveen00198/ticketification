/**
 * Ticket Template Options — UI-only display labels and IDs.
 *
 * This file contains ONLY template identifiers and user-facing labels.
 * The server-side registry is the authoritative source for allowed IDs
 * and the actual template filenames. The frontend never sends file paths.
 */

export interface TicketTemplateOption {
  /** Stable identifier matching the server-side registry */
  id: string;
  /** Human-readable label for display in the UI */
  label: string;
}

export const TICKET_TEMPLATES: readonly TicketTemplateOption[] = [
  { id: 'standard', label: 'Standard Ticket' },
  { id: 'event_staff', label: 'Event Staff / Worker' },
  { id: 'event_worker', label: 'Event Worker' },
] as const;

export const DEFAULT_TEMPLATE_ID = 'standard';
