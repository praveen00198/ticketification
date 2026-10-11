import mongoose from 'mongoose';
import {
  EventRubricModel,
  IEventRubricDocument,
  IRubricCriterion,
  ScoringStatus,
} from '../../../db/mongo/models/event-rubric.model';

export interface CreateRubricInput {
  eventId: mongoose.Types.ObjectId | string;
  title: string;
  track?: string;
  criteria?: IRubricCriterion[];
  scoringStatus?: ScoringStatus;
  createdBy: mongoose.Types.ObjectId | string;
}

export interface UpdateRubricInput {
  title?: string;
  track?: string;
  criteria?: IRubricCriterion[];
  scoringStatus?: ScoringStatus;
}

export class MongoEventRubricRepository {
  async createRubric(data: CreateRubricInput): Promise<IEventRubricDocument> {
    const rubric = new EventRubricModel({
      ...data,
      eventId: new mongoose.Types.ObjectId(data.eventId),
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
      track: data.track ? data.track.trim() : 'General',
    });
    return await rubric.save();
  }

  async findById(rubricId: mongoose.Types.ObjectId | string): Promise<IEventRubricDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(rubricId)) return null;
    return await EventRubricModel.findById(rubricId).exec();
  }

  async findByIdAndEvent(
    rubricId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<IEventRubricDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(rubricId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }
    return await EventRubricModel.findOne({
      _id: new mongoose.Types.ObjectId(rubricId),
      eventId: new mongoose.Types.ObjectId(eventId),
    }).exec();
  }

  async findByEvent(
    eventId: mongoose.Types.ObjectId | string,
    track?: string
  ): Promise<IEventRubricDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (track && track !== 'ALL') {
      query.track = track;
    }

    return await EventRubricModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async updateRubric(
    rubricId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string,
    data: UpdateRubricInput
  ): Promise<IEventRubricDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(rubricId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }

    return await EventRubricModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(rubricId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { $set: data },
      { new: true }
    ).exec();
  }

  async deleteRubric(
    rubricId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(rubricId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return false;
    }

    const result = await EventRubricModel.deleteOne({
      _id: new mongoose.Types.ObjectId(rubricId),
      eventId: new mongoose.Types.ObjectId(eventId),
    }).exec();

    return result.deletedCount > 0;
  }
}

export const mongoEventRubricRepository = new MongoEventRubricRepository();
