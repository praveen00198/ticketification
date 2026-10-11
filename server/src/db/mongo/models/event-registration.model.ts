import mongoose, { Schema, Document, Model } from 'mongoose';

export type RegistrationStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'ATTENDED';
export const REGISTRATION_STATUSES: RegistrationStatus[] = [
  'CONFIRMED',
  'WAITLISTED',
  'CANCELLED',
  'ATTENDED',
];

export interface IRegistrationAttendeeDetails {
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  designation?: string | null;
  teamName?: string | null;
}

export interface IEventRegistrationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userSupabaseId: string;
  credentialId?: mongoose.Types.ObjectId | null;
  status: RegistrationStatus;
  registrationType: string;
  attendeeDetails: IRegistrationAttendeeDetails;
  responses: Record<string, any>;
  teamId?: mongoose.Types.ObjectId | null;
  registeredAt: Date;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttendeeDetailsSchema = new Schema<IRegistrationAttendeeDetails>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
    phone: { type: String, trim: true, default: null },
    organization: { type: String, trim: true, default: null },
    designation: { type: String, trim: true, default: null },
    teamName: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const EventRegistrationSchema = new Schema<IEventRegistrationDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userSupabaseId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    credentialId: {
      type: Schema.Types.ObjectId,
      ref: 'EventCredential',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: 'CONFIRMED',
      index: true,
    },
    registrationType: {
      type: String,
      default: 'ATTENDEE',
      trim: true,
      maxlength: 50,
    },
    attendeeDetails: {
      type: AttendeeDetailsSchema,
      required: true,
    },
    responses: {
      type: Schema.Types.Mixed,
      default: {},
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'EventTeam',
      default: null,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'event_registrations',
    bufferCommands: false,
  }
);

// Compound indexes
EventRegistrationSchema.index({ eventId: 1, userId: 1 });
EventRegistrationSchema.index({ eventId: 1, userSupabaseId: 1 });
EventRegistrationSchema.index({ eventId: 1, status: 1 });
EventRegistrationSchema.index({ userSupabaseId: 1, status: 1 });
EventRegistrationSchema.index({ eventId: 1, 'attendeeDetails.email': 1 });

export const EventRegistrationModel: Model<IEventRegistrationDocument> =
  mongoose.models.EventRegistration ||
  mongoose.model<IEventRegistrationDocument>('EventRegistration', EventRegistrationSchema);

export default EventRegistrationModel;
