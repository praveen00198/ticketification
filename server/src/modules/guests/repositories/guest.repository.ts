import { db } from '../../../db';
import { guests } from '../../../db/schema';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import { GuestFilterOptions } from '../guest.types';

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
   * Find guests for an event with optional search and category filters.
   * Explicitly ordered by createdAt DESC.
   */
  async findByEventId(
    eventId: string,
    optionsOrLimit?: GuestFilterOptions | number,
    maybeOffset?: number
  ) {
    let options: GuestFilterOptions = {};
    if (typeof optionsOrLimit === 'number') {
      options = { limit: optionsOrLimit, offset: maybeOffset || 0 };
    } else if (optionsOrLimit && typeof optionsOrLimit === 'object') {
      options = optionsOrLimit;
    }

    const limit = options.limit || 500;
    const offset = options.offset || 0;

    const conditions = [eq(guests.eventId, eventId)];

    if (options.category) {
      conditions.push(eq(guests.category, options.category));
    }

    if (options.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          ilike(guests.name, searchPattern),
          ilike(guests.email, searchPattern),
          ilike(guests.phone, searchPattern),
          ilike(guests.organization, searchPattern)
        )!
      );
    }

    return await db
      .select()
      .from(guests)
      .where(and(...conditions))
      .orderBy(desc(guests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count guests for an event with optional filters.
   */
  async countByEventId(eventId: string, options: GuestFilterOptions = {}): Promise<number> {
    const conditions = [eq(guests.eventId, eventId)];

    if (options.category) {
      conditions.push(eq(guests.category, options.category));
    }

    if (options.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          ilike(guests.name, searchPattern),
          ilike(guests.email, searchPattern),
          ilike(guests.phone, searchPattern),
          ilike(guests.organization, searchPattern)
        )!
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  /**
   * Create a single guest record.
   */
  async create(data: CreateGuestInput) {
    const result = await db
      .insert(guests)
      .values({
        eventId: data.eventId,
        name: data.name ? data.name.trim() : null,
        email: data.email ? data.email.trim().toLowerCase() : null,
        phone: data.phone ? data.phone.trim() : null,
        organization: data.organization ? data.organization.trim() : null,
        designation: data.designation ? data.designation.trim() : null,
        category: data.category.trim(),
        metadata: data.metadata || {},
        importId: data.importId || null,
      })
      .returning();

    return result[0];
  }

  /**
   * Update a guest by ID.
   */
  async update(id: string, data: Partial<CreateGuestInput>) {
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updatePayload.name = data.name ? data.name.trim() : null;
    if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
    if (data.organization !== undefined) updatePayload.organization = data.organization ? data.organization.trim() : null;
    if (data.designation !== undefined) updatePayload.designation = data.designation ? data.designation.trim() : null;
    if (data.category !== undefined) updatePayload.category = data.category.trim();
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;

    const result = await db
      .update(guests)
      .set(updatePayload)
      .where(eq(guests.id, id))
      .returning();

    return result[0] || null;
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
