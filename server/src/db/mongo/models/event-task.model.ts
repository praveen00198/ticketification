import mongoose, { Schema, Document, Model } from 'mongoose';

export type TaskCategory =
  | 'REGISTRATION'
  | 'SECURITY'
  | 'LOGISTICS'
  | 'HOSPITALITY'
  | 'TECHNICAL'
  | 'GENERAL';

export const TASK_CATEGORIES: TaskCategory[] = [
  'REGISTRATION',
  'SECURITY',
  'LOGISTICS',
  'HOSPITALITY',
  'TECHNICAL',
  'GENERAL',
];

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const TASK_STATUSES: TaskStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const TASK_PRIORITIES: TaskPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export interface IEventTaskDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: TaskCategory;
  station: string;
  assignedMemberIds: mongoose.Types.ObjectId[];
  shiftStart?: Date;
  shiftEnd?: Date;
  status: TaskStatus;
  priority: TaskPriority;
  requiresScanning: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EventTaskSchema = new Schema<IEventTaskDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: TASK_CATEGORIES,
      default: 'GENERAL',
      required: true,
    },
    station: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    assignedMemberIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'EventMember',
      },
    ],
    shiftStart: {
      type: Date,
    },
    shiftEnd: {
      type: Date,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'PENDING',
      required: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'MEDIUM',
      required: true,
    },
    requiresScanning: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'event_tasks',
  }
);

// Compound indexes for operational query performance
EventTaskSchema.index({ eventId: 1, status: 1 });
EventTaskSchema.index({ eventId: 1, station: 1 });
EventTaskSchema.index({ eventId: 1, assignedMemberIds: 1 });

export const EventTaskModel: Model<IEventTaskDocument> =
  mongoose.models.EventTask ||
  mongoose.model<IEventTaskDocument>('EventTask', EventTaskSchema);

export default EventTaskModel;
