import mongoose from 'mongoose';
import {
  EventCredentialModel,
  IEventCredentialDocument,
  CredentialStatus,
  ICredentialHolder,
} from '../../../db/mongo/models/event-credential.model';
import { EventSequenceCounterModel } from '../../../db/mongo/models/event-sequence-counter.model';

export interface CredentialQueryFilters {
  status?: string;
  credentialType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class MongoEventCredentialRepository {
  /**
   * Atomically allocate the next monotonic sequence number for an event.
   */
  async getNextSequenceNumber(eventId: string): Promise<number> {
    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const counter = await EventSequenceCounterModel.findOneAndUpdate(
      { eventId: eventObjId },
      { $inc: { lastSequenceNumber: 1 } },
      { new: true, upsert: true }
    );

    return counter.lastSequenceNumber;
  }

  /**
   * Atomically reserve a block of N sequence numbers for batch issuance.
   * Returns the starting sequence number of the allocated block.
   */
  async allocateSequenceBlock(eventId: string, count: number): Promise<number> {
    if (count <= 0) return 1;
    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const counter = await EventSequenceCounterModel.findOneAndUpdate(
      { eventId: eventObjId },
      { $inc: { lastSequenceNumber: count } },
      { new: true, upsert: true }
    );

    // If counter now has e.g. 50 after adding 10, the block is 41..50
    return counter.lastSequenceNumber - count + 1;
  }

  /**
   * Insert a single credential into MongoDB.
   */
  async create(data: Partial<IEventCredentialDocument>): Promise<IEventCredentialDocument> {
    return EventCredentialModel.create(data);
  }

  /**
   * Insert multiple credentials in batch.
   */
  async createMany(items: Partial<IEventCredentialDocument>[]): Promise<IEventCredentialDocument[]> {
    if (items.length === 0) return [];
    return EventCredentialModel.insertMany(items) as unknown as Promise<IEventCredentialDocument[]>;
  }

  /**
   * Find credential by event and ID, or directly by credential ID.
   */
  async findById(eventIdOrCredentialId: string, credentialId?: string): Promise<IEventCredentialDocument | null> {
    if (credentialId) {
      if (!mongoose.Types.ObjectId.isValid(eventIdOrCredentialId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
        return null;
      }
      return EventCredentialModel.findOne({
        _id: new mongoose.Types.ObjectId(credentialId),
        eventId: new mongoose.Types.ObjectId(eventIdOrCredentialId),
      });
    }
    if (!mongoose.Types.ObjectId.isValid(eventIdOrCredentialId)) {
      return null;
    }
    return EventCredentialModel.findById(eventIdOrCredentialId);
  }

  /**
   * Find active credentials across events by holder email.
   */
  async findByEmail(email: string): Promise<IEventCredentialDocument[]> {
    if (!email) return [];
    return EventCredentialModel.find({
      'holder.email': email.toLowerCase().trim(),
      status: { $ne: 'REVOKED' },
    }).sort({ createdAt: -1 });
  }

  /**
   * Find credential by 64-character verification token across all events.
   */
  async findByVerificationToken(token: string): Promise<IEventCredentialDocument | null> {
    if (!token || token.length !== 64) return null;
    return EventCredentialModel.findOne({ verificationToken: token }).populate('eventId', 'name eventType credentialTerminology venue schedule');
  }

  /**
   * Query credentials with filters, text search, and pagination.
   */
  async findByEvent(
    eventId: string,
    filters: CredentialQueryFilters = {}
  ): Promise<{ credentials: IEventCredentialDocument[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return { credentials: [], total: 0 };
    }

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };

    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    if (filters.credentialType && filters.credentialType !== 'ALL') {
      query.credentialType = filters.credentialType;
    }

    if (filters.search && filters.search.trim()) {
      const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { 'holder.name': regex },
        { 'holder.email': regex },
        { 'holder.organization': regex },
        { formattedId: regex },
      ];
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    const [credentials, total] = await Promise.all([
      EventCredentialModel.find(query)
        .sort({ sequenceNumber: -1 })
        .skip(offset)
        .limit(limit),
      EventCredentialModel.countDocuments(query),
    ]);

    return { credentials, total };
  }

  /**
   * Find all credentials for an event matching optional filters for export or bulk processing.
   */
  async findAllForExport(
    eventId: string,
    filters: CredentialQueryFilters = {}
  ): Promise<IEventCredentialDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return [];
    }

    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }
    if (filters.credentialType && filters.credentialType !== 'ALL') {
      query.credentialType = filters.credentialType;
    }

    return EventCredentialModel.find(query).sort({ sequenceNumber: 1 });
  }

  /**
   * Find credentials within a contiguous sequence number range for an event.
   */
  async findBySequenceRange(
    eventId: string,
    startSeq: number,
    endSeq: number
  ): Promise<IEventCredentialDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    return EventCredentialModel.find({
      eventId: new mongoose.Types.ObjectId(eventId),
      sequenceNumber: { $gte: startSeq, $lte: endSeq },
    }).sort({ sequenceNumber: 1 });
  }

  /**
   * Count credentials matching export filters.
   */
  async countForExport(
    eventId: string,
    filters: CredentialQueryFilters = {}
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;

    if (mongoose.connection.readyState !== 1) {
      const items = await this.findAllForExport(eventId, filters);
      return items.length;
    }

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (filters.status && filters.status !== 'ALL') query.status = filters.status;
    if (filters.credentialType && filters.credentialType !== 'ALL') query.credentialType = filters.credentialType;
    return EventCredentialModel.countDocuments(query).exec();
  }

  /**
   * Return a Mongoose cursor for streaming credentials with bounded memory.
   */
  findExportCursor(
    eventId: string,
    filters: CredentialQueryFilters = {},
    batchSize: number = 50
  ) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new Error('Invalid eventId for export cursor');
    }

    if (mongoose.connection.readyState !== 1) {
      const self = this;
      return {
        async *[Symbol.asyncIterator]() {
          const items = await self.findAllForExport(eventId, filters);
          for (const item of items) {
            yield item;
          }
        },
        close: async () => {},
      };
    }

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (filters.status && filters.status !== 'ALL') query.status = filters.status;
    if (filters.credentialType && filters.credentialType !== 'ALL') query.credentialType = filters.credentialType;

    return EventCredentialModel.find(query)
      .sort({ sequenceNumber: 1 })
      .cursor({ batchSize });
  }

  /**
   * Compute aggregated metrics for an event.
   */
  async getMetrics(eventId: string): Promise<{
    total: number;
    active: number;
    checkedIn: number;
    revoked: number;
  }> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return { total: 0, active: 0, checkedIn: 0, revoked: 0 };
    }

    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const counts = await EventCredentialModel.aggregate([
      { $match: { eventId: eventObjId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    let total = 0;
    let active = 0;
    let checkedIn = 0;
    let revoked = 0;

    counts.forEach((item) => {
      total += item.count;
      if (item._id === 'ACTIVE') active = item.count;
      else if (item._id === 'CHECKED_IN') checkedIn = item.count;
      else if (item._id === 'REVOKED') revoked = item.count;
    });

    return { total, active, checkedIn, revoked };
  }

  /**
   * Update credential status (e.g. revoke, reactivate).
   */
  async updateStatus(
    eventId: string,
    credentialId: string,
    status: CredentialStatus,
    reason?: string
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      return null;
    }

    const updateDoc: any = { status };
    if (status === 'REVOKED') {
      updateDoc.revokedAt = new Date();
      updateDoc.revokedReason = reason || 'Revoked by organizer';
    } else {
      updateDoc.revokedAt = null;
      updateDoc.revokedReason = null;
    }

    return EventCredentialModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(credentialId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { $set: updateDoc },
      { new: true }
    );
  }

  /**
   * Assign or update holder information (e.g. for worker tickets named on distribution).
   */
  async assignHolder(
    eventId: string,
    credentialId: string,
    holder: Partial<ICredentialHolder>
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      return null;
    }

    const updates: any = {};
    if (holder.name !== undefined) updates['holder.name'] = holder.name.trim();
    if (holder.email !== undefined) updates['holder.email'] = holder.email?.trim().toLowerCase() || null;
    if (holder.phone !== undefined) updates['holder.phone'] = holder.phone?.trim() || null;
    if (holder.organization !== undefined) updates['holder.organization'] = holder.organization?.trim() || null;
    if (holder.designation !== undefined) updates['holder.designation'] = holder.designation?.trim() || null;
    if (holder.category !== undefined) updates['holder.category'] = holder.category.trim();
    updates['holder.isAssigned'] = true;

    return EventCredentialModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(credentialId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { $set: updates },
      { new: true }
    );
  }

  /**
   * Atomically check in a SINGLE_USE credential.
   * Race-condition defense: Returns null if already checked in, revoked, or expired.
   */
  async atomicCheckInSingleUse(
    eventId: string,
    credentialId: string
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      return null;
    }

    const now = new Date();

    return EventCredentialModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(credentialId),
        eventId: new mongoose.Types.ObjectId(eventId),
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
      },
      {
        $set: {
          status: 'CHECKED_IN',
          firstCheckedInAt: now,
          lastCheckedInAt: now,
        },
        $inc: { checkInCount: 1 },
      },
      { new: true }
    );
  }

  /**
   * Atomically check in a REUSABLE or REUSABLE_WORKER credential.
   * Increments checkInCount and updates lastCheckedInAt. Optionally assigns worker name.
   */
  async atomicCheckInReusable(
    eventId: string,
    credentialId: string,
    workerName?: string
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      return null;
    }

    const now = new Date();
    const updateDoc: any = {
      $set: {
        status: 'CHECKED_IN',
        lastCheckedInAt: now,
      },
      $inc: { checkInCount: 1 },
    };

    if (workerName && workerName.trim()) {
      updateDoc.$set['holder.name'] = workerName.trim();
      updateDoc.$set['holder.isAssigned'] = true;
    }

    // Try setting firstCheckedInAt if it hasn't been set yet
    let doc = await EventCredentialModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(credentialId),
        eventId: new mongoose.Types.ObjectId(eventId),
        status: { $in: ['ACTIVE', 'CHECKED_IN'] },
        usagePolicy: { $in: ['REUSABLE', 'REUSABLE_WORKER'] },
        firstCheckedInAt: null,
      },
      {
        ...updateDoc,
        $set: {
          ...updateDoc.$set,
          firstCheckedInAt: now,
        },
      },
      { new: true }
    );

    if (doc) return doc;

    // Otherwise standard update for subsequent check-ins
    return EventCredentialModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(credentialId),
        eventId: new mongoose.Types.ObjectId(eventId),
        status: { $in: ['ACTIVE', 'CHECKED_IN'] },
        usagePolicy: { $in: ['REUSABLE', 'REUSABLE_WORKER'] },
      },
      updateDoc,
      { new: true }
    );
  }

  /**
   * Count all unrendered credentials for an event (without 200/500 query cap).
   */
  async countUnrenderedByEvent(eventId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;

    if (mongoose.connection.readyState !== 1) {
      const { credentials } = await this.findByEvent(eventId, { limit: 1000 });
      return credentials.filter((c: any) => !c.asset?.storagePath).length;
    }

    return EventCredentialModel.countDocuments({
      eventId: new mongoose.Types.ObjectId(eventId),
      $or: [
        { 'asset.storagePath': { $exists: false } },
        { 'asset.storagePath': null },
        { 'asset.storagePath': '' },
      ],
    }).exec();
  }

  /**
   * Cursor-based batch pagination for unrendered credentials.
   * Loads at most `limit` records per batch using deterministic _id pagination.
   */
  async findUnrenderedBatch(
    eventId: string,
    lastId?: string | mongoose.Types.ObjectId | null,
    limit: number = 50
  ): Promise<IEventCredentialDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    if (mongoose.connection.readyState !== 1) {
      const { credentials } = await this.findByEvent(eventId, { limit: 1000 });
      const unrendered = credentials.filter((c: any) => !c.asset?.storagePath);
      return unrendered.slice(0, limit);
    }

    const query: any = {
      eventId: new mongoose.Types.ObjectId(eventId),
      $or: [
        { 'asset.storagePath': { $exists: false } },
        { 'asset.storagePath': null },
        { 'asset.storagePath': '' },
      ],
    };

    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    return EventCredentialModel.find(query)
      .sort({ _id: 1 })
      .limit(safeLimit)
      .exec();
  }
}

export const mongoEventCredentialRepository = new MongoEventCredentialRepository();

