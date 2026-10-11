import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  mongoEventTaskRepository,
  MongoEventTaskRepository,
  TaskFilterOptions,
} from '../repositories/mongo-event-task.repository';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  mongoEventMemberRepository,
  MongoEventMemberRepository,
} from '../repositories/mongo-event-member.repository';
import {
  mongoUserRepository,
  MongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  IEventTaskDocument,
  TaskCategory,
  TaskStatus,
  TaskPriority,
  TASK_CATEGORIES,
  TASK_STATUSES,
  TASK_PRIORITIES,
} from '../../../db/mongo/models/event-task.model';

export interface CreateEventTaskDTO {
  title: string;
  description?: string;
  category?: TaskCategory;
  station: string;
  assignedMemberIds?: string[];
  shiftStart?: string | Date;
  shiftEnd?: string | Date;
  priority?: TaskPriority;
  requiresScanning?: boolean;
}

export interface UpdateEventTaskDTO {
  title?: string;
  description?: string;
  category?: TaskCategory;
  station?: string;
  assignedMemberIds?: string[];
  shiftStart?: string | Date;
  shiftEnd?: string | Date;
  priority?: TaskPriority;
  status?: TaskStatus;
  requiresScanning?: boolean;
}

export class EventTaskService {
  constructor(
    private taskRepo: MongoEventTaskRepository = mongoEventTaskRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Helper to verify if caller is event owner, platform admin, or Coordinator/Host with task management rights.
   */
  private async assertCanManageTasks(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ event: any; callerMongoId: mongoose.Types.ObjectId }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller user profile not found', 403);
    }

    const callerMongoId = new mongoose.Types.ObjectId(callerUser._id);

    // Event owner is authorized
    if (event.ownerSupabaseId === callerSupabaseId || (event.ownerId && event.ownerId.equals(callerMongoId))) {
      return { event, callerMongoId };
    }

    // Platform administrator bypass
    if (callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN') {
      return { event, callerMongoId };
    }

    // Check event membership
    const membership = await this.memberRepo.findByEventAndUser(eventId, callerMongoId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('You do not have access to this event.', 403);
    }

    // Hosts and Coordinators or members with MANAGE_STAFF / UPDATE_ASSIGNED_TASKS
    const canManage =
      membership.role === 'HOST' ||
      membership.role === 'COORDINATOR' ||
      membership.permissions.includes('MANAGE_STAFF') ||
      membership.permissions.includes('UPDATE_ASSIGNED_TASKS');

    if (!canManage) {
      throw new AppError('Insufficient permissions to manage event tasks.', 403);
    }

    return { event, callerMongoId };
  }

  /**
   * Helper to verify if caller is at least an active event member.
   */
  private async assertIsActiveMember(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ event: any; callerMongoId: mongoose.Types.ObjectId; membership?: any; isOwnerOrAdmin: boolean }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller user profile not found', 403);
    }

    const callerMongoId = new mongoose.Types.ObjectId(callerUser._id);
    const isOwner = event.ownerSupabaseId === callerSupabaseId || (event.ownerId && event.ownerId.equals(callerMongoId));
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    if (isOwner || isAdmin) {
      return { event, callerMongoId, isOwnerOrAdmin: true };
    }

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerMongoId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('You do not have permission to view tasks for this event.', 403);
    }

    return { event, callerMongoId, membership, isOwnerOrAdmin: false };
  }

  /**
   * Create a new event task or volunteer station shift.
   */
  async createTask(
    eventId: string,
    callerSupabaseId: string,
    dto: CreateEventTaskDTO
  ): Promise<IEventTaskDocument> {
    const { callerMongoId } = await this.assertCanManageTasks(eventId, callerSupabaseId);

    if (!dto.title || !dto.title.trim()) {
      throw new AppError('Task title is required.', 400);
    }

    if (!dto.station || !dto.station.trim()) {
      throw new AppError('Task station / zone is required.', 400);
    }

    const category = dto.category || 'GENERAL';
    if (!TASK_CATEGORIES.includes(category)) {
      throw new AppError(`Invalid task category '${category}'. Allowed: ${TASK_CATEGORIES.join(', ')}`, 400);
    }

    const priority = dto.priority || 'MEDIUM';
    if (!TASK_PRIORITIES.includes(priority)) {
      throw new AppError(`Invalid task priority '${priority}'. Allowed: ${TASK_PRIORITIES.join(', ')}`, 400);
    }

    // Validate assigned members belong to this event
    const validatedMemberIds: string[] = [];
    if (dto.assignedMemberIds && Array.isArray(dto.assignedMemberIds)) {
      for (const mId of dto.assignedMemberIds) {
        if (!mongoose.Types.ObjectId.isValid(mId)) continue;
        const member = await this.memberRepo.findById(mId);
        if (member && member.eventId.toString() === eventId && member.status === 'ACTIVE') {
          validatedMemberIds.push(member._id.toString());
        }
      }
    }

    const task = await this.taskRepo.createTask({
      eventId,
      title: dto.title.trim(),
      description: dto.description?.trim(),
      category,
      station: dto.station.trim(),
      assignedMemberIds: validatedMemberIds,
      shiftStart: dto.shiftStart ? new Date(dto.shiftStart) : undefined,
      shiftEnd: dto.shiftEnd ? new Date(dto.shiftEnd) : undefined,
      status: 'PENDING',
      priority,
      requiresScanning: !!dto.requiresScanning,
      createdBy: callerMongoId,
    });

    return task;
  }

  /**
   * List tasks for an event with optional filters.
   */
  async listTasks(
    eventId: string,
    callerSupabaseId: string,
    filters?: TaskFilterOptions
  ): Promise<IEventTaskDocument[]> {
    await this.assertIsActiveMember(eventId, callerSupabaseId);
    return await this.taskRepo.listTasks(eventId, filters);
  }

  /**
   * Get single task by ID.
   */
  async getTask(
    eventId: string,
    taskId: string,
    callerSupabaseId: string
  ): Promise<IEventTaskDocument> {
    await this.assertIsActiveMember(eventId, callerSupabaseId);
    const task = await this.taskRepo.findByIdAndEvent(taskId, eventId);
    if (!task) {
      throw new AppError('Task not found for this event.', 404);
    }
    return task;
  }

  /**
   * Update an existing task.
   */
  async updateTask(
    eventId: string,
    taskId: string,
    callerSupabaseId: string,
    dto: UpdateEventTaskDTO
  ): Promise<IEventTaskDocument> {
    await this.assertCanManageTasks(eventId, callerSupabaseId);

    const existing = await this.taskRepo.findByIdAndEvent(taskId, eventId);
    if (!existing) {
      throw new AppError('Task not found for this event.', 404);
    }

    const updates: Partial<any> = {};

    if (dto.title !== undefined) {
      if (!dto.title.trim()) throw new AppError('Task title cannot be empty.', 400);
      updates.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      updates.description = dto.description.trim();
    }

    if (dto.station !== undefined) {
      if (!dto.station.trim()) throw new AppError('Station cannot be empty.', 400);
      updates.station = dto.station.trim();
    }

    if (dto.category !== undefined) {
      if (!TASK_CATEGORIES.includes(dto.category)) {
        throw new AppError(`Invalid task category '${dto.category}'.`, 400);
      }
      updates.category = dto.category;
    }

    if (dto.priority !== undefined) {
      if (!TASK_PRIORITIES.includes(dto.priority)) {
        throw new AppError(`Invalid task priority '${dto.priority}'.`, 400);
      }
      updates.priority = dto.priority;
    }

    if (dto.status !== undefined) {
      if (!TASK_STATUSES.includes(dto.status)) {
        throw new AppError(`Invalid task status '${dto.status}'.`, 400);
      }
      updates.status = dto.status;
    }

    if (dto.requiresScanning !== undefined) {
      updates.requiresScanning = !!dto.requiresScanning;
    }

    if (dto.shiftStart !== undefined) {
      updates.shiftStart = dto.shiftStart ? new Date(dto.shiftStart) : undefined;
    }

    if (dto.shiftEnd !== undefined) {
      updates.shiftEnd = dto.shiftEnd ? new Date(dto.shiftEnd) : undefined;
    }

    if (dto.assignedMemberIds !== undefined) {
      const validatedMemberIds: mongoose.Types.ObjectId[] = [];
      for (const mId of dto.assignedMemberIds) {
        if (!mongoose.Types.ObjectId.isValid(mId)) continue;
        const member = await this.memberRepo.findById(mId);
        if (member && member.eventId.toString() === eventId && member.status === 'ACTIVE') {
          validatedMemberIds.push(new mongoose.Types.ObjectId(member._id));
        }
      }
      updates.assignedMemberIds = validatedMemberIds;
    }

    const updated = await this.taskRepo.updateTask(taskId, updates);
    return updated!;
  }

  /**
   * Update task status (Can be executed by Manager OR assigned Volunteer).
   */
  async updateTaskStatus(
    eventId: string,
    taskId: string,
    callerSupabaseId: string,
    status: TaskStatus
  ): Promise<IEventTaskDocument> {
    if (!TASK_STATUSES.includes(status)) {
      throw new AppError(`Invalid status '${status}'. Allowed: ${TASK_STATUSES.join(', ')}`, 400);
    }

    const task = await this.taskRepo.findByIdAndEvent(taskId, eventId);
    if (!task) {
      throw new AppError('Task not found for this event.', 404);
    }

    const { callerMongoId, isOwnerOrAdmin, membership } = await this.assertIsActiveMember(
      eventId,
      callerSupabaseId
    );

    // Check if caller is manager
    const isManager =
      isOwnerOrAdmin ||
      (membership &&
        (membership.role === 'HOST' ||
          membership.role === 'COORDINATOR' ||
          membership.permissions.includes('MANAGE_STAFF') ||
          membership.permissions.includes('UPDATE_ASSIGNED_TASKS')));

    // If not manager, check if caller's member record is assigned to this task
    if (!isManager) {
      if (!membership) {
        throw new AppError('Unauthorized to update this task status.', 403);
      }
      const isAssigned = task.assignedMemberIds.some(
        (id: any) => id.toString() === membership._id.toString() || (id._id && id._id.toString() === membership._id.toString())
      );
      if (!isAssigned) {
        throw new AppError('You are not assigned to this task.', 403);
      }
    }

    const updated = await this.taskRepo.updateTask(taskId, { status });
    return updated!;
  }

  /**
   * Delete a task.
   */
  async deleteTask(
    eventId: string,
    taskId: string,
    callerSupabaseId: string
  ): Promise<{ message: string }> {
    await this.assertCanManageTasks(eventId, callerSupabaseId);

    const task = await this.taskRepo.findByIdAndEvent(taskId, eventId);
    if (!task) {
      throw new AppError('Task not found for this event.', 404);
    }

    await this.taskRepo.deleteTask(taskId);
    return { message: 'Task deleted successfully.' };
  }

  /**
   * Retrieve tasks assigned to the caller.
   */
  async getMyTasks(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ member: any; tasks: IEventTaskDocument[] }> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('User profile not found.', 403);
    }

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('You are not an active member of this event.', 403);
    }

    const tasks = await this.taskRepo.findTasksForMember(eventId, membership._id);
    return { member: membership, tasks };
  }

  /**
   * Coordinator/Host dynamic toggle for Volunteer credential scanning privilege.
   */
  async toggleScannerPrivilege(
    eventId: string,
    memberId: string,
    callerSupabaseId: string,
    enabled: boolean
  ): Promise<{ member: any; message: string }> {
    await this.assertCanManageTasks(eventId, callerSupabaseId);

    const member = await this.memberRepo.findById(memberId);
    if (!member || member.eventId.toString() !== eventId) {
      throw new AppError('Member not found for this event.', 404);
    }

    let permissions = [...member.permissions];
    if (enabled) {
      if (!permissions.includes('SCAN_CREDENTIALS')) {
        permissions.push('SCAN_CREDENTIALS');
      }
    } else {
      permissions = permissions.filter((p) => p !== 'SCAN_CREDENTIALS');
    }

    const updated = await this.memberRepo.updateMember(memberId, { permissions });

    return {
      member: updated,
      message: enabled
        ? `Granted ticket scanning permission to ${member.userEmail}.`
        : `Revoked ticket scanning permission from ${member.userEmail}.`,
    };
  }
}

export const eventTaskService = new EventTaskService();
export default eventTaskService;
