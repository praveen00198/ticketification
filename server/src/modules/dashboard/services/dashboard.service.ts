import { db } from '../../../db';
import { tickets, events, guests, ticketCheckins } from '../../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export class DashboardService {
  async getDashboardStats(eventId?: string) {
    if (!eventId) {
      return {
        stats: {
          totalGuests: 0,
          ticketsGenerated: 0,
          ticketsActive: 0,
          ticketsUsed: 0,
          ticketsRemaining: 0,
        },
        recentActivity: [],
      };
    }

    const [totalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(eq(tickets.eventId, eventId));

    const [usedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(sql`${tickets.eventId} = ${eventId} AND ${tickets.status} = 'USED'`);

    const recentTickets = await db
      .select({
        id: tickets.id,
        verificationToken: tickets.verificationToken,
        sequenceNumber: tickets.sequenceNumber,
        status: tickets.status,
        name: guests.name,
        email: guests.email,
        phone: guests.phone,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .leftJoin(guests, eq(tickets.guestId, guests.id))
      .where(eq(tickets.eventId, eventId))
      .orderBy(desc(tickets.createdAt))
      .limit(5);

    const total = totalCount?.count || 0;
    const used = usedCount?.count || 0;

    return {
      stats: {
        totalGuests: total,
        ticketsGenerated: total,
        ticketsActive: total - used,
        ticketsUsed: used,
        ticketsRemaining: total - used,
      },
      recentActivity: recentTickets,
    };
  }
}

export const dashboardService = new DashboardService();
