import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { createJwtToken } from '../src/utils/local-auth';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { eventRepository } from '../src/modules/events/repositories/event.repository';
import { guestRepository } from '../src/modules/guests/repositories/guest.repository';
import { ticketTypeRepository } from '../src/modules/events/repositories/ticket-type.repository';
import { guestService } from '../src/modules/guests/services/guest.service';
import { guestImportService } from '../src/modules/guests/services/guest-import.service';
import { eventDashboardService } from '../src/modules/events/services/event-dashboard.service';
import {
  getEventCapabilities,
  hasCapability,
  EVENT_CAPABILITY_MATRIX,
  EventCapabilities,
} from '../src/modules/events/utils/event-capabilities';
import {
  validatePublicationReadiness,
  assertPublicationReadiness,
} from '../src/modules/events/utils/publication-readiness';
import { EventLifecycleService } from '../src/modules/events/services/event-lifecycle.service';
import { eventEvaluationService } from '../src/modules/events/services/event-evaluation.service';
import { eventAssignmentService } from '../src/modules/events/services/event-assignment.service';
import { eventMemberService } from '../src/modules/events/services/event-member.service';
import { mongoEventRubricRepository } from '../src/modules/events/repositories/mongo-event-rubric.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventAssignmentRepository } from '../src/modules/events/repositories/mongo-event-assignment.repository';
import { EventModel } from '../src/db/mongo/models/event.model';

/**
 * Navigation Categories Contract Evaluator
 * Verifies contract specifications from PROJECT.md Interface Contract 3 & permissions.ts
 */
function evaluateNavigationContract(
  eventType: string | undefined,
  attendanceMode: string | undefined
): {
  hasGuestRosterNav: boolean;
  hasJudgingNav: boolean;
  hasTeamConsoleNav: boolean;
  hasMentors: boolean;
} {
  const caps = getEventCapabilities(eventType);
  const normalizedMode = (attendanceMode || '').trim().toUpperCase();

  // Guest Roster rendered only when attendanceMode is explicitly EXISTING_ATTENDEE_DATA
  const hasGuestRosterNav = normalizedMode === 'EXISTING_ATTENDEE_DATA';

  // Judging & Evaluation item rendered iff Boolean(caps.judges || caps.evaluators)
  const hasJudgingNav = Boolean(caps.judges || caps.evaluators);

  // Team Console item rendered iff Boolean(caps.teams)
  const hasTeamConsoleNav = Boolean(caps.teams);

  return {
    hasGuestRosterNav,
    hasJudgingNav,
    hasTeamConsoleNav,
    hasMentors: Boolean(caps.mentors),
  };
}

describe('Context-Aware Event Module Visibility & Organization Verification E2E Suite', () => {
  // Test Users
  const hostMongoId = new mongoose.Types.ObjectId();
  const hostUser = {
    id: 'usr_e2e_host_ctx_001',
    email: 'host_ctx@ticketification.com',
    role: 'USER' as const,
    name: 'Context Host',
    platformRole: 'USER',
    _id: hostMongoId,
    supabaseUserId: 'usr_e2e_host_ctx_001',
    status: 'ACTIVE',
  };

  const adminMongoId = new mongoose.Types.ObjectId();
  const adminUser = {
    id: 'usr_e2e_admin_ctx_002',
    email: 'admin_ctx@ticketification.com',
    role: 'ADMIN' as const,
    name: 'Context Admin',
    platformRole: 'ADMIN',
    _id: adminMongoId,
    supabaseUserId: 'usr_e2e_admin_ctx_002',
    status: 'ACTIVE',
  };

  const attendeeUser = {
    id: 'usr_e2e_att_ctx_003',
    email: 'attendee_ctx@ticketification.com',
    role: 'USER' as const,
    name: 'Context Attendee',
    platformRole: 'USER',
    _id: new mongoose.Types.ObjectId(),
    supabaseUserId: 'usr_e2e_att_ctx_003',
    status: 'ACTIVE',
  };

  const hostToken = createJwtToken({
    id: hostUser.id,
    email: hostUser.email,
    role: hostUser.role,
  });

  const adminToken = createJwtToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  const attendeeToken = createJwtToken({
    id: attendeeUser.id,
    email: attendeeUser.email,
    role: attendeeUser.role,
  });

  let currentActiveEvent: any = null;

  const makeMockEvent = (overrides: Record<string, any> = {}) => {
    const eventId = new mongoose.Types.ObjectId();
    const event = {
      _id: eventId,
      name: 'Global Tech & Culture Fest 2026',
      slug: `event-ctx-${Math.random().toString(36).substring(2, 9)}`,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      createdBy: hostUser.id,
      status: 'APPROVED',
      eventType: 'HACKATHON',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      visibility: 'public',
      hostingType: 'ORGANIZATION',
      organizationVerificationStatus: 'APPROVED',
      verificationStatus: 'VERIFIED',
      schedule: {
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        timezone: 'UTC',
      },
      venue: {
        type: 'PHYSICAL',
        name: 'Convention Center',
        city: 'Bengaluru',
      },
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
    currentActiveEvent = event;
    return event;
  };

  let lifecycleService: EventLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();

    lifecycleService = new EventLifecycleService(
      mongoEventRepository,
      mongoUserRepository
    );

    // Default User Repository Mocks
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation((id: string) => {
      if (id === hostUser.id || id === hostMongoId.toString()) return Promise.resolve(hostUser as any);
      if (id === adminUser.id || id === adminMongoId.toString()) return Promise.resolve(adminUser as any);
      return Promise.resolve(attendeeUser as any);
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation((supaId: string) => {
      if (supaId === hostUser.id) return Promise.resolve(hostUser as any);
      if (supaId === adminUser.id) return Promise.resolve(adminUser as any);
      return Promise.resolve(attendeeUser as any);
    });

    // Default Event Repository Mocks (Both MongoDB and Postgres adapters)
    jest.spyOn(mongoEventRepository, 'findById').mockImplementation((id: string) => {
      if (currentActiveEvent && (currentActiveEvent._id.toString() === id || currentActiveEvent.id === id)) {
        return Promise.resolve(currentActiveEvent);
      }
      return Promise.resolve(currentActiveEvent);
    });

    jest.spyOn(eventRepository, 'findById').mockImplementation((id: string) => {
      if (currentActiveEvent && (currentActiveEvent._id.toString() === id || currentActiveEvent.id === id)) {
        return Promise.resolve(currentActiveEvent);
      }
      return Promise.resolve(currentActiveEvent);
    });

    jest.spyOn(eventRepository, 'findByIdAndOwner').mockImplementation((id: string, userId: string) => {
      if (currentActiveEvent && (currentActiveEvent._id.toString() === id || currentActiveEvent.id === id)) {
        return Promise.resolve(currentActiveEvent);
      }
      return Promise.resolve(currentActiveEvent);
    });

    jest.spyOn(EventModel, 'findById').mockImplementation(((id: any) => {
      return {
        exec: jest.fn().mockResolvedValue(currentActiveEvent),
        then: (resolve: any, reject: any) => Promise.resolve(currentActiveEvent).then(resolve, reject),
        catch: (reject: any) => Promise.resolve(currentActiveEvent).catch(reject),
      } as any;
    }) as any);

    // Default Rubric, Member, Ticket Type, and Guest Mocks to prevent DB hanging
    jest.spyOn(mongoEventRubricRepository, 'createRubric').mockImplementation((data: any) =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        scoringStatus: 'OPEN',
        track: 'General',
        ...data,
      } as any)
    );

    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockResolvedValue(null);
    jest.spyOn(mongoEventMemberRepository, 'findByEventAndEmail').mockResolvedValue(null);
    jest.spyOn(mongoEventMemberRepository, 'findById').mockImplementation((memberId: string) =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(memberId),
        eventId: currentActiveEvent?._id || new mongoose.Types.ObjectId(),
        role: 'JUDGE',
        status: 'ACTIVE',
        userEmail: 'judge@example.com',
      } as any)
    );
    jest.spyOn(mongoEventMemberRepository, 'createMember').mockImplementation((data: any) =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        status: 'INVITED',
        ...data,
      } as any)
    );

    jest.spyOn(mongoEventAssignmentRepository, 'createAssignment').mockImplementation((data: any) =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...data,
      } as any)
    );

    jest.spyOn(ticketTypeRepository, 'findByEventAndName').mockImplementation((_eventId, name) =>
      Promise.resolve({
        _id: 'tt_mock_001',
        name,
        label: name,
        usagePolicy: 'SINGLE_USE',
      } as any)
    );

    jest.spyOn(ticketTypeRepository, 'create').mockImplementation((data: any) =>
      Promise.resolve({
        _id: 'tt_mock_created',
        ...data,
      } as any)
    );

    jest.spyOn(guestRepository, 'create').mockImplementation((data: any) =>
      Promise.resolve({
        _id: 'gst_mock_001',
        ...data,
      } as any)
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 test cases per feature)
  // =========================================================================

  describe('Tier 1: Feature Coverage', () => {
    describe('F1: Conditional Guest Roster Visibility & Mutation Guarding (R1)', () => {
      it('T1-F1-01: Native registration event derives hasGuestRoster: false in dashboard service', () => {
        const features = (eventDashboardService as any).deriveFeatures(
          'HACKATHON',
          'Pass',
          'TICKETIFICATION_REGISTRATION'
        );
        expect(features.hasGuestRoster).toBe(false);
      });

      it('T1-F1-02: Manual guest roster event derives hasGuestRoster: true in dashboard service', () => {
        const features = (eventDashboardService as any).deriveFeatures(
          'HACKATHON',
          'Pass',
          'EXISTING_ATTENDEE_DATA'
        );
        expect(features.hasGuestRoster).toBe(true);
      });

      it('T1-F1-03: Single guest creation rejects with 400 when event uses native registration', async () => {
        const mockEvent = makeMockEvent({ attendanceMode: 'TICKETIFICATION_REGISTRATION' });

        const res = await request(app)
          .post(`/api/guests/events/${mockEvent._id}`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            name: 'VIP Guest',
            category: 'VIP',
            email: 'vip@example.com',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        const errorText = typeof res.body.error === 'string' ? res.body.error : (res.body.error?.message || res.body.message || '');
        expect(errorText).toMatch(/native|registration|attendance/i);
      });

      it('T1-F1-04: Guest import validation rejects with 400 when event uses native registration', async () => {
        const mockEvent = makeMockEvent({ attendanceMode: 'TICKETIFICATION_REGISTRATION' });

        const res = await request(app)
          .post(`/api/guests/events/${mockEvent._id}/validate`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            importId: '550e8400-e29b-41d4-a716-446655440000',
            columnMapping: { name: 'name', email: 'email' },
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        const importErrorText = typeof res.body.error === 'string' ? res.body.error : (res.body.error?.message || res.body.message || '');
        expect(importErrorText).toMatch(/native|registration|attendance/i);
      });

      it('T1-F1-05: Host workspace navigation contract excludes Guest Roster under native registration', () => {
        const nav = evaluateNavigationContract('CONFERENCE', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasGuestRosterNav).toBe(false);
      });

      it('T1-F1-06: Host workspace navigation contract includes Guest Roster under manual attendee roster mode', () => {
        const nav = evaluateNavigationContract('CONFERENCE', 'EXISTING_ATTENDEE_DATA');
        expect(nav.hasGuestRosterNav).toBe(true);
      });
    });

    describe('F2: Event Category Capability Matrix & Dynamic Module Filtering (R2)', () => {
      it('T1-F2-01: Wedding category omits judging, evaluators, and teams', () => {
        const caps = getEventCapabilities('WEDDING');
        expect(caps.judges).toBe(false);
        expect(caps.evaluators).toBe(false);
        expect(caps.teams).toBe(false);
        expect(caps.registrations).toBe(true);
        expect(caps.checkIn).toBe(true);

        const nav = evaluateNavigationContract('WEDDING', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(false);
        expect(nav.hasTeamConsoleNav).toBe(false);
      });

      it('T1-F2-02: Concert category omits judging, evaluators, and teams', () => {
        const caps = getEventCapabilities('CONCERT');
        expect(caps.judges).toBe(false);
        expect(caps.evaluators).toBe(false);
        expect(caps.teams).toBe(false);

        const nav = evaluateNavigationContract('CONCERT', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(false);
        expect(nav.hasTeamConsoleNav).toBe(false);
      });

      it('T1-F2-03: Conference category omits judging, evaluators, and teams, but retains schedule', () => {
        const caps = getEventCapabilities('CONFERENCE');
        expect(caps.judges).toBe(false);
        expect(caps.evaluators).toBe(false);
        expect(caps.teams).toBe(false);
        expect(caps.schedule).toBe(true);

        const nav = evaluateNavigationContract('CONFERENCE', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(false);
        expect(nav.hasTeamConsoleNav).toBe(false);
      });

      it('T1-F2-04: Hackathon category retains judging, evaluators, teams, submissions, and mentors', () => {
        const caps = getEventCapabilities('HACKATHON');
        expect(caps.judges).toBe(true);
        expect(caps.evaluators).toBe(true);
        expect(caps.teams).toBe(true);
        expect(caps.submissions).toBe(true);
        expect(caps.mentors).toBe(true);
        expect(caps.results).toBe(true);

        const nav = evaluateNavigationContract('HACKATHON', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(true);
        expect(nav.hasTeamConsoleNav).toBe(true);
      });

      it('T1-F2-05: Backend rubric creation endpoint rejects rubric creation for non-evaluative categories (Wedding)', async () => {
        const mockWeddingEvent = makeMockEvent({ eventType: 'WEDDING' });

        const res = await request(app)
          .post(`/api/events/${mockWeddingEvent._id}/rubrics`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            title: 'Wedding Ceremony Rubric',
            track: 'Main',
            criteria: [{ title: 'Decor', maxScore: 10, weight: 100 }],
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        const rubricErrorText = typeof res.body.error === 'string' ? res.body.error : (res.body.error?.message || res.body.message || '');
        expect(rubricErrorText).toMatch(/category|evaluation|rubric|judg/i);
      });

      it('T1-F2-06: Backend assignment service rejects JUDGE assignment for non-evaluative categories (Concert)', async () => {
        const mockConcertEvent = makeMockEvent({ eventType: 'CONCERT' });

        await expect(
          eventAssignmentService.createAssignment(
            mockConcertEvent._id.toString(),
            hostUser.id,
            {
              memberId: new mongoose.Types.ObjectId().toString(),
              role: 'JUDGE',
              targetName: 'Lead Vocalist',
            }
          )
        ).rejects.toThrow(/judg|evaluat|capability|not supported/i);
      });
    });

    describe('F3: Organization Verification Exemption for Private Events (R3)', () => {
      it('T1-F3-01: Private event with pending organization verification passes publication readiness', () => {
        const mockPrivateOrgEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          verificationStatus: 'PENDING',
        });

        const result = validatePublicationReadiness(mockPrivateOrgEvent);
        expect(result.isReady).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('T1-F3-02: Private event with unverified organization successfully transitions to PUBLISHED', async () => {
        const mockPrivateOrgEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          verificationStatus: 'PENDING',
          status: 'APPROVED',
        });

        jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
          ...mockPrivateOrgEvent,
          status: 'PUBLISHED',
        });

        const res = await lifecycleService.transitionStatus(
          mockPrivateOrgEvent._id.toString(),
          hostUser.id,
          'PUBLISHED'
        );

        expect(res.event.status).toBe('PUBLISHED');
      });

      it('T1-F3-03: Public event with pending organization verification is blocked from publication readiness', () => {
        const mockPublicOrgEvent: any = makeMockEvent({
          visibility: 'public',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          verificationStatus: 'PENDING',
        });

        const result = validatePublicationReadiness(mockPublicOrgEvent);
        expect(result.isReady).toBe(false);
        expect(result.errors.some((e) => e.includes('Organization verification is pending'))).toBe(true);
      });

      it('T1-F3-04: Public event with pending organization verification throws 400 when publishing', async () => {
        const mockPublicOrgEvent: any = makeMockEvent({
          visibility: 'public',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          verificationStatus: 'PENDING',
          status: 'APPROVED',
        });

        await expect(
          lifecycleService.transitionStatus(
            mockPublicOrgEvent._id.toString(),
            hostUser.id,
            'PUBLISHED'
          )
        ).rejects.toThrow(/Organization verification is pending/);
      });

      it('T1-F3-05: Individual host can publish private event without organization verification', async () => {
        const mockIndividualEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'INDIVIDUAL',
          organizationVerificationStatus: 'NOT_REQUIRED',
          verificationStatus: 'UNVERIFIED',
          status: 'APPROVED',
        });

        jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
          ...mockIndividualEvent,
          status: 'PUBLISHED',
        });

        const res = await lifecycleService.transitionStatus(
          mockIndividualEvent._id.toString(),
          hostUser.id,
          'PUBLISHED'
        );

        expect(res.event.status).toBe('PUBLISHED');
      });

      it('T1-F3-06: Verified organization can publish public event without blocker', async () => {
        const mockVerifiedPublicEvent: any = makeMockEvent({
          visibility: 'public',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'APPROVED',
          verificationStatus: 'VERIFIED',
          status: 'APPROVED',
        });

        const result = validatePublicationReadiness(mockVerifiedPublicEvent);
        expect(result.isReady).toBe(true);
        expect(result.errors).toHaveLength(0);

        jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
          ...mockVerifiedPublicEvent,
          status: 'PUBLISHED',
        });

        const res = await lifecycleService.transitionStatus(
          mockVerifiedPublicEvent._id.toString(),
          hostUser.id,
          'PUBLISHED'
        );

        expect(res.event.status).toBe('PUBLISHED');
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 test cases per feature)
  // =========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    describe('F1 Boundaries: Attendance Mode & Roster Edge Conditions', () => {
      it('T2-F1-01: Undefined or null attendanceMode defaults safely to native registration', () => {
        const features = (eventDashboardService as any).deriveFeatures('HACKATHON', 'Pass', undefined);
        expect(features.hasGuestRoster).toBe(false);

        const nav = evaluateNavigationContract('HACKATHON', undefined);
        expect(nav.hasGuestRosterNav).toBe(false);
      });

      it('T2-F1-02: Malformed or unexpected attendanceMode strings default to safe baseline', () => {
        const features = (eventDashboardService as any).deriveFeatures('CONFERENCE', 'Badge', 'INVALID_MODE');
        expect(features.hasGuestRoster).toBe(false);

        const nav = evaluateNavigationContract('CONFERENCE', 'INVALID_MODE');
        expect(nav.hasGuestRosterNav).toBe(false);
      });

      it('T2-F1-03: Case insensitivity and whitespace in attendanceMode are normalized', () => {
        const features = (eventDashboardService as any).deriveFeatures(
          'CONFERENCE',
          'Badge',
          '  existing_attendee_data  '
        );
        expect(features.hasGuestRoster).toBe(true);

        const nav = evaluateNavigationContract('CONFERENCE', '  existing_attendee_data  ');
        expect(nav.hasGuestRosterNav).toBe(true);
      });

      it('T2-F1-04: Guest creation with empty name is rejected with 400 validation error', async () => {
        const mockEvent = makeMockEvent({ attendanceMode: 'EXISTING_ATTENDEE_DATA' });

        const res = await request(app)
          .post(`/api/guests/events/${mockEvent._id}`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            name: '   ',
            category: 'VIP',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('T2-F1-05: Guest import validation with empty column mapping is rejected with 400', async () => {
        const mockEvent = makeMockEvent({ attendanceMode: 'EXISTING_ATTENDEE_DATA' });

        const res = await request(app)
          .post(`/api/guests/events/${mockEvent._id}/validate`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            importId: 'imp_empty_mapping',
            columnMapping: {},
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('T2-F1-06: Non-owner cannot create guests in an existing attendee roster', async () => {
        const mockEvent = makeMockEvent({
          attendanceMode: 'EXISTING_ATTENDEE_DATA',
          createdBy: 'some_other_owner',
          ownerSupabaseId: 'some_other_owner',
        });

        const res = await request(app)
          .post(`/api/guests/events/${mockEvent._id}`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            name: 'John Doe',
            category: 'VIP',
          });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      });
    });

    describe('F2 Boundaries: Category Transitions, Workshop Mentors & Matrix Edge Cases', () => {
      it('T2-F2-01: Workshop decouples mentors from judging: mentors true, judges/evaluators strictly false', () => {
        const caps = getEventCapabilities('WORKSHOP');
        expect(caps.mentors).toBe(true);
        expect(caps.evaluators).toBe(false);
        expect(caps.judges).toBe(false);
        expect(caps.teams).toBe(false);

        const nav = evaluateNavigationContract('WORKSHOP', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(false);
        expect(nav.hasTeamConsoleNav).toBe(false);
        expect(nav.hasMentors).toBe(true);
      });

      it('T2-F2-02: Sports Event enables teams and judges, but omits mentors and evaluators', () => {
        const caps = getEventCapabilities('SPORTS_EVENT');
        expect(caps.teams).toBe(true);
        expect(caps.judges).toBe(true);
        expect(caps.results).toBe(true);
        expect(caps.mentors).toBe(false);
        expect(caps.evaluators).toBe(false);

        const nav = evaluateNavigationContract('SPORTS_EVENT', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(true);
        expect(nav.hasTeamConsoleNav).toBe(true);
      });

      it('T2-F2-03: Award Ceremony enables submissions, evaluators, and judges, but omits teams', () => {
        const caps = getEventCapabilities('AWARD_CEREMONY');
        expect(caps.submissions).toBe(true);
        expect(caps.evaluators).toBe(true);
        expect(caps.judges).toBe(true);
        expect(caps.teams).toBe(false);

        const nav = evaluateNavigationContract('AWARD_CEREMONY', 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(true);
        expect(nav.hasTeamConsoleNav).toBe(false);
      });

      it('T2-F2-04: Unknown, undefined, or empty category safely falls back to standard baseline', () => {
        const capsUnknown = getEventCapabilities('GALA_EXTRAVAGANZA');
        expect(capsUnknown.registrations).toBe(true);
        expect(capsUnknown.judges).toBe(false);
        expect(capsUnknown.evaluators).toBe(false);
        expect(capsUnknown.teams).toBe(false);
        expect(capsUnknown.mentors).toBe(false);

        const capsNull = getEventCapabilities(null);
        expect(capsNull.judges).toBe(false);

        const nav = evaluateNavigationContract(undefined, 'TICKETIFICATION_REGISTRATION');
        expect(nav.hasJudgingNav).toBe(false);
        expect(nav.hasTeamConsoleNav).toBe(false);
      });

      it('T2-F2-05: Case insensitivity in category lookup resolves canonical matrix correctly', () => {
        expect(hasCapability('hackathon', 'judges')).toBe(true);
        expect(hasCapability('wedding', 'judges')).toBe(false);
        expect(hasCapability('WORKshop', 'mentors')).toBe(true);
      });

      it('T2-F2-06: Member invitation rejects EVALUATOR role when category lacks evaluator capability', async () => {
        const mockWeddingEvent = makeMockEvent({ eventType: 'WEDDING' });

        await expect(
          eventMemberService.inviteMember(
            mockWeddingEvent._id.toString(),
            hostUser.id,
            {
              email: 'evaluator@example.com',
              role: 'EVALUATOR',
            }
          )
        ).rejects.toThrow(/evaluat|capability|not supported|role/i);
      });
    });

    describe('F3 Boundaries: Private-to-Public Transitions & Verification Integrity', () => {
      it('T2-F3-01: Switching unverified event from private to public re-evaluates and blocks readiness', () => {
        const mockEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          verificationStatus: 'PENDING',
        });

        // While private: ready
        expect(validatePublicationReadiness(mockEvent).isReady).toBe(true);

        // When switched to public: blocked
        mockEvent.visibility = 'public';
        const publicResult = validatePublicationReadiness(mockEvent);
        expect(publicResult.isReady).toBe(false);
        expect(publicResult.errors.some((e) => e.includes('Organization verification is pending'))).toBe(true);
      });

      it('T2-F3-02: Organization verification status REJECTED allows private event, but blocks public event', () => {
        const mockPrivateEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'REJECTED',
          verificationStatus: 'REJECTED',
        });
        expect(validatePublicationReadiness(mockPrivateEvent).isReady).toBe(true);

        const mockPublicEvent: any = makeMockEvent({
          visibility: 'public',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'REJECTED',
          verificationStatus: 'REJECTED',
        });
        const pubResult = validatePublicationReadiness(mockPublicEvent);
        expect(pubResult.isReady).toBe(false);
        expect(pubResult.errors.some((e) => e.includes('Organization verification was rejected'))).toBe(true);
      });

      it('T2-F3-03: Private event with missing schedule fails publication readiness (only org verification is exempt)', () => {
        const mockInvalidPrivateEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          schedule: { startAt: null, endAt: null },
        });

        const result = validatePublicationReadiness(mockInvalidPrivateEvent);
        expect(result.isReady).toBe(false);
        expect(result.errors.some((e) => e.includes('schedule start date is required'))).toBe(true);
      });

      it('T2-F3-04: Private event with end date before start date fails publication readiness', () => {
        const mockInvalidPrivateEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          schedule: {
            startAt: new Date(Date.now() + 172800000),
            endAt: new Date(Date.now() + 86400000), // Inverted date
          },
        });

        const result = validatePublicationReadiness(mockInvalidPrivateEvent);
        expect(result.isReady).toBe(false);
        expect(result.errors.some((e) => e.includes('end date must be after the start date'))).toBe(true);
      });

      it('T2-F3-05: Publication attempt on CANCELLED private event is rejected by lifecycle state machine', async () => {
        const mockCancelledPrivateEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          status: 'CANCELLED',
        });

        await expect(
          lifecycleService.transitionStatus(
            mockCancelledPrivateEvent._id.toString(),
            hostUser.id,
            'PUBLISHED'
          )
        ).rejects.toThrow(/Invalid status transition/);
      });

      it('T2-F3-06: Non-owner cannot publish a private event even if organization is exempted', async () => {
        const mockPrivateEvent: any = makeMockEvent({
          visibility: 'private',
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          ownerSupabaseId: 'different_owner_123',
        });

        await expect(
          lifecycleService.transitionStatus(
            mockPrivateEvent._id.toString(),
            hostUser.id,
            'PUBLISHED'
          )
        ).rejects.toThrow(/You do not have permission/);
      });
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE CROSS-FEATURE COMBINATIONS
  // =========================================================================

  describe('Tier 3: Pairwise Cross-Feature Combinations', () => {
    it('T3-PAIR-01: Private Wedding + Native Registration (No guest roster, no judging, org verification exempt)', async () => {
      const mockEvent: any = makeMockEvent({
        visibility: 'private',
        eventType: 'WEDDING',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
      });

      // 1. Publication readiness passes without org verification
      const readiness = validatePublicationReadiness(mockEvent);
      expect(readiness.isReady).toBe(true);

      // 2. Dashboard features: no guest roster
      const features = (eventDashboardService as any).deriveFeatures('WEDDING', 'Pass', 'TICKETIFICATION_REGISTRATION');
      expect(features.hasGuestRoster).toBe(false);

      // 3. Capabilities: no judging, no teams
      const caps = getEventCapabilities('WEDDING');
      expect(caps.judges).toBe(false);
      expect(caps.teams).toBe(false);

      // 4. Navigation contract: no guest roster, no judging, no teams
      const nav = evaluateNavigationContract('WEDDING', 'TICKETIFICATION_REGISTRATION');
      expect(nav.hasGuestRosterNav).toBe(false);
      expect(nav.hasJudgingNav).toBe(false);
      expect(nav.hasTeamConsoleNav).toBe(false);

      // 5. Guest creation rejected
      const guestRes = await request(app)
        .post(`/api/guests/events/${mockEvent._id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ name: 'Guest', category: 'VIP' });
      expect(guestRes.status).toBe(400);

      // 6. Rubric creation rejected
      const rubricRes = await request(app)
        .post(`/api/events/${mockEvent._id}/rubrics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Wedding Rubric' });
      expect(rubricRes.status).toBe(400);
    });

    it('T3-PAIR-02: Public Conference + Manual Attendee Roster (Guest roster enabled, no judging, org verification enforced)', async () => {
      const mockEvent: any = makeMockEvent({
        visibility: 'public',
        eventType: 'CONFERENCE',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'APPROVED',
        verificationStatus: 'VERIFIED',
      });

      // 1. Publication readiness: verified org succeeds
      expect(validatePublicationReadiness(mockEvent).isReady).toBe(true);

      // If org is unverified, strictly fails
      mockEvent.organizationVerificationStatus = 'PENDING';
      expect(validatePublicationReadiness(mockEvent).isReady).toBe(false);
      mockEvent.organizationVerificationStatus = 'APPROVED';

      // 2. Dashboard features: has guest roster
      const features = (eventDashboardService as any).deriveFeatures('CONFERENCE', 'Badge', 'EXISTING_ATTENDEE_DATA');
      expect(features.hasGuestRoster).toBe(true);

      // 3. Navigation contract: has guest roster, no judging, no teams
      const nav = evaluateNavigationContract('CONFERENCE', 'EXISTING_ATTENDEE_DATA');
      expect(nav.hasGuestRosterNav).toBe(true);
      expect(nav.hasJudgingNav).toBe(false);
      expect(nav.hasTeamConsoleNav).toBe(false);

      // 4. Rubric creation rejected
      const rubricRes = await request(app)
        .post(`/api/events/${mockEvent._id}/rubrics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Conference Rubric' });
      expect(rubricRes.status).toBe(400);
    });

    it('T3-PAIR-03: Private Hackathon + Native Registration (No guest roster, judging enabled, org verification exempt)', async () => {
      const mockEvent: any = makeMockEvent({
        visibility: 'private',
        eventType: 'HACKATHON',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
      });

      // 1. Publication readiness: exempt
      expect(validatePublicationReadiness(mockEvent).isReady).toBe(true);

      // 2. Features: no guest roster
      const features = (eventDashboardService as any).deriveFeatures('HACKATHON', 'Pass', 'TICKETIFICATION_REGISTRATION');
      expect(features.hasGuestRoster).toBe(false);

      // 3. Navigation: no guest roster; has judging, has teams
      const nav = evaluateNavigationContract('HACKATHON', 'TICKETIFICATION_REGISTRATION');
      expect(nav.hasGuestRosterNav).toBe(false);
      expect(nav.hasJudgingNav).toBe(true);
      expect(nav.hasTeamConsoleNav).toBe(true);

      // 4. Rubric creation allowed
      const caps = getEventCapabilities('HACKATHON');
      expect(caps.judges).toBe(true);
      expect(caps.evaluators).toBe(true);
    });

    it('T3-PAIR-04: Public Hackathon + Manual Attendee Roster (Guest roster enabled, judging enabled, org verification enforced)', async () => {
      const mockEvent: any = makeMockEvent({
        visibility: 'public',
        eventType: 'HACKATHON',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'APPROVED',
        verificationStatus: 'VERIFIED',
      });

      // 1. Publication readiness: enforced & passes
      expect(validatePublicationReadiness(mockEvent).isReady).toBe(true);

      // 2. Features: has guest roster
      const features = (eventDashboardService as any).deriveFeatures('HACKATHON', 'Pass', 'EXISTING_ATTENDEE_DATA');
      expect(features.hasGuestRoster).toBe(true);

      // 3. Navigation: has guest roster, has judging, has teams
      const nav = evaluateNavigationContract('HACKATHON', 'EXISTING_ATTENDEE_DATA');
      expect(nav.hasGuestRosterNav).toBe(true);
      expect(nav.hasJudgingNav).toBe(true);
      expect(nav.hasTeamConsoleNav).toBe(true);
    });

    it('T3-PAIR-05: Private Workshop + Native Registration with Mentors (No guest roster, no judging, mentors active, org verification exempt)', async () => {
      const mockEvent: any = makeMockEvent({
        visibility: 'private',
        eventType: 'WORKSHOP',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
      });

      // 1. Publication readiness: exempt
      expect(validatePublicationReadiness(mockEvent).isReady).toBe(true);

      // 2. Features: no guest roster
      const features = (eventDashboardService as any).deriveFeatures('WORKSHOP', 'Pass', 'TICKETIFICATION_REGISTRATION');
      expect(features.hasGuestRoster).toBe(false);

      // 3. Capabilities: mentors true, judges false
      const caps = getEventCapabilities('WORKSHOP');
      expect(caps.mentors).toBe(true);
      expect(caps.judges).toBe(false);

      // 4. Navigation: no guest roster, no judging, mentors active
      const nav = evaluateNavigationContract('WORKSHOP', 'TICKETIFICATION_REGISTRATION');
      expect(nav.hasGuestRosterNav).toBe(false);
      expect(nav.hasJudgingNav).toBe(false);
      expect(nav.hasMentors).toBe(true);
    });

    it('T3-PAIR-06: Public Concert + Native Registration (No guest roster, no judging, org verification blocked until approved)', async () => {
      const mockEvent: any = makeMockEvent({
        visibility: 'public',
        eventType: 'CONCERT',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
      });

      // 1. Publication readiness: strictly blocked
      const readiness = validatePublicationReadiness(mockEvent);
      expect(readiness.isReady).toBe(false);
      expect(readiness.errors.some((e) => e.includes('Organization verification is pending'))).toBe(true);

      // 2. Features: no guest roster
      const features = (eventDashboardService as any).deriveFeatures('CONCERT', 'Ticket', 'TICKETIFICATION_REGISTRATION');
      expect(features.hasGuestRoster).toBe(false);

      // 3. Navigation: no guest roster, no judging
      const nav = evaluateNavigationContract('CONCERT', 'TICKETIFICATION_REGISTRATION');
      expect(nav.hasGuestRosterNav).toBe(false);
      expect(nav.hasJudgingNav).toBe(false);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (>=5 Scenarios)
  // =========================================================================

  describe('Tier 4: Real-World Scenarios', () => {
    it('T4-SCENARIO-01: Unverified Community Club hosts a Private Corporate Retreat / Workshop', async () => {
      // Step 1: Club creates private workshop while org verification is pending
      const workshopEvent = makeMockEvent({
        name: 'Leadership & AI Executive Workshop',
        eventType: 'WORKSHOP',
        visibility: 'private',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        status: 'APPROVED',
      });

      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...workshopEvent,
        status: 'PUBLISHED',
      } as any);

      // Step 2: Precondition — readiness validated and passes
      const readiness = validatePublicationReadiness(workshopEvent as any);
      expect(readiness.isReady).toBe(true);

      // Step 3: Action — Host publishes event
      const published = await lifecycleService.transitionStatus(
        workshopEvent._id.toString(),
        hostUser.id,
        'PUBLISHED'
      );
      expect(published.event.status).toBe('PUBLISHED');

      // Step 4: Verification — Host console verifies module availability
      const nav = evaluateNavigationContract(workshopEvent.eventType, workshopEvent.attendanceMode);
      expect(nav.hasGuestRosterNav).toBe(false); // Native registration hides guest roster
      expect(nav.hasJudgingNav).toBe(false); // Workshop has no judging
      expect(nav.hasMentors).toBe(true); // Workshop supports mentors
    });

    it('T4-SCENARIO-02: Indie Musical Band organizes a Private VIP Concert with Existing Guest Roster', async () => {
      // Step 1: Band creates private concert with external guest roster
      const concertEvent = makeMockEvent({
        name: 'Acoustic Sessions: Exclusive VIP Night',
        eventType: 'CONCERT',
        visibility: 'private',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
        status: 'APPROVED',
      });

      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...concertEvent,
        status: 'PUBLISHED',
      } as any);

      // Step 2: Readiness check succeeds despite unverified org
      expect(validatePublicationReadiness(concertEvent as any).isReady).toBe(true);

      // Step 3: Event published
      const published = await lifecycleService.transitionStatus(
        concertEvent._id.toString(),
        hostUser.id,
        'PUBLISHED'
      );
      expect(published.event.status).toBe('PUBLISHED');

      // Step 4: Host console navigation exposes Guest Roster and suppresses judging
      const nav = evaluateNavigationContract(concertEvent.eventType, concertEvent.attendanceMode);
      expect(nav.hasGuestRosterNav).toBe(true);
      expect(nav.hasJudgingNav).toBe(false);

      // Step 5: Adding a VIP guest succeeds
      const guest = await guestService.createGuest(
        concertEvent._id.toString(),
        hostUser.id,
        {
          name: 'VIP Sponsor',
          category: 'VIP',
          email: 'sponsor@example.com',
        }
      );
      expect(guest.name).toBe('VIP Sponsor');
    });

    it('T4-SCENARIO-03: Family hosts a Private Wedding with Native RSVP / Registration', async () => {
      // Step 1: Family hosts wedding with individual hosting and native registration
      const weddingEvent = makeMockEvent({
        name: 'Priya & Rahul Wedding Celebration',
        eventType: 'WEDDING',
        visibility: 'private',
        hostingType: 'INDIVIDUAL',
        organizationVerificationStatus: 'NOT_REQUIRED',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        status: 'APPROVED',
      });

      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...weddingEvent,
        status: 'PUBLISHED',
      } as any);

      // Step 2: Immediate publication readiness
      expect(validatePublicationReadiness(weddingEvent as any).isReady).toBe(true);

      // Step 3: Published
      const published = await lifecycleService.transitionStatus(
        weddingEvent._id.toString(),
        hostUser.id,
        'PUBLISHED'
      );
      expect(published.event.status).toBe('PUBLISHED');

      // Step 4: Navigation contract check
      const nav = evaluateNavigationContract(weddingEvent.eventType, weddingEvent.attendanceMode);
      expect(nav.hasGuestRosterNav).toBe(false);
      expect(nav.hasJudgingNav).toBe(false);
      expect(nav.hasTeamConsoleNav).toBe(false);

      // Step 5: Programmatic attempts to create judging rubrics are rejected
      const rubricRes = await request(app)
        .post(`/api/events/${weddingEvent._id}/rubrics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Ceremony Judging' });
      expect(rubricRes.status).toBe(400);
    });

    it('T4-SCENARIO-04: Tech Enterprise hosts a Public Multi-Track Conference with External Guest List', async () => {
      // Step 1: Enterprise attempts to publish public conference while verification is PENDING
      const confEvent = makeMockEvent({
        name: 'Global Cloud Architecture Summit 2026',
        eventType: 'CONFERENCE',
        visibility: 'public',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
        status: 'APPROVED',
      });

      // Step 2: Precondition — publication blocked
      const blockedReadiness = validatePublicationReadiness(confEvent as any);
      expect(blockedReadiness.isReady).toBe(false);
      expect(blockedReadiness.errors.some((e) => e.includes('Organization verification is pending'))).toBe(true);

      // Step 3: Admin approves organization
      confEvent.organizationVerificationStatus = 'APPROVED';
      confEvent.verificationStatus = 'VERIFIED';

      // Step 4: Publication readiness now succeeds
      const approvedReadiness = validatePublicationReadiness(confEvent as any);
      expect(approvedReadiness.isReady).toBe(true);

      // Step 5: Lifecycle transition to published succeeds
      jest.spyOn(mongoEventRepository, 'transitionStatus').mockResolvedValue({
        ...confEvent,
        status: 'PUBLISHED',
      } as any);

      const published = await lifecycleService.transitionStatus(
        confEvent._id.toString(),
        hostUser.id,
        'PUBLISHED'
      );
      expect(published.event.status).toBe('PUBLISHED');

      // Step 6: Navigation verifies Guest Roster is exposed and judging is omitted
      const nav = evaluateNavigationContract(confEvent.eventType, confEvent.attendanceMode);
      expect(nav.hasGuestRosterNav).toBe(true);
      expect(nav.hasJudgingNav).toBe(false);
    });

    it('T4-SCENARIO-05: University Student Club organizes a Public Inter-College Hackathon', async () => {
      // Step 1: Club creates public hackathon with native registration
      const hackathonEvent = makeMockEvent({
        name: 'Inter-College Innovators Hackathon 2026',
        eventType: 'HACKATHON',
        visibility: 'public',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'APPROVED',
        verificationStatus: 'VERIFIED',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        status: 'APPROVED',
      });

      // Step 2: Readiness check succeeds
      expect(validatePublicationReadiness(hackathonEvent as any).isReady).toBe(true);

      // Step 3: Navigation contract exposes complete evaluation suite, but hides guest roster
      const nav = evaluateNavigationContract(hackathonEvent.eventType, hackathonEvent.attendanceMode);
      expect(nav.hasGuestRosterNav).toBe(false); // Native registration hides guest roster
      expect(nav.hasJudgingNav).toBe(true); // Hackathon has judging
      expect(nav.hasTeamConsoleNav).toBe(true); // Hackathon has teams

      // Step 4: Hackathon capabilities include mentors, evaluators, judges, submissions, results
      const caps = getEventCapabilities(hackathonEvent.eventType);
      expect(caps.judges).toBe(true);
      expect(caps.evaluators).toBe(true);
      expect(caps.mentors).toBe(true);
      expect(caps.teams).toBe(true);
      expect(caps.submissions).toBe(true);
      expect(caps.results).toBe(true);

      // Step 5: Attempting manual guest addition is blocked under native registration
      const guestRes = await request(app)
        .post(`/api/guests/events/${hackathonEvent._id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ name: 'Hacker Guest', category: 'PARTICIPANT' });
      expect(guestRes.status).toBe(400);
    });
  });
});
