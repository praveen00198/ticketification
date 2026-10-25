import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  mongoEventRubricRepository,
  MongoEventRubricRepository,
} from '../repositories/mongo-event-rubric.repository';
import {
  mongoEventEvaluationRepository,
  MongoEventEvaluationRepository,
  EvaluationFilterOptions,
} from '../repositories/mongo-event-evaluation.repository';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  mongoEventMemberRepository,
  MongoEventMemberRepository,
} from '../repositories/mongo-event-member.repository';
import {
  mongoEventTeamRepository,
  MongoEventTeamRepository,
} from '../repositories/mongo-event-team.repository';
import {
  mongoUserRepository,
  MongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  IEventRubricDocument,
  IRubricCriterion,
  ScoringStatus,
} from '../../../db/mongo/models/event-rubric.model';
import {
  IEventEvaluationDocument,
  ICriterionScore,
} from '../../../db/mongo/models/event-evaluation.model';

export interface CreateRubricDTO {
  title: string;
  track?: string;
  criteria?: IRubricCriterion[];
}

export interface UpdateRubricDTO {
  title?: string;
  track?: string;
  criteria?: IRubricCriterion[];
  scoringStatus?: ScoringStatus;
}

export interface SubmitEvaluationDTO {
  rubricId: string;
  teamId: string;
  scores: ICriterionScore[];
  generalFeedback?: string;
}

export class EventEvaluationService {
  constructor(
    private rubricRepo: MongoEventRubricRepository = mongoEventRubricRepository,
    private evalRepo: MongoEventEvaluationRepository = mongoEventEvaluationRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private teamRepo: MongoEventTeamRepository = mongoEventTeamRepository,
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

  private async assertCanManageRubrics(
    eventId: string,
    callerSupabaseId: string
  ): Promise<{ event: any; callerMongoId: mongoose.Types.ObjectId }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Caller profile not found', 403);

    if (callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN') {
      return { event, callerMongoId: callerUser._id };
    }

    if (this.isEventOwner(event, callerSupabaseId, callerUser._id)) {
      return { event, callerMongoId: callerUser._id };
    }

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (
      membership &&
      membership.status === 'ACTIVE' &&
      (membership.role === 'HOST' || membership.role === 'COORDINATOR')
    ) {
      return { event, callerMongoId: callerUser._id };
    }

    throw new AppError('Forbidden: Only event hosts or coordinators can manage judging rubrics', 403);
  }

  // --- Rubric Workflows ---

  async createRubric(
    eventId: string,
    callerSupabaseId: string,
    dto: CreateRubricDTO
  ): Promise<IEventRubricDocument> {
    const { callerMongoId } = await this.assertCanManageRubrics(eventId, callerSupabaseId);

    if (!dto.title || !dto.title.trim()) {
      throw new AppError('Rubric title is required', 400);
    }

    return await this.rubricRepo.createRubric({
      eventId,
      title: dto.title.trim(),
      track: dto.track?.trim() || 'General',
      criteria: dto.criteria && dto.criteria.length > 0 ? dto.criteria : undefined,
      scoringStatus: 'OPEN',
      createdBy: callerMongoId,
    });
  }

  async getRubrics(
    eventId: string,
    callerSupabaseId: string,
    track?: string
  ): Promise<IEventRubricDocument[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Unauthorized', 401);

    return await this.rubricRepo.findByEvent(eventId, track);
  }

  async updateRubric(
    eventId: string,
    rubricId: string,
    callerSupabaseId: string,
    dto: UpdateRubricDTO
  ): Promise<IEventRubricDocument> {
    await this.assertCanManageRubrics(eventId, callerSupabaseId);

    const rubric = await this.rubricRepo.findByIdAndEvent(rubricId, eventId);
    if (!rubric) throw new AppError('Rubric not found in this event', 404);

    const updated = await this.rubricRepo.updateRubric(rubricId, eventId, dto);
    if (!updated) throw new AppError('Failed to update rubric', 500);

    return updated;
  }

  async updateScoringStatus(
    eventId: string,
    rubricId: string,
    callerSupabaseId: string,
    status: ScoringStatus
  ): Promise<IEventRubricDocument> {
    await this.assertCanManageRubrics(eventId, callerSupabaseId);

    const rubric = await this.rubricRepo.findByIdAndEvent(rubricId, eventId);
    if (!rubric) throw new AppError('Rubric not found in this event', 404);

    const updated = await this.rubricRepo.updateRubric(rubricId, eventId, {
      scoringStatus: status,
    });
    if (!updated) throw new AppError('Failed to update scoring status', 500);

    return updated;
  }

  async deleteRubric(
    eventId: string,
    rubricId: string,
    callerSupabaseId: string
  ): Promise<void> {
    await this.assertCanManageRubrics(eventId, callerSupabaseId);

    const rubric = await this.rubricRepo.findByIdAndEvent(rubricId, eventId);
    if (!rubric) throw new AppError('Rubric not found in this event', 404);

    const deleted = await this.rubricRepo.deleteRubric(rubricId, eventId);
    if (!deleted) throw new AppError('Failed to delete rubric', 500);
  }

  // --- Scorecard / Evaluation Workflows ---

  async submitEvaluation(
    eventId: string,
    callerSupabaseId: string,
    dto: SubmitEvaluationDTO
  ): Promise<IEventEvaluationDocument> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Unauthorized', 401);

    // Verify caller is active EVALUATOR, COORDINATOR, or HOST
    let evaluatorMemberId: mongoose.Types.ObjectId;
    let evaluatorName = callerUser.email;

    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (membership && membership.status === 'ACTIVE') {
      const allowedRoles = ['HOST', 'COORDINATOR', 'EVALUATOR', 'JUDGE'];
      const hasPermission = membership.permissions?.includes('SCORE_ASSIGNED_TEAMS');
      if (!allowedRoles.includes(membership.role) && !hasPermission) {
        throw new AppError('Forbidden: Only assigned judges, evaluators, or organizers can submit scorecards', 403);
      }
      evaluatorMemberId = membership._id;
      evaluatorName = membership.userEmail;
    } else if (isOwner || isAdmin) {
      evaluatorMemberId = callerUser._id;
      evaluatorName = callerUser.email;
    } else {
      throw new AppError('Forbidden: Only assigned judges, evaluators, or organizers can submit scorecards', 403);
    }

    // Verify Rubric exists and is currently OPEN
    const rubric = await this.rubricRepo.findByIdAndEvent(dto.rubricId, eventId);
    if (!rubric) throw new AppError('Rubric not found in this event', 404);

    if (rubric.scoringStatus !== 'OPEN') {
      throw new AppError(
        `Scoring is ${rubric.scoringStatus.toLowerCase()} for this rubric. No new scorecards can be accepted.`,
        400
      );
    }

    // Verify Team exists
    const team = await this.teamRepo.findByIdAndEvent(dto.teamId, eventId);
    if (!team) throw new AppError('Team not found in this event', 404);

    // Validate and score each criterion
    if (!dto.scores || dto.scores.length === 0) {
      throw new AppError('Scorecard must include scores for rubric criteria', 400);
    }

    let calculatedWeightedTotal = 0;
    const criterionMap = new Map(rubric.criteria.map((c) => [c.key, c]));

    for (const s of dto.scores) {
      const criterion = criterionMap.get(s.criteriaKey);
      if (!criterion) {
        throw new AppError(`Unknown criterion key: "${s.criteriaKey}"`, 400);
      }

      if (typeof s.score !== 'number' || s.score < 0 || s.score > criterion.maxScore) {
        throw new AppError(
          `Score for "${criterion.label}" must be between 0 and ${criterion.maxScore}`,
          400
        );
      }

      // Weight contribution = (score / maxScore) * weight
      calculatedWeightedTotal += (s.score / criterion.maxScore) * criterion.weight;
    }

    return await this.evalRepo.submitEvaluation({
      eventId,
      rubricId: dto.rubricId,
      teamId: dto.teamId,
      evaluatorMemberId,
      evaluatorEmail: callerUser.email,
      evaluatorName,
      scores: dto.scores,
      weightedTotal: Math.round(calculatedWeightedTotal * 100) / 100,
      generalFeedback: dto.generalFeedback?.trim(),
      status: 'SUBMITTED',
    });
  }

  /**
   * Evaluator fetches their own scorecard for a team.
   */
  async getMyEvaluationForTeam(
    eventId: string,
    teamId: string,
    callerSupabaseId: string
  ): Promise<IEventEvaluationDocument | null> {
    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Unauthorized', 401);

    const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    const evaluatorMemberId = membership?._id || callerUser._id;

    return await this.evalRepo.findByEventAndTeamAndEvaluator(eventId, teamId, evaluatorMemberId);
  }

  /**
   * Host / Coordinator lists all evaluations.
   * Blind Review Isolation Invariant: Evaluators cannot query all other judges' scorecards!
   */
  async getAllEvaluations(
    eventId: string,
    callerSupabaseId: string,
    filters?: EvaluationFilterOptions
  ): Promise<IEventEvaluationDocument[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Unauthorized', 401);

    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    let isManager = false;
    if (!isOwner && !isAdmin) {
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      if (
        membership &&
        membership.status === 'ACTIVE' &&
        (membership.role === 'HOST' || membership.role === 'COORDINATOR')
      ) {
        isManager = true;
      }
    }

    if (!isOwner && !isAdmin && !isManager) {
      // Blind review enforcement: Non-managers can ONLY see their own scorecards!
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      if (!membership || membership.status !== 'ACTIVE') {
        throw new AppError('Forbidden: Access requires active event membership', 403);
      }
      return await this.evalRepo.findByEvent(eventId, {
        ...filters,
        evaluatorMemberId: membership._id,
      });
    }

    return await this.evalRepo.findByEvent(eventId, filters);
  }

  /**
   * Get Event Leaderboard.
   * Blind Review Invariant: Evaluators and Participants can view the leaderboard ONLY
   * if rubrics have been marked FINALIZED. Organizers can inspect live aggregates at any time.
   */
  async getLeaderboard(
    eventId: string,
    callerSupabaseId: string,
    track?: string
  ): Promise<any[]> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) throw new AppError('Unauthorized', 401);

    const isOwner = this.isEventOwner(event, callerSupabaseId, callerUser._id);
    const isAdmin = callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN';

    let isManager = false;
    if (!isOwner && !isAdmin) {
      const membership = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
      if (
        membership &&
        membership.status === 'ACTIVE' &&
        (membership.role === 'HOST' || membership.role === 'COORDINATOR')
      ) {
        isManager = true;
      }
    }

    // If not organizer, check whether scoring has been finalized
    if (!isOwner && !isAdmin && !isManager) {
      const rubrics = await this.rubricRepo.findByEvent(eventId, track);
      const isAnyFinalized = rubrics.some((r) => r.scoringStatus === 'FINALIZED');
      if (!isAnyFinalized) {
        throw new AppError(
          'Blind review in effect: Leaderboard is sealed until organizers finalize scoring results.',
          403
        );
      }
    }

    return await this.evalRepo.aggregateLeaderboard(eventId, track);
  }
}

export const eventEvaluationService = new EventEvaluationService();
