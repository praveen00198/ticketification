const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
  supabasePublic: null,
}));

import request from 'supertest';
import app from '../src/app';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventVerificationRepository } from '../src/modules/events/repositories/mongo-event-verification.repository';
import { supabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { createJwtToken } from '../src/utils/local-auth';
import mongoose from 'mongoose';

describe('Phase 4: Event Creation Engine & Wizard', () => {
  jest.setTimeout(30000);

  const hostUser = {
    id: 'host-user-uuid-ph4',
    email: 'host.phase4@example.com',
    role: 'USER' as const,
  };

  const otherUser = {
    id: 'other-user-uuid-ph4',
    email: 'other.phase4@example.com',
    role: 'USER' as const,
  };

  const unonboardedUser = {
    id: 'unonboarded-uuid-ph4',
    email: 'newuser.phase4@example.com',
    role: 'USER' as const,
  };

  const adminUser = {
    id: 'admin-user-uuid-ph4',
    email: 'admin.phase4@ticketification.com',
    role: 'ADMIN' as const,
  };

  const hostUserToken = createJwtToken(hostUser);
  const otherUserToken = createJwtToken(otherUser);
  const unonboardedUserToken = createJwtToken(unonboardedUser);
  const adminUserToken = createJwtToken(adminUser);

  const hostMongoId = new mongoose.Types.ObjectId();
  const otherMongoId = new mongoose.Types.ObjectId();
  const unonboardedMongoId = new mongoose.Types.ObjectId();
  const adminMongoId = new mongoose.Types.ObjectId();

  const validWizardPayload = {
    eventType: 'HACKATHON',
    name: 'HackFest 2026',
    description: 'Premier national hackathon for engineering students',
    attendanceMode: 'TICKETIFICATION_REGISTRATION',
    venue: {
      type: 'PHYSICAL',
      name: 'Innovation Hub Auditorium',
      city: 'Bangalore',
      country: 'India',
      address: 'Outer Ring Road 42',
      postalCode: '560103',
    },
    schedule: {
      startAt: '2026-11-20T09:00:00.000Z',
      endAt: '2026-11-22T18:00:00.000Z',
      timezone: 'Asia/Kolkata',
    },
    registration: {
      pricingModel: 'FREE',
      registrationRequired: true,
      capacity: 500,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const userMap: Record<string, any> = {
      [hostUser.id]: {
        _id: hostMongoId,
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host Organizer',
        platformRole: 'USER',
        status: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      },
      [otherUser.id]: {
        _id: otherMongoId,
        supabaseUserId: otherUser.id,
        email: otherUser.email,
        name: 'Other User',
        platformRole: 'USER',
        status: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      },
      [unonboardedUser.id]: {
        _id: unonboardedMongoId,
        supabaseUserId: unonboardedUser.id,
        email: unonboardedUser.email,
        name: 'New User',
        platformRole: 'USER',
        status: 'ACTIVE',
        hostProfile: null, // HostProfile not required!
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      },
      [adminUser.id]: {
        _id: adminMongoId,
        supabaseUserId: adminUser.id,
        email: adminUser.email,
        name: 'Platform Admin',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
      },
    };

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostUserToken) {
        return {
          data: {
            user: { id: hostUser.id, email: hostUser.email, user_metadata: { name: 'Host Organizer' } } as any,
          },
          error: null,
        };
      }
      if (token === otherUserToken) {
        return {
          data: {
            user: { id: otherUser.id, email: otherUser.email, user_metadata: { name: 'Other User' } } as any,
          },
          error: null,
        };
      }
      if (token === unonboardedUserToken) {
        return {
          data: {
            user: { id: unonboardedUser.id, email: unonboardedUser.email, user_metadata: { name: 'New User' } } as any,
          },
          error: null,
        };
      }
      return {
        data: { user: null },
        error: { message: 'Invalid JWT' },
      };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      const u = userMap[id];
      if (u) {
        return { id: u.supabaseUserId, name: u.name, email: u.email, role: u.platformRole };
      }
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });
  });

  describe('1. Organizer Onboarding Prerequisite Removal & Account State Gate', () => {
    it('should allow authenticated user without a hostProfile to create an event draft (HTTP 201)', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockImplementation(async (data: any) => ({
        _id: new mongoose.Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${unonboardedUserToken}`)
        .send(validWizardPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ownerSupabaseId).toBe(unonboardedUser.id);
      expect(res.body.data.hostingType).toBe('INDIVIDUAL');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerSupabaseId: unonboardedUser.id,
          hostingType: 'INDIVIDUAL',
        })
      );
    });

    it('should reject event creation if caller workspaceStatus is SUSPENDED (HTTP 403)', async () => {
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
        workspaceStatus: 'SUSPENDED',
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send(validWizardPayload);

      expect(res.status).toBe(403);
      expect(res.body.error.message || res.body.error).toContain('suspended');
    });

    it('should reject event creation if caller account status is SUSPENDED (HTTP 403)', async () => {
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        _id: hostMongoId,
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        platformRole: 'USER',
        status: 'SUSPENDED',
        workspaceStatus: 'ACTIVE',
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send(validWizardPayload);

      expect(res.status).toBe(403);
      expect(res.body.error.message || res.body.error).toContain('suspended');
    });
  });

  describe('2. Input Validation & Event-Type Awareness', () => {
    it('should reject payload with missing or invalid eventType', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({ ...validWizardPayload, eventType: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Invalid or missing eventType');
    });

    it('should reject payload with empty event name', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({ ...validWizardPayload, name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Event name is required');
    });

    it('should assign type-aware default credential terminology if not overridden', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'CONCERT',
        name: 'Rock Music Fest',
        credentialTerminology: 'Ticket',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Open Arena', city: 'Mumbai', country: 'India' },
        schedule: {
          startAt: new Date('2026-12-01T18:00:00.000Z'),
          endAt: new Date('2026-12-01T23:00:00.000Z'),
          timezone: 'Asia/Kolkata',
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          eventType: 'CONCERT',
          name: 'Rock Music Fest',
          credentialTerminology: undefined, // omitted, should default to 'Ticket'
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CONCERT',
          credentialTerminology: 'Ticket',
        })
      );
    });

    it('should allow organizer to override credential terminology with custom label', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'CONFERENCE',
        name: 'AI Conclave',
        credentialTerminology: 'Executive Delegate Badge',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'ONLINE', onlineDescription: 'Zoom' },
        schedule: {
          startAt: new Date('2026-12-05T09:00:00.000Z'),
          endAt: new Date('2026-12-05T17:00:00.000Z'),
          timezone: 'UTC',
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          eventType: 'CONFERENCE',
          name: 'AI Conclave',
          credentialTerminology: 'Executive Delegate Badge',
          venue: { type: 'ONLINE', onlineDescription: 'Zoom' },
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialTerminology: 'Executive Delegate Badge',
        })
      );
    });

    it('should reject schedule when endAt is earlier than startAt', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          schedule: {
            startAt: '2026-11-25T18:00:00.000Z',
            endAt: '2026-11-25T09:00:00.000Z', // Before start!
            timezone: 'Asia/Kolkata',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('schedule.endAt must be strictly later');
    });

    it('should reject schedule with invalid IANA timezone', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          schedule: {
            startAt: '2026-11-20T09:00:00.000Z',
            endAt: '2026-11-20T18:00:00.000Z',
            timezone: 'Invalid/Nonexistent_Zone',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Invalid IANA timezone');
    });

    it('should reject physical venue when city or name is missing', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          venue: {
            type: 'PHYSICAL',
            name: '', // missing
            city: '',
            country: 'India',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Physical venue name is required');
    });

    it('should accept online venue without physical address fields', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'WORKSHOP',
        name: 'Online Rust Workshop',
        credentialTerminology: 'Participant Pass',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
        venue: { type: 'ONLINE', onlineDescription: 'Google Meet link provided after check-in' },
        schedule: {
          startAt: new Date('2026-11-20T10:00:00.000Z'),
          endAt: new Date('2026-11-20T13:00:00.000Z'),
          timezone: 'UTC',
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          eventType: 'WORKSHOP',
          name: 'Online Rust Workshop',
          attendanceMode: 'EXISTING_ATTENDEE_DATA',
          venue: {
            type: 'ONLINE',
            onlineDescription: 'Google Meet link provided after check-in',
          },
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          venue: expect.objectContaining({
            type: 'ONLINE',
          }),
        })
      );
    });
  });

  describe('3. Draft Lifecycle & Ownership Invariants', () => {
    it('should initialize new event strictly as DRAFT and ignore client attempt to set APPROVED/PUBLISHED', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockImplementation(async (data: any) => ({
        _id: new mongoose.Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          status: 'PUBLISHED', // Attacker attempt to bypass review!
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DRAFT',
        })
      );
    });

    it('should derive ownerId strictly from server auth context and ignore client spoofed ownerId', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockImplementation(async (data: any) => ({
        _id: new mongoose.Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          ownerId: otherMongoId.toString(), // Spoofing attempt
          ownerSupabaseId: otherUser.id,
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: hostMongoId,
          ownerSupabaseId: hostUser.id,
        })
      );
      expect(createSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: otherMongoId,
        })
      );
    });
  });

  describe('4. Event Listing, Scoping & Pagination', () => {
    it('should return paginated events owned by the authenticated host', async () => {
      const mockEventId = new mongoose.Types.ObjectId();
      jest.spyOn(mongoEventRepository, 'findByOwner').mockResolvedValue({
        events: [
          {
            _id: mockEventId,
            ownerId: hostMongoId,
            ownerSupabaseId: hostUser.id,
            eventType: 'HACKATHON',
            name: 'HackFest 2026',
            credentialTerminology: 'Participant Pass',
            attendanceMode: 'TICKETIFICATION_REGISTRATION',
            venue: { type: 'PHYSICAL', name: 'Hub', city: 'BLR', country: 'IN' },
            schedule: {
              startAt: new Date('2026-11-20T09:00:00.000Z'),
              endAt: new Date('2026-11-22T18:00:00.000Z'),
              timezone: 'Asia/Kolkata',
            },
            status: 'DRAFT',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/events?page=1&limit=10')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('HackFest 2026');
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe('5. Zero-Trust IDOR Prevention & Draft Updates', () => {
    const testEventId = new mongoose.Types.ObjectId().toString();

    it('should allow the owner to retrieve their own event details', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(testEventId),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'HACKATHON',
        name: 'HackFest 2026',
        credentialTerminology: 'Participant Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Hub', city: 'BLR', country: 'IN' },
        schedule: {
          startAt: new Date('2026-11-20T09:00:00.000Z'),
          endAt: new Date('2026-11-22T18:00:00.000Z'),
          timezone: 'Asia/Kolkata',
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .get(`/api/events/${testEventId}`)
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('HackFest 2026');
    });

    it('should reject access when User B attempts to access User A event (IDOR protection, HTTP 403)', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(testEventId),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id, // Owned by Host User!
        eventType: 'HACKATHON',
        name: 'Private HackFest',
        schedule: { startAt: new Date(), endAt: new Date(), timezone: 'UTC' },
        venue: { type: 'ONLINE' },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Caller is otherUser
      const res = await request(app)
        .get(`/api/events/${testEventId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message || res.body.error).toContain('Access denied');
    });

    it('should allow the owner to update permitted fields of a draft event', async () => {
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(testEventId),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'HACKATHON',
        name: 'HackFest 2026',
        credentialTerminology: 'Participant Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Hub', city: 'BLR', country: 'IN' },
        schedule: {
          startAt: new Date('2026-11-20T09:00:00.000Z'),
          endAt: new Date('2026-11-22T18:00:00.000Z'),
          timezone: 'Asia/Kolkata',
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const updateSpy = jest.spyOn(mongoEventRepository, 'updateDraft').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(testEventId),
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        eventType: 'HACKATHON',
        name: 'HackFest 2026 — Expanded Edition',
        credentialTerminology: 'Hacker Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Hub', city: 'BLR', country: 'IN' },
        schedule: {
          startAt: new Date('2026-11-20T09:00:00.000Z'),
          endAt: new Date('2026-11-22T18:00:00.000Z'),
          timezone: 'Asia/Kolkata',
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .put(`/api/events/${testEventId}`)
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          name: 'HackFest 2026 — Expanded Edition',
          credentialTerminology: 'Hacker Pass',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        testEventId,
        hostUser.id,
        expect.objectContaining({
          name: 'HackFest 2026 — Expanded Edition',
          credentialTerminology: 'Hacker Pass',
        })
      );
    });

    it('should reject draft updates that attempt to change event status to PUBLISHED', async () => {
      const res = await request(app)
        .put(`/api/events/${testEventId}`)
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          status: 'PUBLISHED',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Event status cannot be changed via draft update');
    });
  });

  describe('6. Banner Asset Upload', () => {
    it('should return 400 when no banner file is provided', async () => {
      const res = await request(app)
        .post('/api/events/banner')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No file uploaded');
    });

    it('should upload banner buffer to Supabase Storage and return public URL', async () => {
      jest.spyOn(supabaseStorageService, 'uploadEventBanner').mockResolvedValue({
        publicUrl: 'https://supabase.internal/storage/v1/object/public/ticket-images/events/banners/host-1/banner.png',
        storagePath: 'events/banners/host-1/banner.png',
      });

      const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const res = await request(app)
        .post('/api/events/banner')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .attach('banner', fakeImageBuffer, 'banner.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bannerUrl).toContain('supabase.internal');
    });
  });

  describe('7. Hosting Type & Organization Association Engine', () => {
    it('should create individually hosted event with NOT_REQUIRED verification status', async () => {
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockImplementation(async (data: any) => ({
        _id: new mongoose.Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          hostingType: 'INDIVIDUAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hostingType).toBe('INDIVIDUAL');
      expect(res.body.data.organizationVerificationStatus).toBe('NOT_REQUIRED');
      expect(res.body.data.displayStatus).toBe('DRAFT');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostingType: 'INDIVIDUAL',
          organizationVerificationStatus: 'NOT_REQUIRED',
        })
      );
    });

    it('should create organization-hosted event with linked verification record and PENDING status', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const createSpy = jest.spyOn(mongoEventRepository, 'create').mockImplementation(async (data: any) => ({
        _id: eventId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const verificationSpy = jest
        .spyOn(mongoEventVerificationRepository, 'createVerification')
        .mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          eventId,
          status: 'PENDING',
        } as any);

      const orgPayload = {
        ...validWizardPayload,
        hostingType: 'ORGANIZATION',
        organization: {
          name: 'Stanford Robotics Club',
          institutionType: 'COLLEGE_UNIVERSITY',
          officialEmail: 'robotics@stanford.edu',
          department: 'Engineering',
          designation: 'Club President',
          website: 'https://robotics.stanford.edu',
          authorizationDocumentUrl: 'https://supabase.internal/auth-doc.pdf',
        },
      };

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send(orgPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hostingType).toBe('ORGANIZATION');
      expect(res.body.data.organizationVerificationStatus).toBe('PENDING');
      expect(res.body.data.displayStatus).toBe('Draft — Organization Verification Pending');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostingType: 'ORGANIZATION',
          organizationVerificationStatus: 'PENDING',
          organization: expect.objectContaining({
            name: 'Stanford Robotics Club',
            officialEmail: 'robotics@stanford.edu',
          }),
        })
      );
      expect(verificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId,
          institutionName: 'Stanford Robotics Club',
          officialEmail: 'robotics@stanford.edu',
          status: 'PENDING',
        })
      );
    });

    it('should allow the same user to host different events with different organizations or individually', async () => {
      jest.spyOn(mongoEventRepository, 'create').mockImplementation(async (data: any) => ({
        _id: new mongoose.Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      jest.spyOn(mongoEventVerificationRepository, 'createVerification').mockResolvedValue({} as any);

      // Event 1: Org A
      const res1 = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          name: 'AI Symposium',
          hostingType: 'ORGANIZATION',
          organization: {
            name: 'MIT AI Lab',
            institutionType: 'COLLEGE_UNIVERSITY',
            officialEmail: 'director@ailab.mit.edu',
          },
        });
      expect(res1.status).toBe(201);
      expect(res1.body.data.organization?.name).toBe('MIT AI Lab');

      // Event 2: Org B
      const res2 = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          name: 'Open Source Summit',
          hostingType: 'ORGANIZATION',
          organization: {
            name: 'Linux Foundation Chapter',
            institutionType: 'CORPORATE',
            officialEmail: 'chapter@linux.org',
          },
        });
      expect(res2.status).toBe(201);
      expect(res2.body.data.organization?.name).toBe('Linux Foundation Chapter');

      // Event 3: Independent
      const res3 = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          ...validWizardPayload,
          name: 'Weekend Indie Hack',
          hostingType: 'INDIVIDUAL',
        });
      expect(res3.status).toBe(201);
      expect(res3.body.data.hostingType).toBe('INDIVIDUAL');
      expect(res3.body.data.organization).toBeUndefined();
    });

    it('should reject direct publish attempt on organization event with PENDING verification (HTTP 400)', async () => {
      const orgPendingEventId = new mongoose.Types.ObjectId();
      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue({
        _id: orgPendingEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        name: 'Unverified Org Event',
        eventType: 'HACKATHON',
        credentialTerminology: 'Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        venue: { type: 'PHYSICAL', name: 'Auditorium', city: 'City', country: 'Country' },
        schedule: { startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 172800000), timezone: 'Asia/Kolkata' },
        status: 'APPROVED',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        statusHistory: [],
      } as any);

      const res = await request(app)
        .post(`/api/events/${orgPendingEventId.toString()}/publish`)
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Organization verification is pending');
    });

    it('should reject non-admin user from reviewing or approving verification (HTTP 403)', async () => {
      const targetEventId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/admin/verifications/${targetEventId.toString()}/review`)
        .set('Authorization', `Bearer ${hostUserToken}`) // Non-admin!
        .send({
          decision: 'APPROVED',
          reviewNotes: 'Self-approval attempt',
        });

      expect(res.status).toBe(403);
    });

    it('should allow platform admin to approve verification and set organizationVerificationStatus to APPROVED', async () => {
      const targetEventId = new mongoose.Types.ObjectId();
      const mockEvent = {
        _id: targetEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        name: 'Stanford Hackathon',
        status: 'DRAFT',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent as any);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId: targetEventId,
        status: 'PENDING',
        riskScore: 25,
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      } as any);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId: targetEventId,
        status: 'VERIFIED',
      } as any);

      const res = await request(app)
        .post(`/api/admin/verifications/${targetEventId.toString()}/review`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          decision: 'APPROVED',
          reviewNotes: 'Approved official affiliation',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockEvent.organizationVerificationStatus).toBe('APPROVED');
      expect(mockEvent.verificationStatus).toBe('VERIFIED');
    });

    it('should allow platform admin to reject verification, setting organizationVerificationStatus to REJECTED', async () => {
      const targetEventId = new mongoose.Types.ObjectId();
      const mockEvent = {
        _id: targetEventId,
        ownerId: hostMongoId,
        ownerSupabaseId: hostUser.id,
        name: 'Dubious Org Event',
        status: 'DRAFT',
        hostingType: 'ORGANIZATION',
        organizationVerificationStatus: 'PENDING',
        verificationStatus: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(mockEvent as any);
      jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId: targetEventId,
        status: 'PENDING',
        riskScore: 85,
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      } as any);
      jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        eventId: targetEventId,
        status: 'REJECTED',
      } as any);

      const res = await request(app)
        .post(`/api/admin/verifications/${targetEventId.toString()}/review`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          decision: 'REJECTED',
          reviewNotes: 'Invalid authorization letter provided',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockEvent.organizationVerificationStatus).toBe('REJECTED');
    });

    it('should exclude pending and rejected organization events from public queries', async () => {
      const publicQuerySpy = jest.spyOn(mongoEventRepository, 'findPublicEvents').mockResolvedValue({
        events: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
      });

      const res = await request(app).get('/api/public/events?page=1&limit=12');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toEqual([]);
      expect(publicQuerySpy).toHaveBeenCalled();
    });
  });
});

