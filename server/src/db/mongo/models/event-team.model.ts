import mongoose, { Schema, Document, Model } from 'mongoose';

export type TeamStatus = 'REGISTERED' | 'FORMED' | 'SUBMITTED' | 'DISQUALIFIED' | 'WITHDRAWN';
export const TEAM_STATUSES: TeamStatus[] = [
  'REGISTERED',
  'FORMED',
  'SUBMITTED',
  'DISQUALIFIED',
  'WITHDRAWN',
];

export interface ITeamMember {
  name: string;
  email: string;
  role?: string;
  checkedIn?: boolean;
}

export interface IEventTeamDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  teamName: string;
  track?: string;
  tableNumber?: string;
  leaderName: string;
  leaderEmail: string;
  members: ITeamMember[];
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
  status: TeamStatus;
  submittedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
    role: { type: String, trim: true, default: 'Member', maxlength: 50 },
    checkedIn: { type: Boolean, default: false },
  },
  { _id: false }
);

const EventTeamSchema = new Schema<IEventTeamDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    teamName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    track: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'General',
    },
    tableNumber: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    leaderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    leaderEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    members: {
      type: [TeamMemberSchema],
      default: [],
    },
    projectTitle: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    projectDescription: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    repoUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    demoUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: TEAM_STATUSES,
      default: 'REGISTERED',
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'event_teams',
  }
);

// Compound indexes
EventTeamSchema.index({ eventId: 1, teamName: 1 }, { unique: true });
EventTeamSchema.index({ eventId: 1, track: 1 });
EventTeamSchema.index({ eventId: 1, status: 1 });
EventTeamSchema.index({ eventId: 1, leaderEmail: 1 });

export const EventTeamModel: Model<IEventTeamDocument> =
  mongoose.models.EventTeam ||
  mongoose.model<IEventTeamDocument>('EventTeam', EventTeamSchema);

export default EventTeamModel;
