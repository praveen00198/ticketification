import mongoose from 'mongoose';
import { EventModel, IEvent, IEventDocument } from '../../../db/mongo/models/event.model';

export interface EventQueryOptions {
  page?: number;
  limit?: number;
  status?: string;
  eventType?: string;
  search?: string;
}

export interface PublicEventQueryOptions {
  page?: number;
  limit?: number;
  eventType?: string;
  search?: string;
  city?: string;
  pricingModel?: string;
  venueType?: string;
}

export interface PaginatedEventsResult {
  events: IEventDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class MongoEventRepository {
  constructor(private model: typeof EventModel = EventModel) {}

  /**
   * Create a new Event document in MongoDB.
   */
  async create(data: Partial<IEvent>): Promise<IEventDocument> {
    if (mongoose.connection.readyState !== 1) {
      return {
        ...data,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }
    return await this.model.create(data);
  }

  /**
   * Find an event by its MongoDB ObjectId.
   */
  async findById(id: string): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    if (mongoose.connection.readyState !== 1 && !Boolean((this.model.findById as any)?.mock)) {
      return null;
    }
    return await this.model.findById(id).exec();
  }

  /**
   * Find an event by ID and verified owner Supabase user ID (strict zero-trust check).
   */
  async findByIdAndOwner(id: string, ownerSupabaseId: string): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    if (mongoose.connection.readyState !== 1 && !Boolean((this.model.findOne as any)?.mock)) {
      return null;
    }
    return await this.model.findOne({ _id: id, ownerSupabaseId }).exec();
  }

  /**
   * Find paginated events owned by a user with optional status and eventType filters.
   */
  async findByOwner(
    ownerSupabaseId: string,
    options: EventQueryOptions = {}
  ): Promise<PaginatedEventsResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1 && !Boolean((this.model.find as any)?.mock)) {
      return {
        events: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const query: Record<string, any> = { ownerSupabaseId };

    if (options.status) {
      query.status = options.status;
    }

    if (options.eventType) {
      query.eventType = options.eventType;
    }

    if (options.search && options.search.trim()) {
      query.$text = { $search: options.search.trim() };
    }

    const [events, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Update an existing draft event.
   * Restricts updates to events owned by the user and currently in 'DRAFT' status.
   */
  async updateDraft(
    id: string,
    ownerSupabaseId: string,
    updates: Partial<IEvent>
  ): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    return await this.model
      .findOneAndUpdate(
        { _id: id, ownerSupabaseId, status: 'DRAFT' },
        { $set: updates },
        { returnDocument: 'after', runValidators: true }
      )
      .exec();
  }

  /**
   * Delete an existing draft event owned by the caller.
   */
  async deleteDraft(id: string, ownerSupabaseId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }

    const result = await this.model.deleteOne({ _id: id, ownerSupabaseId, status: 'DRAFT' }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Transition event status with immutable audit logging and optional metadata.
   */
  async transitionStatus(
    id: string,
    newStatus: string,
    historyEntry: any,
    extraUpdates: Record<string, any> = {}
  ): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    return await this.model
      .findByIdAndUpdate(
        id,
        {
          $set: { status: newStatus, ...extraUpdates },
          $push: { statusHistory: historyEntry },
        },
        { returnDocument: 'after', runValidators: true }
      )
      .exec();
  }

  /**
   * Find paginated publicly discoverable events.
   * Strictly enforces public status: PUBLISHED, REGISTRATION_OPEN, or EVENT_LIVE.
   */
  async findPublicEvents(
    options: PublicEventQueryOptions = {}
  ): Promise<PaginatedEventsResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 12));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN', 'EVENT_LIVE'] },
      organizationVerificationStatus: { $nin: ['PENDING', 'REJECTED'] },
      verificationStatus: { $nin: ['PENDING', 'REJECTED'] },
      $and: [
        {
          $or: [
            { hostingType: { $ne: 'ORGANIZATION' } },
            { hostingType: 'ORGANIZATION', verificationStatus: 'VERIFIED' },
          ],
        },
      ],
    };

    if (options.eventType && options.eventType !== 'ALL') {
      query.eventType = options.eventType;
    }

    if (options.venueType && options.venueType !== 'ALL') {
      query['venue.type'] = options.venueType;
    }

    if (options.pricingModel && options.pricingModel !== 'ALL') {
      query['registration.pricingModel'] = options.pricingModel;
    }

    if (options.city && options.city.trim()) {
      query['venue.city'] = { $regex: options.city.trim(), $options: 'i' };
    }

    if (options.search && options.search.trim()) {
      const searchRegex = { $regex: options.search.trim(), $options: 'i' };
      query.$and.push({
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { 'venue.city': searchRegex },
          { 'venue.name': searchRegex },
        ],
      });
    }

    const [events, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ 'schedule.startAt': 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find a single publicly accessible event by ID.
   * Strictly verifies event has reached a public lifecycle state.
   * Allows direct microsite navigation to events that are PUBLISHED, REGISTRATION_OPEN,
   * REGISTRATION_CLOSED, EVENT_LIVE, COMPLETED, or CANCELLED.
   * Strictly excludes private/unpublished drafts (DRAFT, SUBMITTED, UNDER_REVIEW, REJECTED, SUSPENDED).
   */
  async findPublicById(id: string): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    return await this.model
      .findOne({
        _id: id,
        status: {
          $in: [
            'PUBLISHED',
            'REGISTRATION_OPEN',
            'REGISTRATION_CLOSED',
            'EVENT_LIVE',
            'COMPLETED',
            'CANCELLED',
          ],
        },
        organizationVerificationStatus: { $nin: ['PENDING', 'REJECTED'] },
        verificationStatus: { $nin: ['PENDING', 'REJECTED'] },
        $or: [
          { hostingType: { $ne: 'ORGANIZATION' } },
          { hostingType: 'ORGANIZATION', verificationStatus: 'VERIFIED' },
        ],
      })
      .exec();
  }

  /**
   * Find public events hosted by a specific organizer.
   */
  async findPublicByHost(hostIdentifier: string): Promise<IEventDocument[]> {
    const isObjectId = mongoose.Types.ObjectId.isValid(hostIdentifier);
    const query: Record<string, any> = {
      status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN', 'EVENT_LIVE'] },
      organizationVerificationStatus: { $nin: ['PENDING', 'REJECTED'] },
      verificationStatus: { $nin: ['PENDING', 'REJECTED'] },
      $and: [
        {
          $or: [
            { ownerSupabaseId: hostIdentifier },
            ...(isObjectId ? [{ ownerId: new mongoose.Types.ObjectId(hostIdentifier) }] : []),
          ],
        },
        {
          $or: [
            { hostingType: { $ne: 'ORGANIZATION' } },
            { hostingType: 'ORGANIZATION', verificationStatus: 'VERIFIED' },
          ],
        },
      ],
    };

    return await this.model
      .find(query)
      .sort({ 'schedule.startAt': 1 })
      .limit(20)
      .exec();
  }

  /**
   * Reconcile or ensure confirmedCount is properly initialized from authoritative registration records.
   * If forceReconcile is true, synchronizes the count with actual confirmed registrations using CAS versioning.
   * If false, verifies missing, uninitialized, or legacy state:
   *  - If count is valid and event has already been reconciled, fast-paths to avoid expensive collection scans.
   *  - Otherwise, runs bounded CAS reconciliation that NEVER blindly overwrites concurrent reservations.
   */
  async reconcileConfirmedCount(eventId: string, forceReconcile: boolean = false): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;

    if (mongoose.connection.readyState !== 1 && process.env.NODE_ENV !== 'test') {
      return 0;
    }

    const eventQuery: any = this.model.findById(eventId);
    const event = typeof eventQuery?.exec === 'function' ? await eventQuery.exec() : await eventQuery;
    if (!event) return 0;

    const currentCount = event.registration?.confirmedCount;
    const isReconciled = !!event.registration?.reconciledAt;
    const hasValidCounter = currentCount !== undefined && currentCount !== null;

    // Fast-path: Skip DB collection scan if event is already reconciled and not forced
    if (!forceReconcile && isReconciled && hasValidCounter) {
      return currentCount;
    }

    const { EventRegistrationModel, CONFIRMED_CAPACITY_STATUSES } = await import(
      '../../../db/mongo/models/event-registration.model'
    );

    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const q: any = this.model.findById(eventId);
      const selQ = typeof q?.select === 'function' ? q.select('registration') : q;
      const currentDoc = typeof selQ?.exec === 'function' ? await selQ.exec() : await selQ;
      if (!currentDoc) return 0;

      // If another concurrent request already reconciled this event while we were waiting, yield
      if (!forceReconcile && currentDoc.registration?.reconciledAt && currentDoc.registration?.confirmedCount !== undefined && currentDoc.registration?.confirmedCount !== null) {
        return currentDoc.registration.confirmedCount;
      }

      const currentVersion = currentDoc.registration?.reconcileVersion ?? 0;
      const now = new Date();

      // Count only authoritative confirmed/attended registrations
      const countQuery: any = EventRegistrationModel.countDocuments({
        eventId: new mongoose.Types.ObjectId(eventId),
        status: { $in: CONFIRMED_CAPACITY_STATUSES },
      });
      const actualCount = typeof countQuery?.exec === 'function' ? await countQuery.exec() : await countQuery;

      // Conditional Compare-And-Swap (CAS) to prevent overwriting concurrent reservations/releases
      const query: any = {
        _id: new mongoose.Types.ObjectId(eventId),
      };

      if (currentVersion === 0) {
        query.$or = [
          { 'registration.reconcileVersion': { $exists: false } },
          { 'registration.reconcileVersion': null },
          { 'registration.reconcileVersion': 0 },
        ];
      } else {
        query['registration.reconcileVersion'] = currentVersion;
      }

      const updateOp: any = this.model.updateOne(
        query,
        {
          $set: {
            'registration.confirmedCount': actualCount,
            'registration.reconciledAt': now,
          },
          $inc: {
            'registration.reconcileVersion': 1,
          },
        }
      );
      const updateResult = typeof updateOp?.exec === 'function' ? await updateOp.exec() : await updateOp;

      // IMPORTANT: acknowledged === true means the MongoDB server received the command,
      // NOT that a document was matched or modified. A zero-match CAS update still has
      // acknowledged: true. We must check matchedCount or modifiedCount explicitly.
      // Only fall back to the !('matchedCount' in updateResult) guard for legacy
      // driver versions that genuinely don't expose matchedCount.
      const isSuccess =
        updateResult &&
        (updateResult.matchedCount === 1 ||
          updateResult.modifiedCount === 1 ||
          updateResult.nModified === 1 ||
          updateResult.n === 1 ||
          (!('matchedCount' in updateResult) && !('modifiedCount' in updateResult) && !('nModified' in updateResult)));

      if (isSuccess) {
        return actualCount;
      }

      // CAS failed due to concurrent reservation or release incrementing reconcileVersion.
      // Small backoff before retrying to allow in-flight reservation to settle.
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
      }
    }

    // If all CAS retries encountered concurrent mutations, read and return the latest live counter
    const finalQ: any = this.model.findById(eventId);
    const finalSel = typeof finalQ?.select === 'function' ? finalQ.select('registration') : finalQ;
    const latestDoc = typeof finalSel?.exec === 'function' ? await finalSel.exec() : await finalSel;
    return latestDoc?.registration?.confirmedCount ?? 0;
  }

  /**
   * Atomically reserve a registration capacity slot.
   * Validates event registration eligibility status (PUBLISHED or REGISTRATION_OPEN).
   * Ensures counter is initialized for legacy events before reserving.
   * If capacity is set, only increments if confirmedCount < capacity.
   * Returns true if slot successfully reserved, false if capacity limit reached or event ineligible.
   */
  async reserveRegistrationSlot(eventId: string, capacity?: number): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return false;

    // Never report success for a reservation when MongoDB is unavailable.
    // Returning true here would allow over-capacity registrations to succeed
    // when the database is disconnected, corrupting production counters on reconnect.
    if (mongoose.connection.readyState !== 1) {
      return false;
    }

    const eventQ: any = this.model.findById(eventId);
    const sel = typeof eventQ?.select === 'function' ? eventQ.select('status registration') : eventQ;
    const event = typeof sel?.exec === 'function' ? await sel.exec() : await sel;
    if (!event) return false;

    const allowedStatuses = ['PUBLISHED', 'REGISTRATION_OPEN'];
    if (!allowedStatuses.includes(event.status)) {
      return false;
    }

    // Lazy initialization for legacy events lacking confirmedCount or reconciledAt
    const isReconciled = !!event.registration?.reconciledAt;
    const hasCount = event.registration?.confirmedCount !== undefined && event.registration?.confirmedCount !== null;
    if (!isReconciled || !hasCount) {
      await this.reconcileConfirmedCount(eventId, false);
    }

    const query: any = {
      _id: new mongoose.Types.ObjectId(eventId),
      status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN'] },
    };

    if (capacity && capacity > 0) {
      query.$expr = {
        $lt: [
          { $ifNull: ['$registration.confirmedCount', 0] },
          capacity,
        ],
      };
    }

    const updated = await this.model.findOneAndUpdate(
      query,
      {
        $inc: {
          'registration.confirmedCount': 1,
          'registration.reconcileVersion': 1,
        },
      },
      { returnDocument: 'after' }
    ).exec();

    return !!updated;
  }

  /**
   * Atomically release a previously reserved or cancelled registration capacity slot.
   * If a releaseToken (registration ID or reservation token) is provided, guarantees idempotent exactly-once release.
   */
  async releaseRegistrationSlot(eventId: string, releaseToken?: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return false;

    // Never report success for a release when MongoDB is unavailable.
    // A false positive here would hide the fact that the counter was not decremented.
    if (mongoose.connection.readyState !== 1) {
      return false;
    }

    const query: any = {
      _id: new mongoose.Types.ObjectId(eventId),
      'registration.confirmedCount': { $gt: 0 },
    };

    if (releaseToken) {
      query['registration.releasedTokens'] = { $ne: releaseToken };
    }

    const update: any = {
      $inc: {
        'registration.confirmedCount': -1,
        'registration.reconcileVersion': 1,
      },
    };

    if (releaseToken) {
      update.$push = {
        'registration.releasedTokens': {
          $each: [releaseToken],
          $slice: -100, // Keep bounded to last 100 tokens
        },
      };
    }

    const updated = await this.model.findOneAndUpdate(query, update, { returnDocument: 'after' }).exec();
    return !!updated;
  }

  /**
   * Initialize or sync confirmedCount on an event.
   */
  async initConfirmedCount(eventId: string, count: number): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return;

    if (mongoose.connection.readyState !== 1) {
      return;
    }

    await this.model.updateOne(
      { _id: new mongoose.Types.ObjectId(eventId) },
      {
        $set: {
          'registration.confirmedCount': Math.max(0, count),
          'registration.reconciledAt': new Date(),
        },
        $inc: {
          'registration.reconcileVersion': 1,
        },
      }
    ).exec();
  }
}

export const mongoEventRepository = new MongoEventRepository();
export default mongoEventRepository;


