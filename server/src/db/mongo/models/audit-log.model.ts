import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'STAFF_INVITED'
  | 'STAFF_ROLE_UPDATED'
  | 'STAFF_REMOVED'
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_REVOKED'
  | 'CREDENTIAL_STATUS_CHANGED'
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_LIFECYCLE_TRANSITION'
  | 'EVENT_SUSPENDED'
  | 'STORAGE_PURGED'
  | 'BULK_IMPORT_ENQUEUED'
  | 'BULK_RENDER_ENQUEUED'
  | 'EXPORT_ENQUEUED'
  | 'SCORE_OVERRIDDEN'
  | 'SECURITY_RATE_LIMIT_BREACH'
  | 'EVENT_REPORTED';

export interface IAuditLog {
  actorId: mongoose.Types.ObjectId | string;
  actorEmail: string;
  actorRole: string;
  eventId?: mongoose.Types.ObjectId | string | null;
  action: AuditAction | string;
  targetEntity: string;
  targetId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {
  _id: mongoose.Types.ObjectId;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    actorId: { type: Schema.Types.Mixed, required: true, index: true },
    actorEmail: { type: String, required: true, trim: true, lowercase: true },
    actorRole: { type: String, default: 'USER' },
    eventId: { type: Schema.Types.Mixed, default: null, index: true },
    action: { type: String, required: true, index: true },
    targetEntity: { type: String, required: true, index: true },
    targetId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: 'unknown' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // No updatedAt: strictly immutable
    collection: 'audit_logs',
    bufferCommands: false,
  }
);

// Compound indexes for high-throughput event filtering
AuditLogSchema.index({ eventId: 1, createdAt: -1 });
AuditLogSchema.index({ eventId: 1, action: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });

// Invariant: Enforce Write-Once, Append-Only Immutability
function preventMutation() {
  throw new Error('AuditLog documents are strictly immutable and cannot be modified or deleted.');
}

AuditLogSchema.pre('updateOne', preventMutation);
AuditLogSchema.pre('updateMany', preventMutation);
AuditLogSchema.pre('findOneAndUpdate', preventMutation);
AuditLogSchema.pre('deleteOne', { document: true, query: true }, preventMutation);
AuditLogSchema.pre('deleteMany', preventMutation);
AuditLogSchema.pre('findOneAndDelete', preventMutation);

export const AuditLogModel: Model<IAuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
