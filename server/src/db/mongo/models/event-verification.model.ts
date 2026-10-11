import mongoose, { Document, Model, Schema } from 'mongoose';

export type InstitutionType =
  | 'COLLEGE_UNIVERSITY'
  | 'CORPORATE'
  | 'NON_PROFIT'
  | 'INDEPENDENT'
  | 'GOVERNMENT';

export const INSTITUTION_TYPES: InstitutionType[] = [
  'COLLEGE_UNIVERSITY',
  'CORPORATE',
  'NON_PROFIT',
  'INDEPENDENT',
  'GOVERNMENT',
];

export type VerificationRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';
export const VERIFICATION_RISK_TIERS: VerificationRiskTier[] = ['LOW', 'MEDIUM', 'HIGH'];

export type VerificationStatus = 'DRAFT' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export const VERIFICATION_STATUSES: VerificationStatus[] = ['DRAFT', 'PENDING', 'VERIFIED', 'REJECTED'];

export interface IEventVerification {
  eventId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  institutionName: string;
  institutionType: InstitutionType;
  officialEmail: string;
  department: string;
  designation: string;
  websiteUrl?: string;
  documentUrls: string[];
  otpHash?: string;
  otpExpiresAt?: Date;
  otpVerified: boolean;
  riskScore: number;
  riskTier: VerificationRiskTier;
  riskFactors: string[];
  status: VerificationStatus;
  reviewNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEventVerificationDocument extends IEventVerification, Document {
  createdAt: Date;
  updatedAt: Date;
}

const EventVerificationSchema = new Schema<IEventVerificationDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      unique: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ownerId is required'],
      index: true,
    },
    institutionName: {
      type: String,
      required: [true, 'institutionName is required'],
      trim: true,
      maxlength: [150, 'Institution name cannot exceed 150 characters'],
    },
    institutionType: {
      type: String,
      enum: {
        values: INSTITUTION_TYPES,
        message: 'Invalid institutionType: {VALUE}',
      },
      default: 'COLLEGE_UNIVERSITY',
      required: true,
    },
    officialEmail: {
      type: String,
      required: [true, 'officialEmail is required'],
      trim: true,
      lowercase: true,
      maxlength: [150, 'Email cannot exceed 150 characters'],
    },
    department: {
      type: String,
      required: [true, 'department is required'],
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },
    designation: {
      type: String,
      required: [true, 'designation is required'],
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters'],
    },
    websiteUrl: {
      type: String,
      trim: true,
      maxlength: [200, 'Website URL cannot exceed 200 characters'],
    },
    documentUrls: {
      type: [String],
      default: [],
    },
    otpHash: {
      type: String,
      select: false, // Hidden by default from queries for security
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    riskTier: {
      type: String,
      enum: {
        values: VERIFICATION_RISK_TIERS,
        message: 'Invalid riskTier: {VALUE}',
      },
      default: 'LOW',
      index: true,
    },
    riskFactors: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: VERIFICATION_STATUSES,
        message: 'Invalid status: {VALUE}',
      },
      default: 'DRAFT',
      index: true,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review notes cannot exceed 1000 characters'],
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    submittedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'event_verifications',
  }
);

// Indexes
EventVerificationSchema.index({ status: 1, riskTier: 1, createdAt: -1 });
EventVerificationSchema.index({ ownerId: 1, createdAt: -1 });

export const EventVerificationModel: Model<IEventVerificationDocument> =
  mongoose.models.EventVerification ||
  mongoose.model<IEventVerificationDocument>('EventVerification', EventVerificationSchema);

export default EventVerificationModel;
