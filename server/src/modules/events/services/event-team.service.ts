import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  mongoEventTeamRepository,
  MongoEventTeamRepository,
  TeamFilterOptions,
} from '../repositories/mongo-event-team.repository';
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
  IEventTeamDocument,
  ITeamMember,
  TeamStatus,
  TEAM_STATUSES,
} from '../../../db/mongo/models/event-team.model';

export interface CreateEventTeamDTO {
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
}

export interface UpdateEventTeamDTO {
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
}

export class EventTeamService {
  constructor(
    private teamRepo: MongoEventTeamRepository = mongoEventTeamRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  private isEventOwner(
    event: any,
    callerSupabaseId: string,
    callerMongoId: mongoose.Types.ObjectId
  ): boolean {
    return (
      event.ownerSupabaseId === callerSupabaseId ||
      (event.ownerId && event.ownerId.equals(callerMongoId))
    );
  }

  /**
   * Helper to verify if caller is event owner, platform admin, or Coordinator/Host.
   */
  private async assertCanManageTeams(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ event: any; callerMongoId: mongoose.Types.ObjectId; callerEmail: string }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller user profile not found', 403);
    }

    if (callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN') {
      return { event, callerMongoId: callerUser._id, callerEmail: callerUser.email };
    }

    if (this.isEventOwner(event, callerSupabaseId, callerUser._id)) {
      return { event, callerMongoId: callerUser._id, callerEmail: callerUser.email };
    }

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (
      membership &&
      membership.status === 'ACTIVE' &&
      (membership.role === 'HOST' || membership.role === 'COORDINATOR')
    ) {
      return { event, callerMongoId: callerUser._id, callerEmail: callerUser.email };
    }

    throw new AppError('Forbidden: Only event hosts or coordinators can manage teams', 403);
  }

  /**
   * Create a new team in the event.
   */
  async createTeam(
    eventId: string,
    callerSupabaseId: string,
    dto: CreateEventTeamDTO
  ): Promise<IEventTeamDocument> {
    const { callerMongoId } = await this.assertCanManageTeams(eventId, callerSupabaseId);

    if (!dto.teamName || !dto.teamName.trim()) {
      throw new AppError('Team name is required', 400);
    }

    if (!dto.leaderName || !dto.leaderName.trim()) {
      throw new AppError('Leader name is required', 400);
    }

    if (!dto.leaderEmail || !dto.leaderEmail.trim()) {
      throw new AppError('Leader email is required', 400);
    }

    // Check duplicate team name in event
    const existing = await this.teamRepo.findByEventAndName(eventId, dto.teamName);
    if (existing) {
      throw new AppError(`A team named "${dto.teamName.trim()}" already exists in this event`, 409);
    }

    // Initialize team roster
    const members: ITeamMember[] = dto.members && dto.members.length > 0
      ? dto.members
      : [
          {
            name: dto.leaderName.trim(),
            email: dto.leaderEmail.toLowerCase().trim(),
            role: 'Team Lead',
            checkedIn: false,
          },
        ];

    // Check roster cap
    if (members.length > 6) {
      throw new AppError('Team roster cannot exceed 6 members', 400);
    }

    return await this.teamRepo.createTeam({
      eventId,
      teamName: dto.teamName.trim(),
      track: dto.track ? dto.track.trim() : 'General',
      tableNumber: dto.tableNumber ? dto.tableNumber.trim() : undefined,
      leaderName: dto.leaderName.trim(),
      leaderEmail: dto.leaderEmail.toLowerCase().trim(),
      members,
      projectTitle: dto.projectTitle?.trim(),
      projectDescription: dto.projectDescription?.trim(),
      repoUrl: dto.repoUrl?.trim(),
      demoUrl: dto.demoUrl?.trim(),
      status: 'REGISTERED',
      createdBy: callerMongoId,
    });
  }

  /**
   * List all teams in an event with optional filters.
   */
  async getTeams(
    eventId: string,
    callerSupabaseId: string,
    filters?: TeamFilterOptions
  ): Promise<IEventTeamDocument[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Unauthorized', 401);
    }

    // Authorized if owner, platform admin, or active event member
    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      if (!membership || membership.status !== 'ACTIVE') {
        throw new AppError('Forbidden: Access to event teams requires active membership', 403);
      }
    }

    return await this.teamRepo.findByEvent(eventId, filters);
  }

  /**
   * Get single team details.
   */
  async getTeamById(
    eventId: string,
    teamId: string,
    callerSupabaseId: string
  ): Promise<IEventTeamDocument> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Unauthorized', 401);
    }

    const team = await this.teamRepo.findByIdAndEvent(teamId, eventId);
    if (!team) {
      throw new AppError('Team not found in this event', 404);
    }

    return team;
  }

  /**
   * Update team info (metadata, project details, track, table).
   */
  async updateTeam(
    eventId: string,
    teamId: string,
    callerSupabaseId: string,
    dto: UpdateEventTeamDTO
  ): Promise<IEventTeamDocument> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Caller user profile not found', 403);
    }

    const team = await this.teamRepo.findByIdAndEvent(teamId, eventId);
    if (!team) {
      throw new AppError('Team not found in this event', 404);
    }

    // Check if caller can manage or is team leader
    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';
    const isLeader = team.leaderEmail.toLowerCase() === callerUser.email.toLowerCase();

    let isStaffManager = false;
    if (!isOwner && !isAdmin) {
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      if (
        membership &&
        membership.status === 'ACTIVE' &&
        (membership.role === 'HOST' || membership.role === 'COORDINATOR')
      ) {
        isStaffManager = true;
      }
    }

    if (!isOwner && !isAdmin && !isStaffManager && !isLeader) {
      throw new AppError('Forbidden: Only event organizers or team leaders can edit team details', 403);
    }

    // If changing team name, verify uniqueness
    if (dto.teamName && dto.teamName.trim() !== team.teamName) {
      const existing = await this.teamRepo.findByEventAndName(eventId, dto.teamName);
      if (existing && existing._id.toString() !== teamId) {
        throw new AppError(`A team named "${dto.teamName.trim()}" already exists in this event`, 409);
      }
    }

    // Status transition handling
    let submittedAt = team.submittedAt;
    if (dto.status === 'SUBMITTED' && !submittedAt) {
      submittedAt = new Date();
    }

    const updated = await this.teamRepo.updateTeam(teamId, eventId, {
      ...dto,
      submittedAt,
    });

    if (!updated) {
      throw new AppError('Failed to update team', 500);
    }

    return updated;
  }

  /**
   * Add a member to a team roster.
   */
  async addMember(
    eventId: string,
    teamId: string,
    callerSupabaseId: string,
    member: ITeamMember
  ): Promise<IEventTeamDocument> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Unauthorized', 401);
    }

    const team = await this.teamRepo.findByIdAndEvent(teamId, eventId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';
    const isLeader = team.leaderEmail.toLowerCase() === callerUser.email.toLowerCase();

    if (!isOwner && !isAdmin && !isLeader) {
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      const isStaffManager =
        membership &&
        membership.status === 'ACTIVE' &&
        (membership.role === 'HOST' || membership.role === 'COORDINATOR');

      if (!isStaffManager) {
        throw new AppError('Forbidden: Only organizers or team leaders can add members', 403);
      }
    }

    if (team.members.length >= 6) {
      throw new AppError('Team has reached maximum allowed roster capacity (6 members)', 400);
    }

    const normalizedEmail = member.email.toLowerCase().trim();
    const alreadyInTeam = team.members.some((m) => m.email.toLowerCase() === normalizedEmail);
    if (alreadyInTeam) {
      throw new AppError(`Member with email "${normalizedEmail}" is already in this team`, 409);
    }

    const updated = await this.teamRepo.addMember(teamId, eventId, {
      name: member.name.trim(),
      email: normalizedEmail,
      role: member.role?.trim() || 'Member',
      checkedIn: !!member.checkedIn,
    });

    if (!updated) {
      throw new AppError('Failed to add team member', 500);
    }

    return updated;
  }

  /**
   * Remove a member from a team roster.
   */
  async removeMember(
    eventId: string,
    teamId: string,
    callerSupabaseId: string,
    memberEmail: string
  ): Promise<IEventTeamDocument> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AppError('Unauthorized', 401);
    }

    const team = await this.teamRepo.findByIdAndEvent(teamId, eventId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';
    const isLeader = team.leaderEmail.toLowerCase() === callerUser.email.toLowerCase();

    if (!isOwner && !isAdmin && !isLeader) {
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      const isStaffManager =
        membership &&
        membership.status === 'ACTIVE' &&
        (membership.role === 'HOST' || membership.role === 'COORDINATOR');

      if (!isStaffManager) {
        throw new AppError('Forbidden: Only organizers or team leaders can remove members', 403);
      }
    }

    const normalizedEmail = memberEmail.toLowerCase().trim();
    if (team.leaderEmail.toLowerCase() === normalizedEmail) {
      throw new AppError('Cannot remove team leader from team roster', 400);
    }

    const updated = await this.teamRepo.removeMember(teamId, eventId, normalizedEmail);
    if (!updated) {
      throw new AppError('Failed to remove team member', 500);
    }

    return updated;
  }

  /**
   * Delete team.
   */
  async deleteTeam(
    eventId: string,
    teamId: string,
    callerSupabaseId: string
  ): Promise<void> {
    await this.assertCanManageTeams(eventId, callerSupabaseId);

    const team = await this.teamRepo.findByIdAndEvent(teamId, eventId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const deleted = await this.teamRepo.deleteTeam(teamId, eventId);
    if (!deleted) {
      throw new AppError('Failed to delete team', 500);
    }
  }

  /**
   * Attendee Self-Service: Find the caller's team for an event.
   */
  async getMyTeam(eventId: string, callerSupabaseId: string): Promise<IEventTeamDocument | null> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser || !callerUser.email) {
      return null;
    }
    return await this.teamRepo.findByMemberEmail(eventId, callerUser.email);
  }

  /**
   * Attendee Self-Service: Create a new team where caller is the leader.
   */
  async createAttendeeTeam(
    eventId: string,
    callerSupabaseId: string,
    teamName: string,
    track?: string
  ): Promise<IEventTeamDocument> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser || !callerUser.email) {
      throw new AppError('Authenticated user profile not found', 401);
    }

    if (!teamName || !teamName.trim()) {
      throw new AppError('Team name is required', 400);
    }

    // Check if user is already in a team for this event
    const existingMemberTeam = await this.teamRepo.findByMemberEmail(eventId, callerUser.email);
    if (existingMemberTeam) {
      throw new AppError('You are already part of a team in this event', 409);
    }

    // Check if team name already exists
    const duplicate = await this.teamRepo.findByEventAndName(eventId, teamName);
    if (duplicate) {
      throw new AppError(`A team named "${teamName.trim()}" already exists`, 409);
    }

    return await this.teamRepo.createTeam({
      eventId,
      teamName: teamName.trim(),
      track: track ? track.trim() : 'General',
      leaderName: callerUser.name,
      leaderEmail: callerUser.email.toLowerCase().trim(),
      members: [
        {
          name: callerUser.name,
          email: callerUser.email.toLowerCase().trim(),
          role: 'Team Lead',
          checkedIn: false,
        },
      ],
      status: 'FORMED',
      createdBy: callerUser._id,
    });
  }

  /**
   * Attendee Self-Service: Join an existing team by teamId or teamName.
   */
  async joinAttendeeTeam(
    eventId: string,
    callerSupabaseId: string,
    teamIdOrName: string
  ): Promise<IEventTeamDocument> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser || !callerUser.email) {
      throw new AppError('Authenticated user profile not found', 401);
    }

    // Check if already in a team
    const alreadyIn = await this.teamRepo.findByMemberEmail(eventId, callerUser.email);
    if (alreadyIn) {
      throw new AppError('You are already part of a team in this event', 409);
    }

    // Find target team
    let targetTeam: IEventTeamDocument | null = null;
    if (mongoose.Types.ObjectId.isValid(teamIdOrName)) {
      targetTeam = await this.teamRepo.findByIdAndEvent(teamIdOrName, eventId);
    }
    if (!targetTeam) {
      targetTeam = await this.teamRepo.findByEventAndName(eventId, teamIdOrName);
    }

    if (!targetTeam) {
      throw new AppError('Target team not found in this event', 404);
    }

    if (targetTeam.members.length >= 6) {
      throw new AppError('Target team has reached maximum member limit (6 members)', 400);
    }

    const updated = await this.teamRepo.addMember(targetTeam._id.toString(), eventId, {
      name: callerUser.name,
      email: callerUser.email.toLowerCase().trim(),
      role: 'Member',
      checkedIn: false,
    });

    if (!updated) {
      throw new AppError('Failed to join team', 500);
    }

    return updated;
  }

  /**
   * Attendee Self-Service: Submit project details for the attendee's team.
   */
  async submitAttendeeProject(
    eventId: string,
    callerSupabaseId: string,
    projectData: {
      projectTitle?: string;
      projectDescription?: string;
      repoUrl?: string;
      demoUrl?: string;
    }
  ): Promise<IEventTeamDocument> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser || !callerUser.email) {
      throw new AppError('Authenticated user profile not found', 401);
    }

    const team = await this.teamRepo.findByMemberEmail(eventId, callerUser.email);
    if (!team) {
      throw new AppError('You are not part of an active team in this event', 404);
    }

    const updated = await this.teamRepo.updateTeam(team._id.toString(), eventId, {
      projectTitle: projectData.projectTitle?.trim(),
      projectDescription: projectData.projectDescription?.trim(),
      repoUrl: projectData.repoUrl?.trim(),
      demoUrl: projectData.demoUrl?.trim(),
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });

    if (!updated) {
      throw new AppError('Failed to update project submission', 500);
    }

    return updated;
  }
}

export const eventTeamService = new EventTeamService();

