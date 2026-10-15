import mongoose, { Schema, Document, Model } from 'mongoose';

export type JobType = 'IMPORT_CREDENTIALS' | 'BULK_RENDER_ASSETS' | 'EXPORT_CREDENTIALS';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface IJobProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  percentage: number;
}

export interface IJobErrorEntry {
  row?: number;
  identifier?: string;
  error: string;
}

export interface IJobResult {
  importedCount: number;
  renderedCount: number;
  exportedCount?: number;
  downloadUrl?: string | null;
  storagePath?: string | null;
  fileSizeBytes?: number | null;
  errorLog: IJobErrorEntry[];
}

export interface IEventJobDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  jobType: JobType;
  status: JobStatus;
  progress: IJobProgress;
  payload: Record<string, any>;
  result: IJobResult;
  errorMessage?: string | null;
  createdBy: mongoose.Types.ObjectId;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  lockedBy?: string | null;
  lockExpiresAt?: Date | null;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date | null;
  failureReason?: string | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const JobProgressSchema = new Schema<IJobProgress>(
  {
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    succeeded: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  { _id: false }
);

const JobErrorEntrySchema = new Schema<IJobErrorEntry>(
  {
    row: { type: Number },
    identifier: { type: String },
    error: { type: String, required: true },
  },
  { _id: false }
);

const JobResultSchema = new Schema<IJobResult>(
  {
    importedCount: { type: Number, default: 0 },
    renderedCount: { type: Number, default: 0 },
    exportedCount: { type: Number, default: 0 },
    downloadUrl: { type: String, default: null },
    storagePath: { type: String, default: null },
    fileSizeBytes: { type: Number, default: 0 },
    errorLog: { type: [JobErrorEntrySchema], default: [] },
  },
  { _id: false }
);

const EventJobSchema = new Schema<IEventJobDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      required: true,
      enum: ['IMPORT_CREDENTIALS', 'BULK_RENDER_ASSETS', 'EXPORT_CREDENTIALS'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      index: true,
    },
    progress: {
      type: JobProgressSchema,
      default: () => ({
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      }),
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: JobResultSchema,
      default: () => ({
        importedCount: 0,
        renderedCount: 0,
        errorLog: [],
      }),
    },
    errorMessage: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    lockExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    nextRunAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'event_jobs',
  }
);

// Indexes for high-throughput lookup and queue monitoring
EventJobSchema.index({ eventId: 1, createdAt: -1 });
EventJobSchema.index({ status: 1, createdAt: 1 });
EventJobSchema.index({ status: 1, lockExpiresAt: 1, nextRunAt: 1, createdAt: 1 });

export const EventJobModel: Model<IEventJobDocument> =
  (mongoose.models.EventJob as Model<IEventJobDocument>) ||
  mongoose.model<IEventJobDocument>('EventJob', EventJobSchema);
