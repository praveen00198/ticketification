import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEventSequenceCounterDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  lastSequenceNumber: number;
  updatedAt: Date;
}

const EventSequenceCounterSchema = new Schema<IEventSequenceCounterDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      unique: true,
      index: true,
    },
    lastSequenceNumber: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'event_sequence_counters',
  }
);

export const EventSequenceCounterModel: Model<IEventSequenceCounterDocument> =
  mongoose.models.EventSequenceCounter ||
  mongoose.model<IEventSequenceCounterDocument>(
    'EventSequenceCounter',
    EventSequenceCounterSchema
  );
