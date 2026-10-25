import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import { createJwtToken } from '../src/utils/local-auth';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventVerificationRepository } from '../src/modules/events/repositories/mongo-event-verification.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { eventService } from '../src/modules/events/services/event.service';
import { eventVerificationService } from '../src/modules/events/services/event-verification.service';
import { eventLifecycleService } from '../src/modules/events/services/event-lifecycle.service';
import {
  canManageEventOperations,
  getUserDisplayRole,
  isHostWorkspaceMode,
  getNavigationCategories,
} from '../../client/src/utils/permissions';
import {
  EVENT_CAPABILITY_MATRIX as serverCapabilityMatrix,
  getEventCapabilities as serverGetCapabilities,
} from '../src/modules/events/utils/event-capabilities';
import {
  EVENT_CAPABILITY_MATRIX as clientCapabilityMatrix,
  getEventCapabilities as clientGetCapabilities,
} from '../../client/src/utils/event-capabilities';
import {
  validatePublicationReadiness,
  assertPublicationReadiness,
} from '../src/modules/events/utils/publication-readiness';
import { EVENT_TYPES, EventType } from '../src/db/mongo/models/event.model';

describe('Architectural Audit Verification Matrix (Workstreams 1-6)', () => {
  const hostUser = {
    id: 'usr_host_audit_1',
    email: 'host.audit@ticketification.internal',
    role: 'USER' as const,
  };
  const hostToken = createJwtToken(hostUser);
  const hostMongoId = new mongoose.Types.ObjectId();

  const coordinatorUser = {
    id: 'usr_coord_audit_1',
    email: 'coord.audit@ticketification.internal',
    role: 'USER' as const,
  };
  const coordinatorToken = createJwtToken(coordinatorUser);
  const coordinatorMongoId = new mongoose.Types.ObjectId();

  const judgeUser = {
    id: 'usr_judge_audit_1',
    email: 'judge.audit@ticketification.internal',
    role: 'USER' as const,
  };
  const judgeToken = createJwtToken(judgeUser);
  const judgeMongoId = new mongoose.Types.ObjectId();

  const adminUser = {
    id: 'usr_admin_audit_1',
    email: 'admin.audit@ticketification.internal',
    role: 'ADMIN' as const,
  };
  const adminToken = createJwtToken(adminUser);
  const adminMongoId = new mongoose.Types.ObjectId();

  const foreignUser = {
    id: 'usr_foreign_audit_1',
    email: 'foreign.audit@ticketification.internal',
    role: 'USER' as const,
  };
  const foreignToken = createJwtToken(foreignUser);
  const foreignMongoId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();

    const userMap: Record<string, any> = {
      [hostUser.id]: {
        _id: hostMongoId,
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host User',
        platformRole: 'USER',
        status: 'ACTIVE',
        isOnboarded: false, // Normal user without HostProfile
      },
      [coordinatorUser.id]: {
        _id: coordinatorMongoId,
        supabaseUserId: coordinatorUser.id,
        email: coordinatorUser.email,
        name: 'Coordinator User',
        platformRole: 'USER',
        status: 'ACTIVE',
        isOnboarded: false,
      },
      [judgeUser.id]: {
        _id: judgeMongoId,
        supabaseUserId: judgeUser.id,
        email: judgeUser.email,
        name: 'Judge User',
        platformRole: 'USER',
        status: 'ACTIVE',
        isOnboarded: false,
      },
      [adminUser.id]: {
        _id: adminMongoId,
        supabaseUserId: adminUser.id,
        email: adminUser.email,
        name: 'Platform Admin',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
      },
      [foreignUser.id]: {
        _id: foreignMongoId,
        supabaseUserId: foreignUser.id,
        email: foreignUser.email,
        name: 'Foreign User',
        platformRole: 'USER',
        status: 'ACTIVE',
        isOnboarded: true, // Legacy onboarded user!
      },
    };

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string) => {
      return userMap[id] || null;
    });
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: any) => {
      const strId = id?.toString();
      const found = Object.values(userMap).find((u) => u._id.toString() === strId);
      return found || null;
    });
  });

  // =========================================================================
  // WORKSTREAM 1: Single Global User Identity & HostProfile Independence
  // =========================================================================
  describe('Workstream 1: Single Global User Identity & HostProfile Independence', () => {
    it('allows an authenticated user without HostProfile or onboarding to create an individual event', async () => {
      const eventId = new mongoose.Types.ObjectId();
      jest.spyOn(mongoEventRepository, 'create').mockResolvedValue({
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'CONFERENCE',
        name: 'Independent Tech Meetup',
        credentialTerminology: 'Attendee Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Civic Center', city: 'Bengaluru', country: 'India' },
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'Asia/Kolkata',
        },
        hostingType: 'INDIVIDUAL',
        organizationVerificationStatus: 'NOT_REQUIRED',
        verificationStatus: 'UNVERIFIED',
        verificationLevel: 'UNVERIFIED',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          eventType: 'CONFERENCE',
          name: 'Independent Tech Meetup',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          hostingType: 'INDIVIDUAL',
          venue: { type: 'PHYSICAL', name: 'Civic Center', city: 'Bengaluru', country: 'India' },
          schedule: {
            startAt: new Date(Date.now() + 86400000).toISOString(),
            endAt: new Date(Date.now() + 172800000).toISOString(),
            timezone: 'Asia/Kolkata',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hostingType).toBe('INDIVIDUAL');
      expect(res.body.data.organizationVerificationStatus).toBe('NOT_REQUIRED');
    });

    it('prohibits a user with legacy isOnboarded: true from accessing an unauthorized event', () => {
      const foreignEvent = {
        id: 'foreign_event_1',
        name: 'Foreign Private Event',
        ownerSupabaseId: hostUser.id,
        createdBy: hostUser.id,
      };

      const onboardedAttendee = {
        id: foreignUser.id,
        name: foreignUser.name,
        email: foreignUser.email,
        role: 'USER',
        isOnboarded: true, // Legacy onboarded
      };

      // Client permission guard denies access
      expect(canManageEventOperations(onboardedAttendee, foreignEvent)).toBe(false);
    });

    it('ensures getUserDisplayRole returns Attendee globally even if isOnboarded is true', () => {
      const onboardedAttendee = {
        name: 'Praveen',
        email: 'praveen@example.com',
        role: 'USER',
        isOnboarded: true,
      };

      expect(getUserDisplayRole(onboardedAttendee)).toBe('Attendee');
      expect(getUserDisplayRole(onboardedAttendee, null)).toBe('Attendee');
    });
  });

  // =========================================================================
  // WORKSTREAM 2: Fix Organization Verification Record Failures
  // =========================================================================
  describe('Workstream 2: Fix Organization Verification Record Failures', () => {
    it('keeps event in safe recoverable non-public state (PENDING, NOT REJECTED) when verification record creation throws', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockSavedEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'HACKATHON',
        name: 'Campus Hack 2026',
        hostingType: 'ORGANIZATION',
        organization: {
          name: 'ACM Student Chapter',
          institutionType: 'COLLEGE_UNIVERSITY',
          officialEmail: 'acm@campus.edu',
        },
        venue: { type: 'PHYSICAL', name: 'Main Auditorium', city: 'Bengaluru', country: 'India' },
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'Asia/Kolkata',
        },
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'UNVERIFIED',
        verificationLevel: 'UNVERIFIED',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockImplementation(async () => mockSavedEvent),
      };

      jest.spyOn(mongoEventRepository, 'create').mockResolvedValue(mockSavedEvent);
      // Simulate infrastructure/network/DB failure on verification record creation
      jest.spyOn(mongoEventVerificationRepository, 'createVerification').mockRejectedValue(
        new Error('MongoDB replica set connection timed out')
      );

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          eventType: 'HACKATHON',
          name: 'Campus Hack 2026',
          hostingType: 'ORGANIZATION',
          organization: {
            name: 'ACM Student Chapter',
            institutionType: 'COLLEGE_UNIVERSITY',
            officialEmail: 'acm@campus.edu',
          },
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          venue: { type: 'PHYSICAL', name: 'Main Auditorium', city: 'Bengaluru', country: 'India' },
          schedule: {
            startAt: new Date(Date.now() + 86400000).toISOString(),
            endAt: new Date(Date.now() + 172800000).toISOString(),
            timezone: 'Asia/Kolkata',
          },
        });

      expect(res.status).toBe(201);
      // Verified fix: The event is NOT marked as REJECTED!
      expect(res.body.data.organizationVerificationStatus).toBe('PENDING');
      expect(res.body.data.verificationStatus).toBe('UNVERIFIED');
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('auto-heals and creates verification record without duplicates via retry endpoint', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'HACKATHON',
        name: 'Campus Hack 2026',
        hostingType: 'ORGANIZATION',
        organization: {
          name: 'ACM Student Chapter',
          institutionType: 'COLLEGE_UNIVERSITY',
          officialEmail: 'acm@campus.edu',
        },
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'UNVERIFIED',
        status: 'DRAFT',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue(null);
      const createVerifSpy = jest.spyOn(mongoEventVerificationRepository, 'createVerification').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        ownerId: hostMongoId,
        institutionName: 'ACM Student Chapter',
        status: 'PENDING',
      } as any);

      const res = await request(app)
        .post(`/api/events/${eventId.toString()}/verification/retry`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(createVerifSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId,
          institutionName: 'ACM Student Chapter',
          status: 'PENDING',
        })
      );
    });

    it('distinguishes a genuine administrative rejection with decision and review notes', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        status: 'SUBMITTED',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        riskTier: 'MEDIUM',
      } as any);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: 'REJECTED',
      } as any);

      const res = await request(app)
        .post(`/api/admin/verifications/${eventId.toString()}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECTED',
          reviewNotes: 'Institutional authorization document could not be validated with university registry.',
        });

      expect(res.status).toBe(200);
      expect(mockEvent.status).toBe('DRAFT');
      expect(mockEvent.organizationVerificationStatus).toBe('REJECTED');
      expect(mockEvent.verificationStatus).toBe('REJECTED');
      expect(mockEvent.statusHistory[0].reason).toContain('Institutional authorization document');
    });
  });

  // =========================================================================
  // WORKSTREAM 3: Enforce Complete Publication Readiness
  // =========================================================================
  describe('Workstream 3: Enforce Complete Publication Readiness', () => {
    it('blocks publication when schedule end date precedes start date', () => {
      const invalidEvent: any = {
        name: 'Invalid Schedule Summit',
        eventType: 'CONFERENCE',
        hostingType: 'INDIVIDUAL',
        organizationVerificationStatus: 'NOT_REQUIRED',
        venue: { type: 'PHYSICAL', name: 'Hall A', city: 'Delhi' },
        schedule: {
          startAt: new Date('2026-11-20T10:00:00Z'),
          endAt: new Date('2026-11-19T10:00:00Z'), // Before start!
        },
      };

      const result = validatePublicationReadiness(invalidEvent);
      expect(result.isReady).toBe(false);
      expect(result.errors).toContain('Event schedule end date must be after the start date.');
      expect(() => assertPublicationReadiness(invalidEvent)).toThrow('Event schedule end date must be after the start date.');
    });

    it('blocks publication when required event name is missing', () => {
      const noNameEvent: any = {
        name: '', // Missing name
        eventType: 'CONFERENCE',
        hostingType: 'INDIVIDUAL',
        organizationVerificationStatus: 'NOT_REQUIRED',
        schedule: {
          startAt: new Date('2026-11-20T10:00:00Z'),
          endAt: new Date('2026-11-20T18:00:00Z'),
        },
      };

      const result = validatePublicationReadiness(noNameEvent);
      expect(result.isReady).toBe(false);
      expect(result.errors).toContain('Event name is required before publication.');
    });

    it('transitions approved organization event with incomplete schedule to APPROVED instead of auto-publishing', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const incompleteEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        name: 'Approved But Incomplete Hackathon',
        eventType: 'HACKATHON',
        status: 'SUBMITTED',
        hostingType: 'ORGANIZATION',
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() - 1000), // Incomplete/invalid schedule: end before start!
        },
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(incompleteEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        riskTier: 'LOW',
      } as any);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({} as any);

      const result = await eventVerificationService.reviewVerification(
        eventId.toString(),
        adminUser.id,
        'APPROVED',
        'Org approved, but event must be completed before publishing'
      );

      // Verified fix: Remained in APPROVED (non-public), did NOT auto-publish!
      expect(result.event.status).toBe('APPROVED');
      expect(result.event.organizationVerificationStatus).toBe('APPROVED');
      expect(result.event.verificationStatus).toBe('VERIFIED');
    });

    it('auto-publishes when organization is approved AND complete publication readiness is satisfied', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const readyEvent: any = {
        _id: eventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        name: 'Fully Ready Hackathon 2026',
        eventType: 'HACKATHON',
        status: 'SUBMITTED',
        hostingType: 'ORGANIZATION',
        venue: { type: 'PHYSICAL', name: 'Main Campus', city: 'Bengaluru' },
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
        },
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(readyEvent);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        riskTier: 'LOW',
      } as any);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({} as any);

      const result = await eventVerificationService.reviewVerification(
        eventId.toString(),
        adminUser.id,
        'APPROVED',
        'Auto-publishing ready event'
      );

      expect(result.event.status).toBe('PUBLISHED');
      expect(result.event.organizationVerificationStatus).toBe('APPROVED');
      expect(result.event.verificationStatus).toBe('VERIFIED');
    });
  });

  // =========================================================================
  // WORKSTREAM 4: Correct Event-Level Authorization for Collaborators
  // =========================================================================
  describe('Workstream 4: Correct Event-Level Authorization for Collaborators', () => {
    const eventId = new mongoose.Types.ObjectId();
    const eventDoc: any = {
      _id: eventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Collaborator Operations Summit',
      eventType: 'CONFERENCE',
      status: 'PUBLISHED',
      schedule: {
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        timezone: 'Asia/Kolkata',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('authorizes event creator to manage operations and retrieve event details as HOST', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(eventDoc);

      const event = await eventService.getEventById(eventId.toString(), hostUser.id);
      expect(event.userRole).toBe('HOST');

      const canManage = canManageEventOperations(hostUser, {
        createdBy: hostUser.id,
        ownerSupabaseId: hostUser.id,
        userRole: 'HOST',
      });
      expect(canManage).toBe(true);
    });

    it('authorizes assigned COORDINATOR to manage event operations and retrieve event details', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(eventDoc);
      jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        userId: coordinatorMongoId,
        role: 'COORDINATOR',
        status: 'ACTIVE',
        permissions: ['MANAGE_ATTENDEES', 'IMPORT_ATTENDEES', 'SCAN_CREDENTIALS'],
      } as any);

      const event = await eventService.getEventById(eventId.toString(), coordinatorUser.id);
      expect(event.userRole).toBe('COORDINATOR');
      expect(event.userPermissions).toContain('IMPORT_ATTENDEES');

      const canManage = canManageEventOperations(coordinatorUser, {
        createdBy: hostUser.id,
        userRole: 'COORDINATOR',
      });
      expect(canManage).toBe(true);
    });

    it('prohibits assigned JUDGE from host-level operations while granting review workspace access', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(eventDoc);
      jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        userId: judgeMongoId,
        role: 'JUDGE',
        status: 'ACTIVE',
        permissions: ['SCORE_ASSIGNED_TEAMS', 'VIEW_EVALUATION_RESULTS'],
      } as any);

      const event = await eventService.getEventById(eventId.toString(), judgeUser.id);
      expect(event.userRole).toBe('JUDGE');

      // Least privilege: Judges do NOT receive general host operational management capability
      const canManage = canManageEventOperations(judgeUser, {
        createdBy: hostUser.id,
        userRole: 'JUDGE',
      });
      expect(canManage).toBe(false);
    });

    it('immediately denies access if collaborator status is REVOKED', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(eventDoc);
      jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId,
        userId: coordinatorMongoId,
        role: 'COORDINATOR',
        status: 'REVOKED', // Access revoked!
        permissions: [],
      } as any);

      await expect(
        eventService.getEventById(eventId.toString(), coordinatorUser.id)
      ).rejects.toThrow('Access denied');
    });
  });

  // =========================================================================
  // WORKSTREAM 5: Capability Matrix Parity Across Client & Server
  // =========================================================================
  describe('Workstream 5: Capability Matrix Parity Across Client & Server', () => {
    it('verifies 100% parity across all 13 canonical EVENT_TYPES between client and server', () => {
      const serverTypes = Object.keys(serverCapabilityMatrix).sort();
      const clientTypes = Object.keys(clientCapabilityMatrix).sort();

      expect(serverTypes).toEqual(clientTypes);
      expect(serverTypes).toHaveLength(13);

      for (const eventType of EVENT_TYPES) {
        const serverCaps = serverGetCapabilities(eventType);
        const clientCaps = clientGetCapabilities(eventType);

        expect(serverCaps).toEqual(clientCaps);
      }
    });

    it('verifies exact key parity for all 14 capability flags across every event type', () => {
      const expectedKeys = [
        'registrations',
        'ticketing',
        'checkIn',
        'teams',
        'submissions',
        'mentors',
        'evaluators',
        'judges',
        'results',
        'schedule',
        'venues',
        'communications',
        'analytics',
        'auditLog',
      ];

      for (const eventType of EVENT_TYPES) {
        const serverCaps = serverGetCapabilities(eventType);
        const clientCaps = clientGetCapabilities(eventType);

        expect(Object.keys(serverCaps).sort()).toEqual(expectedKeys.sort());
        expect(Object.keys(clientCaps).sort()).toEqual(expectedKeys.sort());
      }
    });
  });

  // =========================================================================
  // WORKSTREAM 6: Workspace Routing & Event Isolation
  // =========================================================================
  describe('Workstream 6: Workspace Routing & Event Isolation', () => {
    it('isolates Global User Navigation from Event Host Workspace navigation', () => {
      const globalNav = getNavigationCategories({
        user: hostUser,
        currentEvent: null,
        pathname: '/explore',
      });
      const globalTitles = globalNav.map((c) => c.title);

      expect(globalTitles).toContain('Event Discovery');
      expect(globalTitles).toContain('Attendee Wallet');
      expect(globalTitles).toContain('My Activity');
      expect(globalTitles).toContain('Event Hosting');
      expect(globalTitles).not.toContain('Core Event Management');
      expect(globalTitles).not.toContain('Event Operations');

      const hostNav = getNavigationCategories({
        user: hostUser,
        currentEvent: {
          id: 'evt_123',
          name: 'Tech Hackathon',
          eventType: 'HACKATHON',
          createdBy: hostUser.id,
        },
        pathname: '/events/evt_123',
      });
      const hostTitles = hostNav.map((c) => c.title);

      expect(hostTitles).toContain('Core Event Management');
      expect(hostTitles).toContain('Event Operations');
      expect(hostTitles).toContain('Personnel & Evaluation');
    });

    it('does not activate host workspace mode on global paths even if currentEvent is provided', () => {
      const activeEvent = { id: 'evt_123', name: 'Active Event' };

      expect(isHostWorkspaceMode('/explore', activeEvent)).toBe(false);
      expect(isHostWorkspaceMode('/wallet', activeEvent)).toBe(false);
      expect(isHostWorkspaceMode('/registrations', activeEvent)).toBe(false);
      expect(isHostWorkspaceMode('/history', activeEvent)).toBe(false);
      expect(isHostWorkspaceMode('/dashboard', activeEvent)).toBe(false);
      expect(isHostWorkspaceMode('/events/create', activeEvent)).toBe(false);

      // Explicit event-management route DOES activate host workspace mode
      expect(isHostWorkspaceMode('/events/evt_123', activeEvent)).toBe(true);
      expect(isHostWorkspaceMode('/import', activeEvent)).toBe(true);
      expect(isHostWorkspaceMode('/tickets', activeEvent)).toBe(true);
      expect(isHostWorkspaceMode('/scan', activeEvent)).toBe(true);
    });
  });
});
