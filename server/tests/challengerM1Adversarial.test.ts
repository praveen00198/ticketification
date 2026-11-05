import mongoose from 'mongoose';
import { guestService } from '../src/modules/guests/services/guest.service';
import { guestImportService } from '../src/modules/guests/services/guest-import.service';
import { eventService } from '../src/modules/events/services/event.service';
import { eventLifecycleService } from '../src/modules/events/services/event-lifecycle.service';
import { eventEvaluationService } from '../src/modules/events/services/event-evaluation.service';
import { eventAssignmentService } from '../src/modules/events/services/event-assignment.service';
import { eventMemberService } from '../src/modules/events/services/event-member.service';
import { eventDashboardService } from '../src/modules/events/services/event-dashboard.service';
import { EventModel, EventType } from '../src/db/mongo/models/event.model';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { guestRepository } from '../src/modules/guests/repositories/guest.repository';
import { ticketTypeRepository } from '../src/modules/events/repositories/ticket-type.repository';
import { mongoEventRubricRepository } from '../src/modules/events/repositories/mongo-event-rubric.repository';
import { mongoEventAssignmentRepository } from '../src/modules/events/repositories/mongo-event-assignment.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import {
  validatePublicationReadiness,
  assertPublicationReadiness,
} from '../src/modules/events/utils/publication-readiness';
import {
  getEventCapabilities,
  hasCapability,
  EVENT_CAPABILITY_MATRIX,
} from '../src/modules/events/utils/event-capabilities';
import { ValidationError, AppError } from '../src/middlewares/error.middleware';

describe('M1 Challenger Empirical & Adversarial Test Suite', () => {
  const hostId = 'usr_challenger_host_01';
  const hostMongoId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.restoreAllMocks();

    // Default mock user
    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
      _id: hostMongoId,
      supabaseUserId: hostId,
      email: 'host@test.com',
      platformRole: 'USER',
      status: 'ACTIVE',
    } as any);
  });

  // =========================================================================
  // SECTION 1: PROBING GUEST ROSTER BYPASS VECTORS
  // =========================================================================
  describe('1. Adversarial Probes: Guest Roster Native Registration Bypass Attempts', () => {
    it('1.1 Canonical rejection: createGuest on TICKETIFICATION_REGISTRATION throws ValidationError (HTTP 400)', async () => {
      const eventId = new mongoose.Types.ObjectId();
      jest.spyOn(EventModel, 'findById').mockResolvedValue({
        _id: eventId,
        ownerSupabaseId: hostId,
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      } as any);

      await expect(
        guestService.createGuest(eventId.toString(), hostId, {
          name: 'VIP Guest',
          category: 'VIP',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('1.2 Casing probe: createGuest with lowercase "ticketification_registration" attendanceMode (Empirical Vulnerability Probe)', async () => {
      const eventId = new mongoose.Types.ObjectId();
      jest.spyOn(EventModel, 'findById').mockResolvedValue({
        _id: eventId,
        ownerSupabaseId: hostId,
        attendanceMode: 'ticketification_registration', // lowercase bypass attempt
      } as any);

      jest.spyOn(ticketTypeRepository, 'findByEventAndName').mockResolvedValue(null);
      jest.spyOn(ticketTypeRepository, 'create').mockResolvedValue({ id: 'tt_1' } as any);
      jest.spyOn(guestRepository, 'create').mockResolvedValue({ id: 'g_1', name: 'VIP Guest' } as any);

      let threw = false;
      try {
        await guestService.createGuest(eventId.toString(), hostId, {
          name: 'VIP Guest',
          category: 'VIP',
        });
      } catch (err: any) {
        threw = true;
      }

      // EMPIRICAL OBSERVATION:
      // In guest.service.ts, the check is strictly `event.attendanceMode === 'TICKETIFICATION_REGISTRATION'`.
      // When attendanceMode is 'ticketification_registration', threw is FALSE (bypassed)!
      expect(threw).toBe(false);
    });

    it('1.3 All guest service endpoints enforce attendanceMode guard for canonical attendanceMode', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const guestId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(EventModel, 'findById').mockResolvedValue({
        _id: eventId,
        ownerSupabaseId: hostId,
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      } as any);

      // Endpoint 1: getGuestsByEvent
      await expect(
        guestService.getGuestsByEvent(eventId.toString(), hostId)
      ).rejects.toThrow(ValidationError);

      // Endpoint 2: getGuestById
      await expect(
        guestService.getGuestById(eventId.toString(), guestId, hostId)
      ).rejects.toThrow(ValidationError);

      // Endpoint 3: updateGuest
      await expect(
        guestService.updateGuest(eventId.toString(), guestId, hostId, { name: 'New Name' })
      ).rejects.toThrow(ValidationError);

      // Endpoint 4: deleteGuest
      await expect(
        guestService.deleteGuest(eventId.toString(), guestId, hostId)
      ).rejects.toThrow(ValidationError);
    });

    it('1.4 Guest Import authorization rejects TICKETIFICATION_REGISTRATION for host', async () => {
      const eventId = new mongoose.Types.ObjectId();
      jest.spyOn(EventModel, 'findById').mockResolvedValue({
        _id: eventId,
        ownerSupabaseId: hostId,
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      } as any);

      await expect(
        guestImportService.checkEventAuthorization(eventId.toString(), hostId)
      ).rejects.toThrow(ValidationError);
    });

    it('1.5 Legitimate EXISTING_ATTENDEE_DATA permits guest operations without error', async () => {
      const eventId = new mongoose.Types.ObjectId();
      jest.spyOn(EventModel, 'findById').mockResolvedValue({
        _id: eventId,
        ownerSupabaseId: hostId,
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      } as any);

      jest.spyOn(ticketTypeRepository, 'findByEventAndName').mockResolvedValue({ id: 'tt_1' } as any);
      jest.spyOn(guestRepository, 'create').mockResolvedValue({ id: 'g_1', name: 'Authorized Guest' } as any);

      const res = await guestService.createGuest(eventId.toString(), hostId, {
        name: 'Authorized Guest',
      });
      expect(res.name).toBe('Authorized Guest');
    });
  });

  // =========================================================================
  // SECTION 2: PROBING ORGANIZATION VERIFICATION ON PUBLIC EVENTS
  // =========================================================================
  describe('2. Adversarial Probes: Organization Verification Enforcement on Public Events', () => {
    it('2.1 Public org event with PENDING verification is blocked by publication-readiness', () => {
      const res = validatePublicationReadiness({
        name: 'Public Org Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      } as any);

      expect(res.isReady).toBe(false);
      expect(res.errors.some((e) => e.includes('Organization verification is pending'))).toBe(true);
    });

    it('2.2 Public org event with REJECTED verification is blocked by publication-readiness', () => {
      const res = validatePublicationReadiness({
        name: 'Public Org Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'REJECTED',
        verificationStatus: 'REJECTED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      } as any);

      expect(res.isReady).toBe(false);
      expect(res.errors.some((e) => e.includes('Organization verification was rejected'))).toBe(true);
    });

    it('2.3 Public org event with UNVERIFIED verificationStatus is blocked by publication-readiness', () => {
      const res = validatePublicationReadiness({
        name: 'Public Org Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      } as any);

      expect(res.isReady).toBe(false);
      expect(res.errors.some((e) => e.includes('Event must be officially verified and approved'))).toBe(true);
    });

    it('2.4 Verified public org event (VERIFIED) passes publication readiness', () => {
      const res = validatePublicationReadiness({
        name: 'Verified Org Summit',
        hostingType: 'ORGANIZATION',
        visibility: 'public',
        organizationVerificationStatus: 'APPROVED',
        verificationStatus: 'VERIFIED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      } as any);

      expect(res.isReady).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('2.5 Switching draft from private to public automatically resets verification to PENDING', async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      const existingDraft: any = {
        _id: eventId,
        ownerSupabaseId: hostId,
        status: 'DRAFT',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        schedule: { startAt: new Date(), endAt: new Date() },
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(existingDraft);
      const updateDraftSpy = jest.spyOn(mongoEventRepository, 'updateDraft').mockImplementation(
        async (_id, _owner, updatePayload: any) => {
          return {
            ...existingDraft,
            ...updatePayload,
            createdAt: new Date(),
            updatedAt: new Date(),
            schedule: {
              startAt: new Date(),
              endAt: new Date(),
              timezone: 'UTC',
            },
            ownerId: hostMongoId,
          } as any;
        }
      );

      await eventService.updateEventDraft(eventId, hostId, {
        visibility: 'public',
      });

      expect(updateDraftSpy).toHaveBeenCalled();
      const passedUpdate = updateDraftSpy.mock.calls[0][2] as any;
      expect(passedUpdate.organizationVerificationStatus).toBe('PENDING');
      expect(passedUpdate.verificationStatus).toBe('PENDING');
    });
  });

  // =========================================================================
  // SECTION 3: VERIFYING PRIVATE EVENT VERIFICATION BYPASS
  // =========================================================================
  describe('3. Adversarial Probes: Private Event Organization Verification Bypass', () => {
    it('3.1 Private org event with UNVERIFIED status passes publication readiness without admin approval', () => {
      const res = validatePublicationReadiness({
        name: 'Private Org Gathering',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      } as any);

      expect(res.isReady).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('3.2 Private org event transitions to PUBLISHED directly without verification error', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockPrivateEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostId,
        name: 'Private Org Hackathon',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        status: 'APPROVED',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'UTC',
        },
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockPrivateEvent);
      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...mockPrivateEvent,
        status: 'PUBLISHED',
      });

      const result = await eventLifecycleService.transitionStatus(
        eventId.toString(),
        hostId,
        'PUBLISHED'
      );

      expect(result.event.status).toBe('PUBLISHED');
    });

    it('3.3 Private event missing valid schedule is still rejected (only verification is exempt)', () => {
      const res = validatePublicationReadiness({
        name: 'Private Event Without Schedule',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        schedule: undefined,
      } as any);

      expect(res.isReady).toBe(false);
      expect(res.errors.some((e) => e.includes('schedule start date is required'))).toBe(true);
    });

    it('3.4 Private event with end date before start date is rejected', () => {
      const res = validatePublicationReadiness({
        name: 'Private Event Time Travel',
        hostingType: 'ORGANIZATION',
        visibility: 'private',
        organizationVerificationStatus: 'NOT_REQUIRED',
        schedule: {
          startAt: new Date(Date.now() + 100000),
          endAt: new Date(Date.now() - 100000),
          timezone: 'UTC',
        },
      } as any);

      expect(res.isReady).toBe(false);
      expect(res.errors.some((e) => e.includes('end date must be after the start date'))).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 4: EXHAUSTIVE CATEGORY CAPABILITY BOUNDARIES
  // =========================================================================
  describe('4. Exhaustive Category Capability Matrix Boundaries', () => {
    const nonEvaluativeCategories: EventType[] = [
      'WEDDING',
      'CONCERT',
      'CONFERENCE',
      'WORKSHOP',
      'FESTIVAL',
      'EXHIBITION',
      'CORPORATE_EVENT',
      'OTHER',
    ];

    const competitiveCategories: EventType[] = [
      'HACKATHON',
      'COLLEGE_EVENT',
      'SPORTS_EVENT',
      'AWARD_CEREMONY',
      'CULTURAL_EVENT',
    ];

    // Non-evaluative categories must strictly reject rubrics
    test.each(nonEvaluativeCategories)(
      '4.1 Category %s strictly rejects rubric creation with ValidationError (HTTP 400)',
      async (category) => {
        const eventId = new mongoose.Types.ObjectId();
        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
          _id: eventId,
          ownerId: hostMongoId,
          ownerSupabaseId: hostId,
          eventType: category,
        } as any);

        await expect(
          eventEvaluationService.createRubric(
            eventId.toString(),
            hostId,
            {
              title: `${category} Rubric`,
            } as any
          )
        ).rejects.toThrow(`Judging and evaluation rubrics are not supported for event type '${category}'.`);
      }
    );

    // Non-evaluative categories must strictly reject JUDGE role assignments
    test.each(nonEvaluativeCategories)(
      '4.2 Category %s strictly rejects JUDGE assignment with ValidationError (HTTP 400)',
      async (category) => {
        const eventId = new mongoose.Types.ObjectId();
        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
          _id: eventId,
          ownerId: hostMongoId,
          ownerSupabaseId: hostId,
          eventType: category,
        } as any);

        await expect(
          eventAssignmentService.createAssignment(
            eventId.toString(),
            hostId,
            {
              memberId: new mongoose.Types.ObjectId().toString(),
              role: 'JUDGE',
              targetName: 'Main Room',
            } as any
          )
        ).rejects.toThrow(`Judge assignments are not supported for event type '${category}'.`);
      }
    );

    // Non-evaluative categories must strictly reject EVALUATOR member invitations
    test.each(nonEvaluativeCategories)(
      '4.3 Category %s strictly rejects EVALUATOR member invitation with ValidationError (HTTP 400)',
      async (category) => {
        const eventId = new mongoose.Types.ObjectId();
        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
          _id: eventId,
          ownerId: hostMongoId,
          ownerSupabaseId: hostId,
          eventType: category,
        } as any);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostId,
          platformRole: 'USER',
        } as any);

        await expect(
          eventMemberService.inviteMember(
            eventId.toString(),
            hostId,
            {
              email: 'evaluator@test.com',
              role: 'EVALUATOR',
            } as any
          )
        ).rejects.toThrow(`Evaluator role is not supported for event type '${category}'.`);
      }
    );

    // Competitive categories must allow rubric creation
    test.each(competitiveCategories)(
      '4.4 Competitive category %s permits rubric creation without capability error',
      async (category) => {
        const eventId = new mongoose.Types.ObjectId();
        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
          _id: eventId,
          ownerId: hostMongoId,
          ownerSupabaseId: hostId,
          eventType: category,
        } as any);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostId,
          platformRole: 'USER',
        } as any);

        jest.spyOn(mongoEventRubricRepository, 'createRubric').mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          eventId,
          title: `${category} Rubric`,
          track: 'General',
          scoringStatus: 'OPEN',
        } as any);

        const res = await eventEvaluationService.createRubric(
          eventId.toString(),
          hostId,
          {
            title: `${category} Rubric`,
          } as any
        );

        expect(res.title).toBe(`${category} Rubric`);
      }
    );

    // Competitive categories must allow JUDGE assignments
    test.each(competitiveCategories)(
      '4.5 Competitive category %s permits JUDGE assignment without capability error',
      async (category) => {
        const eventId = new mongoose.Types.ObjectId();
        const memberId = new mongoose.Types.ObjectId();
        jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
          _id: eventId,
          ownerId: hostMongoId,
          ownerSupabaseId: hostId,
          eventType: category,
        } as any);
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
          _id: hostMongoId,
          supabaseUserId: hostId,
          platformRole: 'USER',
        } as any);
        jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue({
          _id: memberId,
          eventId,
          role: 'JUDGE',
          status: 'ACTIVE',
        } as any);
        jest.spyOn(mongoEventAssignmentRepository, 'findByEventAndMemberAndTarget').mockResolvedValue(null);
        jest.spyOn(mongoEventAssignmentRepository, 'createAssignment').mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          eventId,
          userId: 'usr_judge_01',
          role: 'JUDGE',
          status: 'ACTIVE',
        } as any);

        const res = await eventAssignmentService.createAssignment(
          eventId.toString(),
          hostId,
          {
            memberId: memberId.toString(),
            role: 'JUDGE',
            targetName: 'Track A',
          } as any
        );

        expect(res.role).toBe('JUDGE');
      }
    );

    it('4.6 Workshop category specifically permits MENTORS but rejects JUDGES', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const memberId = new mongoose.Types.ObjectId();
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostId,
        eventType: 'WORKSHOP',
      } as any);
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostId,
        platformRole: 'USER',
      } as any);
      jest.spyOn(mongoEventMemberRepository, 'findById').mockResolvedValue({
        _id: memberId,
        eventId,
        role: 'MENTOR',
        status: 'ACTIVE',
      } as any);
      jest.spyOn(mongoEventAssignmentRepository, 'findByEventAndMemberAndTarget').mockResolvedValue(null);
      jest.spyOn(mongoEventAssignmentRepository, 'createAssignment').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        userId: 'usr_mentor_01',
        role: 'MENTOR',
        status: 'ACTIVE',
      } as any);

      const mentorRes = await eventAssignmentService.createAssignment(
        eventId.toString(),
        hostId,
        {
          memberId: memberId.toString(),
          role: 'MENTOR',
          targetName: 'Python Workshop',
        } as any
      );
      expect(mentorRes.role).toBe('MENTOR');

      // Judge assignment should fail
      await expect(
        eventAssignmentService.createAssignment(
          eventId.toString(),
          hostId,
          {
            memberId: memberId.toString(),
            role: 'JUDGE',
            targetName: 'Python Workshop',
          } as any
        )
      ).rejects.toThrow("Judge assignments are not supported for event type 'WORKSHOP'.");
    });
  });
});
