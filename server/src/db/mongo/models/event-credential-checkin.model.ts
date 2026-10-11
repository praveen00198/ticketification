import mongoose, { Schema, Document, Model } from 'mongoose';
import { CredentialUsagePolicy } from './event-credential.model';

export type CheckinScanStatus =
  | 'SUCCESS'
  | 'ALREADY_CHECKED_IN'
  | 'REVOKED'
  | 'EXPIRED'
  | 'UNAUTHORIZED';

export interface ICheckinHolderSnapshot {
  name: string;
  category: string;
  formattedId: string;
}

export interface IEventCredentialCheckinDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  credentialId: mongoose.Types.ObjectId;
  scannedBy: mongoose.Types.ObjectId;
  scannerEmail: string;
  scannerRole: string;
  scannedAt: Date;
  scanStatus: CheckinScanStatus;
  usagePolicy: CredentialUsagePolicy;
  gate: string;
  holderSnapshot: ICheckinHolderSnapshot;
  notes?: string | null;
  createdAt: Date;
}

const CheckinHolderSnapshotSchema = new Schema<ICheckinHolderSnapshot>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true, default: 'PARTICIPANT' },
    formattedId: { type: String, required: true },
  },
  { _id: false }
);

const EventCredentialCheckinSchema = new Schema<IEventCredentialCheckinDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    credentialId: {
      type: Schema.Types.ObjectId,
      ref: 'EventCredential',
      required: true,
      index: true,
    },
    scannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scannerEmail: {
      type: String,
      required: true,
    },
    scannerRole: {
      type: String,
      required: true,
      default: 'STAFF',
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    scanStatus: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'ALREADY_CHECKED_IN', 'REVOKED', 'EXPIRED', 'UNAUTHORIZED'],
      index: true,
    },
    usagePolicy: {
      type: String,
      required: true,
      enum: ['SINGLE_USE', 'REUSABLE', 'REUSABLE_WORKER'],
    },
    gate: {
      type: String,
      required: true,
      default: 'Main Gate',
      trim: true,
    },
    holderSnapshot: {
      type: CheckinHolderSnapshotSchema,
      required: true,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'event_credential_checkins',
  }
);

// High-throughput query indexes
EventCredentialCheckinSchema.index({ eventId: 1, scannedAt: -1 });
EventCredentialCheckinSchema.index({ credentialId: 1, scannedAt: -1 });
EventCredentialCheckinSchema.index({ eventId: 1, scanStatus: 1 });
EventCredentialCheckinSchema.index({ eventId: 1, gate: 1 });

export const EventCredentialCheckinModel: Model<IEventCredentialCheckinDocument> =
  (mongoose.models.EventCredentialCheckin as Model<IEventCredentialCheckinDocument>) ||
  mongoose.model<IEventCredentialCheckinDocument>(
    'EventCredentialCheckin',
    EventCredentialCheckinSchema
  );
