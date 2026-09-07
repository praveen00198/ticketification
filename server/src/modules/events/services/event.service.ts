import { eventRepository, EventRepository, CreateEventInput, UpdateEventInput } from '../repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository, CreateTicketTypeInput } from '../repositories/ticket-type.repository';
import { userRepository, UserRepository } from '../../auth/repositories/user.repository';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  AppError,
} from '../../../middlewares/error.middleware';
import { CreateEventDTO, UpdateEventDTO, CreateTicketTypeDTO, EventResponse } from '../event.types';

export const DEFAULT_TICKET_TYPES = [
  { name: 'GENERAL', label: 'General Guest', usagePolicy: 'SINGLE_USE' },
  { name: 'VIP', label: 'VIP Guest', usagePolicy: 'SINGLE_USE' },
  { name: 'WORKER', label: 'Event Staff / Worker', usagePolicy: 'REUSABLE' },
  { name: 'SPEAKER', label: 'Speaker / Guest of Honor', usagePolicy: 'SINGLE_USE' },
  { name: 'ORGANIZER', label: 'Event Organizer', usagePolicy: 'SINGLE_USE' },
];

export class EventService {
  constructor(
    private readonly eventRepo: EventRepository = eventRepository,
    private readonly ticketTypeRepo: TicketTypeRepository = ticketTypeRepository,
    private readonly userRepo: UserRepository = userRepository
  ) {}

  /**
   * List all events owned by the user, ordered newest first.
   */
  async getEventsByOwner(userId: string): Promise<EventResponse[]> {
    const events = await this.eventRepo.findByOwner(userId);
    return events as EventResponse[];
  }

  /**
   * Create a new event and automatically provision default ticket types.
   */
  async createEvent(userId: string, data: CreateEventDTO): Promise<EventResponse> {
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('Event name is required.');
    }
    if (!data.date) {
      throw new ValidationError('Event date is required.');
    }

    // Ensure creator profile exists in public.users to satisfy foreign key constraint
    try {
      const existingUser = await this.userRepo.findById(userId);
      if (!existingUser) {
        await this.userRepo.upsert({
          id: userId,
          name: data.organizerName?.trim() || 'Admin',
          email: `${userId}@ticketification.internal`,
          role: 'ADMIN',
        });
      }
    } catch (syncErr) {
      console.warn('[EventService] Pre-event user upsert fallback:', syncErr);
    }

    // 1. Create event record
    const event = await this.eventRepo.create({
      ...data,
      name: data.name.trim(),
      createdBy: userId,
    });

    // 2. Seed default ticket types for this event
    const defaultTypes: CreateTicketTypeInput[] = DEFAULT_TICKET_TYPES.map((t) => ({
      eventId: event.id,
      name: t.name,
      label: t.label,
      usagePolicy: t.usagePolicy,
    }));

    const ticketTypes = await this.ticketTypeRepo.createMany(defaultTypes);

    return {
      ...event,
      ticketTypes,
    } as EventResponse;
  }

  /**
   * Get event details with strict ownership verification.
   */
  async getEventById(eventId: string, userId: string): Promise<EventResponse> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (event.createdBy !== userId) {
      throw new AuthorizationError('Access denied: You do not own this event.');
    }

    const types = await this.ticketTypeRepo.findByEventId(eventId);

    return {
      ...event,
      ticketTypes: types,
    } as EventResponse;
  }

  /**
   * Update event details with strict ownership verification.
   */
  async updateEvent(eventId: string, userId: string, data: UpdateEventDTO): Promise<EventResponse> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (event.createdBy !== userId) {
      throw new AuthorizationError('Access denied: You do not own this event.');
    }

    const updated = await this.eventRepo.update(eventId, data);
    if (!updated) {
      throw new AppError('Failed to update event.', 500);
    }

    const types = await this.ticketTypeRepo.findByEventId(eventId);

    return {
      ...updated,
      ticketTypes: types,
    } as EventResponse;
  }

  /**
   * Delete an event with strict ownership verification.
   */
  async deleteEvent(eventId: string, userId: string): Promise<void> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (event.createdBy !== userId) {
      throw new AuthorizationError('Access denied: You do not own this event.');
    }

    await this.eventRepo.delete(eventId);
  }

  /**
   * Add a custom ticket type to an event with ownership check.
   */
  async addTicketType(
    eventId: string,
    userId: string,
    ticketTypeData: CreateTicketTypeDTO
  ) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (event.createdBy !== userId) {
      throw new AuthorizationError('Access denied: You do not own this event.');
    }

    const normalizedName = ticketTypeData.name.toUpperCase().trim();
    const existing = await this.ticketTypeRepo.findByEventAndName(eventId, normalizedName);
    if (existing) {
      throw new ConflictError(`Ticket type '${normalizedName}' already exists for this event.`);
    }

    return await this.ticketTypeRepo.create({
      eventId,
      name: normalizedName,
      label: ticketTypeData.label || normalizedName,
      usagePolicy: ticketTypeData.usagePolicy || 'SINGLE_USE',
    });
  }

  /**
   * List ticket types for an event with ownership check.
   */
  async getTicketTypes(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (event.createdBy !== userId) {
      throw new AuthorizationError('Access denied: You do not own this event.');
    }

    let types = await this.ticketTypeRepo.findByEventId(eventId);
    if (types.length === 0) {
      const defaultTypes = DEFAULT_TICKET_TYPES.map((t) => ({
        eventId,
        name: t.name,
        label: t.label,
        usagePolicy: t.usagePolicy,
      }));
      types = await this.ticketTypeRepo.createMany(defaultTypes);
    }

    return types;
  }
}

export const eventService = new EventService();
