import { db } from '../../../db';
import { tickets, guests, ticketTypes, events } from '../../../db/schema';
import { eq, and, asc, desc, sql, or, ilike } from 'drizzle-orm';

export interface CreateTicketInput {
  eventId: string;
  guestId?: string | null;
  ticketTypeId: string;
  verificationToken: string;
  status?: string;
  usagePolicy?: string;
  assetPath?: string | null;
  assetUrl?: string | null;
  sequenceNumber: number;
  createdBy: string;
}

export interface TicketFilterOptions {
  status?: string;
  ticketTypeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class TicketRepository {
  /**
   * Get the next sequence number for an event atomically.
   */
  async getNextSequenceNumber(eventId: string): Promise<number> {
    const result = await db
      .select({ maxSeq: sql<number>`COALESCE(MAX(${tickets.sequenceNumber}), 0)` })
      .from(tickets)
      .where(eq(tickets.eventId, eventId));

    return Number(result[0]?.maxSeq || 0) + 1;
  }

  /**
   * Insert a single ticket.
   */
  async create(data: CreateTicketInput) {
    const result = await db
      .insert(tickets)
      .values({
        eventId: data.eventId,
        guestId: data.guestId || null,
        ticketTypeId: data.ticketTypeId,
        verificationToken: data.verificationToken,
        status: data.status || 'ACTIVE',
        usagePolicy: data.usagePolicy || 'SINGLE_USE',
        assetPath: data.assetPath || null,
        assetUrl: data.assetUrl || null,
        sequenceNumber: data.sequenceNumber,
        createdBy: data.createdBy,
      })
      .returning();

    return result[0];
  }

  /**
   * Batch insert tickets in chunks to stay well within Postgres parameter limits.
   */
  async createMany(items: CreateTicketInput[]) {
    if (items.length === 0) return [];
    const CHUNK_SIZE = 500;
    const results = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const inserted = await db
        .insert(tickets)
        .values(
          chunk.map((data) => ({
            eventId: data.eventId,
            guestId: data.guestId || null,
            ticketTypeId: data.ticketTypeId,
            verificationToken: data.verificationToken,
            status: data.status || 'ACTIVE',
            usagePolicy: data.usagePolicy || 'SINGLE_USE',
            assetPath: data.assetPath || null,
            assetUrl: data.assetUrl || null,
            sequenceNumber: data.sequenceNumber,
            createdBy: data.createdBy,
          }))
        )
        .returning();
      results.push(...inserted);
    }
    return results;
  }

  /**
   * Find ticket by unique verification token.
   */
  async findByVerificationToken(verificationToken: string) {
    const result = await db
      .select({
        ticket: tickets,
        guest: guests,
        ticketType: ticketTypes,
        event: events,
      })
      .from(tickets)
      .leftJoin(guests, eq(tickets.guestId, guests.id))
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(eq(tickets.verificationToken, verificationToken))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find ticket by primary key ID.
   */
  async findById(id: string) {
    const result = await db
      .select({
        ticket: tickets,
        guest: guests,
        ticketType: ticketTypes,
        event: events,
      })
      .from(tickets)
      .leftJoin(guests, eq(tickets.guestId, guests.id))
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(eq(tickets.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find all tickets for an event with deterministic sequence order and optional filters.
   */
  async findByEventId(eventId: string, options: TicketFilterOptions = {}) {
    const limit = options.limit || 10000;
    const offset = options.offset || 0;

    const conditions = [eq(tickets.eventId, eventId)];

    if (options.status) {
      conditions.push(eq(tickets.status, options.status));
    }
    if (options.ticketTypeId) {
      conditions.push(eq(tickets.ticketTypeId, options.ticketTypeId));
    }

    if (options.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(guests.name, q),
          ilike(guests.email, q),
          ilike(guests.phone, q),
          ilike(tickets.verificationToken, q)
        )!
      );
    }

    return await db
      .select({
        ticket: tickets,
        guest: guests,
        ticketType: ticketTypes,
      })
      .from(tickets)
      .leftJoin(guests, eq(tickets.guestId, guests.id))
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .where(and(...conditions))
      .orderBy(asc(tickets.sequenceNumber))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count tickets for an event.
   */
  async countByEventId(eventId: string, options: TicketFilterOptions = {}): Promise<number> {
    const conditions = [eq(tickets.eventId, eventId)];

    if (options.status) {
      conditions.push(eq(tickets.status, options.status));
    }
    if (options.ticketTypeId) {
      conditions.push(eq(tickets.ticketTypeId, options.ticketTypeId));
    }

    if (options.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(guests.name, q),
          ilike(guests.email, q),
          ilike(guests.phone, q),
          ilike(tickets.verificationToken, q)
        )!
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .leftJoin(guests, eq(tickets.guestId, guests.id))
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  /**
   * Find unassigned tickets (guestId IS NULL) for an event.
   */
  async findUnassignedByEventId(eventId: string) {
    return await db
      .select({
        ticket: tickets,
        ticketType: ticketTypes,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
      .where(and(eq(tickets.eventId, eventId), sql`${tickets.guestId} IS NULL`))
      .orderBy(asc(tickets.sequenceNumber));
  }

  /**
   * Update a ticket by ID.
   */
  async update(id: string, data: Partial<CreateTicketInput>) {
    const result = await db
      .update(tickets)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, id))
      .returning();

    return result[0] || null;
  }
}

export const ticketRepository = new TicketRepository();
