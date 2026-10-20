import mongoose from 'mongoose';
import {
  EventAssignmentModel,
  IEventAssignmentDocument,
  AssignmentRole,
  AssignmentStatus,
  IMentorshipLog,
} from '../../../db/mongo/models/event-assignment.model';

export interface CreateAssignmentInput {
  eventId: mongoose.Types.ObjectId | string;
  memberId: mongoose.Types.ObjectId | string;
  role: AssignmentRole;
  track?: string;
  assignedTargetType?: 'TRACK' | 'TEAM' | 'GENERAL';
  targetId?: string;
  targetName: string;
  notes?: string;
  status?: AssignmentStatus;
  createdBy: mongoose.Types.ObjectId | string;
}

export interface AssignmentFilterOptions {
  role?: AssignmentRole;
  track?: string;
  status?: AssignmentStatus;
  memberId?: mongoose.Types.ObjectId | string;
}

export class MongoEventAssignmentRepository {
  async createAssignment(data: CreateAssignmentInput): Promise<IEventAssignmentDocument> {
    const assignment = new EventAssignmentModel({
      ...data,
      eventId: new mongoose.Types.ObjectId(data.eventId),
      memberId: new mongoose.Types.ObjectId(data.memberId),
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
      mentorshipLogs: [],
    });
    return await assignment.save();
  }

  async findById(assignmentId: mongoose.Types.ObjectId | string): Promise<IEventAssignmentDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) return null;
    return await EventAssignmentModel.findById(assignmentId)
      .populate('memberId', 'userEmail role permissions status')
      .exec();
  }

  async findByIdAndEvent(
    assignmentId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<IEventAssignmentDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(assignmentId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }
    return await EventAssignmentModel.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      eventId: new mongoose.Types.ObjectId(eventId),
    })
      .populate('memberId', 'userEmail role permissions status')
      .exec();
  }

  async findByEventAndMemberAndTarget(
    eventId: mongoose.Types.ObjectId | string,
    memberId: mongoose.Types.ObjectId | string,
    targetName: string
  ): Promise<IEventAssignmentDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return null;
    }
    return await EventAssignmentModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      memberId: new mongoose.Types.ObjectId(memberId),
      targetName: targetName.trim(),
    }).exec();
  }

  async listAssignments(
    eventId: mongoose.Types.ObjectId | string,
    filters?: AssignmentFilterOptions
  ): Promise<IEventAssignmentDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: Record<string, any> = {
      eventId: new mongoose.Types.ObjectId(eventId),
    };

    if (filters?.role) {
      query.role = filters.role;
    }
    if (filters?.track) {
      query.track = filters.track;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.memberId && mongoose.Types.ObjectId.isValid(filters.memberId)) {
      query.memberId = new mongoose.Types.ObjectId(filters.memberId);
    }

    return await EventAssignmentModel.find(query)
      .sort({ createdAt: -1 })
      .populate('memberId', 'userEmail role permissions status')
      .exec();
  }

  async listAssignmentsForMember(
    eventId: mongoose.Types.ObjectId | string,
    memberId: mongoose.Types.ObjectId | string
  ): Promise<IEventAssignmentDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return [];
    }
    return await EventAssignmentModel.find({
      eventId: new mongoose.Types.ObjectId(eventId),
      memberId: new mongoose.Types.ObjectId(memberId),
      status: 'ACTIVE',
    })
      .sort({ createdAt: -1 })
      .populate('memberId', 'userEmail role permissions status')
      .exec();
  }

  async updateAssignment(
    assignmentId: mongoose.Types.ObjectId | string,
    updates: Partial<IEventAssignmentDocument>
  ): Promise<IEventAssignmentDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) return null;
    return await EventAssignmentModel.findByIdAndUpdate(assignmentId, { $set: updates }, { returnDocument: 'after' })
      .populate('memberId', 'userEmail role permissions status')
      .exec();
  }

  async addMentorshipLog(
    assignmentId: mongoose.Types.ObjectId | string,
    log: IMentorshipLog
  ): Promise<IEventAssignmentDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) return null;
    return await EventAssignmentModel.findByIdAndUpdate(
      assignmentId,
      { $push: { mentorshipLogs: log } },
      { returnDocument: 'after' }
    )
      .populate('memberId', 'userEmail role permissions status')
      .exec();
  }

  async deleteAssignment(assignmentId: mongoose.Types.ObjectId | string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) return false;
    const result = await EventAssignmentModel.findByIdAndDelete(assignmentId).exec();
    return !!result;
  }
}

export const mongoEventAssignmentRepository = new MongoEventAssignmentRepository();
export default mongoEventAssignmentRepository;
