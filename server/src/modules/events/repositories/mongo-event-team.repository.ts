import mongoose from 'mongoose';
import {
  EventTeamModel,
  IEventTeamDocument,
  ITeamMember,
  TeamStatus,
} from '../../../db/mongo/models/event-team.model';

export interface CreateTeamInput {
  eventId: mongoose.Types.ObjectId | string;
  teamName: string;
  track?: string;
  tableNumber?: string;
  leaderName: string;
  leaderEmail: string;
  members?: ITeamMember[];
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
  status?: TeamStatus;
  createdBy: mongoose.Types.ObjectId | string;
}

export interface UpdateTeamInput {
  teamName?: string;
  track?: string;
  tableNumber?: string;
  leaderName?: string;
  leaderEmail?: string;
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
  status?: TeamStatus;
  submittedAt?: Date;
}

export interface TeamFilterOptions {
  track?: string;
  status?: TeamStatus;
  search?: string;
  leaderEmail?: string;
}

export class MongoEventTeamRepository {
  async createTeam(data: CreateTeamInput): Promise<IEventTeamDocument> {
    const team = new EventTeamModel({
      ...data,
      eventId: new mongoose.Types.ObjectId(data.eventId),
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
      leaderEmail: data.leaderEmail.toLowerCase().trim(),
      members: data.members || [
        {
          name: data.leaderName,
          email: data.leaderEmail.toLowerCase().trim(),
          role: 'Team Lead',
          checkedIn: false,
        },
      ],
    });
    return await team.save();
  }

  async findById(teamId: mongoose.Types.ObjectId | string): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(teamId)) return null;
    return await EventTeamModel.findById(teamId).exec();
  }

  async findByIdAndEvent(
    teamId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }
    return await EventTeamModel.findOne({
      _id: new mongoose.Types.ObjectId(teamId),
      eventId: new mongoose.Types.ObjectId(eventId),
    }).exec();
  }

  async findByEventAndName(
    eventId: mongoose.Types.ObjectId | string,
    teamName: string
  ): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return null;
    return await EventTeamModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      teamName: { $regex: new RegExp(`^${teamName.trim()}$`, 'i') },
    }).exec();
  }

  async findByEvent(
    eventId: mongoose.Types.ObjectId | string,
    filters?: TeamFilterOptions
  ): Promise<IEventTeamDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };

    if (filters?.track) {
      query.track = filters.track;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.leaderEmail) {
      query.leaderEmail = filters.leaderEmail.toLowerCase().trim();
    }

    if (filters?.search && filters.search.trim()) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { teamName: searchRegex },
        { leaderName: searchRegex },
        { leaderEmail: searchRegex },
        { projectTitle: searchRegex },
        { 'members.name': searchRegex },
        { 'members.email': searchRegex },
      ];
    }

    return await EventTeamModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findByMemberEmail(
    eventId: mongoose.Types.ObjectId | string,
    email: string
  ): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !email) return null;
    const normalized = email.toLowerCase().trim();
    return await EventTeamModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      $or: [{ leaderEmail: normalized }, { 'members.email': normalized }],
      status: { $nin: ['DISQUALIFIED', 'WITHDRAWN'] },
    }).exec();
  }

  async updateTeam(
    teamId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string,
    data: UpdateTeamInput
  ): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }

    const updatePayload: any = { ...data };
    if (data.leaderEmail) {
      updatePayload.leaderEmail = data.leaderEmail.toLowerCase().trim();
    }

    return await EventTeamModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(teamId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { $set: updatePayload },
      { returnDocument: 'after' }
    ).exec();
  }

  async addMember(
    teamId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string,
    member: ITeamMember
  ): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }

    return await EventTeamModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(teamId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      {
        $push: {
          members: {
            name: member.name.trim(),
            email: member.email.toLowerCase().trim(),
            role: member.role || 'Member',
            checkedIn: !!member.checkedIn,
          },
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  async removeMember(
    teamId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string,
    memberEmail: string
  ): Promise<IEventTeamDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }

    return await EventTeamModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(teamId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      {
        $pull: {
          members: { email: memberEmail.toLowerCase().trim() },
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  async deleteTeam(
    teamId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return false;
    }

    const result = await EventTeamModel.deleteOne({
      _id: new mongoose.Types.ObjectId(teamId),
      eventId: new mongoose.Types.ObjectId(eventId),
    }).exec();

    return result.deletedCount > 0;
  }

  async countByEvent(eventId: mongoose.Types.ObjectId | string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return 0;
    return await EventTeamModel.countDocuments({
      eventId: new mongoose.Types.ObjectId(eventId),
    }).exec();
  }
}

export const mongoEventTeamRepository = new MongoEventTeamRepository();

