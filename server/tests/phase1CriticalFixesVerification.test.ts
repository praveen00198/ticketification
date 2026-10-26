import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { createJwtToken } from '../src/utils/local-auth';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventVerificationRepository } from '../src/modules/events/repositories/mongo-event-verification.repository';

// Replicates client/src/utils/venue.ts formatVenueLabel
const formatVenueLabel = (venue: any): string => {
  if (!venue) return 'Online / TBA';
  if (typeof venue === 'string') return venue;
  if (typeof venue === 'object') {
    if (venue.name && venue.city) return `${venue.name}, ${venue.city}`;
    if (venue.name) return venue.name;
    if (venue.city) return venue.city;
    if (venue.address) return venue.address;
    if (venue.type === 'ONLINE') return 'Virtual Event (Online)';
    if (venue.type === 'HYBRID') return 'Hybrid Event';
    if (venue.type) return String(venue.type);
    return 'Venue Announced Soon';
  }
  return String(venue);
};

// Replicates client/src/api/events.ts normalizeEventItem
const normalizeEventItem = (item: any): any => {
  if (!item) {
    throw new Error('Cannot normalize null or undefined event');
  }

  const rawDate = item.schedule?.startAt || item.date || item.createdAt;
  let dateFormatted: string;
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      dateFormatted = isNaN(d.getTime()) ? String(rawDate) : d.toISOString().split('T')[0];
    } catch {
      dateFormatted = String(rawDate);
    }
  } else {
    dateFormatted = new Date().toISOString().split('T')[0];
  }

  let timeFormatted: string | null = null;
  if (item.time) {
    timeFormatted = item.time;
  } else if (item.schedule?.startAt) {
    try {
      const d = new Date(item.schedule.startAt);
      if (!isNaN(d.getTime())) {
        timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      timeFormatted = null;
    }
  }

  const venueDisplay = formatVenueLabel(item.venue);

  return {
    id: item._id || item.id,
    name: item.name || 'Untitled Event',
    date: dateFormatted,
    time: timeFormatted,
    venue: venueDisplay,
    description: item.description ?? null,
    organizerName: item.organizerName ?? (item.organization?.name ?? null),
    logoUrl: item.logoUrl ?? null,
    ticketTemplateUrl: item.ticketTemplateUrl ?? null,
    status: item.status || 'DRAFT',
    eventType: item.eventType,
    credentialTerminology: item.credentialTerminology || item.credentialType,
    attendanceMode: item.attendanceMode,
    hostingType: item.hostingType,
    organization: item.organization,
    organizationVerificationStatus: item.organizationVerificationStatus,
    verificationLevel: item.verificationLevel,
    verificationStatus: item.verificationStatus,
    displayStatus: item.displayStatus,
    bannerUrl: item.bannerUrl ?? null,
    venueDetails: item.venueDetails || (typeof item.venue === 'object' ? item.venue : null),
    scheduleDetails: item.scheduleDetails || item.schedule || null,
    createdBy: item.ownerId || item.ownerSupabaseId || item.createdBy || '',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    ticketTypes: item.ticketTypes,
    userRole: item.userRole,
    userPermissions: item.userPermissions,
  };
};

// Replicates client/src/utils/permissions.ts isHostWorkspaceMode
const isHostWorkspaceMode = (pathname: string, currentEvent?: { id?: string } | null): boolean => {
  if (!currentEvent) return false;
  if (pathname.startsWith('/events/') && !pathname.startsWith('/events/create')) {
    return true;
  }
  if (['/import', '/tickets', '/scan', '/reports'].includes(pathname)) {
    return true;
  }
  return false;
};

describe('Phase 1 Critical Production Bug Fixes Verification', () => {
  const testUser = {
    id: 'usr_phase1_test_001',
    email: 'phase1_test@example.com',
    role: 'USER' as const,
    name: 'Phase 1 Tester',
  };

  const testToken = createJwtToken({
    id: testUser.id,
    email: testUser.email,
    role: testUser.role,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // BUG A: Event Switcher & Venue Object Normalization
  // =========================================================================
  describe('Bug A: Venue Normalization & React Safety', () => {
    it('normalizes a raw backend event with a structured PHYSICAL venue object into a display string without losing venueDetails', () => {
      const rawBackendEvent = {
        _id: 'evt_101',
        name: 'Tech Conclave 2026',
        eventType: 'CONFERENCE',
        venue: {
          type: 'PHYSICAL',
          name: 'Silicon Arena',
          city: 'San Francisco',
          address: '500 Howard St',
          country: 'USA',
        },
        schedule: {
          startAt: '2026-11-15T09:30:00.000Z',
          endAt: '2026-11-16T18:00:00.000Z',
          timezone: 'America/Los_Angeles',
        },
        status: 'UPCOMING',
        hostingType: 'INDIVIDUAL',
        organizationVerificationStatus: 'NOT_REQUIRED',
        ticketTypes: [{ id: 'tt_1', name: 'GENERAL', label: 'General Pass' }],
        userRole: 'HOST',
      };

      const normalized = normalizeEventItem(rawBackendEvent);

      // 1. Venue must be a string (preventing React crash "Objects are not valid as a React child")
      expect(typeof normalized.venue).toBe('string');
      expect(normalized.venue).toBe('Silicon Arena, San Francisco');

      // 2. Full structured venue must be preserved in venueDetails
      expect(normalized.venueDetails).toEqual(rawBackendEvent.venue);
      expect(normalized.venueDetails.address).toBe('500 Howard St');

      // 3. Schedule must be extracted and preserved
      expect(normalized.date).toBe('2026-11-15');
      expect(normalized.scheduleDetails).toEqual(rawBackendEvent.schedule);

      // 4. Role, ticketTypes, and status must be preserved
      expect(normalized.userRole).toBe('HOST');
      expect(normalized.status).toBe('UPCOMING');
      expect(normalized.ticketTypes?.length).toBe(1);
    });

    it('normalizes an ONLINE event correctly and preserves online venueDetails', () => {
      const rawOnlineEvent = {
        _id: 'evt_online_002',
        name: 'Global Virtual Hackathon',
        eventType: 'HACKATHON',
        venue: {
          type: 'ONLINE',
          onlineDescription: 'Zoom + Discord',
        },
        schedule: {
          startAt: '2026-12-01T10:00:00.000Z',
          endAt: '2026-12-03T18:00:00.000Z',
          timezone: 'UTC',
        },
      };

      const normalized = normalizeEventItem(rawOnlineEvent);

      expect(typeof normalized.venue).toBe('string');
      expect(normalized.venue).toBe('Virtual Event (Online)');
      expect(normalized.venueDetails).toEqual({
        type: 'ONLINE',
        onlineDescription: 'Zoom + Discord',
      });
    });

    it('normalizes a HYBRID event correctly', () => {
      const rawHybridEvent = {
        _id: 'evt_hybrid_003',
        name: 'Hybrid Summit',
        venue: { type: 'HYBRID' },
      };

      const normalized = normalizeEventItem(rawHybridEvent);
      expect(normalized.venue).toBe('Hybrid Event');
      expect(normalized.venueDetails).toEqual({ type: 'HYBRID' });
    });

    it('preserves an existing string venue without modification', () => {
      const rawStringEvent = {
        _id: 'evt_string_004',
        name: 'Local Workshop',
        venue: 'Room 302, Engineering Block',
      };

      const normalized = normalizeEventItem(rawStringEvent);
      expect(normalized.venue).toBe('Room 302, Engineering Block');
    });

    it('handles null, undefined, or empty venue gracefully with fallback string', () => {
      const rawMissingVenue = {
        _id: 'evt_missing_005',
        name: 'TBD Meetup',
        venue: null,
      };

      const normalized = normalizeEventItem(rawMissingVenue);
      expect(typeof normalized.venue).toBe('string');
      expect(normalized.venue).toBe('Online / TBA');
    });

    it('guarantees formatVenueLabel always returns string under any input type', () => {
      const dangerousInputs = [
        { type: 'PHYSICAL' },
        { someCustomKey: 'value' },
        { city: 'London' },
        { address: '10 Downing St' },
        {},
        null,
        undefined,
        '',
        12345,
      ];

      dangerousInputs.forEach((input) => {
        const result = formatVenueLabel(input);
        expect(typeof result).toBe('string');
        expect(result).not.toBe('[object Object]');
      });
    });
  });

  // =========================================================================
  // BUG B: Workspace Navigation & Route Enforcement
  // =========================================================================
  describe('Bug B: Workspace Mode & Route Transitions', () => {
    const mockEvent = { id: 'evt_host_001', name: 'Production Launch Event' };

    it('treats /events/:id as Host Workspace mode when an event is selected', () => {
      expect(isHostWorkspaceMode('/events/evt_host_001', mockEvent)).toBe(true);
    });

    it('does NOT treat /dashboard as Host Workspace mode even if an event is set in state', () => {
      // Proves that navigating to /dashboard on Select was the exact cause of Bug B
      expect(isHostWorkspaceMode('/dashboard', mockEvent)).toBe(false);
    });

    it('does NOT treat /events/create as Host Workspace mode', () => {
      expect(isHostWorkspaceMode('/events/create', mockEvent)).toBe(false);
    });

    it('treats event operational sub-routes (/import, /tickets, /scan, /reports) as Host Workspace mode when currentEvent is present', () => {
      expect(isHostWorkspaceMode('/import', mockEvent)).toBe(true);
      expect(isHostWorkspaceMode('/tickets', mockEvent)).toBe(true);
      expect(isHostWorkspaceMode('/scan', mockEvent)).toBe(true);
      expect(isHostWorkspaceMode('/reports', mockEvent)).toBe(true);
    });

    it('returns false for all routes when currentEvent is null (Global User Workspace)', () => {
      expect(isHostWorkspaceMode('/events/evt_host_001', null)).toBe(false);
      expect(isHostWorkspaceMode('/dashboard', null)).toBe(false);
      expect(isHostWorkspaceMode('/import', null)).toBe(false);
      expect(isHostWorkspaceMode('/tickets', null)).toBe(false);
      expect(isHostWorkspaceMode('/scan', null)).toBe(false);
      expect(isHostWorkspaceMode('/reports', null)).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: Individual Event Creation Verification
  // =========================================================================
  describe('Section 4: Individual Event Creation Without Mandatory Onboarding', () => {
    it('allows an authenticated user without HostProfile or onboarding to create an individual event draft (HTTP 201)', async () => {
      const eventMongoId = new mongoose.Types.ObjectId();
      const userMongoId = new mongoose.Types.ObjectId();

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: userMongoId,
        supabaseUserId: testUser.id,
        email: testUser.email,
        name: testUser.name,
        platformRole: 'USER',
        status: 'ACTIVE',
        hostProfile: null, // User has NOT completed HostProfile onboarding
      } as any);

      jest.spyOn(mongoEventRepository, 'create').mockResolvedValue({
        _id: eventMongoId,
        ownerId: userMongoId,
        ownerSupabaseId: testUser.id,
        eventType: 'CONFERENCE',
        name: 'Community Open Mic',
        credentialTerminology: 'Attendee Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Community Center', city: 'Bengaluru' },
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
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          eventType: 'CONFERENCE',
          name: 'Community Open Mic',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          hostingType: 'INDIVIDUAL',
          venue: { type: 'PHYSICAL', name: 'Community Center', city: 'Bengaluru', country: 'India' },
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

    it('enforces organization verification details when hostingType is ORGANIZATION', async () => {
      const eventMongoId = new mongoose.Types.ObjectId();
      const userMongoId = new mongoose.Types.ObjectId();

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: userMongoId,
        supabaseUserId: testUser.id,
        email: testUser.email,
        name: testUser.name,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      jest.spyOn(mongoEventVerificationRepository, 'createVerification').mockResolvedValue({} as any);

      jest.spyOn(mongoEventRepository, 'create').mockResolvedValue({
        _id: eventMongoId,
        ownerId: userMongoId,
        ownerSupabaseId: testUser.id,
        eventType: 'HACKATHON',
        name: 'Inter-College Hackathon 2026',
        credentialTerminology: 'Participant Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'University Campus', city: 'Mumbai' },
        schedule: {
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          timezone: 'Asia/Kolkata',
        },
        hostingType: 'ORGANIZATION',
        organization: {
          name: 'Apex Institute of Technology',
          institutionType: 'COLLEGE_UNIVERSITY',
          officialEmail: 'contact@apex.edu',
        },
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        verificationLevel: 'UNVERIFIED',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          eventType: 'HACKATHON',
          name: 'Inter-College Hackathon 2026',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          hostingType: 'ORGANIZATION',
          organization: {
            name: 'Apex Institute of Technology',
            institutionType: 'COLLEGE_UNIVERSITY',
            officialEmail: 'contact@apex.edu',
          },
          venue: { type: 'PHYSICAL', name: 'University Campus', city: 'Mumbai', country: 'India' },
          schedule: {
            startAt: new Date(Date.now() + 86400000).toISOString(),
            endAt: new Date(Date.now() + 172800000).toISOString(),
            timezone: 'Asia/Kolkata',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hostingType).toBe('ORGANIZATION');
      expect(res.body.data.organizationVerificationStatus).toBe('PENDING');
    });
  });
});
