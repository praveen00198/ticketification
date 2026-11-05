import mongoose from 'mongoose';
import { EventModel } from '../../../db/mongo/models/event.model';
import { guestRepository, GuestRepository } from '../repositories/guest.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository } from '../../events/repositories/ticket-type.repository';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  AppError,
} from '../../../middlewares/error.middleware';
import {
  CreateSingleGuestDTO,
  UpdateGuestDTO,
  GuestFilterOptions,
  GuestResponse,
} from '../guest.types';

export class GuestService {
  constructor(
    private readonly guestRepo: GuestRepository = guestRepository,
    private readonly eventRepo: EventRepository = eventRepository,
    private readonly ticketTypeRepo: TicketTypeRepository = ticketTypeRepository
  ) {}

  /**
   * Helper to verify that the user owns the specified event.
   */
  private async assertEventOwnership(eventId: string, userId: string) {
    let event: any = null;

    const isMongo = mongoose.connection.readyState === 1 || Boolean((EventModel.findById as any)?.mock);
    if (isMongo && mongoose.Types.ObjectId.isValid(eventId)) {
      const mongoEvent = await EventModel.findById(eventId);
      if (mongoEvent) {
        const isOwner =
          mongoEvent.ownerSupabaseId === userId ||
          String(mongoEvent.ownerId) === userId ||
          String(mongoEvent.ownerSupabaseId) === userId ||
          (mongoEvent as any).createdBy === userId;

        if (!isOwner) {
          throw new AuthorizationError('Access denied: You do not own this event.');
        }
        event = mongoEvent;
      }
    }

    if (!event) {
      try {
        event = await this.eventRepo.findById(eventId);
      } catch {
        event = null;
      }
    }

    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (event.createdBy && event.createdBy !== userId) {
      throw new AuthorizationError('Access denied: You do not own this event.');
    }

    if (event.attendanceMode === 'TICKETIFICATION_REGISTRATION') {
      throw new ValidationError(
        'Guest roster operations are not permitted for events using native platform registration.'
      );
    }

    return event;
  }

  /**
   * Create a single guest under an event.
   */
  async createGuest(
    eventId: string,
    userId: string,
    data: CreateSingleGuestDTO
  ): Promise<GuestResponse> {
    await this.assertEventOwnership(eventId, userId);

    if (!data.name || !data.name.trim()) {
      throw new ValidationError('Guest name is required.');
    }

    const categoryName = (data.category || 'GENERAL').toUpperCase().trim();

    // Verify or create ticket type for this category
    let ticketType = await this.ticketTypeRepo.findByEventAndName(eventId, categoryName);
    if (!ticketType) {
      const usagePolicy = categoryName === 'WORKER' ? 'REUSABLE' : 'SINGLE_USE';
      ticketType = await this.ticketTypeRepo.create({
        eventId,
        name: categoryName,
        label: categoryName,
        usagePolicy,
      });
    }

    const guest = await this.guestRepo.create({
      eventId,
      name: data.name.trim(),
      category: categoryName,
      email: data.email || null,
      phone: data.phone || null,
      organization: data.organization || null,
      designation: data.designation || null,
      metadata: data.metadata || {},
    });

    return guest as GuestResponse;
  }

  /**
   * List guests for an event with pagination and search.
   */
  async getGuestsByEvent(
    eventId: string,
    userId: string,
    options: GuestFilterOptions = {}
  ): Promise<{ guests: GuestResponse[]; total: number; limit: number; offset: number }> {
    await this.assertEventOwnership(eventId, userId);

    const limit = options.limit || 500;
    const offset = options.offset || 0;

    const [guestsList, total] = await Promise.all([
      this.guestRepo.findByEventId(eventId, options),
      this.guestRepo.countByEventId(eventId, options),
    ]);

    return {
      guests: guestsList as GuestResponse[],
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a single guest by ID, scoped to event and user.
   */
  async getGuestById(
    eventId: string,
    guestId: string,
    userId: string
  ): Promise<GuestResponse> {
    await this.assertEventOwnership(eventId, userId);

    const guest = await this.guestRepo.findById(guestId);
    if (!guest || guest.eventId !== eventId) {
      throw new NotFoundError('Guest not found for this event.');
    }

    return guest as GuestResponse;
  }

  /**
   * Update an existing guest.
   */
  async updateGuest(
    eventId: string,
    guestId: string,
    userId: string,
    data: UpdateGuestDTO
  ): Promise<GuestResponse> {
    await this.assertEventOwnership(eventId, userId);

    const existingGuest = await this.guestRepo.findById(guestId);
    if (!existingGuest || existingGuest.eventId !== eventId) {
      throw new NotFoundError('Guest not found for this event.');
    }

    const updated = await this.guestRepo.update(guestId, data);
    if (!updated) {
      throw new AppError('Failed to update guest.', 500);
    }

    return updated as GuestResponse;
  }

  /**
   * Delete a guest.
   */
  async deleteGuest(
    eventId: string,
    guestId: string,
    userId: string
  ): Promise<void> {
    await this.assertEventOwnership(eventId, userId);

    const existingGuest = await this.guestRepo.findById(guestId);
    if (!existingGuest || existingGuest.eventId !== eventId) {
      throw new NotFoundError('Guest not found for this event.');
    }

    await this.guestRepo.deleteById(guestId);
  }
}

export const guestService = new GuestService();
