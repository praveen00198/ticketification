import mongoose from 'mongoose';
import {
  EventRegistrationModel,
  IEventRegistrationDocument,
  RegistrationStatus,
} from '../../../db/mongo/models/event-registration.model';

export interface CreateRegistrationData {
  eventId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  userSupabaseId: string;
  credentialId?: string | mongoose.Types.ObjectId | null;
  status?: RegistrationStatus;
  registrationType?: string;
  attendeeDetails: {
    name: string;
    email: string;
    phone?: string | null;
    organization?: string | null;
    designation?: string | null;
    teamName?: string | null;
  };
  responses?: Record<string, any>;
  teamId?: string | mongoose.Types.ObjectId | null;
  registeredAt?: Date;
}

export class MongoEventRegistrationRepository {
  async create(data: CreateRegistrationData): Promise<IEventRegistrationDocument> {
    const reg = new EventRegistrationModel({
      ...data,
      eventId: typeof data.eventId === 'string' ? new mongoose.Types.ObjectId(data.eventId) : data.eventId,
      userId: typeof data.userId === 'string' ? new mongoose.Types.ObjectId(data.userId) : data.userId,
      credentialId:
        data.credentialId && typeof data.credentialId === 'string'
          ? new mongoose.Types.ObjectId(data.credentialId)
          : data.credentialId || null,
      teamId:
        data.teamId && typeof data.teamId === 'string'
          ? new mongoose.Types.ObjectId(data.teamId)
          : data.teamId || null,
      status: data.status || 'CONFIRMED',
      registrationType: data.registrationType || 'ATTENDEE',
      registeredAt: data.registeredAt || new Date(),
    });

    return await reg.save();
  }

  async findByEventAndUser(
    eventId: string,
    userId: string | mongoose.Types.ObjectId
  ): Promise<IEventRegistrationDocument | null> {
    const uId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    return await EventRegistrationModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      userId: uId,
      status: { $ne: 'CANCELLED' },
    }).exec();
  }

  async findByEventAndSupabaseId(
    eventId: string,
    userSupabaseId: string
  ): Promise<IEventRegistrationDocument | null> {
    return await EventRegistrationModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      userSupabaseId,
      status: { $ne: 'CANCELLED' },
    }).exec();
  }

  async findByUserSupabaseId(userSupabaseId: string): Promise<IEventRegistrationDocument[]> {
    return await EventRegistrationModel.find({
      userSupabaseId,
    })
      .sort({ registeredAt: -1 })
      .populate('eventId')
      .populate('credentialId')
      .exec();
  }

  async countByEvent(eventId: string, status?: RegistrationStatus): Promise<number> {
    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'CANCELLED' };
    }
    return await EventRegistrationModel.countDocuments(query).exec();
  }

  async updateStatus(
    id: string,
    eventId: string,
    status: RegistrationStatus,
    cancelledAt?: Date,
    cancellationReason?: string
  ): Promise<IEventRegistrationDocument | null> {
    const update: any = { status };
    if (cancelledAt) update.cancelledAt = cancelledAt;
    if (cancellationReason) update.cancellationReason = cancellationReason;

    return await EventRegistrationModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { $set: update },
      { new: true }
    ).exec();
  }

  async updateTeam(
    id: string,
    eventId: string,
    teamId: string | mongoose.Types.ObjectId
  ): Promise<IEventRegistrationDocument | null> {
    const tId = typeof teamId === 'string' ? new mongoose.Types.ObjectId(teamId) : teamId;
    return await EventRegistrationModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { $set: { teamId: tId } },
      { new: true }
    ).exec();
  }

  async findById(id: string): Promise<IEventRegistrationDocument | null> {
    return await EventRegistrationModel.findById(id).populate('eventId').populate('credentialId').exec();
  }
}

export const mongoEventRegistrationRepository = new MongoEventRegistrationRepository();
