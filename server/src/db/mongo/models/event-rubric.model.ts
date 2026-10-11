import mongoose, { Schema, Document, Model } from 'mongoose';

export type ScoringStatus = 'OPEN' | 'CLOSED' | 'FINALIZED';
export const SCORING_STATUSES: ScoringStatus[] = ['OPEN', 'CLOSED', 'FINALIZED'];

export interface IRubricCriterion {
  key: string;
  label: string;
  maxScore: number;
  weight: number;
  description?: string;
}

export interface IEventRubricDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  title: string;
  track?: string;
  criteria: IRubricCriterion[];
  scoringStatus: ScoringStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RubricCriterionSchema = new Schema<IRubricCriterion>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    maxScore: { type: Number, required: true, min: 1, default: 10 },
    weight: { type: Number, required: true, min: 1, default: 25 },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const EventRubricSchema = new Schema<IEventRubricDocument>(
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
      maxlength: 150,
    },
    track: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'General',
    },
    criteria: {
      type: [RubricCriterionSchema],
      required: true,
      default: [
        { key: 'innovation', label: 'Innovation & Originality', maxScore: 10, weight: 25 },
        { key: 'tech_execution', label: 'Technical Execution', maxScore: 10, weight: 35 },
        { key: 'design_ux', label: 'Design & User Experience', maxScore: 10, weight: 20 },
        { key: 'viability', label: 'Practical Impact & Viability', maxScore: 10, weight: 20 },
      ],
    },
    scoringStatus: {
      type: String,
      enum: SCORING_STATUSES,
      default: 'OPEN',
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'event_rubrics',
  }
);

EventRubricSchema.index({ eventId: 1, track: 1 });
EventRubricSchema.index({ eventId: 1, scoringStatus: 1 });

export const EventRubricModel: Model<IEventRubricDocument> =
  mongoose.models.EventRubric ||
  mongoose.model<IEventRubricDocument>('EventRubric', EventRubricSchema);

export default EventRubricModel;
