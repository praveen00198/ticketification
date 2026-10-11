import mongoose, { Schema, Document, Model } from 'mongoose';

export type EventType =
  | 'CONFERENCE'
  | 'HACKATHON'
  | 'CONCERT'
  | 'FESTIVAL'
  | 'WORKSHOP'
  | 'COLLEGE_EVENT'
  | 'SPORTS_EVENT'
  | 'EXHIBITION'
  | 'AWARD_CEREMONY'
  | 'CORPORATE_EVENT'
  | 'CULTURAL_EVENT'
  | 'WEDDING'
  | 'OTHER';

export const EVENT_TYPES: EventType[] = [
  'CONFERENCE',
  'HACKATHON',
  'CONCERT',
  'FESTIVAL',
  'WORKSHOP',
  'COLLEGE_EVENT',
  'SPORTS_EVENT',
  'EXHIBITION',
  'AWARD_CEREMONY',
  'CORPORATE_EVENT',
  'CULTURAL_EVENT',
  'WEDDING',
  'OTHER',
];

export type AttendanceMode =
  | 'TICKETIFICATION_REGISTRATION'
  | 'EXISTING_ATTENDEE_DATA';

export const ATTENDANCE_MODES: AttendanceMode[] = [
  'TICKETIFICATION_REGISTRATION',
  'EXISTING_ATTENDEE_DATA',
];

export type VenueType = 'PHYSICAL' | 'ONLINE' | 'HYBRID';

export const VENUE_TYPES: VenueType[] = ['PHYSICAL', 'ONLINE', 'HYBRID'];

export type EventStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'EVENT_LIVE'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'CANCELLED';

export const EVENT_STATUSES: EventStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'EVENT_LIVE',
  'COMPLETED',
  'ARCHIVED',
  'REJECTED',
  'SUSPENDED',
  'CANCELLED',
];

export interface IEventVenue {
  type: VenueType;
  name?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  onlineDescription?: string;
}

export interface IEventSchedule {
  startAt: Date;
  endAt: Date;
  timezone: string;
}

export interface IEventRegistration {
  pricingModel?: 'FREE' | 'PAID';
  registrationRequired?: boolean;
  capacity?: number;
}

export type EventVerificationLevel = 'UNVERIFIED' | 'LOW' | 'MEDIUM' | 'HIGH';
export type EventVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export const EVENT_VERIFICATION_LEVELS: EventVerificationLevel[] = ['UNVERIFIED', 'LOW', 'MEDIUM', 'HIGH'];
export const EVENT_VERIFICATION_STATUSES: EventVerificationStatus[] = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];

export interface IEventStatusHistory {
  fromStatus: EventStatus;
  toStatus: EventStatus;
  changedBy: mongoose.Types.ObjectId;
  changedBySupabaseId: string;
  reason?: string;
  timestamp: Date;
}

export interface IEvent {
  ownerId: mongoose.Types.ObjectId;
  ownerSupabaseId: string;
  eventType: EventType;
  name: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology: string;
  attendanceMode: AttendanceMode;
  venue: IEventVenue;
  schedule: IEventSchedule;
  registration?: IEventRegistration;
  status: EventStatus;
  verificationLevel?: EventVerificationLevel;
  verificationStatus?: EventVerificationStatus;
  institutionId?: mongoose.Types.ObjectId;
  statusHistory?: IEventStatusHistory[];
  cancellationReason?: string;
  cancelledAt?: Date;
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEventDocument extends IEvent, Document {
  createdAt: Date;
  updatedAt: Date;
}

const EventVenueSchema = new Schema<IEventVenue>(
  {
    type: {
      type: String,
      enum: {
        values: VENUE_TYPES,
        message: 'Invalid venue type: {VALUE}',
      },
      required: true,
      default: 'PHYSICAL',
    },
    name: {
      type: String,
      trim: true,
      maxlength: [150, 'Venue name cannot exceed 150 characters'],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Venue address cannot exceed 200 characters'],
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    region: {
      type: String,
      trim: true,
      maxlength: [100, 'Region/State cannot exceed 100 characters'],
    },
    country: {
      type: String,
      trim: true,
      maxlength: [100, 'Country cannot exceed 100 characters'],
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Postal code cannot exceed 20 characters'],
    },
    onlineDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Online meeting description cannot exceed 500 characters'],
    },
  },
  { _id: false }
);

const EventScheduleSchema = new Schema<IEventSchedule>(
  {
    startAt: {
      type: Date,
      required: [true, 'Event startAt timestamp is required'],
    },
    endAt: {
      type: Date,
      required: [true, 'Event endAt timestamp is required'],
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
      default: 'UTC',
      trim: true,
    },
  },
  { _id: false }
);

const EventRegistrationSchema = new Schema<IEventRegistration>(
  {
    pricingModel: {
      type: String,
      enum: ['FREE', 'PAID'],
      default: 'FREE',
    },
    registrationRequired: {
      type: Boolean,
      default: true,
    },
    capacity: {
      type: Number,
      min: [1, 'Capacity must be at least 1'],
    },
  },
  { _id: false }
);

const EventStatusHistorySchema = new Schema<IEventStatusHistory>(
  {
    fromStatus: {
      type: String,
      enum: EVENT_STATUSES,
      required: true,
    },
    toStatus: {
      type: String,
      enum: EVENT_STATUSES,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedBySupabaseId: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const EventSchema = new Schema<IEventDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ownerId is required'],
      index: true,
    },
    ownerSupabaseId: {
      type: String,
      required: [true, 'ownerSupabaseId is required'],
      index: true,
    },
    eventType: {
      type: String,
      enum: {
        values: EVENT_TYPES,
        message: 'Invalid eventType: {VALUE}',
      },
      required: [true, 'eventType is required'],
    },
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      minlength: [2, 'Event name must be at least 2 characters'],
      maxlength: [120, 'Event name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    bannerUrl: {
      type: String,
      trim: true,
    },
    credentialTerminology: {
      type: String,
      required: [true, 'credentialTerminology is required'],
      trim: true,
      minlength: [2, 'Credential terminology must be at least 2 characters'],
      maxlength: [50, 'Credential terminology cannot exceed 50 characters'],
      default: 'Ticket',
    },
    attendanceMode: {
      type: String,
      enum: {
        values: ATTENDANCE_MODES,
        message: 'Invalid attendanceMode: {VALUE}',
      },
      required: [true, 'attendanceMode is required'],
      default: 'TICKETIFICATION_REGISTRATION',
    },
    venue: {
      type: EventVenueSchema,
      required: [true, 'Venue configuration is required'],
    },
    schedule: {
      type: EventScheduleSchema,
      required: [true, 'Schedule configuration is required'],
    },
    registration: {
      type: EventRegistrationSchema,
      default: () => ({ pricingModel: 'FREE', registrationRequired: true }),
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUSES,
        message: 'Invalid status: {VALUE}',
      },
      default: 'DRAFT',
      required: true,
      index: true,
    },
    verificationLevel: {
      type: String,
      enum: {
        values: EVENT_VERIFICATION_LEVELS,
        message: 'Invalid verificationLevel: {VALUE}',
      },
      default: 'UNVERIFIED',
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: {
        values: EVENT_VERIFICATION_STATUSES,
        message: 'Invalid verificationStatus: {VALUE}',
      },
      default: 'UNVERIFIED',
      index: true,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
    },
    statusHistory: {
      type: [EventStatusHistorySchema],
      default: [],
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    cancelledAt: {
      type: Date,
    },
    suspensionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    suspendedAt: {
      type: Date,
    },
    suspendedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'events',
  }
);

// Compound Indexes for fast owner queries and filtering
EventSchema.index({ ownerId: 1, createdAt: -1 });
EventSchema.index({ ownerSupabaseId: 1, createdAt: -1 });
EventSchema.index({ ownerId: 1, status: 1 });
EventSchema.index({ ownerId: 1, eventType: 1 });
EventSchema.index({ name: 'text', description: 'text' });

export const EventModel: Model<IEventDocument> =
  mongoose.models.Event || mongoose.model<IEventDocument>('Event', EventSchema);

export default EventModel;
