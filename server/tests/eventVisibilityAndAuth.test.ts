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
import { mongoUserRepository, MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository, MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { EventRegistrationModel } from '../src/db/mongo/models/event-registration.model';
import { publicEventService } from '../src/modules/events/services/public-event.service';
import { EventService } from '../src/modules/events/services/event.service';
import { validateEventWizardInput } from '../src/modules/events/event.validation';
import { createJwtToken } from '../src/utils/local-auth';
import mongoose from 'mongoose';

describe('Event Creation Authentication & Visibility Enforcement Suite', () => {
  jest.setTimeout(15000);

  const testUser = {
    id: 'test-user-auth-vis-1',
    email: 'organizer.vis@example.com',
    role: 'USER' as const,
  };

  const otherUser = {
    id: 'other-user-auth-vis-2',
    email: 'other.vis@example.com',
    role: 'USER' as const,
  };

  const validToken = createJwtToken(testUser);
  const otherUserToken = createJwtToken(otherUser);

  const hostMongoId = new mongoose.Types.ObjectId();
  const otherMongoId = new mongoose.Types.ObjectId();
  const publicEventMongoId = new mongoose.Types.ObjectId();
  const privateEventMongoId = new mongoose.Types.ObjectId();

  const mockPublicEventDoc: any = {
    _id: publicEventMongoId,
    id: publicEventMongoId.toString(),
    ownerId: hostMongoId,
    ownerSupabaseId: testUser.id,
    name: 'Explicit Public Hackathon',
    eventType: 'HACKATHON',
    description: 'A publicly discoverable hackathon.',
    credentialTerminology: 'Hacker Pass',
    attendanceMode: 'TICKETIFICATION_REGISTRATION',
    status: 'PUBLISHED',
    visibility: 'public',
    venue: {
      type: 'PHYSICAL',
      name: 'Tech Center Hall A',
      city: 'Mumbai',
      country: 'India',
    },
    schedule: {
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
      timezone: 'Asia/Kolkata',
    },
    registration: {
      capacity: 500,
      pricingModel: 'FREE',
      registrationRequired: true,
    },
    hostingType: 'INDIVIDUAL',
    verificationLevel: 'HIGH',
    verificationStatus: 'VERIFIED',
    organizationVerificationStatus: 'NOT_REQUIRED',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(true),
  };

  const mockPrivateEventDoc: any = {
    _id: privateEventMongoId,
    id: privateEventMongoId.toString(),
    ownerId: hostMongoId,
    ownerSupabaseId: testUser.id,
    name: 'Exclusive Private Hackathon',
    eventType: 'HACKATHON',
    description: 'A private invitation-only hackathon.',
    credentialTerminology: 'Hacker Pass',
    attendanceMode: 'TICKETIFICATION_REGISTRATION',
    status: 'PUBLISHED',
    visibility: 'private',
    venue: {
      type: 'PHYSICAL',
      name: 'Tech Center Hall B',
      city: 'Mumbai',
      country: 'India',
    },
    schedule: {
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
      timezone: 'Asia/Kolkata',
    },
    registration: {
      capacity: 100,
      pricingModel: 'FREE',
      registrationRequired: true,
    },
    hostingType: 'INDIVIDUAL',
    verificationLevel: 'HIGH',
    verificationStatus: 'VERIFIED',
    organizationVerificationStatus: 'NOT_REQUIRED',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(true),
  };

  const userMap: Record<string, any> = {
    [testUser.id]: {
      _id: hostMongoId,
      supabaseUserId: testUser.id,
      email: testUser.email,
      name: 'Organizer Test',
      platformRole: 'USER',
      status: 'ACTIVE',
      workspaceStatus: 'ACTIVE',
      hostVerificationStatus: 'HIGH',
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    publicEventService.clearCache();

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === validToken) {
        return {
          data: {
            user: { id: testUser.id, email: testUser.email, user_metadata: { name: 'Organizer Test' } } as any,
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
      return {
        data: { user: null },
        error: { message: 'Invalid JWT' },
      };
    });

    jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    jest.spyOn(MongoUserRepository.prototype, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return Object.values(userMap).find((u) => u._id.toString() === id.toString()) || null;
    });
  });

  describe('Objective 1: Authentication & Bearer Token Verification', () => {
    const validPayload = {
      eventType: 'CONFERENCE',
      name: 'Authentication Test Conference',
      credentialTerminology: 'Attendee Pass',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: {
        type: 'PHYSICAL',
        name: 'Tech Center Hall A',
        city: 'Mumbai',
        country: 'India',
      },
      schedule: {
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 172800000).toISOString(),
        timezone: 'Asia/Kolkata',
      },
      hostingType: 'INDIVIDUAL',
    };

    it('fails with 401 when Authorization header is missing', async () => {
      const res = await request(app)
        .post('/api/events')
        .send(validPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Authentication required\. Missing Bearer token\./i);
    });

    it('fails with 401 when Authorization header is malformed (missing Bearer prefix)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', validToken)
        .send(validPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Authentication required\. Missing Bearer token\./i);
    });

    it('fails with 401 when Bearer token is invalid/tampered', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', 'Bearer invalid-garbage-token')
        .send(validPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('succeeds with 201 when valid Bearer token is provided', async () => {
      const createSpy = jest.spyOn(MongoEventRepository.prototype, 'create').mockResolvedValue({
        ...mockPublicEventDoc,
        name: validPayload.name,
      });

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(validPayload.name);
      expect(res.body.data.visibility).toBe('public'); // Default is public
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'public',
        })
      );
    });
  });

  describe('Objective 2: Event Visibility Validation & Persistence', () => {
    const basePayload = {
      eventType: 'HACKATHON',
      name: 'Hackathon Test',
      credentialTerminology: 'Hacker Pass',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: {
        type: 'PHYSICAL',
        name: 'Innovation Hub',
        city: 'Bengaluru',
        country: 'India',
      },
      schedule: {
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 172800000).toISOString(),
        timezone: 'Asia/Kolkata',
      },
      hostingType: 'INDIVIDUAL',
    };

    it('validates default visibility to "public" when omitted from wizard payload', () => {
      const result = validateEventWizardInput(basePayload);
      expect(result.visibility).toBe('public');
    });

    it('validates explicit visibility: "public"', () => {
      const result = validateEventWizardInput({ ...basePayload, visibility: 'public' });
      expect(result.visibility).toBe('public');
    });

    it('validates explicit visibility: "private"', () => {
      const result = validateEventWizardInput({ ...basePayload, visibility: 'private' });
      expect(result.visibility).toBe('private');
    });

    it('throws ValidationError when invalid visibility is provided', () => {
      expect(() => {
        validateEventWizardInput({ ...basePayload, visibility: 'super-secret' });
      }).toThrow(/Invalid visibility/i);
    });

    it('rejects invalid visibility with 400 over HTTP API', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          ...basePayload,
          visibility: 'hidden-secret',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Invalid visibility/i);
    });

    it('persists visibility: "private" when selected via HTTP API', async () => {
      const createSpy = jest.spyOn(MongoEventRepository.prototype, 'create').mockResolvedValue(mockPrivateEventDoc);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          ...basePayload,
          name: 'Exclusive Private Hackathon',
          visibility: 'private',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.visibility).toBe('private');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'private',
        })
      );
    });
  });

  describe('Objective 2: Server-Side Visibility Enforcement & Catalog Isolation', () => {
    it('GET /api/public/events calls findPublicEvents and returns public events only', async () => {
      const findSpy = jest.spyOn(MongoEventRepository.prototype, 'findPublicEvents').mockResolvedValue({
        events: [mockPublicEventDoc],
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });

      const res = await request(app).get('/api/public/events?limit=50');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0].id).toBe(publicEventMongoId.toString());
      expect(res.body.data.events[0].name).toBe('Explicit Public Hackathon');
    });

    it('GET /api/public/events/:id returns 200 for public event', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findPublicById').mockResolvedValue(mockPublicEventDoc);
      jest.spyOn(EventRegistrationModel, 'countDocuments').mockReturnValue({
        exec: jest.fn().mockResolvedValue(25),
      } as any);

      const res = await request(app).get(`/api/public/events/${publicEventMongoId.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.id).toBe(publicEventMongoId.toString());
      expect(res.body.data.event.name).toBe('Explicit Public Hackathon');
    });

    it('GET /api/public/events/:id returns 404 when event is private (findPublicById returns null)', async () => {
      // Because findPublicById excludes private events with { visibility: { $ne: 'private' } }, it returns null
      jest.spyOn(MongoEventRepository.prototype, 'findPublicById').mockResolvedValue(null);

      const res = await request(app).get(`/api/public/events/${privateEventMongoId.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('GET /api/public/hosts/:hostId returns only public events for that organizer', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findPublicByHost').mockResolvedValue([mockPublicEventDoc]);

      const res = await request(app).get(`/api/public/hosts/${testUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0].id).toBe(publicEventMongoId.toString());
    });

    it('Authorized host CAN fetch their own private event via /api/events/:id', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockPrivateEventDoc);

      const res = await request(app)
        .get(`/api/events/${privateEventMongoId.toString()}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(privateEventMongoId.toString());
      expect(res.body.data.visibility).toBe('private');
      expect(res.body.data.name).toBe('Exclusive Private Hackathon');
      expect(res.body.data.userRole).toBe('HOST');
    });

    it('Unauthorized user CANNOT fetch private event via /api/events/:id (403 AuthorizationError)', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockPrivateEventDoc);

      const res = await request(app)
        .get(`/api/events/${privateEventMongoId.toString()}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Access denied/i);
    });

    it('publicEventService.clearCache() resets in-memory catalog and detail caches cleanly', () => {
      expect(() => publicEventService.clearCache()).not.toThrow();
    });
  });
});
