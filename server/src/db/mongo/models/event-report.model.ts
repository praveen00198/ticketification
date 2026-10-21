import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReportCategory =
  | 'SCAM'
  | 'IMPERSONATION'
  | 'MISLEADING_INFO'
  | 'INAPPROPRIATE_CONTENT'
  | 'TECHNICAL_ISSUE'
  | 'ACCESS_ISSUE'
  | 'OTHER';

export const REPORT_CATEGORIES: ReportCategory[] = [
  'SCAM',
  'IMPERSONATION',
  'MISLEADING_INFO',
  'INAPPROPRIATE_CONTENT',
  'TECHNICAL_ISSUE',
  'ACCESS_ISSUE',
  'OTHER',
];

export type ReportStatus = 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
export const REPORT_STATUSES: ReportStatus[] = [
  'PENDING',
  'INVESTIGATING',
  'RESOLVED',
  'DISMISSED',
];

export interface IEventReport {
  eventId?: mongoose.Types.ObjectId | null;
  reporterEmail: string;
  reporterName?: string | null;
  reporterUserId?: mongoose.Types.ObjectId | string | null;
  category: ReportCategory;
  reason: string;
  status: ReportStatus;
  actionTaken?: string | null;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEventReportDocument extends IEventReport, Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EventReportSchema = new Schema<IEventReportDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
      default: null,
      index: true,
    },
    reporterEmail: {
      type: String,
      required: [true, 'reporterEmail is required'],
      trim: true,
      lowercase: true,
      maxlength: [150, 'Reporter email cannot exceed 150 characters'],
    },
    reporterName: {
      type: String,
      trim: true,
      maxlength: [120, 'Reporter name cannot exceed 120 characters'],
      default: null,
    },
    reporterUserId: {
      type: Schema.Types.Mixed,
      default: null,
    },
    category: {
      type: String,
      enum: {
        values: REPORT_CATEGORIES,
        message: 'Invalid report category: {VALUE}',
      },
      required: [true, 'category is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'reason is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: REPORT_STATUSES,
        message: 'Invalid report status: {VALUE}',
      },
      default: 'PENDING',
      index: true,
    },
    actionTaken: {
      type: String,
      trim: true,
      maxlength: [500, 'actionTaken cannot exceed 500 characters'],
      default: null,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
  },
  {
    timestamps: true,
    collection: 'event_reports',
    bufferCommands: false,
  }
);

EventReportSchema.index({ eventId: 1, createdAt: -1 });
EventReportSchema.index({ status: 1, createdAt: -1 });

export const EventReportModel: Model<IEventReportDocument> =
  mongoose.models.EventReport ||
  mongoose.model<IEventReportDocument>('EventReport', EventReportSchema);

export default EventReportModel;
