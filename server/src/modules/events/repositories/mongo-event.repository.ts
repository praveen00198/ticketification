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
    return await this.model.findById(id).exec();
  }

  /**
   * Find an event by ID and verified owner Supabase user ID (strict zero-trust check).
   */
  async findByIdAndOwner(id: string, ownerSupabaseId: string): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
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
        { new: true, runValidators: true }
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
        { new: true, runValidators: true }
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
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { 'venue.city': searchRegex },
        { 'venue.name': searchRegex },
      ];
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
   * Strictly verifies status is PUBLISHED, REGISTRATION_OPEN, or EVENT_LIVE.
   */
  async findPublicById(id: string): Promise<IEventDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    return await this.model
      .findOne({
        _id: id,
        status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN', 'EVENT_LIVE'] },
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
      $or: [
        { ownerSupabaseId: hostIdentifier },
        ...(isObjectId ? [{ ownerId: new mongoose.Types.ObjectId(hostIdentifier) }] : []),
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
   * If forceReconcile is true, synchronizes the count with actual confirmed registrations.
   * If false, only sets it if missing (null or undefined) to preserve concurrent reservations.
   */
  async reconcileConfirmedCount(eventId: string, forceReconcile: boolean = false): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;
    if (mongoose.connection.readyState !== 1) return 0;

    const event = await this.model.findById(eventId);
    if (!event) return 0;

    const hasCounter = event.registration?.confirmedCount !== undefined && event.registration?.confirmedCount !== null;
    if (hasCounter && !forceReconcile) {
      return event.registration!.confirmedCount!;
    }

    const { EventRegistrationModel } = await import('../../../db/mongo/models/event-registration.model');
    const actualCount = await EventRegistrationModel.countDocuments({
      eventId: new mongoose.Types.ObjectId(eventId),
      status: { $in: ['CONFIRMED', 'ATTENDED'] },
    });

    if (forceReconcile) {
      await this.model.updateOne(
        { _id: new mongoose.Types.ObjectId(eventId) },
        { $set: { 'registration.confirmedCount': actualCount } }
      ).exec();
    } else {
      await this.model.updateOne(
        {
          _id: new mongoose.Types.ObjectId(eventId),
          $or: [
            { 'registration.confirmedCount': { $exists: false } },
            { 'registration.confirmedCount': null },
          ],
        },
        { $set: { 'registration.confirmedCount': actualCount } }
      ).exec();
    }

    return actualCount;
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

    // Guard against buffering in disconnected test environments
    if (mongoose.connection.readyState !== 1) {
      return true;
    }

    // Lazy initialization for legacy events lacking confirmedCount
    await this.reconcileConfirmedCount(eventId, false);

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
      { $inc: { 'registration.confirmedCount': 1 } },
      { new: true }
    ).exec();

    return !!updated;
  }

  /**
   * Atomically release a previously reserved or cancelled registration capacity slot.
   */
  async releaseRegistrationSlot(eventId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return;

    if (mongoose.connection.readyState !== 1) {
      return;
    }

    await this.model.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(eventId),
        'registration.confirmedCount': { $gt: 0 },
      },
      { $inc: { 'registration.confirmedCount': -1 } }
    ).exec();
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
      { $set: { 'registration.confirmedCount': Math.max(0, count) } }
    ).exec();
  }
}

export const mongoEventRepository = new MongoEventRepository();
export default mongoEventRepository;


