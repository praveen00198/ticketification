import mongoose from 'mongoose';
import {
  AuditLogModel,
  IAuditLog,
  IAuditLogDocument,
} from '../../../db/mongo/models/audit-log.model';

export interface AuditLogQueryFilters {
  action?: string;
  actorId?: string;
  targetEntity?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class MongoAuditLogRepository {
  constructor(private model: typeof AuditLogModel = AuditLogModel) {}

  /**
   * Appends an immutable audit log entry.
   */
  async create(data: Partial<IAuditLog>): Promise<IAuditLogDocument> {
    return await this.model.create(data);
  }

  /**
   * Queries paginated audit logs scoped strictly to an eventId.
   */
  async findByEvent(
    eventId: string,
    filters: AuditLogQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<{
    logs: IAuditLogDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {
      eventId: new mongoose.Types.ObjectId(eventId),
    };

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.actorId && mongoose.Types.ObjectId.isValid(filters.actorId)) {
      query.actorId = new mongoose.Types.ObjectId(filters.actorId);
    }

    if (filters.targetEntity) {
      query.targetEntity = filters.targetEntity;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email')
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Finds recent audit entries initiated by an actor.
   */
  async findByActor(
    actorId: string,
    limit = 50
  ): Promise<IAuditLogDocument[]> {
    return await this.model
      .find({ actorId: new mongoose.Types.ObjectId(actorId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}

export const mongoAuditLogRepository = new MongoAuditLogRepository();
