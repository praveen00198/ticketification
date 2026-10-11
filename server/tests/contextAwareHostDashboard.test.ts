import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import {
  EventDashboardService,
  eventDashboardService,
} from '../src/modules/events/services/event-dashboard.service';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventCredentialCheckinRepository } from '../src/modules/events/repositories/mongo-event-credential-checkin.repository';
import { MongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { MongoEventTeamRepository } from '../src/modules/events/repositories/mongo-event-team.repository';
import { EventStorageGovernanceService } from '../src/modules/events/services/event-storage-governance.service';
import { MongoAuditLogRepository } from '../src/modules/events/repositories/mongo-audit-log.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';

// Mock auth middleware
jest.mock('../src/middlewares/auth.middleware', () => {
  const handler = (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.includes('host-token')) {
      req.user = { id: 'host-user-id', role: 'USER', email: 'host@test.com' };
    } else if (authHeader.includes('coordinator-token')) {
      req.user = { id: 'coord-user-id', role: 'USER', email: 'coord@test.com' };
    } else if (authHeader.includes('volunteer-token')) {
      req.user = { id: 'volunteer-user-id', role: 'USER', email: 'volunteer@test.com' };
    } else if (authHeader.includes('attacker-token')) {
      req.user = { id: 'attacker-user-id', role: 'USER', email: 'attacker@test.com' };
    } else {
      req.user = { id: 'host-user-id', role: 'USER', email: 'host@test.com' };
    }
    next();
  };
  return {
    authMiddleware: handler,
    authenticateUser: handler,
    default: handler,
  };
});

describe('Phase 19: Context-Aware Host Dashboard Console Engine', () => {
  const eventId1 = new mongoose.Types.ObjectId().toString();
  const eventId2 = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Context-Aware Feature Adaptation Rules', () => {
    it('should derive competition and mentor tools for HACKATHON events', () => {
      const features = eventDashboardService.deriveFeatures('HACKATHON');
      expect(features.hasCompetition).toBe(true);
      expect(features.hasMentors).toBe(true);
      expect(features.hasRubrics).toBe(true);
      expect(features.credentialTerm).toBe('Hacker Pass');
    });

    it('should derive turnstile and suppress competition for CONCERT events', () => {
      const features = eventDashboardService.deriveFeatures('CONCERT');
      expect(features.hasCompetition).toBe(false);
      expect(features.hasMentors).toBe(false);
      expect(features.hasHighThroughputTurnstile).toBe(true);
      expect(features.credentialTerm).toBe('Ticket');
    });

    it('should derive session schedules and badge term for CONFERENCE events', () => {
      const features = eventDashboardService.deriveFeatures('CONFERENCE');
      expect(features.hasCompetition).toBe(false);
      expect(features.hasSessions).toBe(true);
      expect(features.credentialTerm).toBe('Badge');
    });

    it('should support custom credentialTaxonomy overriding defaults', () => {
      const features = eventDashboardService.deriveFeatures('CONFERENCE', 'VIP Wristband');
      expect(features.credentialTerm).toBe('VIP Wristband');
    });
  });

  describe('2. Multi-Module Aggregated Telemetry Compilation', () => {
    it('should compile complete dashboard summary across credential, checkin, staff, storage, and audit systems', async () => {
      const mockEvent: any = {
        _id: new mongoose.Types.ObjectId(eventId1),
        name: 'OmniHacks 2026',
        eventType: 'HACKATHON',
        status: 'PUBLISHED',
        date: new Date('2026-11-20'),
        venue: 'Grand Tech Arena',
      };

      const mockEventRepo = {
        findById: jest.fn().mockResolvedValue(mockEvent),
      };
      const mockCredRepo = {
        getMetrics: jest.fn().mockResolvedValue({ total: 200, active: 150, checkedIn: 45, revoked: 5 }),
      };
      const mockCheckinRepo = {
        getCheckinStats: jest.fn().mockResolvedValue({
          totalScans: 55,
          successfulCheckins: 45,
          duplicateRejections: 8,
          revokedRejections: 2,
          velocityLast15Mins: 12,
        }),
      };
      const mockMemberRepo = {
        listEventMembers: jest.fn().mockResolvedValue([
          { role: 'COORDINATOR' },
          { role: 'VOLUNTEER' },
          { role: 'VOLUNTEER' },
          { role: 'MENTOR' },
          { role: 'EVALUATOR' },
        ]),
      };
      const mockTeamRepo = {
        findByEvent: jest.fn().mockResolvedValue([
          { members: [1, 2, 3] },
          { members: [4, 5] },
        ]),
      };
      const mockStorageGov = {
        getEventStorageMetrics: jest.fn().mockResolvedValue({
          totalBytes: 150000000,
          quotaBytes: 1073741824,
          usedPercentage: 14,
        }),
      };
      const mockAuditRepo = {
        findByEvent: jest.fn().mockResolvedValue({
          logs: [
            {
              _id: new mongoose.Types.ObjectId(),
              action: 'STAFF_INVITED',
              actorEmail: 'host@test.com',
              actorRole: 'HOST',
              createdAt: new Date(),
            },
          ],
          total: 1,
        }),
      };

      const service = new EventDashboardService(
        mockEventRepo as any,
        mockCredRepo as any,
        mockCheckinRepo as any,
        mockMemberRepo as any,
        mockTeamRepo as any,
        mockStorageGov as any,
        mockAuditRepo as any
      );

      const summary = await service.getDashboardSummary(eventId1);

      expect(summary.event.name).toBe('OmniHacks 2026');
      expect(summary.event.features.hasCompetition).toBe(true);
      expect(summary.credentials.total).toBe(200);
      expect(summary.credentials.checkedIn).toBe(45);
      expect(summary.credentials.checkInRatePercent).toBe(23); // 45 / 200 = 22.5% -> 23%
      expect(summary.checkins.velocityLast15Mins).toBe(12);
      expect(summary.staff.total).toBe(5);
      expect(summary.staff.volunteers).toBe(2);
      expect(summary.staff.coordinators).toBe(1);
      expect(summary.teams?.totalTeams).toBe(2);
      expect(summary.teams?.totalMembers).toBe(5);
      expect(summary.storage.usagePercent).toBe(14);
      expect(summary.recentAuditLogs).toHaveLength(1);
    });
  });

  describe('3. Zero-Trust RBAC & IDOR Boundary on Dashboard Console', () => {
    it('GET /api/events/:eventId/dashboard-summary should allow authorized Host and return 200 OK', async () => {
      jest.spyOn(EventJobQueueService.prototype, 'authorizeHostOrCoordinator').mockResolvedValue(true as any);
      jest.spyOn(eventDashboardService, 'getDashboardSummary').mockResolvedValue({
        event: {
          id: eventId1,
          name: 'Tech Summit 2026',
          eventType: 'CONFERENCE',
          status: 'EVENT_LIVE',
          date: '2026-12-01',
          features: {
            hasCompetition: false,
            hasMentors: false,
            hasRubrics: false,
            hasSessions: true,
            hasHighThroughputTurnstile: false,
            credentialTerm: 'Badge',
          },
        },
        credentials: { total: 500, active: 400, checkedIn: 95, revoked: 5, checkInRatePercent: 19 },
        checkins: { totalScans: 100, successfulCheckins: 95, duplicateRejections: 4, revokedRejections: 1, velocityLast15Mins: 20 },
        staff: { total: 10, coordinators: 2, volunteers: 8, mentors: 0, evaluators: 0 },
        storage: { totalStorageBytes: 50000000, quotaBytes: 1073741824, usagePercent: 5 },
        recentAuditLogs: [],
      });

      const res = await request(app)
        .get(`/api/events/${eventId1}/dashboard-summary`)
        .set('Authorization', 'Bearer host-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.eventType).toBe('CONFERENCE');
      expect(res.body.data.credentials.total).toBe(500);
    });

    it('GET /api/events/:eventId/dashboard-summary should reject unauthorized volunteer with HTTP 403 Forbidden', async () => {
      const forbiddenError = new Error('Access denied: Host or Coordinator role required') as any;
      forbiddenError.statusCode = 403;
      jest.spyOn(EventJobQueueService.prototype, 'authorizeHostOrCoordinator').mockRejectedValue(forbiddenError);

      const res = await request(app)
        .get(`/api/events/${eventId1}/dashboard-summary`)
        .set('Authorization', 'Bearer volunteer-token');

      expect(res.status).toBe(403);
    });

    it('GET /api/events/:eventId/dashboard-summary should prevent cross-event IDOR leaks', async () => {
      const idorError = new Error('Access denied: Unauthorized access to this event') as any;
      idorError.statusCode = 403;
      jest.spyOn(EventJobQueueService.prototype, 'authorizeHostOrCoordinator').mockImplementation(async (targetEventId: string) => {
        if (targetEventId === eventId2) {
          throw idorError;
        }
        return true as any;
      });

      const res = await request(app)
        .get(`/api/events/${eventId2}/dashboard-summary`)
        .set('Authorization', 'Bearer attacker-token');

      expect(res.status).toBe(403);
    });
  });
});
