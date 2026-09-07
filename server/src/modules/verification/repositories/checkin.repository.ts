import { db } from '../../../db';
import { ticketCheckins, tickets, guests, ticketTypes } from '../../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export interface CreateCheckinInput {
  ticketId: string;
  eventId: string;
  verifiedBy?: string;
  workerNameAssigned?: string | null;
  metadata?: Record<string, any>;
}

export class CheckinRepository {
  /**
   * Record a check-in event in the audit table.
   */
  async create(data: CreateCheckinInput) {
    const result = await db
      .insert(ticketCheckins)
      .values({
        ticketId: data.ticketId,
        eventId: data.eventId,
        verifiedBy: data.verifiedBy || 'Admin Scanner',
        workerNameAssigned: data.workerNameAssigned || null,
        metadata: data.metadata || {},
      })
      .returning();

    return result[0];
  }

  /**
   * Get the most recent check-in for a ticket.
   */
  async getLastCheckinForTicket(ticketId: string) {
    const result = await db
      .select()
      .from(ticketCheckins)
      .where(eq(ticketCheckins.ticketId, ticketId))
      .orderBy(desc(ticketCheckins.checkedInAt))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get recent check-ins for an event with explicit deterministic order.
   */
  async getRecentCheckins(eventId: string, limit = 20) {
    return await db
      .select({
        checkin: ticketCheckins,
        ticket: tickets,
        guest: guests,
        ticketType: ticketTypes,
      })
      .from(ticketCheckins)
      .innerJoin(tickets, eq(ticketCheckins.ticketId, tickets.id))
      .leftJoin(guests, eq(tickets.guestId, guests.id))
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .where(eq(ticketCheckins.eventId, eventId))
      .orderBy(desc(ticketCheckins.checkedInAt))
      .limit(limit);
  }

  /**
   * Count total check-ins for an event.
   */
  async countCheckinsByEvent(eventId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ticketCheckins)
      .where(eq(ticketCheckins.eventId, eventId));

    return result[0]?.count || 0;
  }
}

export const checkinRepository = new CheckinRepository();
