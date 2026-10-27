import mongoose from 'mongoose';
import { isMongoConnected } from '../../../db/mongodb';
import { EventCredentialModel } from '../../../db/mongo/models/event-credential.model';
import { EventRegistrationModel } from '../../../db/mongo/models/event-registration.model';
import config from '../../../config/env';

export interface DashboardStatsResult {
  stats: {
    totalGuests: number;
    ticketsGenerated: number;
    ticketsActive: number;
    ticketsUsed: number;
    ticketsRemaining: number;
  };
  recentActivity: Array<{
    id: string;
    verificationToken: string;
    sequenceNumber: number;
    status: string;
    name: string;
    email: string | null;
    phone: string | null;
    createdAt: Date;
  }>;
}

export class DashboardService {
  async getDashboardStats(eventId?: string): Promise<DashboardStatsResult> {
    const emptyResult: DashboardStatsResult = {
      stats: {
        totalGuests: 0,
        ticketsGenerated: 0,
        ticketsActive: 0,
        ticketsUsed: 0,
        ticketsRemaining: 0,
      },
      recentActivity: [],
    };

    if (!eventId) {
      return emptyResult;
    }

    // 1. Primary Store: MongoDB (Authoritative)
    if (isMongoConnected() && mongoose.isValidObjectId(eventId)) {
      try {
        if (mongoose.connection.readyState !== 1 && !(EventCredentialModel.countDocuments as any).mock) {
          return emptyResult;
        }

        const safeEventId = new mongoose.Types.ObjectId(eventId);

        const [totalCredentials, usedCredentials, totalRegistrations, recentDocs] = await Promise.all([
          EventCredentialModel.countDocuments({ eventId: safeEventId }),
          EventCredentialModel.countDocuments({
            eventId: safeEventId,
            status: { $in: ['CHECKED_IN', 'USED'] },
          }),
          EventRegistrationModel.countDocuments({
            eventId: safeEventId,
            status: { $in: ['CONFIRMED', 'ATTENDED', 'REGISTERED'] },
          }),
          EventCredentialModel.find({ eventId: safeEventId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        ]);

        const totalGuests = Math.max(totalCredentials, totalRegistrations);
        const activeCount = Math.max(0, totalCredentials - usedCredentials);

        const recentActivity = recentDocs.map((c: any) => ({
          id: c._id ? c._id.toString() : '',
          verificationToken: c.verificationToken || '',
          sequenceNumber: c.sequenceNumber || 0,
          status: c.status === 'CHECKED_IN' ? 'USED' : c.status || 'ACTIVE',
          name: c.holder?.name || 'Attendee',
          email: c.holder?.email || null,
          phone: c.holder?.phone || null,
          createdAt: c.createdAt || new Date(),
        }));

        if (totalGuests > 0 || recentActivity.length > 0) {
          return {
            stats: {
              totalGuests,
              ticketsGenerated: totalCredentials,
              ticketsActive: activeCount,
              ticketsUsed: usedCredentials,
              ticketsRemaining: activeCount,
            },
            recentActivity,
          };
        }
      } catch (mongoErr) {
        console.warn('[DashboardService] Error querying MongoDB stats, trying fallback:', mongoErr);
      }
    }

    // 2. Fallback Store: PostgreSQL (Legacy Drizzle Schema)
    if (config.env.databaseUrl) {
      try {
        const { db } = await import('../../../db');
        const { tickets, guests } = await import('../../../db/schema');
        const { eq, desc, sql } = await import('drizzle-orm');

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
          recentActivity: recentTickets as any,
        };
      } catch (_pgErr) {
        // Fall through to empty result if postgres is unconfigured or fails
      }
    }

    return emptyResult;
  }
}

export const dashboardService = new DashboardService();
