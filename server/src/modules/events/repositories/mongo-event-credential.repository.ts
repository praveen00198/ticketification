import mongoose from 'mongoose';
import {
  EventCredentialModel,
  IEventCredentialDocument,
  CredentialStatus,
  CredentialRenderStatus,
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

export interface RenderAssetData {
  storagePath: string;
  publicUrl: string;
  renderedAt?: Date;
  mimeType?: string;
  dimensions?: { width: number; height: number };
  fileSize?: number;
  fileSizeBytes?: number;
  [key: string]: any;
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
      { returnDocument: 'after', upsert: true }
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
      { returnDocument: 'after', upsert: true }
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
   * Idempotently insert credentials, upserting by (eventId, sequenceNumber) without
   * overwriting existing records ($setOnInsert).
   */
  async upsertMany(items: Partial<IEventCredentialDocument>[]): Promise<IEventCredentialDocument[]> {
    if (items.length === 0) return [];

    items.forEach((doc) => {
      if (!doc.renderStatus) {
        doc.renderStatus = 'PENDING';
      }
    });

    if (mongoose.connection.readyState !== 1) {
      return EventCredentialModel.insertMany(items) as unknown as Promise<IEventCredentialDocument[]>;
    }

    const operations = items.map((doc) => ({
      updateOne: {
        filter: {
          eventId: doc.eventId,
          sequenceNumber: doc.sequenceNumber,
        },
        update: {
          $setOnInsert: doc,
        },
        upsert: true,
      },
    }));

    try {
      await EventCredentialModel.bulkWrite(operations, { ordered: false });
    } catch (err: any) {
      if (err.code === 11000 || err.message?.includes('duplicate key') || err.message?.includes('E11000')) {
        // Safe duplicate-key absorption: document already exists in DB
      } else {
        throw err;
      }
    }

    const eventIds = Array.from(new Set(items.map((i) => i.eventId!.toString())));
    const minSeq = Math.min(...items.map((i) => i.sequenceNumber!));
    const maxSeq = Math.max(...items.map((i) => i.sequenceNumber!));
    const results = await Promise.all(
      eventIds.map((eId) => this.findBySequenceRange(eId, minSeq, maxSeq))
    );
    return results.flat();
  }

  /**
   * Insert multiple credentials in batch safely and idempotently.
   */
  async createMany(items: Partial<IEventCredentialDocument>[]): Promise<IEventCredentialDocument[]> {
    if (items.length === 0) return [];
    if (mongoose.connection.readyState !== 1) {
      return EventCredentialModel.insertMany(items) as unknown as Promise<IEventCredentialDocument[]>;
    }
    return this.upsertMany(items);
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
   * Uses lean projection without .populate() to optimize high-throughput scan paths.
   */
  async findByVerificationToken(token: string): Promise<IEventCredentialDocument | null> {
    if (!token || token.length !== 64) return null;
    return EventCredentialModel.findOne({ verificationToken: token })
      .select('eventId sequenceNumber formattedId verificationToken credentialType terminology usagePolicy status holder asset firstCheckedInAt lastCheckedInAt checkInCount revokedAt revokedReason')
      .lean() as any;
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
      if (process.env.NODE_ENV === 'test') {
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
      throw new Error('MongoDB connection is not ready. Bounded export cursor cannot be established.');
    }

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (filters.status && filters.status !== 'ALL') query.status = filters.status;
    if (filters.credentialType && filters.credentialType !== 'ALL') query.credentialType = filters.credentialType;

    return EventCredentialModel.find(query)
      .select('formattedId sequenceNumber holder asset verificationToken credentialType status eventId')
      .sort({ sequenceNumber: 1, _id: 1 })
      .lean()
      .cursor({ batchSize });
  }

  /**
   * Keyset pagination for streaming credential exports with bounded memory.
   * Retrieves only the minimal fields required for export packaging.
   */
  async findExportBatchKeyset(
    eventId: string,
    lastSequenceNumber: number = 0,
    lastId?: string,
    batchSize: number = 50,
    filters: CredentialQueryFilters = {}
  ): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new Error('Invalid eventId for export keyset pagination');
    }

    if (mongoose.connection.readyState !== 1) {
      if (process.env.NODE_ENV === 'test') {
        const items = await this.findAllForExport(eventId, filters);
        return items
          .filter((i: any) => (i.sequenceNumber || 0) > lastSequenceNumber)
          .slice(0, batchSize);
      }
      throw new Error('MongoDB connection is not ready. Bounded export keyset cannot be established.');
    }

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (filters.status && filters.status !== 'ALL') query.status = filters.status;
    if (filters.credentialType && filters.credentialType !== 'ALL') query.credentialType = filters.credentialType;

    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query.$or = [
        { sequenceNumber: { $gt: lastSequenceNumber } },
        { sequenceNumber: lastSequenceNumber, _id: { $gt: new mongoose.Types.ObjectId(lastId) } },
      ];
    } else {
      query.sequenceNumber = { $gt: lastSequenceNumber };
    }

    return EventCredentialModel.find(query)
      .select('formattedId sequenceNumber holder asset verificationToken credentialType status eventId')
      .sort({ sequenceNumber: 1, _id: 1 })
      .limit(batchSize)
      .lean();
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
      { returnDocument: 'after' }
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
      { returnDocument: 'after' }
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
      { returnDocument: 'after' }
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
      { returnDocument: 'after' }
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
      { returnDocument: 'after' }
    );
  }

  /**
   * Returns current Mongoose connection readyState (1 = connected).
   */
  protected getDbReadyState(): number {
    return mongoose.connection.readyState;
  }

  /**
   * Helper to construct canonical query matching unrendered credentials.
   * Matches credentials belonging to eventId where renderStatus is not COMPLETED
   * and asset publicUrl or renderedAt is missing/null/empty.
   */
  protected buildUnrenderedQuery(eventId: string | mongoose.Types.ObjectId): Record<string, any> {
    return {
      eventId: new mongoose.Types.ObjectId(eventId),
      renderStatus: { $ne: 'COMPLETED' },
      $or: [
        { 'asset.publicUrl': { $exists: false } },
        { 'asset.publicUrl': null },
        { 'asset.publicUrl': '' },
        { 'asset.renderedAt': { $exists: false } },
        { 'asset.renderedAt': null },
      ],
    };
  }

  /**
   * Helper predicate for in-memory unrendered credential checks in test mode.
   */
  protected isCredentialUnrendered(c: any): boolean {
    return c.renderStatus !== 'COMPLETED' && (!c.asset?.publicUrl || !c.asset?.renderedAt);
  }

  /**
   * Count all unrendered credentials for an event (without 200/500 query cap).
   * Harmonized with findUnrenderedBatch.
   */
  async countUnrenderedByEvent(eventId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;

    if (this.getDbReadyState() !== 1) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('[DatabaseDisconnected] Cannot process unrendered credentials while database is disconnected');
      }
      const { credentials } = await this.findByEvent(eventId, { limit: 10000 });
      return credentials.filter((c: any) => this.isCredentialUnrendered(c)).length;
    }

    return EventCredentialModel.countDocuments(this.buildUnrenderedQuery(eventId)).exec();
  }

  /**
   * Cursor-based batch pagination for unrendered credentials.
   * Loads at most `limit` records per batch using deterministic _id pagination.
   * Harmonized with countUnrenderedByEvent.
   */
  async findUnrenderedBatch(
    eventId: string,
    lastId?: string | mongoose.Types.ObjectId | null,
    limit: number = 50
  ): Promise<IEventCredentialDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    if (this.getDbReadyState() !== 1) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('[DatabaseDisconnected] Cannot process unrendered credentials while database is disconnected');
      }
      const { credentials } = await this.findByEvent(eventId, { limit: 10000 });
      let unrendered = credentials.filter((c: any) => this.isCredentialUnrendered(c));
      if (lastId) {
        const lastIdStr = lastId.toString();
        unrendered = unrendered.filter((c: any) => (c._id?.toString() || '') > lastIdStr);
      }
      return unrendered.slice(0, limit);
    }

    const query: any = this.buildUnrenderedQuery(eventId);

    if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    return EventCredentialModel.find(query)
      .sort({ _id: 1 })
      .limit(safeLimit)
      .exec();
  }

  /**
   * Atomically claim an unrendered ticket lease for a worker.
   * Matches tickets that are PENDING, FAILED, legacy unrendered, or have an expired PROCESSING lease.
   */
  async claimUnrenderedTicketLease(
    eventId: string,
    workerId: string,
    leaseMs: number = 60000
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !workerId) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    if (this.getDbReadyState() !== 1) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('[DatabaseDisconnected] Cannot claim ticket lease while database is disconnected');
      }
      const { credentials } = await this.findByEvent(eventId, { limit: 10000 });
      const candidate = (credentials as any[]).find((c: any) => {
        if (c.renderStatus === 'COMPLETED') return false;
        const isPending = !c.renderStatus || c.renderStatus === 'PENDING' || c.renderStatus === 'FAILED';
        const isExpired =
          c.renderStatus === 'PROCESSING' &&
          (!c.renderingLockExpiresAt || new Date(c.renderingLockExpiresAt) <= now);
        const isMissingAsset = !c.asset?.publicUrl || !c.asset?.renderedAt;
        return (isPending || isExpired) && isMissingAsset;
      });

      if (!candidate) return null;

      candidate.renderStatus = 'PROCESSING';
      candidate.renderingLockedBy = workerId;
      candidate.renderingLockExpiresAt = expiresAt;
      if (candidate.renderAttempts !== undefined) {
        candidate.renderAttempts = (candidate.renderAttempts || 0) + 1;
      }
      if (typeof candidate.save === 'function') {
        await candidate.save();
      }
      return candidate;
    }

    const query: any = {
      eventId: new mongoose.Types.ObjectId(eventId),
      renderStatus: { $ne: 'COMPLETED' },
      $or: [
        { renderStatus: 'PENDING' },
        {
          renderStatus: { $exists: false },
          $or: [
            { 'asset.publicUrl': { $exists: false } },
            { 'asset.publicUrl': null },
            { 'asset.publicUrl': '' },
          ],
        },
        { renderStatus: 'FAILED' },
        {
          renderStatus: 'PROCESSING',
          $or: [
            { renderingLockExpiresAt: { $lte: now } },
            { renderingLockExpiresAt: null },
            { renderingLockExpiresAt: { $exists: false } },
          ],
        },
      ],
    };

    return EventCredentialModel.findOneAndUpdate(
      query,
      {
        $set: {
          renderStatus: 'PROCESSING',
          renderingLockedBy: workerId,
          renderingLockExpiresAt: expiresAt,
          renderError: null,
        },
        $inc: { renderAttempts: 1 },
      },
      {
        returnDocument: 'after',
        sort: { sequenceNumber: 1, _id: 1 },
      }
    ).exec();
  }

  /**
   * Reclaim abandoned ticket rendering leases whose lease expiration plus grace period has passed.
   * Resets renderStatus to PENDING and clears worker locks.
   */
  async reclaimAbandonedTicketLeases(
    eventId: string,
    leaseGraceMs: number = 0
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;

    const cutoff = new Date(Date.now() - Math.max(0, leaseGraceMs));

    if (this.getDbReadyState() !== 1) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('[DatabaseDisconnected] Cannot reclaim ticket leases while database is disconnected');
      }
      const { credentials } = await this.findByEvent(eventId, { limit: 10000 });
      let reclaimed = 0;
      for (const cred of credentials as any[]) {
        if (
          cred.renderStatus === 'PROCESSING' &&
          (!cred.renderingLockExpiresAt || new Date(cred.renderingLockExpiresAt) <= cutoff)
        ) {
          cred.renderStatus = 'PENDING';
          cred.renderingLockedBy = null;
          cred.renderingLockExpiresAt = null;
          if (typeof cred.save === 'function') await cred.save();
          reclaimed++;
        }
      }
      return reclaimed;
    }

    const filter: any = {
      eventId: new mongoose.Types.ObjectId(eventId),
      renderStatus: 'PROCESSING',
      $or: [
        { renderingLockExpiresAt: { $lte: cutoff } },
        { renderingLockExpiresAt: null },
        { renderingLockExpiresAt: { $exists: false } },
      ],
    };

    const update = {
      $set: {
        renderStatus: 'PENDING',
        renderingLockedBy: null,
        renderingLockExpiresAt: null,
      },
    };

    const result = await EventCredentialModel.updateMany(filter, update).exec();
    return result.modifiedCount || 0;
  }

  /**
   * Atomically mark a credential as COMPLETED with its uploaded storage asset metadata.
   * Releases worker lock and sets renderStatus to COMPLETED.
   */
  async markRenderCompleted(
    credentialId: string,
    assetData: RenderAssetData
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(credentialId)) {
      throw new Error(`Invalid credentialId: ${credentialId}`);
    }
    if (!assetData || !assetData.storagePath || !assetData.publicUrl) {
      throw new Error('storagePath and publicUrl are required to mark render completed');
    }

    const renderedAt = assetData.renderedAt || new Date();

    if (this.getDbReadyState() !== 1) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('[DatabaseDisconnected] Cannot mark render completed while database is disconnected');
      }
      const cred = await EventCredentialModel.findById(credentialId);
      if (cred) {
        cred.renderStatus = 'COMPLETED';
        cred.renderError = null;
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
        cred.asset = {
          storagePath: assetData.storagePath,
          publicUrl: assetData.publicUrl,
          renderedAt,
          mimeType: assetData.mimeType || 'image/png',
          dimensions: assetData.dimensions || null,
          fileSizeBytes:
            assetData.fileSizeBytes !== undefined
              ? assetData.fileSizeBytes
              : assetData.fileSize !== undefined
              ? assetData.fileSize
              : null,
        };
        if (typeof cred.save === 'function') await cred.save();
      }
      return cred;
    }

    const update: any = {
      $set: {
        renderStatus: 'COMPLETED',
        renderError: null,
        renderingLockedBy: null,
        renderingLockExpiresAt: null,
        'asset.storagePath': assetData.storagePath,
        'asset.publicUrl': assetData.publicUrl,
        'asset.renderedAt': renderedAt,
        'asset.mimeType': assetData.mimeType || 'image/png',
      },
    };

    const fileSize =
      assetData.fileSizeBytes !== undefined ? assetData.fileSizeBytes : assetData.fileSize;
    if (fileSize !== undefined && fileSize !== null) {
      update.$set['asset.fileSizeBytes'] = fileSize;
    }
    if (assetData.dimensions) {
      update.$set['asset.dimensions'] = assetData.dimensions;
    }

    return EventCredentialModel.findByIdAndUpdate(
      credentialId,
      update,
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Atomically mark a credential as FAILED with error details and release worker lock.
   */
  async markRenderFailed(
    credentialId: string,
    error: string
  ): Promise<IEventCredentialDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(credentialId)) {
      throw new Error(`Invalid credentialId: ${credentialId}`);
    }

    const sanitizedError = (error || 'Rendering failed').slice(0, 1000);

    if (this.getDbReadyState() !== 1) {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('[DatabaseDisconnected] Cannot mark render failed while database is disconnected');
      }
      const cred = await EventCredentialModel.findById(credentialId);
      if (cred) {
        cred.renderStatus = 'FAILED';
        cred.renderError = sanitizedError;
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
        if (!cred.metadata) cred.metadata = {};
        cred.metadata.lastRenderError = sanitizedError.slice(0, 500);
        cred.metadata.renderFailedAt = new Date();
        if (typeof cred.save === 'function') await cred.save();
      }
      return cred;
    }

    const update = {
      $set: {
        renderStatus: 'FAILED',
        renderError: sanitizedError,
        renderingLockedBy: null,
        renderingLockExpiresAt: null,
        'metadata.lastRenderError': sanitizedError.slice(0, 500),
        'metadata.renderFailedAt': new Date(),
      },
    };

    return EventCredentialModel.findByIdAndUpdate(
      credentialId,
      update,
      { returnDocument: 'after' }
    ).exec();
  }
}

export const mongoEventCredentialRepository = new MongoEventCredentialRepository();

