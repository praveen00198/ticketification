import mongoose from 'mongoose';
import {
  EventCredentialCheckinModel,
  IEventCredentialCheckinDocument,
  CheckinScanStatus,
} from '../../../db/mongo/models/event-credential-checkin.model';

export interface CheckinQueryOptions {
  limit?: number;
  gate?: string;
  scanStatus?: string;
  search?: string;
}

export interface CheckinAggregatedStats {
  totalScans: number;
  successfulCheckins: number;
  duplicateRejections: number;
  revokedRejections: number;
  velocityLast15Mins: number;
}

export class MongoEventCredentialCheckinRepository {
  /**
   * Log an immutable check-in scan record.
   */
  async createCheckinLog(
    data: Partial<IEventCredentialCheckinDocument>
  ): Promise<IEventCredentialCheckinDocument> {
    return EventCredentialCheckinModel.create(data);
  }

  /**
   * Query recent check-in logs for an event with filtering and pagination.
   */
  async findRecentByEvent(
    eventId: string,
    options: CheckinQueryOptions = {}
  ): Promise<IEventCredentialCheckinDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };

    if (options.gate && options.gate !== 'ALL') {
      query.gate = options.gate;
    }

    if (options.scanStatus && options.scanStatus !== 'ALL') {
      query.scanStatus = options.scanStatus;
    }

    if (options.search && options.search.trim()) {
      const escaped = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { 'holderSnapshot.name': regex },
        { 'holderSnapshot.formattedId': regex },
        { scannerEmail: regex },
        { notes: regex },
      ];
    }

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);

    return EventCredentialCheckinModel.find(query)
      .sort({ scannedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Aggregate live check-in statistics and velocity.
   */
  async getCheckinStats(eventId: string): Promise<CheckinAggregatedStats> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return {
        totalScans: 0,
        successfulCheckins: 0,
        duplicateRejections: 0,
        revokedRejections: 0,
        velocityLast15Mins: 0,
      };
    }

    const eventObjId = new mongoose.Types.ObjectId(eventId);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const [statusCounts, velocityCount] = await Promise.all([
      EventCredentialCheckinModel.aggregate([
        { $match: { eventId: eventObjId } },
        { $group: { _id: '$scanStatus', count: { $sum: 1 } } },
      ]),
      EventCredentialCheckinModel.countDocuments({
        eventId: eventObjId,
        scanStatus: 'SUCCESS',
        scannedAt: { $gte: fifteenMinutesAgo },
      }),
    ]);

    let totalScans = 0;
    let successfulCheckins = 0;
    let duplicateRejections = 0;
    let revokedRejections = 0;

    statusCounts.forEach((item) => {
      totalScans += item.count;
      if (item._id === 'SUCCESS') successfulCheckins = item.count;
      if (item._id === 'ALREADY_CHECKED_IN') duplicateRejections = item.count;
      if (item._id === 'REVOKED') revokedRejections = item.count;
    });

    return {
      totalScans,
      successfulCheckins,
      duplicateRejections,
      revokedRejections,
      velocityLast15Mins: velocityCount,
    };
  }
}

export const mongoEventCredentialCheckinRepository =
  new MongoEventCredentialCheckinRepository();
