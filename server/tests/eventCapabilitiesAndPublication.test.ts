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
import { eventMemberService } from '../src/modules/events/services/event-member.service';
import { eventDashboardService, EventDashboardService } from '../src/modules/events/services/event-dashboard.service';
import { GuestService } from '../src/modules/guests/services/guest.service';
import { guestImportService } from '../src/modules/guests/services/guest-import.service';
import { validatePublicationReadiness } from '../src/modules/events/utils/publication-readiness';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventAssignmentRepository } from '../src/modules/events/repositories/mongo-event-assignment.repository';
import { mongoEventRubricRepository } from '../src/modules/events/repositories/mongo-event-rubric.repository';
import { EventModel } from '../src/db/mongo/models/event.model';
import { ValidationError } from '../src/middlewares/error.middleware';

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

    it('should permit an organization event with visibility === "private" to be published without organization verification', async () => {
      const privateOrgEventId = new mongoose.Types.ObjectId();
      const mockPrivateOrgEvent: any = {
        _id: privateOrgEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
        name: 'Internal Org Strategy Hackathon',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        status: 'APPROVED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockPrivateOrgEvent);
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostSupabaseId,
      } as any);
      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...mockPrivateOrgEvent,
        status: 'PUBLISHED',
      });

      const result = await lifecycleService.transitionStatus(
        privateOrgEventId.toString(),
        hostSupabaseId,
        'PUBLISHED'
      );

      expect(result.event.status).toBe('PUBLISHED');
      expect(result.message).toContain('PUBLISHED');
    });

    it('should exempt private organization events with pending verification status from publication readiness errors', () => {
      const mockPrivateOrgEvent: any = {
        name: 'Private Executive Workshop',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
      };

      const result = validatePublicationReadiness(mockPrivateOrgEvent);
      expect(result.isReady).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should generate publication readiness errors for public organization events when verification is pending', () => {
      const mockPublicOrgEvent: any = {
        name: 'Public Developer Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
      };

      const result = validatePublicationReadiness(mockPublicOrgEvent);
      expect(result.isReady).toBe(false);
      expect(result.errors).toContain(
        'Organization verification is pending. The event cannot be published until verified.'
      );
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

  describe('5. Guest Roster Attendance Mode Access Enforcement', () => {
    let guestService: GuestService;
    const mockGuestRepo: any = {
      create: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
      findByEventId: jest.fn(),
      countByEventId: jest.fn(),
      update: jest.fn(),
    };
    const mockEventRepo: any = {
      findById: jest.fn(),
      findByIdAndOwner: jest.fn(),
    };
    const mockTicketTypeRepo: any = {
      findByEventAndName: jest.fn(),
      create: jest.fn(),
    };

    beforeEach(() => {
      guestService = new GuestService(mockGuestRepo, mockEventRepo, mockTicketTypeRepo);
      jest.clearAllMocks();
    });

    it('should reject guest roster creation when event uses native registration (TICKETIFICATION_REGISTRATION)', async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      mockEventRepo.findById.mockResolvedValue({
        id: eventId,
        createdBy: hostSupabaseId,
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      });

      await expect(
        guestService.createGuest(eventId, hostSupabaseId, {
          name: 'Jane Attendee',
          email: 'jane@example.com',
        })
      ).rejects.toThrow(/Guest roster operations are not permitted for events using native platform registration/i);
    });

    it('should permit guest roster creation when event uses external guest roster (EXISTING_ATTENDEE_DATA)', async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      mockEventRepo.findById.mockResolvedValue({
        id: eventId,
        createdBy: hostSupabaseId,
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      });
      mockTicketTypeRepo.findByEventAndName.mockResolvedValue({ id: 'tt-general', name: 'GENERAL' });
      mockGuestRepo.create.mockResolvedValue({
        id: 'guest-123',
        eventId,
        name: 'Jane Attendee',
        email: 'jane@example.com',
        ticketTypeId: 'tt-general',
      });

      const guest = await guestService.createGuest(eventId, hostSupabaseId, {
        name: 'Jane Attendee',
        email: 'jane@example.com',
      });

      expect(guest).toBeDefined();
      expect(guest.name).toBe('Jane Attendee');
    });

    it('should permit guest creation when attendanceMode is undefined (legacy fallback)', async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      mockEventRepo.findById.mockResolvedValue({
        id: eventId,
        createdBy: hostSupabaseId,
      });
      mockTicketTypeRepo.findByEventAndName.mockResolvedValue({ id: 'tt-general', name: 'GENERAL' });
      mockGuestRepo.create.mockResolvedValue({
        id: 'guest-legacy',
        eventId,
        name: 'Legacy Attendee',
        email: 'legacy@example.com',
      });

      const guest = await guestService.createGuest(eventId, hostSupabaseId, {
        name: 'Legacy Attendee',
        email: 'legacy@example.com',
      });

      expect(guest).toBeDefined();
      expect(guest.name).toBe('Legacy Attendee');
    });

    it('should reject guest import authorization when Mongo event uses TICKETIFICATION_REGISTRATION', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockMongoEvent = {
        _id: eventId,
        ownerSupabaseId: hostSupabaseId,
        ownerId: hostMongoId,
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      };

      jest.spyOn(EventModel, 'findById').mockResolvedValue(mockMongoEvent as any);

      await expect(
        guestImportService.checkEventAuthorization(eventId.toString(), hostSupabaseId)
      ).rejects.toThrow(/Guest roster operations are not permitted for events using native platform registration/i);
    });

    it('should permit guest import authorization when Mongo event uses EXISTING_ATTENDEE_DATA', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockMongoEvent = {
        _id: eventId,
        ownerSupabaseId: hostSupabaseId,
        ownerId: hostMongoId,
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      };

      jest.spyOn(EventModel, 'findById').mockResolvedValue(mockMongoEvent as any);

      const result = await guestImportService.checkEventAuthorization(eventId.toString(), hostSupabaseId);
      expect(result.isMongo).toBe(true);
      expect(result.event).toBeDefined();
    });

    it('should correctly derive hasGuestRoster feature flag based on attendanceMode', () => {
      const nativeFeatures = eventDashboardService.deriveFeatures(
        'CONFERENCE',
        undefined,
        'TICKETIFICATION_REGISTRATION'
      );
      expect(nativeFeatures.hasGuestRoster).toBe(false);

      const rosterFeatures = eventDashboardService.deriveFeatures(
        'CONFERENCE',
        undefined,
        'EXISTING_ATTENDEE_DATA'
      );
      expect(rosterFeatures.hasGuestRoster).toBe(true);

      const defaultFeatures = eventDashboardService.deriveFeatures('CONFERENCE');
      expect(defaultFeatures.hasGuestRoster).toBe(false);
    });

    it('should expose hasGuestRoster in dashboard summary telemetry', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockEvent: any = {
        _id: eventId,
        eventType: 'CONFERENCE',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      };

      const customDashboardService = new EventDashboardService(
        { findById: jest.fn().mockResolvedValue(mockEvent) } as any,
        { getMetrics: jest.fn().mockResolvedValue({ total: 0, active: 0, checkedIn: 0, revoked: 0 }) } as any,
        { getCheckinStats: jest.fn().mockResolvedValue({ totalScans: 0, successfulCheckins: 0, duplicateRejections: 0, revokedRejections: 0, velocityLast15Mins: 0 }) } as any,
        { listEventMembers: jest.fn().mockResolvedValue([]) } as any,
        { findByEvent: jest.fn().mockResolvedValue([]) } as any,
        { getEventStorageMetrics: jest.fn().mockResolvedValue({ totalBytes: 0, quotaBytes: 0, usedPercentage: 0 }) } as any,
        { findByEvent: jest.fn().mockResolvedValue({ logs: [], total: 0 }) } as any
      );

      const summary = await customDashboardService.getDashboardSummary(eventId.toString());
      expect(summary.event.features.hasGuestRoster).toBe(true);
    });
  });

  describe('6. Backend Category Capability Enforcement for Judging & Evaluators', () => {
    const eventId = new mongoose.Types.ObjectId();
    const memberMongoId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('6.1 Rubric Creation Capability Enforcement', () => {
      const nonCompetitiveTypes = ['WEDDING', 'CONCERT', 'CONFERENCE', 'WORKSHOP', 'FESTIVAL'];

      it.each(nonCompetitiveTypes)(
        'should reject rubric creation with HTTP 400 for non-evaluative category %s',
        async (eventType) => {
          const mockEvent: any = {
            _id: eventId,
            eventType,
            ownerId: hostMongoId,
            ownerSupabaseId: hostSupabaseId,
          };

          jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
          jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
            _id: hostMongoId,
            supabaseUserId: hostSupabaseId,
            platformRole: 'USER',
          } as any);

          await expect(
            eventEvaluationService.createRubric(eventId.toString(), hostSupabaseId, {
              title: 'General Rubric',
            })
          ).rejects.toThrow(`Judging and evaluation rubrics are not supported for event type '${eventType}'.`);
        }
      );

      const competitiveTypes = ['HACKATHON', 'COLLEGE_EVENT', 'SPORTS_EVENT', 'AWARD_CEREMONY', 'CULTURAL_EVENT'];

      it.each(competitiveTypes)(
        'should permit rubric creation for competitive category %s',
        async (eventType) => {
          const mockEvent: any = {
            _id: eventId,
            eventType,
            ownerId: hostMongoId,
            ownerSupabaseId: hostSupabaseId,
          };

          const mockRubric: any = {
            _id: new mongoose.Types.ObjectId(),
            eventId,
            title: 'Official Scoring Criteria',
            track: 'General',
            scoringStatus: 'OPEN',
          };

          jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
          jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
            _id: hostMongoId,
            supabaseUserId: hostSupabaseId,
            platformRole: 'USER',
          } as any);
          jest.spyOn(mongoEventRubricRepository, 'createRubric').mockResolvedValue(mockRubric);

          const result = await eventEvaluationService.createRubric(eventId.toString(), hostSupabaseId, {
            title: 'Official Scoring Criteria',
          });

          expect(result).toBeDefined();
          expect(result.title).toBe('Official Scoring Criteria');
        }
      );
    });

    describe('6.2 Judge & Evaluator Assignment Capability Enforcement', () => {
      it('should reject JUDGE assignment on WEDDING with HTTP 400', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'WEDDING',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);

        await expect(
          eventAssignmentService.createAssignment(eventId.toString(), hostSupabaseId, {
            memberId: memberMongoId.toString(),
            role: 'JUDGE',
            targetName: 'Main Stage',
          })
        ).rejects.toThrow("Judge assignments are not supported for event type 'WEDDING'.");
      });

      it('should reject JUDGE assignment on WORKSHOP with HTTP 400 but permit MENTOR assignment', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'WORKSHOP',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);

        await expect(
          eventAssignmentService.createAssignment(eventId.toString(), hostSupabaseId, {
            memberId: memberMongoId.toString(),
            role: 'JUDGE',
            targetName: 'Lab 1',
          })
        ).rejects.toThrow("Judge assignments are not supported for event type 'WORKSHOP'.");

        const mockMember: any = {
          _id: memberMongoId,
          eventId,
          userEmail: 'instructor@workshop.dev',
          role: 'MENTOR',
          status: 'ACTIVE',
        };
        const mockAssignment: any = {
          _id: new mongoose.Types.ObjectId(),
          eventId,
          memberId: memberMongoId,
          role: 'MENTOR',
          targetName: 'Lab 1',
        };

        jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue(mockMember);
        jest.spyOn(mongoEventAssignmentRepository, 'findByEventAndMemberAndTarget').mockResolvedValue(null);
        jest.spyOn(mongoEventAssignmentRepository, 'createAssignment').mockResolvedValue(mockAssignment);

        const result = await eventAssignmentService.createAssignment(eventId.toString(), hostSupabaseId, {
          memberId: memberMongoId.toString(),
          role: 'MENTOR',
          targetName: 'Lab 1',
        });

        expect(result.role).toBe('MENTOR');
      });

      it('should permit JUDGE assignment on SPORTS_EVENT but reject EVALUATOR assignment', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'SPORTS_EVENT',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);

        await expect(
          eventAssignmentService.createAssignment(eventId.toString(), hostSupabaseId, {
            memberId: memberMongoId.toString(),
            role: 'EVALUATOR',
            targetName: 'Court 1',
          })
        ).rejects.toThrow("Evaluator assignments are not supported for event type 'SPORTS_EVENT'.");

        const mockMember: any = {
          _id: memberMongoId,
          eventId,
          userEmail: 'referee@sports.com',
          role: 'JUDGE',
          status: 'ACTIVE',
        };
        const mockAssignment: any = {
          _id: new mongoose.Types.ObjectId(),
          eventId,
          memberId: memberMongoId,
          role: 'JUDGE',
          targetName: 'Court 1',
        };

        jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue(mockMember);
        jest.spyOn(mongoEventAssignmentRepository, 'findByEventAndMemberAndTarget').mockResolvedValue(null);
        jest.spyOn(mongoEventAssignmentRepository, 'createAssignment').mockResolvedValue(mockAssignment);

        const result = await eventAssignmentService.createAssignment(eventId.toString(), hostSupabaseId, {
          memberId: memberMongoId.toString(),
          role: 'JUDGE',
          targetName: 'Court 1',
        });

        expect(result.role).toBe('JUDGE');
      });
    });

    describe('6.3 Member Role Invitation & Update Capability Enforcement', () => {
      it('should reject inviting member as JUDGE for CONFERENCE with HTTP 400', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'CONFERENCE',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);

        await expect(
          eventMemberService.inviteMember(eventId.toString(), hostSupabaseId, {
            email: 'judge@conference.org',
            role: 'JUDGE',
          })
        ).rejects.toThrow("Judge role is not supported for event type 'CONFERENCE'.");
      });

      it('should reject updating member to EVALUATOR for WEDDING with HTTP 400', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'WEDDING',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        const mockMember: any = {
          _id: memberMongoId,
          eventId,
          userEmail: 'relative@wedding.com',
          role: 'VOLUNTEER',
          status: 'ACTIVE',
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);
        jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue(mockMember);

        await expect(
          eventMemberService.updateMember(eventId.toString(), memberMongoId.toString(), hostSupabaseId, {
            role: 'EVALUATOR',
          })
        ).rejects.toThrow("Evaluator role is not supported for event type 'WEDDING'.");
      });

      it('should permit inviting member as JUDGE for HACKATHON', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'HACKATHON',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        const mockCreatedMember: any = {
          _id: memberMongoId,
          eventId,
          userEmail: 'judge@hackathon.tech',
          role: 'JUDGE',
          status: 'INVITED',
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);
        jest.spyOn(mongoEventMemberRepository, 'findByEventAndEmail').mockResolvedValue(null);
        jest.spyOn(mongoUserRepository, 'findByEmail').mockResolvedValue(null);
        jest.spyOn(mongoEventMemberRepository, 'createMember').mockResolvedValue(mockCreatedMember);

        const result = await eventMemberService.inviteMember(eventId.toString(), hostSupabaseId, {
          email: 'judge@hackathon.tech',
          role: 'JUDGE',
        });

        expect(result.member.role).toBe('JUDGE');
        expect(result.invitationLink).toBeDefined();
      });

      it('should reject custom evaluation permissions on CONFERENCE with HTTP 400', async () => {
        const mockEvent: any = {
          _id: eventId,
          eventType: 'CONFERENCE',
          ownerId: hostMongoId,
          ownerSupabaseId: hostSupabaseId,
        };

        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostSupabaseId,
          platformRole: 'USER',
        } as any);
        jest.spyOn(mongoEventMemberRepository, 'findByEventAndEmail').mockResolvedValue(null);

        await expect(
          eventMemberService.inviteMember(eventId.toString(), hostSupabaseId, {
            email: 'member@conference.org',
            role: 'VOLUNTEER',
            customPermissions: ['SCORE_ASSIGNED_TEAMS'],
          })
        ).rejects.toThrow("Evaluation permissions are not supported for event type 'CONFERENCE'.");
      });
    });
  });
});
