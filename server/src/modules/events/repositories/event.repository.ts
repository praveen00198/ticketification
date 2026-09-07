import { db } from '../../../db';
import { events, ticketTypes } from '../../../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export interface CreateEventInput {
  name: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  venue?: string | null;
  description?: string | null;
  organizerName?: string | null;
  logoUrl?: string | null;
  ticketTemplateUrl?: string | null;
  status?: string;
  createdBy: string;
}

export interface UpdateEventInput {
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

export class EventRepository {
  /**
   * Find all events owned by a user, explicitly ordered by createdAt DESC.
   */
  async findByOwner(userId: string) {
    return await db
      .select()
      .from(events)
      .where(eq(events.createdBy, userId))
      .orderBy(desc(events.createdAt));
  }

  /**
   * Find a single event by ID.
   */
  async findById(eventId: string) {
    const result = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a single event by ID and owner.
   */
  async findByIdAndOwner(eventId: string, userId: string) {
    const result = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.createdBy, userId)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a new event.
   */
  async create(data: CreateEventInput) {
    const result = await db
      .insert(events)
      .values({
        name: data.name,
        date: data.date,
        time: data.time || null,
        venue: data.venue || null,
        description: data.description || null,
        organizerName: data.organizerName || null,
        logoUrl: data.logoUrl || null,
        ticketTemplateUrl: data.ticketTemplateUrl || null,
        status: data.status || 'UPCOMING',
        createdBy: data.createdBy,
      })
      .returning();

    return result[0];
  }

  /**
   * Update an event by ID.
   */
  async update(eventId: string, data: UpdateEventInput) {
    const result = await db
      .update(events)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete an event by ID.
   */
  async delete(eventId: string) {
    const result = await db
      .delete(events)
      .where(eq(events.id, eventId))
      .returning();

    return result[0] || null;
  }
}

export const eventRepository = new EventRepository();
