import { ValidationError } from '../../middlewares/error.middleware';
import { CreateEventDTO, UpdateEventDTO, CreateTicketTypeDTO } from './event.types';

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
  // Validate YYYY-MM-DD or standard date string
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
    result.status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'UPCOMING';
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

  const policy = typeof body.usagePolicy === 'string' ? body.usagePolicy.trim().toUpperCase() : 'SINGLE_USE';
  if (policy !== 'SINGLE_USE' && policy !== 'REUSABLE') {
    throw new ValidationError('Usage policy must be either SINGLE_USE or REUSABLE.');
  }

  return {
    name,
    label: typeof body.label === 'string' ? body.label.trim() : name,
    usagePolicy: policy as 'SINGLE_USE' | 'REUSABLE',
  };
}
