import { db } from '../../../db';
import { guests } from '../../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateGuestInput {
  eventId: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  designation?: string | null;
  category: string;
  metadata?: Record<string, any>;
  importId?: string | null;
}

export class GuestRepository {
  /**
   * Find all guests for an event, explicitly ordered by createdAt DESC.
   */
  async findByEventId(eventId: string, limit = 500, offset = 0) {
    return await db
      .select()
      .from(guests)
      .where(eq(guests.eventId, eventId))
      .orderBy(desc(guests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count all guests for an event.
   */
  async countByEventId(eventId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests)
      .where(eq(guests.eventId, eventId));

    return result[0]?.count || 0;
  }

  /**
   * Insert multiple guest records in a batch.
   */
  async insertMany(records: CreateGuestInput[]) {
    if (records.length === 0) return [];
    return await db
      .insert(guests)
      .values(
        records.map((r) => ({
          eventId: r.eventId,
          name: r.name ? r.name.trim() : null,
          email: r.email ? r.email.trim().toLowerCase() : null,
          phone: r.phone ? r.phone.trim() : null,
          organization: r.organization ? r.organization.trim() : null,
          designation: r.designation ? r.designation.trim() : null,
          category: r.category.trim(),
          metadata: r.metadata || {},
          importId: r.importId || null,
        }))
      )
      .returning();
  }

  /**
   * Find a guest by ID.
   */
  async findById(id: string) {
    const result = await db
      .select()
      .from(guests)
      .where(eq(guests.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Delete a guest by ID.
   */
  async deleteById(id: string) {
    const result = await db
      .delete(guests)
      .where(eq(guests.id, id))
      .returning();

    return result[0] || null;
  }
}

export const guestRepository = new GuestRepository();
