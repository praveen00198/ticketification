import mongoose, { Schema, Document, Model } from 'mongoose';

export type AssignmentRole = 'MENTOR' | 'EVALUATOR';
export const ASSIGNMENT_ROLES: AssignmentRole[] = ['MENTOR', 'EVALUATOR'];

export type AssignmentTargetType = 'TRACK' | 'TEAM' | 'GENERAL';
export const ASSIGNMENT_TARGET_TYPES: AssignmentTargetType[] = ['TRACK', 'TEAM', 'GENERAL'];

export type AssignmentStatus = 'ACTIVE' | 'INACTIVE';
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['ACTIVE', 'INACTIVE'];

export interface IMentorshipLog {
  authorEmail: string;
  note: string;
  timestamp: Date;
}

export interface IEventAssignmentDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  role: AssignmentRole;
  track?: string;
  assignedTargetType: AssignmentTargetType;
  targetId?: string;
  targetName: string;
  notes?: string;
  status: AssignmentStatus;
  mentorshipLogs: IMentorshipLog[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MentorshipLogSchema = new Schema<IMentorshipLog>(
  {
    authorEmail: { type: String, required: true },
    note: { type: String, required: true, maxlength: 2000 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EventAssignmentSchema = new Schema<IEventAssignmentDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'EventMember',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ASSIGNMENT_ROLES,
      required: true,
    },
    track: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    assignedTargetType: {
      type: String,
      enum: ASSIGNMENT_TARGET_TYPES,
      default: 'GENERAL',
      required: true,
    },
    targetId: {
      type: String,
      trim: true,
    },
    targetName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: 'ACTIVE',
      required: true,
    },
    mentorshipLogs: [MentorshipLogSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'event_assignments',
  }
);

// Compound indexes
EventAssignmentSchema.index({ eventId: 1, memberId: 1, targetName: 1 }, { unique: true });
EventAssignmentSchema.index({ eventId: 1, role: 1 });
EventAssignmentSchema.index({ eventId: 1, track: 1 });

export const EventAssignmentModel: Model<IEventAssignmentDocument> =
  mongoose.models.EventAssignment ||
  mongoose.model<IEventAssignmentDocument>('EventAssignment', EventAssignmentSchema);

export default EventAssignmentModel;
