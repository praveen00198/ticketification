import mongoose from 'mongoose';
import {
  EVENT_CAPABILITY_MATRIX,
  getEventCapabilities,
  hasCapability,
} from '../src/modules/events/utils/event-capabilities';
import {
  validatePublicationReadiness,
  assertPublicationReadiness,
} from '../src/modules/events/utils/publication-readiness';
import { GuestService } from '../src/modules/guests/services/guest.service';
import { guestImportService } from '../src/modules/guests/services/guest-import.service';
import { eventMemberService } from '../src/modules/events/services/event-member.service';
import { eventEvaluationService } from '../src/modules/events/services/event-evaluation.service';
import { eventAssignmentService } from '../src/modules/events/services/event-assignment.service';
import { eventDashboardService } from '../src/modules/events/services/event-dashboard.service';
import { EventModel } from '../src/db/mongo/models/event.model';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { ValidationError } from '../src/middlewares/error.middleware';

describe('M1 Challenger 2 Empirical Stress & Mutation Test Suite', () => {
  const hostMongoId = new mongoose.Types.ObjectId();
  const hostSupabaseId = 'challenger-2-host-supabase-id';

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
      _id: hostMongoId,
      supabaseUserId: hostSupabaseId,
      email: 'host@challenger2.test',
      platformRole: 'USER',
      status: 'ACTIVE',
    } as any);
  });

  // =========================================================================
  // 1. AttendanceMode Mutation & Immediate Guard Enforcement
  // =========================================================================
  describe('1. AttendanceMode Mutation & Guard Enforcement', () => {
    let guestService: GuestService;
    let mockGuestRepo: any;
    let mockEventRepo: any;
    let mockTicketTypeRepo: any;

    beforeEach(() => {
      mockGuestRepo = {
        create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'gst-c2', ...dto })),
        update: jest.fn().mockImplementation((id, dto) => Promise.resolve({ id, ...dto })),
        deleteById: jest.fn().mockResolvedValue(true),
        findById: jest.fn().mockResolvedValue({ id: 'gst-c2', eventId: 'evt-c2' }),
      };
      mockEventRepo = {
        findById: jest.fn(),
        findByIdAndOwner: jest.fn(),
      };
      mockTicketTypeRepo = {
        findByEventAndName: jest.fn().mockResolvedValue({ id: 'tt-c2', name: 'GENERAL' }),
        create: jest.fn().mockResolvedValue({ id: 'tt-c2', name: 'GENERAL' }),
      };
      guestService = new GuestService(mockGuestRepo, mockEventRepo, mockTicketTypeRepo);
    });

    it('immediately enforces guard when event changes from EXISTING_ATTENDEE_DATA to TICKETIFICATION_REGISTRATION', async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      const mutableEvent: any = {
        id: eventId,
        createdBy: hostSupabaseId,
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      };

      mockEventRepo.findById.mockImplementation(async () => ({ ...mutableEvent }));

      // Step 1: Initial state (EXISTING_ATTENDEE_DATA) allows guest creation
      const createdGuest = await guestService.createGuest(eventId, hostSupabaseId, {
        name: 'Allowed Attendee',
        email: 'allowed@test.com',
      });
      expect(createdGuest).toBeDefined();
      expect(createdGuest.name).toBe('Allowed Attendee');

      // Step 2: Mutate event attendanceMode in database
      mutableEvent.attendanceMode = 'TICKETIFICATION_REGISTRATION';

      // Step 3: Immediate subsequent call must be rejected with HTTP 400 ValidationError
      await expect(
        guestService.createGuest(eventId, hostSupabaseId, {
          name: 'Blocked Attendee',
          email: 'blocked@test.com',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        guestService.createGuest(eventId, hostSupabaseId, {
          name: 'Blocked Attendee',
          email: 'blocked@test.com',
        })
      ).rejects.toThrow(/Guest roster operations are not permitted for events using native platform registration/i);
    });

    it('immediately enforces guard on guest-import service when Mongo event attendanceMode changes', async () => {
      const eventObjectId = new mongoose.Types.ObjectId();
      const eventId = eventObjectId.toString();

      const mutableMongoEvent: any = {
        _id: eventObjectId,
        ownerSupabaseId: hostSupabaseId,
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      };

      jest.spyOn(EventModel, 'findById').mockImplementation((() => Promise.resolve(mutableMongoEvent)) as any);

      // Initial check succeeds
      const check1 = await guestImportService.checkEventAuthorization(eventId, hostSupabaseId);
      expect(check1.isMongo).toBe(true);

      // Mutate to native registration
      mutableMongoEvent.attendanceMode = 'TICKETIFICATION_REGISTRATION';

      // Subsequent check immediately throws ValidationError
      await expect(
        guestImportService.checkEventAuthorization(eventId, hostSupabaseId)
      ).rejects.toThrow(ValidationError);
      await expect(
        guestImportService.checkEventAuthorization(eventId, hostSupabaseId)
      ).rejects.toThrow(/Guest roster operations are not permitted for events using native platform registration/i);
    });

    it('concurrent guest creation requests during mid-flight mode switch do not leak unauthenticated/unvalidated writes', async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      let mode = 'EXISTING_ATTENDEE_DATA';
      mockEventRepo.findById.mockImplementation(async () => ({
        id: eventId,
        createdBy: hostSupabaseId,
        attendanceMode: mode,
      }));

      // Simulate 30 concurrent requests with transition at index 15
      const promises = Array.from({ length: 30 }).map(async (_, i) => {
        if (i === 15) {
          mode = 'TICKETIFICATION_REGISTRATION';
        }
        try {
          await guestService.createGuest(eventId, hostSupabaseId, {
            name: `Attendee ${i}`,
            email: `attendee${i}@test.com`,
          });
          return { index: i, outcome: 'ALLOWED' };
        } catch (err: any) {
          return { index: i, outcome: 'BLOCKED', error: err.message };
        }
      });

      const results = await Promise.all(promises);
      const postTransition = results.filter((r) => r.index >= 15);
      expect(postTransition.every((r) => r.outcome === 'BLOCKED')).toBe(true);
      expect(postTransition.every((r) => r.error.includes('native platform registration'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. Publication Readiness: Private to Public Transition
  // =========================================================================
  describe('2. Publication Readiness: Private to Public Transition on Unverified Org Draft', () => {
    it('immediately blocks publication readiness when toggled from private to public', () => {
      const draftEvent: any = {
        name: 'Innovators Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'America/New_York',
        },
      };

      // In private mode: organization verification is exempt, passes readiness
      const privateCheck = validatePublicationReadiness(draftEvent);
      expect(privateCheck.isReady).toBe(true);
      expect(privateCheck.errors).toHaveLength(0);

      // Host toggles visibility from private to public
      draftEvent.visibility = 'public';
      draftEvent.organizationVerificationStatus = 'PENDING';
      draftEvent.verificationStatus = 'PENDING';

      // Immediate readiness re-check must block publication
      const publicCheck = validatePublicationReadiness(draftEvent);
      expect(publicCheck.isReady).toBe(false);
      expect(publicCheck.errors).toContain(
        'Organization verification is pending. The event cannot be published until verified.'
      );

      // assertPublicationReadiness must immediately throw
      expect(() => assertPublicationReadiness(draftEvent)).toThrow(
        /Organization verification is pending. The event cannot be published until verified./
      );
    });

    it('blocks publication when toggled to public even if organizationVerificationStatus is NOT_REQUIRED but unverified', () => {
      const draftEvent: any = {
        name: 'Open Developer Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      };

      const check = validatePublicationReadiness(draftEvent);
      expect(check.isReady).toBe(false);
      expect(check.errors).toContain(
        'Event must be officially verified and approved before it can be published.'
      );
    });

    it('toggling back from public to private immediately clears organization verification blocker', () => {
      const draftEvent: any = {
        name: 'Private Org Gala',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      };

      expect(validatePublicationReadiness(draftEvent).isReady).toBe(false);

      // Revert to private
      draftEvent.visibility = 'private';
      const check = validatePublicationReadiness(draftEvent);
      expect(check.isReady).toBe(true);
      expect(check.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. Category Capability Enforcement for Evaluation Permissions
  // =========================================================================
  describe('3. Evaluation Permissions & Category Capability Checks', () => {
    const eventId = new mongoose.Types.ObjectId();
    const eventIdStr = eventId.toString();

    function setupMockEvent(category: string) {
      const mockEvent: any = {
        _id: eventId,
        eventType: category,
        ownerId: hostMongoId,
        ownerSupabaseId: hostSupabaseId,
      };
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
      return mockEvent;
    }

    it('blocks member invites with SCORE_ASSIGNED_TEAMS or VIEW_EVALUATION_RESULTS for non-evaluative categories', async () => {
      const nonEvaluative = ['CONFERENCE', 'WEDDING', 'CONCERT', 'WORKSHOP', 'FESTIVAL'];

      for (const cat of nonEvaluative) {
        setupMockEvent(cat);
        jest.spyOn(mongoEventMemberRepository, 'findByEventAndEmail').mockResolvedValue(null);

        // Test SCORE_ASSIGNED_TEAMS
        await expect(
          eventMemberService.inviteMember(eventIdStr, hostSupabaseId, {
            email: `score_${cat.toLowerCase()}@test.com`,
            role: 'COORDINATOR',
            customPermissions: ['SCORE_ASSIGNED_TEAMS'],
          })
        ).rejects.toThrow(
          new RegExp(`Evaluation permissions are not supported for event type '${cat}'`, 'i')
        );

        // Test VIEW_EVALUATION_RESULTS
        await expect(
          eventMemberService.inviteMember(eventIdStr, hostSupabaseId, {
            email: `view_${cat.toLowerCase()}@test.com`,
            role: 'VOLUNTEER',
            customPermissions: ['VIEW_EVALUATION_RESULTS'],
          })
        ).rejects.toThrow(
          new RegExp(`Evaluation permissions are not supported for event type '${cat}'`, 'i')
        );
      }
    });

    it('blocks member role updates to JUDGE or EVALUATOR for non-evaluative categories', async () => {
      setupMockEvent('WEDDING');
      const memberId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(memberId),
        eventId,
        role: 'VOLUNTEER',
        permissions: [],
      } as any);

      await expect(
        eventMemberService.updateMember(eventIdStr, memberId, hostSupabaseId, {
          role: 'JUDGE',
        })
      ).rejects.toThrow(/Judge role is not supported for event type 'WEDDING'/i);

      await expect(
        eventMemberService.updateMember(eventIdStr, memberId, hostSupabaseId, {
          role: 'EVALUATOR',
        })
      ).rejects.toThrow(/Evaluator role is not supported for event type 'WEDDING'/i);
    });

    it('blocks injecting SCORE_ASSIGNED_TEAMS or VIEW_EVALUATION_RESULTS via updateMember permissions', async () => {
      setupMockEvent('CONCERT');
      const memberId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(memberId),
        eventId,
        role: 'VOLUNTEER',
        permissions: [],
      } as any);

      await expect(
        eventMemberService.updateMember(eventIdStr, memberId, hostSupabaseId, {
          permissions: ['SCORE_ASSIGNED_TEAMS'],
        })
      ).rejects.toThrow(/Evaluation permissions are not supported for event type 'CONCERT'/i);

      await expect(
        eventMemberService.updateMember(eventIdStr, memberId, hostSupabaseId, {
          permissions: ['VIEW_EVALUATION_RESULTS'],
        })
      ).rejects.toThrow(/Evaluation permissions are not supported for event type 'CONCERT'/i);
    });

    it('blocks rubric creation for WEDDING, CONCERT, and CONFERENCE', async () => {
      for (const cat of ['WEDDING', 'CONCERT', 'CONFERENCE']) {
        setupMockEvent(cat);
        jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockResolvedValue({
          role: 'HOST',
          permissions: ['ALL'],
          status: 'ACTIVE',
        } as any);

        await expect(
          eventEvaluationService.createRubric(
            eventIdStr,
            hostSupabaseId,
            {
              name: 'Judging Rubric',
              criteria: [{ name: 'Execution', maxScore: 10, weight: 1 }],
            },
            true
          )
        ).rejects.toThrow(
          new RegExp(`Judging and evaluation rubrics are not supported for event type '${cat}'`, 'i')
        );
      }
    });

    it('blocks judge assignment for WEDDING, CONCERT, and CONFERENCE with proper memberId validation', async () => {
      const validMemberId = new mongoose.Types.ObjectId().toString();

      for (const cat of ['WEDDING', 'CONCERT', 'CONFERENCE']) {
        setupMockEvent(cat);
        jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockResolvedValue({
          role: 'HOST',
          permissions: ['ALL'],
          status: 'ACTIVE',
        } as any);

        await expect(
          eventAssignmentService.createAssignment(
            eventIdStr,
            hostSupabaseId,
            {
              role: 'JUDGE',
              memberId: validMemberId,
              targetName: 'General Track',
            },
            true
          )
        ).rejects.toThrow(
          new RegExp(`Judge assignments are not supported for event type '${cat}'`, 'i')
        );
      }
    });
  });
});
