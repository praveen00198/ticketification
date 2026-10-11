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
}

export const mongoEventRepository = new MongoEventRepository();
export default mongoEventRepository;

