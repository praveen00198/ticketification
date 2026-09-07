import { ValidationError } from '../../middlewares/error.middleware';
import { GenerateWorkerTicketsDTO, TicketFilterQuery } from './ticket.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateEventIdParam(eventId: unknown): string {
  if (typeof eventId !== 'string' || !eventId.trim()) {
    throw new ValidationError('Event ID is required', [
      { field: 'eventId', message: 'Event ID must be a non-empty string' },
    ]);
  }
  const cleanId = eventId.trim();
  if (!UUID_REGEX.test(cleanId)) {
    throw new ValidationError('Invalid Event ID format', [
      { field: 'eventId', message: 'Event ID must be a valid UUID' },
    ]);
  }
  return cleanId;
}

export function validateTicketIdParam(ticketId: unknown): string {
  if (typeof ticketId !== 'string' || !ticketId.trim()) {
    throw new ValidationError('Ticket ID is required', [
      { field: 'id', message: 'Ticket ID must be a non-empty string' },
    ]);
  }
  return ticketId.trim();
}

export function validateGenerateWorkerTicketsInput(input: unknown): GenerateWorkerTicketsDTO {
  const payload = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const errors: Array<{ field: string; message: string }> = [];

  let count = 10;
  if (payload.count !== undefined) {
    const parsed = parseInt(payload.count, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 500) {
      errors.push({ field: 'count', message: 'Count must be an integer between 1 and 500' });
    } else {
      count = parsed;
    }
  }

  let ticketTypeName = 'WORKER';
  if (payload.ticketTypeName !== undefined) {
    if (typeof payload.ticketTypeName !== 'string' || !payload.ticketTypeName.trim()) {
      errors.push({ field: 'ticketTypeName', message: 'Ticket type name must be a non-empty string' });
    } else if (payload.ticketTypeName.trim().length > 50) {
      errors.push({ field: 'ticketTypeName', message: 'Ticket type name cannot exceed 50 characters' });
    } else {
      ticketTypeName = payload.ticketTypeName.trim().toUpperCase();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid worker ticket generation payload', errors);
  }

  return { count, ticketTypeName };
}

export function validateTicketFilterQuery(query: unknown): TicketFilterQuery {
  const q = (query && typeof query === 'object' ? query : {}) as Record<string, any>;

  let limit = 500;
  if (q.limit !== undefined) {
    const parsed = parseInt(q.limit, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 5000) {
      limit = parsed;
    }
  }

  let offset = 0;
  if (q.offset !== undefined) {
    const parsed = parseInt(q.offset, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  let status: string | undefined;
  if (typeof q.status === 'string' && q.status.trim()) {
    status = q.status.trim().toUpperCase();
  }

  let ticketTypeId: string | undefined;
  if (typeof q.ticketTypeId === 'string' && UUID_REGEX.test(q.ticketTypeId.trim())) {
    ticketTypeId = q.ticketTypeId.trim();
  }

  let search: string | undefined;
  if (typeof q.search === 'string' && q.search.trim()) {
    search = q.search.trim().slice(0, 200);
  }

  return {
    status,
    ticketTypeId,
    search,
    limit,
    offset,
  };
}
