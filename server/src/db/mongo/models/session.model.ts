import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionDocument extends ISession, Document {
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISessionDocument>(
  {
    userId: {
      type: String,
      required: [true, 'userId is required'],
      index: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'tokenHash is required'],
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: [true, 'familyId is required'],
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'expiresAt is required'],
      index: { expires: 0 }, // Automatic TTL cleanup by MongoDB
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'sessions',
  }
);

// Compound indexes for session queries
SessionSchema.index({ userId: 1, revokedAt: 1 });
SessionSchema.index({ familyId: 1, revokedAt: 1 });

export const SessionModel: Model<ISessionDocument> =
  mongoose.models.Session || mongoose.model<ISessionDocument>('Session', SessionSchema);

export default SessionModel;
