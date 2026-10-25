import mongoose from 'mongoose';
import { mongoEventRepository, MongoEventRepository } from '../repositories/mongo-event.repository';
import { mongoEventCredentialRepository, MongoEventCredentialRepository } from '../repositories/mongo-event-credential.repository';
import { mongoEventCredentialCheckinRepository, MongoEventCredentialCheckinRepository } from '../repositories/mongo-event-credential-checkin.repository';
import { mongoEventMemberRepository, MongoEventMemberRepository } from '../repositories/mongo-event-member.repository';
import { mongoEventTeamRepository, MongoEventTeamRepository } from '../repositories/mongo-event-team.repository';
import { eventStorageGovernanceService, EventStorageGovernanceService } from './event-storage-governance.service';
import { mongoAuditLogRepository, MongoAuditLogRepository } from '../repositories/mongo-audit-log.repository';
import { NotFoundError } from '../../../middlewares/error.middleware';

export interface EventTypeFeatures {
  hasCompetition: boolean;
  hasMentors: boolean;
  hasRubrics: boolean;
  hasSessions: boolean;
  hasHighThroughputTurnstile: boolean;
  credentialTerm: string;
}

export interface EventDashboardSummary {
  event: {
    id: string;
    name: string;
    eventType: string;
    status: string;
    date: string;
    venue?: string;
    credentialTaxonomy?: string;
    features: EventTypeFeatures;
  };
  credentials: {
    total: number;
    active: number;
    checkedIn: number;
    revoked: number;
    checkInRatePercent: number;
  };
  checkins: {
    totalScans: number;
    successfulCheckins: number;
    duplicateRejections: number;
    revokedRejections: number;
    velocityLast15Mins: number;
  };
  staff: {
    total: number;
    coordinators: number;
    volunteers: number;
    mentors: number;
    evaluators: number;
    judges: number;
  };
  teams?: {
    totalTeams: number;
    totalMembers: number;
  };
  storage: {
    totalStorageBytes: number;
    quotaBytes: number;
    usagePercent: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    actorRole: string;
    createdAt: string;
  }>;
}

export class EventDashboardService {
  constructor(
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private credRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private checkinRepo: MongoEventCredentialCheckinRepository = mongoEventCredentialCheckinRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private teamRepo: MongoEventTeamRepository = mongoEventTeamRepository,
    private storageGovService: EventStorageGovernanceService = eventStorageGovernanceService,
    private auditRepo: MongoAuditLogRepository = mongoAuditLogRepository
  ) {}

  /**
   * Derive type-aware feature capabilities based on event type.
   */
  deriveFeatures(eventType: string = 'OTHER', credentialTaxonomy?: string): EventTypeFeatures {
    const normalizedType = (eventType || 'OTHER').toUpperCase().trim();

    const isCompetition = ['HACKATHON', 'COMPETITION', 'COLLEGE_FEST'].includes(normalizedType);
    const isConference = ['CONFERENCE', 'SUMMIT', 'SEMINAR'].includes(normalizedType);
    const isHighVelocity = ['CONCERT', 'FESTIVAL', 'COLLEGE_FEST', 'SPORTS'].includes(normalizedType);

    let credentialTerm = 'Pass';
    if (credentialTaxonomy) {
      credentialTerm = credentialTaxonomy;
    } else if (normalizedType === 'CONFERENCE') {
      credentialTerm = 'Badge';
    } else if (normalizedType === 'CONCERT' || normalizedType === 'FESTIVAL') {
      credentialTerm = 'Ticket';
    } else if (normalizedType === 'HACKATHON') {
      credentialTerm = 'Hacker Pass';
    } else if (normalizedType === 'WORKSHOP') {
      credentialTerm = 'Workshop Pass';
    }

    return {
      hasCompetition: isCompetition,
      hasMentors: ['HACKATHON', 'COMPETITION'].includes(normalizedType),
      hasRubrics: isCompetition,
      hasSessions: isConference,
      hasHighThroughputTurnstile: isHighVelocity,
      credentialTerm,
    };
  }

  /**
   * High-performance aggregated telemetry compilation for the Host Console.
   */
  async getDashboardSummary(eventId: string): Promise<EventDashboardSummary> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const eventType = (event.eventType || 'OTHER').toUpperCase();
    const features = this.deriveFeatures(eventType, (event as any).credentialTaxonomy);

    // Parallel aggregate queries
    const [credMetrics, checkinStats, members, storageMetrics, auditLogs, teams] = await Promise.all([
      this.credRepo.getMetrics(eventId).catch(() => ({ total: 0, active: 0, checkedIn: 0, revoked: 0 })),
      this.checkinRepo.getCheckinStats(eventId).catch(() => ({
        totalScans: 0,
        successfulCheckins: 0,
        duplicateRejections: 0,
        revokedRejections: 0,
        velocityLast15Mins: 0,
      })),
      this.memberRepo.listEventMembers(eventId).catch(() => []),
      this.storageGovService.getEventStorageMetrics(eventId).catch(() => ({
        eventId,
        totalBytes: 0,
        totalBytesFormatted: '0 B',
        quotaBytes: 1024 * 1024 * 1024,
        quotaBytesFormatted: '1024 MB',
        usedPercentage: 0,
        isNearQuota: false,
        isQuotaExceeded: false,
        breakdown: {
          credentials: { count: 0, bytes: 0, formatted: '0 B' },
          exports: { count: 0, bytes: 0, formatted: '0 B' },
          templates: { count: 0, bytes: 0, formatted: '0 B' },
        },
        recentExports: [],
      })),
      this.auditRepo.findByEvent(eventId, {}, { limit: 5 }).catch(() => ({ logs: [], total: 0, page: 1, totalPages: 1 })),
      features.hasCompetition
        ? this.teamRepo.findByEvent(eventId).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Calculate check-in rate
    const checkInRatePercent =
      credMetrics.total > 0
        ? Math.round((credMetrics.checkedIn / credMetrics.total) * 100)
        : 0;

    // Categorize staff members
    let coordinators = 0;
    let volunteers = 0;
    let mentors = 0;
    let evaluators = 0;
    let judges = 0;

    for (const m of members) {
      const role = (m.role || '').toUpperCase();
      if (role === 'COORDINATOR') coordinators++;
      else if (role === 'VOLUNTEER') volunteers++;
      else if (role === 'MENTOR') mentors++;
      else if (role === 'EVALUATOR') evaluators++;
      else if (role === 'JUDGE') judges++;
    }

    // Team calculations (if competition)
    let teamSummary: { totalTeams: number; totalMembers: number } | undefined = undefined;
    if (features.hasCompetition) {
      const totalTeams = teams.length;
      let totalMembers = 0;
      for (const t of teams) {
        totalMembers += (t.members || []).length;
      }
      teamSummary = { totalTeams, totalMembers };
    }

    // Resolve date and venue cleanly across schema variants
    let dateStr = new Date().toISOString().split('T')[0];
    if ((event as any).date) {
      const rawDate = (event as any).date;
      dateStr = rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : String(rawDate);
    } else if (event.schedule?.startAt) {
      const rawDate = event.schedule.startAt;
      dateStr = rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : String(rawDate);
    }

    let venueStr: string | undefined = undefined;
    if (typeof (event as any).venue === 'string') {
      venueStr = (event as any).venue;
    } else if (event.venue) {
      venueStr = event.venue.name || event.venue.address || undefined;
    }

    const taxonomy =
      (event as any).credentialTaxonomy || (event as any).credentialTerminology || undefined;

    return {
      event: {
        id: event._id.toString(),
        name: event.name,
        eventType,
        status: event.status,
        date: dateStr,
        venue: venueStr,
        credentialTaxonomy: taxonomy,
        features,
      },
      credentials: {
        total: credMetrics.total,
        active: credMetrics.active,
        checkedIn: credMetrics.checkedIn,
        revoked: credMetrics.revoked,
        checkInRatePercent,
      },
      checkins: {
        totalScans: checkinStats.totalScans,
        successfulCheckins: checkinStats.successfulCheckins,
        duplicateRejections: checkinStats.duplicateRejections,
        revokedRejections: checkinStats.revokedRejections,
        velocityLast15Mins: checkinStats.velocityLast15Mins,
      },
      staff: {
        total: members.length,
        coordinators,
        volunteers,
        mentors,
        evaluators,
        judges,
      },
      teams: teamSummary,
      storage: {
        totalStorageBytes: storageMetrics.totalBytes,
        quotaBytes: storageMetrics.quotaBytes,
        usagePercent: storageMetrics.usedPercentage,
      },
      recentAuditLogs: (auditLogs.logs || []).map((l: any) => ({
        id: l._id.toString(),
        action: l.action,
        actorEmail: l.actorEmail,
        actorRole: l.actorRole,
        createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
      })),
    };
  }
}

export const eventDashboardService = new EventDashboardService();
