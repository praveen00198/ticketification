import mongoose, { Schema, Document, Model } from 'mongoose';

export type CredentialUsagePolicy = 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER';
export const CREDENTIAL_USAGE_POLICIES: CredentialUsagePolicy[] = [
  'SINGLE_USE',
  'REUSABLE',
  'REUSABLE_WORKER',
];

export type CredentialStatus = 'ACTIVE' | 'CHECKED_IN' | 'REVOKED' | 'EXPIRED';
export const CREDENTIAL_STATUSES: CredentialStatus[] = [
  'ACTIVE',
  'CHECKED_IN',
  'REVOKED',
  'EXPIRED',
];

export interface ICredentialHolder {
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  designation?: string | null;
  teamId?: mongoose.Types.ObjectId | null;
  category: string;
  isAssigned: boolean;
}

export interface ICredentialAsset {
  storagePath?: string | null;
  publicUrl?: string | null;
  renderedAt?: Date | null;
  mimeType: string;
}

export interface IEventCredentialDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  sequenceNumber: number;
  formattedId: string;
  verificationToken: string;
  credentialType: string;
  terminology: string;
  usagePolicy: CredentialUsagePolicy;
  status: CredentialStatus;
  holder: ICredentialHolder;
  asset: ICredentialAsset;
  metadata?: Record<string, any>;
  createdBy: mongoose.Types.ObjectId;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  checkInCount: number;
  firstCheckedInAt?: Date | null;
  lastCheckedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CredentialHolderSchema = new Schema<ICredentialHolder>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, default: null },
    phone: { type: String, trim: true, default: null },
    organization: { type: String, trim: true, default: null },
    designation: { type: String, trim: true, default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'EventTeam', default: null },
    category: { type: String, trim: true, default: 'General' },
    isAssigned: { type: Boolean, default: true },
  },
  { _id: false }
);

const CredentialAssetSchema = new Schema<ICredentialAsset>(
  {
    storagePath: { type: String, trim: true, default: null },
    publicUrl: { type: String, trim: true, default: null },
    renderedAt: { type: Date, default: null },
    mimeType: { type: String, default: 'image/png' },
  },
  { _id: false }
);

export const EventCredentialSchema = new Schema<IEventCredentialDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    formattedId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    verificationToken: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
    },
    credentialType: {
      type: String,
      required: true,
      trim: true,
      default: 'ATTENDEE',
      maxlength: 50,
    },
    terminology: {
      type: String,
      required: true,
      trim: true,
      default: 'Ticket',
      maxlength: 50,
    },
    usagePolicy: {
      type: String,
      enum: CREDENTIAL_USAGE_POLICIES,
      default: 'SINGLE_USE',
    },
    status: {
      type: String,
      enum: CREDENTIAL_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    holder: {
      type: CredentialHolderSchema,
      required: true,
    },
    asset: {
      type: CredentialAssetSchema,
      default: () => ({ mimeType: 'image/png' }),
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    checkInCount: {
      type: Number,
      default: 0,
    },
    firstCheckedInAt: {
      type: Date,
      default: null,
    },
    lastCheckedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'event_credentials',
  }
);

// Compound & Performance Indexes
EventCredentialSchema.index({ eventId: 1, sequenceNumber: 1 }, { unique: true });
EventCredentialSchema.index({ verificationToken: 1 }, { unique: true });
EventCredentialSchema.index(
  { eventId: 1, 'metadata.importKey': 1 },
  { unique: true, partialFilterExpression: { 'metadata.importKey': { $type: 'string' } } }
);
EventCredentialSchema.index({ eventId: 1, status: 1 });
EventCredentialSchema.index({ eventId: 1, credentialType: 1 });
EventCredentialSchema.index({ eventId: 1, 'holder.email': 1 });
EventCredentialSchema.index({ eventId: 1, 'holder.teamId': 1 });
EventCredentialSchema.index({ eventId: 1, 'asset.storagePath': 1, _id: 1 });
EventCredentialSchema.index({ eventId: 1, status: 1, sequenceNumber: 1 });
EventCredentialSchema.index({ eventId: 1, _id: 1 });

export const EventCredentialModel: Model<IEventCredentialDocument> =
  mongoose.models.EventCredential ||
  mongoose.model<IEventCredentialDocument>('EventCredential', EventCredentialSchema);
