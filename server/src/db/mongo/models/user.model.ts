import mongoose, { Schema, Document, Model } from 'mongoose';

export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export type InstitutionType =
  | 'COLLEGE_UNIVERSITY'
  | 'CORPORATE'
  | 'COMMUNITY_CLUB'
  | 'INDEPENDENT';

export type WorkspaceStatus = 'ACTIVE' | 'SUSPENDED';
export type HostVerificationStatus = 'UNVERIFIED' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface IHostProfile {
  organizationName: string;
  institutionType: InstitutionType;
  institutionName?: string;
  website?: string;
  phone?: string;
  bio?: string;
  logoUrl?: string;
  onboardedAt: Date;
}

export interface IUser {
  supabaseUserId: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  platformRole: PlatformRole;
  status: UserStatus;
  hostProfile?: IHostProfile;
  workspaceStatus?: WorkspaceStatus;
  hostVerificationStatus?: HostVerificationStatus;
  passwordHash?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}

const HostProfileSchema = new Schema<IHostProfile>(
  {
    organizationName: {
      type: String,
      required: [true, 'organizationName is required'],
      trim: true,
      maxlength: [120, 'Organization name cannot exceed 120 characters'],
    },
    institutionType: {
      type: String,
      enum: {
        values: ['COLLEGE_UNIVERSITY', 'CORPORATE', 'COMMUNITY_CLUB', 'INDEPENDENT'],
        message: 'Invalid institutionType: {VALUE}',
      },
      required: [true, 'institutionType is required'],
    },
    institutionName: {
      type: String,
      trim: true,
      maxlength: [150, 'Institution name cannot exceed 150 characters'],
      default: null,
    },
    website: {
      type: String,
      trim: true,
      maxlength: [255, 'Website URL cannot exceed 255 characters'],
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone cannot exceed 30 characters'],
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: null,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: null,
    },
    onboardedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    supabaseUserId: {
      type: String,
      required: false,
      sparse: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address format'],
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      default: 'User',
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
    platformRole: {
      type: String,
      enum: {
        values: ['USER', 'ADMIN', 'SUPER_ADMIN'],
        message: 'Invalid platformRole: {VALUE}',
      },
      default: 'USER',
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'SUSPENDED'],
        message: 'Invalid status: {VALUE}',
      },
      default: 'ACTIVE',
      required: true,
    },
    hostProfile: {
      type: HostProfileSchema,
      default: null,
    },
    workspaceStatus: {
      type: String,
      enum: {
        values: ['ACTIVE', 'SUSPENDED'],
        message: 'Invalid workspaceStatus: {VALUE}',
      },
      default: 'ACTIVE',
    },
    hostVerificationStatus: {
      type: String,
      enum: {
        values: ['UNVERIFIED', 'LOW', 'MEDIUM', 'HIGH'],
        message: 'Invalid hostVerificationStatus: {VALUE}',
      },
      default: 'UNVERIFIED',
    },
    passwordHash: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Explicit compound indexes
UserSchema.index({ platformRole: 1, status: 1 });
UserSchema.index({ 'hostProfile.organizationName': 1 });

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default UserModel;
