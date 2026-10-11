import crypto from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  mongoEventMemberRepository,
  MongoEventMemberRepository,
} from '../repositories/mongo-event-member.repository';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  mongoUserRepository,
  MongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  EventRole,
  EventPermission,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_EVENT_PERMISSIONS,
  IEventMemberDocument,
} from '../../../db/mongo/models/event-member.model';

export interface InviteMemberDTO {
  email: string;
  role: EventRole;
  customPermissions?: EventPermission[];
}

export class EventMemberService {
  constructor(
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Helper to verify if caller is event owner or has MANAGE_STAFF permission.
   */
  private async assertCanManageStaff(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ event: any; callerMongoId: mongoose.Types.ObjectId }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller profile not found', 403);
    }

    const callerMongoId = new mongoose.Types.ObjectId(callerUser._id);

    // Event owner is authorized
    if (event.ownerSupabaseId === callerSupabaseId || event.ownerId.equals(callerMongoId)) {
      return { event, callerMongoId };
    }

    // Platform admin is authorized
    if (callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN') {
      return { event, callerMongoId };
    }

    // Check event_members active permission
    const membership = await this.memberRepo.findByEventAndUser(eventId, callerMongoId);
    if (!membership || !membership.permissions.includes('MANAGE_STAFF')) {
      throw new AppError('You do not have permission to manage staff for this event.', 403);
    }

    return { event, callerMongoId };
  }

  /**
   * Invite a team member to an event with role and permissions.
   */
  async inviteMember(
    eventId: string,
    callerSupabaseId: string,
    dto: InviteMemberDTO
  ): Promise<{ member: IEventMemberDocument; invitationLink: string; devToken?: string }> {
    const { event, callerMongoId } = await this.assertCanManageStaff(eventId, callerSupabaseId);

    const email = dto.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('A valid email address is required for invitation.', 400);
    }

    if (!dto.role) {
      throw new AppError('Role is required.', 400);
    }

    // Check if membership already exists for this email
    const existing = await this.memberRepo.findByEventAndEmail(eventId, email);
    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new AppError(`User ${email} is already an active member of this event.`, 400);
      }
      if (existing.status === 'INVITED') {
        // Check if existing invitation is still valid
        if (existing.invitationExpiresAt && existing.invitationExpiresAt > new Date()) {
          throw new AppError(`An active invitation is already pending for ${email}.`, 400);
        }
      }
    }

    // Calculate assigned permissions
    let assignedPermissions: EventPermission[];
    if (dto.customPermissions && Array.isArray(dto.customPermissions)) {
      // Validate all provided permissions
      const validPermissions = dto.customPermissions.filter((p) =>
        ALL_EVENT_PERMISSIONS.includes(p)
      );
      assignedPermissions = Array.from(new Set(validPermissions));
    } else {
      assignedPermissions = [...(DEFAULT_ROLE_PERMISSIONS[dto.role] || [])];
    }

    // Generate secure 64-char hex token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72-hour TTL

    // Resolve target user if they already exist globally
    const targetUser = await this.userRepo.findByEmail(email);

    let member: IEventMemberDocument;
    if (existing && existing.status === 'REVOKED') {
      // Re-invite revoked member
      member = (await this.memberRepo.updateMember(existing._id, {
        role: dto.role,
        permissions: assignedPermissions,
        status: 'INVITED',
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        invitedBy: callerMongoId,
        userId: targetUser ? new mongoose.Types.ObjectId(targetUser._id) : undefined,
      }))!;
    } else {
      member = await this.memberRepo.createMember({
        eventId: new mongoose.Types.ObjectId(eventId),
        userId: targetUser ? new mongoose.Types.ObjectId(targetUser._id) : undefined,
        userEmail: email,
        role: dto.role,
        permissions: assignedPermissions,
        status: 'INVITED',
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        invitedBy: callerMongoId,
      });
    }

    const invitationLink = `/invite/accept?token=${token}`;

    return {
      member,
      invitationLink,
      devToken: token,
    };
  }

  /**
   * Accept an invitation using the cryptographic single-use token.
   */
  async acceptInvitation(
    token: string,
    callerSupabaseId: string
  ): Promise<{ member: IEventMemberDocument; message: string }> {
    if (!token || !token.trim()) {
      throw new AppError('Invitation token is required.', 400);
    }

    const membership = await this.memberRepo.findByInvitationToken(token.trim());
    if (!membership) {
      throw new AppError('Invalid or expired invitation token.', 404);
    }

    if (membership.invitationExpiresAt && membership.invitationExpiresAt < new Date()) {
      throw new AppError('This invitation has expired. Please request a new invitation.', 400);
    }

    // Resolve caller User
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller user profile not found.', 403);
    }

    // Email matching security check
    if (membership.userEmail.toLowerCase() !== callerUser.email.toLowerCase()) {
      throw new AppError(
        `This invitation was sent to ${membership.userEmail}. Please sign in with that email to accept.`,
        403
      );
    }

    const updated = await this.memberRepo.updateMember(membership._id, {
      userId: new mongoose.Types.ObjectId(callerUser._id),
      status: 'ACTIVE',
      acceptedAt: new Date(),
      invitationToken: undefined,
      invitationExpiresAt: undefined,
    });

    return {
      member: updated!,
      message: `You have successfully joined the event as ${membership.role}.`,
    };
  }

  /**
   * Update member role and/or granular permissions.
   */
  async updateMember(
    eventId: string,
    memberId: string,
    callerSupabaseId: string,
    updates: { role?: EventRole; permissions?: EventPermission[] }
  ): Promise<IEventMemberDocument> {
    await this.assertCanManageStaff(eventId, callerSupabaseId);

    const member = await this.memberRepo.findById(memberId);
    if (!member || member.eventId.toString() !== eventId) {
      throw new AppError('Member not found for this event.', 404);
    }

    // Cannot modify HOST role to non-host if they are the primary host
    const patch: Partial<any> = {};
    if (updates.role) {
      patch.role = updates.role;
      if (!updates.permissions) {
        patch.permissions = DEFAULT_ROLE_PERMISSIONS[updates.role] || [];
      }
    }

    if (updates.permissions && Array.isArray(updates.permissions)) {
      patch.permissions = Array.from(
        new Set(updates.permissions.filter((p) => ALL_EVENT_PERMISSIONS.includes(p)))
      );
    }

    const updated = await this.memberRepo.updateMember(memberId, patch);
    return updated!;
  }

  /**
   * Revoke or remove an event member.
   */
  async revokeMember(
    eventId: string,
    memberId: string,
    callerSupabaseId: string
  ): Promise<{ message: string }> {
    const { event } = await this.assertCanManageStaff(eventId, callerSupabaseId);

    const member = await this.memberRepo.findById(memberId);
    if (!member || member.eventId.toString() !== eventId) {
      throw new AppError('Member not found for this event.', 404);
    }

    // Cannot revoke the primary event owner
    if (member.userId && event.ownerId.equals(member.userId)) {
      throw new AppError('Cannot revoke the primary event owner.', 400);
    }

    await this.memberRepo.updateMember(memberId, {
      status: 'REVOKED',
    });

    return { message: 'Member access has been revoked.' };
  }

  /**
   * List members for an event.
   */
  async listMembers(
    eventId: string,
    callerSupabaseId: string,
    status?: string
  ): Promise<IEventMemberDocument[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller user not found', 403);
    }

    const callerMongoId = new mongoose.Types.ObjectId(callerUser._id);
    const isOwner = event.ownerSupabaseId === callerSupabaseId || event.ownerId.equals(callerMongoId);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      // Must be an active member of this event
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerMongoId);
      if (!membership || membership.status !== 'ACTIVE') {
        throw new AppError('You do not have permission to view members of this event.', 403);
      }
    }

    return await this.memberRepo.listEventMembers(eventId, status);
  }
}

export const eventMemberService = new EventMemberService();
export default eventMemberService;
