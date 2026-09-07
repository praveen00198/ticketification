import { db } from '../../../db';
import { ticketTypes } from '../../../db/schema';
import { eq, and, asc } from 'drizzle-orm';

export interface CreateTicketTypeInput {
  eventId: string;
  name: string;
  label: string;
  usagePolicy?: string; // 'SINGLE_USE' | 'REUSABLE_WORKER'
}

export class TicketTypeRepository {
  /**
   * List all ticket types for an event, explicitly ordered by createdAt ASC.
   */
  async findByEventId(eventId: string) {
    return await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId))
      .orderBy(asc(ticketTypes.createdAt));
  }

  /**
   * Find a specific ticket type by name and event ID.
   */
  async findByEventAndName(eventId: string, name: string) {
    const result = await db
      .select()
      .from(ticketTypes)
      .where(and(eq(ticketTypes.eventId, eventId), eq(ticketTypes.name, name)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a single ticket type.
   */
  async create(data: CreateTicketTypeInput) {
    const result = await db
      .insert(ticketTypes)
      .values({
        eventId: data.eventId,
        name: data.name.toUpperCase().trim(),
        label: data.label.trim(),
        usagePolicy: data.usagePolicy || 'SINGLE_USE',
      })
      .returning();

    return result[0];
  }

  /**
   * Batch create ticket types for an event.
   */
  async createMany(types: CreateTicketTypeInput[]) {
    if (types.length === 0) return [];
    return await db
      .insert(ticketTypes)
      .values(
        types.map((t) => ({
          eventId: t.eventId,
          name: t.name.toUpperCase().trim(),
          label: t.label.trim(),
          usagePolicy: t.usagePolicy || 'SINGLE_USE',
        }))
      )
      .returning();
  }

  /**
   * Delete a ticket type.
   */
  async delete(ticketTypeId: string) {
    const result = await db
      .delete(ticketTypes)
      .where(eq(ticketTypes.id, ticketTypeId))
      .returning();

    return result[0] || null;
  }
}

export const ticketTypeRepository = new TicketTypeRepository();
