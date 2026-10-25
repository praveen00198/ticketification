import mongoose from 'mongoose';
import {
  EVENT_CAPABILITY_MATRIX,
  getEventCapabilities,
  hasCapability,
} from '../src/modules/events/utils/event-capabilities';
import {
  EventRole,
  EVENT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
} from '../src/db/mongo/models/event-member.model';
import {
  AssignmentRole,
  ASSIGNMENT_ROLES,
} from '../src/db/mongo/models/event-assignment.model';
import { EventLifecycleService } from '../src/modules/events/services/event-lifecycle.service';
import { EventVerificationService } from '../src/modules/events/services/event-verification.service';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventVerificationRepository } from '../src/modules/events/repositories/mongo-event-verification.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { eventAssignmentService } from '../src/modules/events/services/event-assignment.service';
import { eventEvaluationService } from '../src/modules/events/services/event-evaluation.service';

describe('Event Capabilities, Publication Lifecycle & Global Identity Architecture', () => {
  const hostMongoId = new mongoose.Types.ObjectId();
  const hostSupabaseId = 'supabase-user-host-global-identity';
  const adminMongoId = new mongoose.Types.ObjectId();
  const adminSupabaseId = 'supabase-admin-platform';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Centralized Category Capability Matrix', () => {
    it('should configure Hackathons with teams, submissions, mentors, evaluators, judges, and results', () => {
      const caps = getEventCapabilities('HACKATHON');
      expect(caps.registrations).toBe(true);
      expect(caps.ticketing).toBe(true);
      expect(caps.checkIn).toBe(true);
      expect(caps.teams).toBe(true);
      expect(caps.submissions).toBe(true);
      expect(caps.mentors).toBe(true);
      expect(caps.evaluators).toBe(true);
      expect(caps.judges).toBe(true);
      expect(caps.results).toBe(true);
      expect(caps.schedule).toBe(true);
      expect(caps.analytics).toBe(true);
    });

    it('should configure Conferences with schedules and ticketing, but without teams, mentors, or judges', () => {
      const caps = getEventCapabilities('CONFERENCE');
      expect(caps.registrations).toBe(true);
      expect(caps.ticketing).toBe(true);
      expect(caps.checkIn).toBe(true);
      expect(caps.teams).toBe(false);
      expect(caps.submissions).toBe(false);
      expect(caps.mentors).toBe(false);
      expect(caps.evaluators).toBe(false);
      expect(caps.judges).toBe(false);
      expect(caps.results).toBe(false);
      expect(caps.schedule).toBe(true);
    });

    it('should configure Workshops with mentors and sessions, but without judging rubrics or teams', () => {
      const caps = getEventCapabilities('WORKSHOP');
      expect(caps.mentors).toBe(true);
      expect(caps.teams).toBe(false);
      expect(caps.evaluators).toBe(false);
      expect(caps.judges).toBe(false);
    });

    it('should configure Sports Events with teams, judges, and results', () => {
      const caps = getEventCapabilities('SPORTS_EVENT');
      expect(caps.teams).toBe(true);
      expect(caps.judges).toBe(true);
      expect(caps.results).toBe(true);
      expect(caps.mentors).toBe(false);
    });

    it('should safely fall back to default baseline for unknown or unsupported event types', () => {
      const caps = getEventCapabilities('UNKNOWN_UNSUPPORTED_TYPE');
      expect(caps.registrations).toBe(true);
      expect(caps.ticketing).toBe(true);
      expect(caps.checkIn).toBe(true);
      expect(caps.teams).toBe(false);
      expect(caps.submissions).toBe(false);
      expect(caps.mentors).toBe(false);
      expect(caps.evaluators).toBe(false);
      expect(caps.judges).toBe(false);
      expect(caps.results).toBe(false);
    });

    it('should correctly query capabilities using hasCapability helper', () => {
      expect(hasCapability('HACKATHON', 'teams')).toBe(true);
      expect(hasCapability('CONFERENCE', 'teams')).toBe(false);
      expect(hasCapability('WORKSHOP', 'mentors')).toBe(true);
      expect(hasCapability('CONCERT', 'evaluators')).toBe(false);
      expect(hasCapability(null, 'registrations')).toBe(true);
    });
  });

  describe('2. Judge Role Reconciliation & Assignment Taxonomy', () => {
    it('should include JUDGE in canonical EVENT_ROLES and have scoring permissions', () => {
      expect(EVENT_ROLES).toContain('JUDGE');
      const perms = DEFAULT_ROLE_PERMISSIONS['JUDGE'];
      expect(perms).toContain('SCORE_ASSIGNED_TEAMS');
      expect(perms).toContain('VIEW_EVALUATION_RESULTS');
    });

    it('should include JUDGE in canonical ASSIGNMENT_ROLES', () => {
      expect(ASSIGNMENT_ROLES).toContain('JUDGE');
    });
  });

  describe('3. Individual vs Organization Publication Eligibility', () => {
    let lifecycleService: EventLifecycleService;

    beforeEach(() => {
      lifecycleService = new EventLifecycleService(
        mongoEventRepository,
        mongoUserRepository
      );
    });

    it('should permit an individual event to be published without organization verification', async () => {
      const individualEventId = new mongoose.Types.ObjectId();
      const mockIndividualEvent: any = {
        _id: individualEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'Open Community AI Meetup',
        hostingType: 'INDIVIDUAL',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        status: 'APPROVED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockIndividualEvent);
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostSupabaseId,
      } as any);
      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...mockIndividualEvent,
        status: 'PUBLISHED',
      });

      const result = await lifecycleService.transitionStatus(
        individualEventId.toString(),
        hostSupabaseId,
        'PUBLISHED'
      );

      expect(result.event.status).toBe('PUBLISHED');
      expect(result.message).toContain('PUBLISHED');
    });

    it('should block an organization event from publishing if verification is pending', async () => {
      const orgEventId = new mongoose.Types.ObjectId();
      const mockOrgEvent: any = {
        _id: orgEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'University Hackathon 2026',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        status: 'APPROVED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockOrgEvent);
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostSupabaseId,
      } as any);

      await expect(
        lifecycleService.transitionStatus(
          orgEventId.toString(),
          hostSupabaseId,
          'PUBLISHED'
        )
      ).rejects.toThrow('Organization verification is pending');
    });

    it('should block an organization event from publishing if verification was rejected', async () => {
      const orgEventId = new mongoose.Types.ObjectId();
      const mockOrgEvent: any = {
        _id: orgEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'Suspicious Conference',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'REJECTED',
        verificationStatus: 'REJECTED',
        status: 'APPROVED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockOrgEvent);
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostSupabaseId,
      } as any);

      await expect(
        lifecycleService.transitionStatus(
          orgEventId.toString(),
          hostSupabaseId,
          'PUBLISHED'
        )
      ).rejects.toThrow('Organization verification was rejected');
    });
  });

  describe('4. Approval & Automatic Publication Reconciliation', () => {
    let verificationService: EventVerificationService;

    beforeEach(() => {
      verificationService = new EventVerificationService(
        mongoEventVerificationRepository,
        mongoEventRepository,
        mongoUserRepository
      );
    });

    it('should automatically publish a SUBMITTED organization event when approved by admin if ready', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'Verified MIT Hackathon',
        status: 'SUBMITTED',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockVerification: any = {
        _id: new mongoose.Types.ObjectId(),
        eventId,
        ownerId: hostMongoId,
        riskTier: 'LOW',
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue(mockVerification);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({
        ...mockVerification,
        status: 'VERIFIED',
      });
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: adminMongoId,
        supabaseUserId: adminSupabaseId,
      } as any);

      const result = await verificationService.reviewVerification(
        eventId.toString(),
        adminSupabaseId,
        'APPROVED',
        'Official university authorization verified'
      );

      expect(result.event.status).toBe('PUBLISHED');
      expect(result.event.verificationStatus).toBe('VERIFIED');
      expect(result.event.organizationVerificationStatus).toBe('APPROVED');
      expect(mockEvent.save).toHaveBeenCalled();
      expect(result.event.statusHistory).toBeDefined();
      expect(result.event.statusHistory[0].toStatus).toBe('PUBLISHED');
    });

    it('should transition to APPROVED (not auto-publish) if event was still in DRAFT', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockDraftEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'In-Progress Draft Conference',
        status: 'DRAFT',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockVerification: any = {
        _id: new mongoose.Types.ObjectId(),
        eventId,
        ownerId: hostMongoId,
        riskTier: 'MEDIUM',
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockDraftEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue(mockVerification);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({
        ...mockVerification,
        status: 'VERIFIED',
      });
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: adminMongoId,
        supabaseUserId: adminSupabaseId,
      } as any);

      const result = await verificationService.reviewVerification(
        eventId.toString(),
        adminSupabaseId,
        'APPROVED',
        'Org approved ahead of event finalization'
      );

      expect(result.event.status).toBe('APPROVED');
      expect(result.event.verificationStatus).toBe('VERIFIED');
      expect(result.event.organizationVerificationStatus).toBe('APPROVED');
    });

    it('should reset event to DRAFT when admin rejects verification with notes', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'Unverified Organization Event',
        status: 'SUBMITTED',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockVerification: any = {
        _id: new mongoose.Types.ObjectId(),
        eventId,
        ownerId: hostMongoId,
        riskTier: 'HIGH',
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue(mockVerification);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({
        ...mockVerification,
        status: 'REJECTED',
      });
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: adminMongoId,
        supabaseUserId: adminSupabaseId,
      } as any);

      const result = await verificationService.reviewVerification(
        eventId.toString(),
        adminSupabaseId,
        'REJECTED',
        'Invalid document provided'
      );

      expect(result.event.status).toBe('DRAFT');
      expect(result.event.verificationStatus).toBe('REJECTED');
      expect(result.event.organizationVerificationStatus).toBe('REJECTED');
    });
  });
});
