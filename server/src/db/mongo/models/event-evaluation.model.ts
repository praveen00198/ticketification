import mongoose, { Schema, Document, Model } from 'mongoose';

export type EvaluationStatus = 'DRAFT' | 'SUBMITTED';
export const EVALUATION_STATUSES: EvaluationStatus[] = ['DRAFT', 'SUBMITTED'];

export interface ICriterionScore {
  criteriaKey: string;
  score: number;
  feedback?: string;
}

export interface IEventEvaluationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  rubricId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  evaluatorMemberId: mongoose.Types.ObjectId;
  evaluatorEmail: string;
  evaluatorName: string;
  scores: ICriterionScore[];
  weightedTotal: number;
  generalFeedback?: string;
  status: EvaluationStatus;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionScoreSchema = new Schema<ICriterionScore>(
  {
    criteriaKey: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0 },
    feedback: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const EventEvaluationSchema = new Schema<IEventEvaluationDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    rubricId: {
      type: Schema.Types.ObjectId,
      ref: 'EventRubric',
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'EventTeam',
      required: true,
      index: true,
    },
    evaluatorMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'EventMember',
      required: true,
      index: true,
    },
    evaluatorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    evaluatorName: {
      type: String,
      required: true,
      trim: true,
    },
    scores: {
      type: [CriterionScoreSchema],
      required: true,
      default: [],
    },
    weightedTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    generalFeedback: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: EVALUATION_STATUSES,
      default: 'SUBMITTED',
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'event_evaluations',
  }
);

// Compound unique index: Each evaluator can score a team once per event
EventEvaluationSchema.index(
  { eventId: 1, teamId: 1, evaluatorMemberId: 1 },
  { unique: true }
);
EventEvaluationSchema.index({ eventId: 1, rubricId: 1 });
EventEvaluationSchema.index({ eventId: 1, status: 1 });

export const EventEvaluationModel: Model<IEventEvaluationDocument> =
  mongoose.models.EventEvaluation ||
  mongoose.model<IEventEvaluationDocument>('EventEvaluation', EventEvaluationSchema);

export default EventEvaluationModel;
