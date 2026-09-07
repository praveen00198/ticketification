import { eventRepository, EventRepository, CreateEventInput, UpdateEventInput } from '../repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository, CreateTicketTypeInput } from '../repositories/ticket-type.repository';
import { userRepository, UserRepository } from '../../auth/repositories/user.repository';
import { AppError } from '../../../middlewares/error.middleware';

export const DEFAULT_TICKET_TYPES = [
  { name: 'GENERAL', label: 'General Guest', usagePolicy: 'SINGLE_USE' },
  { name: 'VIP', label: 'VIP Guest', usagePolicy: 'SINGLE_USE' },
  { name: 'WORKER', label: 'Event Staff / Worker', usagePolicy: 'REUSABLE_WORKER' },
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
   * List all events owned by the user.
   */
  async getEventsByOwner(userId: string) {
    return await this.eventRepo.findByOwner(userId);
  }

  /**
   * Create a new event and automatically provision default ticket types.
   */
  async createEvent(userId: string, data: Omit<CreateEventInput, 'createdBy'>) {
    if (!data.name || !data.name.trim()) {
      throw new AppError('Event name is required', 400);
    }
    if (!data.date) {
      throw new AppError('Event date is required', 400);
    }

    // Ensure the creator profile exists in public.users to satisfy foreign key constraint
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
    };
  }

  /**
   * Get event details with ownership verification.
   */
  async getEventById(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.createdBy !== userId) {
      throw new AppError('Access denied: You do not own this event', 403);
    }

    const types = await this.ticketTypeRepo.findByEventId(eventId);

    return {
      ...event,
      ticketTypes: types,
    };
  }

  /**
   * Update event details with ownership verification.
   */
  async updateEvent(eventId: string, userId: string, data: UpdateEventInput) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.createdBy !== userId) {
      throw new AppError('Access denied: You do not own this event', 403);
    }

    const updated = await this.eventRepo.update(eventId, data);
    return updated;
  }

  /**
   * Delete an event with ownership verification.
   */
  async deleteEvent(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.createdBy !== userId) {
      throw new AppError('Access denied: You do not own this event', 403);
    }

    return await this.eventRepo.delete(eventId);
  }

  /**
   * Add a custom ticket type to an event.
   */
  async addTicketType(
    eventId: string,
    userId: string,
    ticketTypeData: { name: string; label: string; usagePolicy?: string }
  ) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.createdBy !== userId) {
      throw new AppError('Access denied: You do not own this event', 403);
    }

    const normalizedName = ticketTypeData.name.toUpperCase().trim();
    const existing = await this.ticketTypeRepo.findByEventAndName(eventId, normalizedName);
    if (existing) {
      throw new AppError(`Ticket type '${normalizedName}' already exists for this event`, 409);
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
      throw new AppError('Event not found', 404);
    }

    if (event.createdBy !== userId) {
      throw new AppError('Access denied: You do not own this event', 403);
    }

    return await this.ticketTypeRepo.findByEventId(eventId);
  }
}

export const eventService = new EventService();
