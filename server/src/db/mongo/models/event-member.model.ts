import mongoose, { Schema, Document, Model } from 'mongoose';

export type EventRole =
  | 'HOST'
  | 'COORDINATOR'
  | 'VOLUNTEER'
  | 'MENTOR'
  | 'EVALUATOR';

export const EVENT_ROLES: EventRole[] = [
  'HOST',
  'COORDINATOR',
  'VOLUNTEER',
  'MENTOR',
  'EVALUATOR',
];

export type EventPermission =
  | 'MANAGE_EVENT_SETTINGS'
  | 'MANAGE_STAFF'
  | 'MANAGE_ATTENDEES'
  | 'IMPORT_ATTENDEES'
  | 'CONFIGURE_CREDENTIALS'
  | 'GENERATE_CREDENTIALS'
  | 'DOWNLOAD_CREDENTIALS'
  | 'SCAN_CREDENTIALS'
  | 'VIEW_ASSIGNED_TASKS'
  | 'UPDATE_ASSIGNED_TASKS'
  | 'MENTOR_ASSIGNED_TEAMS'
  | 'SCORE_ASSIGNED_TEAMS'
  | 'VIEW_EVALUATION_RESULTS'
  | 'EXPORT_EVENT_DATA';

export const ALL_EVENT_PERMISSIONS: EventPermission[] = [
  'MANAGE_EVENT_SETTINGS',
  'MANAGE_STAFF',
  'MANAGE_ATTENDEES',
  'IMPORT_ATTENDEES',
  'CONFIGURE_CREDENTIALS',
  'GENERATE_CREDENTIALS',
  'DOWNLOAD_CREDENTIALS',
  'SCAN_CREDENTIALS',
  'VIEW_ASSIGNED_TASKS',
  'UPDATE_ASSIGNED_TASKS',
  'MENTOR_ASSIGNED_TEAMS',
  'SCORE_ASSIGNED_TEAMS',
  'VIEW_EVALUATION_RESULTS',
  'EXPORT_EVENT_DATA',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<EventRole, EventPermission[]> = {
  HOST: [...ALL_EVENT_PERMISSIONS],
  COORDINATOR: [
    'MANAGE_STAFF',
    'MANAGE_ATTENDEES',
    'IMPORT_ATTENDEES',
    'GENERATE_CREDENTIALS',
    'DOWNLOAD_CREDENTIALS',
    'SCAN_CREDENTIALS',
    'VIEW_ASSIGNED_TASKS',
    'UPDATE_ASSIGNED_TASKS',
    'EXPORT_EVENT_DATA',
  ],
  VOLUNTEER: [
    'VIEW_ASSIGNED_TASKS',
    'UPDATE_ASSIGNED_TASKS',
  ],
  MENTOR: [
    'MENTOR_ASSIGNED_TEAMS',
  ],
  EVALUATOR: [
    'SCORE_ASSIGNED_TEAMS',
    'VIEW_EVALUATION_RESULTS',
  ],
};

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

export const MEMBER_STATUSES: MemberStatus[] = ['INVITED', 'ACTIVE', 'REVOKED'];

export interface IEventMember {
  eventId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userEmail: string;
  role: EventRole;
  permissions: EventPermission[];
  status: MemberStatus;
  invitationToken?: string;
  invitationExpiresAt?: Date;
  invitedBy: mongoose.Types.ObjectId;
  acceptedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEventMemberDocument extends IEventMember, Document {
  createdAt: Date;
  updatedAt: Date;
}

const EventMemberSchema = new Schema<IEventMemberDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userEmail: {
      type: String,
      required: [true, 'userEmail is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: EVENT_ROLES,
        message: 'Invalid event role: {VALUE}',
      },
      required: [true, 'role is required'],
      index: true,
    },
    permissions: {
      type: [String],
      enum: ALL_EVENT_PERMISSIONS,
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: MEMBER_STATUSES,
        message: 'Invalid member status: {VALUE}',
      },
      default: 'INVITED',
      required: true,
      index: true,
    },
    invitationToken: {
      type: String,
      select: false,
      index: true,
    },
    invitationExpiresAt: {
      type: Date,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'invitedBy is required'],
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'event_members',
  }
);

// Compound indexes for rapid lookup and uniqueness
EventMemberSchema.index({ eventId: 1, userEmail: 1 }, { unique: true });
EventMemberSchema.index({ eventId: 1, userId: 1 });
EventMemberSchema.index({ eventId: 1, status: 1 });
EventMemberSchema.index({ eventId: 1, role: 1 });

export const EventMemberModel: Model<IEventMemberDocument> =
  mongoose.models.EventMember ||
  mongoose.model<IEventMemberDocument>('EventMember', EventMemberSchema);

export default EventMemberModel;
