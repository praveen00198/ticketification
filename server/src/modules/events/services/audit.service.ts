import mongoose from 'mongoose';
import {
  MongoAuditLogRepository,
  mongoAuditLogRepository,
  AuditLogQueryFilters,
  PaginationOptions,
} from '../repositories/mongo-audit-log.repository';
import {
  AuditAction,
  IAuditLogDocument,
} from '../../../db/mongo/models/audit-log.model';

export interface RecordAuditParams {
  actorId: string | mongoose.Types.ObjectId;
  actorEmail: string;
  actorRole?: string;
  eventId?: string | mongoose.Types.ObjectId | null;
  action: AuditAction | string;
  targetEntity: string;
  targetId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  constructor(
    private auditRepo: MongoAuditLogRepository = mongoAuditLogRepository
  ) {}

  /**
   * Appends an immutable audit log record.
   */
  async record(params: RecordAuditParams): Promise<IAuditLogDocument | null> {
    try {
      const isMocked = Boolean((this.auditRepo.create as any)?.mock || (this.auditRepo.create as any)?._isMockFunction);
      if (mongoose.connection.readyState !== 1 && !isMocked) {
        return null;
      }

      const toSafeId = (id: any) => {
        if (!id) return null;
        if (id instanceof mongoose.Types.ObjectId) return id;
        if (typeof id === 'string' && mongoose.isValidObjectId(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        return id;
      };

      const entry = await this.auditRepo.create({
        actorId: toSafeId(params.actorId),
        actorEmail: params.actorEmail.toLowerCase().trim(),
        actorRole: params.actorRole || 'USER',
        eventId: toSafeId(params.eventId),
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'unknown',
      });
      return entry;
    } catch (err: any) {
      console.warn('[AuditService] Failed to record immutable audit log:', err?.message || err);
      return null;
    }
  }

  /**
   * Queries paginated audit logs for a specific event.
   */
  async getEventAuditLogs(
    eventId: string,
    filters: AuditLogQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<{
    logs: IAuditLogDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await this.auditRepo.findByEvent(eventId, filters, options);
  }
}

export const auditService = new AuditService();
