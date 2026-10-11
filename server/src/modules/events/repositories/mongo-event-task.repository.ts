import mongoose from 'mongoose';
import {
  EventTaskModel,
  IEventTaskDocument,
  TaskStatus,
  TaskCategory,
  TaskPriority,
} from '../../../db/mongo/models/event-task.model';

export interface CreateTaskInput {
  eventId: mongoose.Types.ObjectId | string;
  title: string;
  description?: string;
  category: TaskCategory;
  station: string;
  assignedMemberIds?: (mongoose.Types.ObjectId | string)[];
  shiftStart?: Date;
  shiftEnd?: Date;
  status?: TaskStatus;
  priority?: TaskPriority;
  requiresScanning?: boolean;
  createdBy: mongoose.Types.ObjectId | string;
}

export interface TaskFilterOptions {
  status?: TaskStatus;
  station?: string;
  category?: TaskCategory;
  assignedMemberId?: mongoose.Types.ObjectId | string;
}

export class MongoEventTaskRepository {
  async createTask(data: CreateTaskInput): Promise<IEventTaskDocument> {
    const task = new EventTaskModel({
      ...data,
      eventId: new mongoose.Types.ObjectId(data.eventId),
      assignedMemberIds: (data.assignedMemberIds || []).map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
    });
    return await task.save();
  }

  async findById(taskId: mongoose.Types.ObjectId | string): Promise<IEventTaskDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
    return await EventTaskModel.findById(taskId)
      .populate('assignedMemberIds', 'userEmail role status permissions')
      .exec();
  }

  async findByIdAndEvent(
    taskId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<IEventTaskDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return null;
    }
    return await EventTaskModel.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      eventId: new mongoose.Types.ObjectId(eventId),
    })
      .populate('assignedMemberIds', 'userEmail role status permissions')
      .exec();
  }

  async listTasks(
    eventId: mongoose.Types.ObjectId | string,
    filters?: TaskFilterOptions
  ): Promise<IEventTaskDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: Record<string, any> = {
      eventId: new mongoose.Types.ObjectId(eventId),
    };

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.station) {
      query.station = filters.station;
    }
    if (filters?.category) {
      query.category = filters.category;
    }
    if (filters?.assignedMemberId && mongoose.Types.ObjectId.isValid(filters.assignedMemberId)) {
      query.assignedMemberIds = new mongoose.Types.ObjectId(filters.assignedMemberId);
    }

    return await EventTaskModel.find(query)
      .sort({ priority: -1, shiftStart: 1, createdAt: -1 })
      .populate('assignedMemberIds', 'userEmail role status permissions')
      .exec();
  }

  async findTasksForMember(
    eventId: mongoose.Types.ObjectId | string,
    memberId: mongoose.Types.ObjectId | string
  ): Promise<IEventTaskDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return [];
    }

    return await EventTaskModel.find({
      eventId: new mongoose.Types.ObjectId(eventId),
      assignedMemberIds: new mongoose.Types.ObjectId(memberId),
    })
      .sort({ shiftStart: 1, priority: -1, createdAt: -1 })
      .populate('assignedMemberIds', 'userEmail role status permissions')
      .exec();
  }

  async updateTask(
    taskId: mongoose.Types.ObjectId | string,
    updates: Partial<IEventTaskDocument>
  ): Promise<IEventTaskDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return null;

    return await EventTaskModel.findByIdAndUpdate(taskId, { $set: updates }, { new: true })
      .populate('assignedMemberIds', 'userEmail role status permissions')
      .exec();
  }

  async deleteTask(taskId: mongoose.Types.ObjectId | string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return false;
    const result = await EventTaskModel.findByIdAndDelete(taskId).exec();
    return !!result;
  }

  async countTasksByStatus(
    eventId: mongoose.Types.ObjectId | string
  ): Promise<Record<TaskStatus, number>> {
    const initial: Record<TaskStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    if (!mongoose.Types.ObjectId.isValid(eventId)) return initial;

    const aggregation = await EventTaskModel.aggregate([
      { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    for (const item of aggregation) {
      if (item._id && initial[item._id as TaskStatus] !== undefined) {
        initial[item._id as TaskStatus] = item.count;
      }
    }

    return initial;
  }
}

export const mongoEventTaskRepository = new MongoEventTaskRepository();
export default mongoEventTaskRepository;
