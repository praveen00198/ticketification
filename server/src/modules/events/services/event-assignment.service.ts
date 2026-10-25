import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  mongoEventAssignmentRepository,
  MongoEventAssignmentRepository,
  AssignmentFilterOptions,
} from '../repositories/mongo-event-assignment.repository';
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
  IEventAssignmentDocument,
  AssignmentRole,
  AssignmentTargetType,
  ASSIGNMENT_ROLES,
  ASSIGNMENT_TARGET_TYPES,
} from '../../../db/mongo/models/event-assignment.model';

export interface CreateEventAssignmentDTO {
  memberId: string;
  role: AssignmentRole;
  track?: string;
  assignedTargetType?: AssignmentTargetType;
  targetId?: string;
  targetName: string;
  notes?: string;
}

export class EventAssignmentService {
  constructor(
    private assignmentRepo: MongoEventAssignmentRepository = mongoEventAssignmentRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Helper to verify if caller is event owner, platform admin, or Coordinator/Host.
   */
  private async assertCanManageAssignments(
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

    const canManage =
      membership.role === 'HOST' ||
      membership.role === 'COORDINATOR' ||
      membership.permissions.includes('MANAGE_STAFF') ||
      membership.permissions.includes('MANAGE_EVENT_SETTINGS');

    if (!canManage) {
      throw new AppError('Insufficient permissions to manage assignments.', 403);
    }

    return { event, callerMongoId };
  }

  /**
   * Create an assignment for a Mentor or Evaluator.
   */
  async createAssignment(
    eventId: string,
    callerSupabaseId: string,
    dto: CreateEventAssignmentDTO
  ): Promise<IEventAssignmentDocument> {
    const { callerMongoId } = await this.assertCanManageAssignments(eventId, callerSupabaseId);

    if (!dto.memberId || !mongoose.Types.ObjectId.isValid(dto.memberId)) {
      throw new AppError('Valid memberId is required.', 400);
    }

    if (!dto.role || !ASSIGNMENT_ROLES.includes(dto.role)) {
      throw new AppError(`Invalid role '${dto.role}'. Allowed: ${ASSIGNMENT_ROLES.join(', ')}`, 400);
    }

    if (!dto.targetName || !dto.targetName.trim()) {
      throw new AppError('targetName (e.g., Track name or Team identifier) is required.', 400);
    }

    const member = await this.memberRepo.findById(dto.memberId);
    if (!member || member.eventId.toString() !== eventId) {
      throw new AppError('Target member not found for this event.', 404);
    }

    if (member.status !== 'ACTIVE') {
      throw new AppError(`Member ${member.userEmail} must have ACTIVE status before receiving assignments.`, 400);
    }

    // Ensure member has matching role or appropriate permission
    const isMatching =
      member.role === dto.role ||
      (dto.role === 'JUDGE' && member.role === 'EVALUATOR') ||
      (dto.role === 'EVALUATOR' && member.role === 'JUDGE') ||
      member.role === 'HOST' ||
      member.role === 'COORDINATOR';

    if (!isMatching) {
      throw new AppError(
        `Cannot assign ${dto.role} duty to a member with role '${member.role}'. Update their member role first.`,
        400
      );
    }

    // Check duplicate assignment
    const existing = await this.assignmentRepo.findByEventAndMemberAndTarget(
      eventId,
      dto.memberId,
      dto.targetName.trim()
    );
    if (existing) {
      throw new AppError(
        `Member ${member.userEmail} is already assigned to '${dto.targetName.trim()}'.`,
        400
      );
    }

    return await this.assignmentRepo.createAssignment({
      eventId,
      memberId: dto.memberId,
      role: dto.role,
      track: dto.track?.trim(),
      assignedTargetType: dto.assignedTargetType || 'TRACK',
      targetId: dto.targetId?.trim(),
      targetName: dto.targetName.trim(),
      notes: dto.notes?.trim(),
      status: 'ACTIVE',
      createdBy: callerMongoId,
    });
  }

  /**
   * List assignments with optional role/track filters.
   */
  async listAssignments(
    eventId: string,
    callerSupabaseId: string,
    filters?: AssignmentFilterOptions
  ): Promise<IEventAssignmentDocument[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Caller user not found', 403);

    const callerMongoId = new mongoose.Types.ObjectId(callerUser._id);
    const isOwner = event.ownerSupabaseId === callerSupabaseId || (event.ownerId && event.ownerId.equals(callerMongoId));
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    if (isOwner || isAdmin) {
      return await this.assignmentRepo.listAssignments(eventId, filters);
    }

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerMongoId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('You do not have access to view assignments for this event.', 403);
    }

    // If host or coordinator, return all matching assignments
    if (membership.role === 'HOST' || membership.role === 'COORDINATOR') {
      return await this.assignmentRepo.listAssignments(eventId, filters);
    }

    // Otherwise, restrict to assignments for this specific member (Blind review / workspace scoping)
    return await this.assignmentRepo.listAssignmentsForMember(eventId, membership._id);
  }

  /**
   * Get assignments specific to the authenticated caller.
   */
  async getMyAssignments(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ member: any; assignments: IEventAssignmentDocument[] }> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Caller user not found', 403);

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('You are not an active member of this event.', 403);
    }

    const assignments = await this.assignmentRepo.listAssignmentsForMember(eventId, membership._id);
    return { member: membership, assignments };
  }

  /**
   * Record a mentorship session log.
   */
  async recordMentorshipLog(
    eventId: string,
    assignmentId: string,
    callerSupabaseId: string,
    note: string
  ): Promise<IEventAssignmentDocument> {
    if (!note || !note.trim()) {
      throw new AppError('Mentorship note cannot be empty.', 400);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Caller user not found', 403);

    const assignment = await this.assignmentRepo.findByIdAndEvent(assignmentId, eventId);
    if (!assignment) throw new AppError('Assignment not found for this event.', 404);

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    const isAssigned = membership && assignment.memberId.toString() === membership._id.toString();
    const isManager = membership && (membership.role === 'HOST' || membership.role === 'COORDINATOR');

    if (!isAssigned && !isManager) {
      throw new AppError('Unauthorized to record mentorship notes on this assignment.', 403);
    }

    const updated = await this.assignmentRepo.addMentorshipLog(assignmentId, {
      authorEmail: callerUser.email,
      note: note.trim(),
      timestamp: new Date(),
    });

    return updated!;
  }

  /**
   * Remove an assignment.
   */
  async deleteAssignment(
    eventId: string,
    assignmentId: string,
    callerSupabaseId: string
  ): Promise<{ message: string }> {
    await this.assertCanManageAssignments(eventId, callerSupabaseId);

    const assignment = await this.assignmentRepo.findByIdAndEvent(assignmentId, eventId);
    if (!assignment) throw new AppError('Assignment not found for this event.', 404);

    await this.assignmentRepo.deleteAssignment(assignmentId);
    return { message: 'Assignment successfully removed.' };
  }
}

export const eventAssignmentService = new EventAssignmentService();
export default eventAssignmentService;
