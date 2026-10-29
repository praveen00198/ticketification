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
import mongoose from 'mongoose';
import { createJwtToken } from '../src/utils/local-auth';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventReportRepository } from '../src/modules/events/repositories/mongo-event-report.repository';
import { MongoEventRegistrationRepository } from '../src/modules/events/repositories/mongo-event-registration.repository';
import { MongoEventTeamRepository } from '../src/modules/events/repositories/mongo-event-team.repository';
import { EventModel } from '../src/db/mongo/models/event.model';
import { EventMemberModel } from '../src/db/mongo/models/event-member.model';
import { guestImportService } from '../src/modules/guests/services/guest-import.service';
import { AuthorizationError } from '../src/middlewares/error.middleware';

describe('Attendee Workspace, Auth & Security Isolation Suite', () => {
  jest.setTimeout(15000);

  const hostUser = {
    id: 'usr_host_123',
    email: 'host.workspace@example.com',
    role: 'USER' as const,
  };

  const attendeeUser = {
    id: 'usr_attendee_456',
    email: 'attendee.workspace@example.com',
    role: 'USER' as const,
  };

  const hostToken = createJwtToken(hostUser);
  const attendeeToken = createJwtToken(attendeeUser);

  const eventMongoId = new mongoose.Types.ObjectId();
  const hostMongoId = new mongoose.Types.ObjectId();
  const attendeeMongoId = new mongoose.Types.ObjectId();

  const mockEventDoc: any = {
    _id: eventMongoId,
    id: eventMongoId.toString(),
    ownerId: hostMongoId,
    ownerSupabaseId: hostUser.id,
    name: 'Tech Innovators Summit 2026',
    eventType: 'CONFERENCE',
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    date: new Date('2026-11-15T09:00:00Z'),
    venue: 'Convention Center Hall A',
    description: 'Premier tech conference',
  };

  const userMap: Record<string, any> = {
    [hostUser.id]: {
      _id: hostMongoId,
      supabaseUserId: hostUser.id,
      email: hostUser.email,
      name: 'Host Organizer',
      platformRole: 'USER',
    },
    [attendeeUser.id]: {
      _id: attendeeMongoId,
      supabaseUserId: attendeeUser.id,
      email: attendeeUser.email,
      name: 'Attendee Jane',
      platformRole: 'USER',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    jest.spyOn(MongoUserRepository.prototype, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return Object.values(userMap).find((u) => u._id.toString() === id.toString()) || null;
    });

    jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockEventDoc as any);

    jest.spyOn(EventModel, 'findById').mockImplementation(((id: any) => {
      const p: any = Promise.resolve(mockEventDoc);
      p.lean = () => ({
        exec: async () => mockEventDoc,
      });
      p.exec = async () => mockEventDoc;
      return p;
    }) as any);

    const nullQuery: any = Promise.resolve(null);
    nullQuery.lean = () => ({ exec: async () => null });
    nullQuery.exec = async () => null;

    jest.spyOn(EventMemberModel, 'findOne').mockImplementation((() => nullQuery) as any);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('1. Production Auth Verification Invariant', () => {
    it('successfully authenticates valid HS256 tokens regardless of production environment', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${attendeeToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(attendeeUser.email);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('rejects unauthenticated requests to protected endpoints with 401 Missing Bearer token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Authentication required\. Missing Bearer token\./i);
    });
  });

  describe('2. Guest Roster & Import Permission Enforcement (IDOR Defense)', () => {
    it('strictly denies ordinary attendees from importing guests into an event', async () => {
      const nullQuery: any = Promise.resolve(null);
      nullQuery.lean = () => ({ exec: async () => null });
      nullQuery.exec = async () => null;

      jest.spyOn(EventMemberModel, 'findOne').mockImplementation((() => nullQuery) as any);

      await expect(
        guestImportService.checkEventAuthorization(eventMongoId.toString(), attendeeUser.id)
      ).rejects.toThrow(AuthorizationError);
    });

    it('authorizes the event owner for guest import', async () => {
      const result = await guestImportService.checkEventAuthorization(
        eventMongoId.toString(),
        hostUser.id
      );
      expect(result).toBeDefined();
      expect(result.event).toBeDefined();
    });
  });

  describe('3. Contextual Support & Issue Reporting', () => {
    it('allows authenticated attendees to submit an issue report with eventId and category', async () => {
      const createSpy = jest.spyOn(MongoEventReportRepository.prototype, 'create').mockImplementation(async (data: any): Promise<any> => {
        return {
          _id: new mongoose.Types.ObjectId(),
          ...data,
          status: 'PENDING',
          createdAt: new Date(),
        };
      });

      const res = await request(app)
        .post('/api/support/report')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: eventMongoId.toString(),
          category: 'CREDENTIAL_QR_ISSUE',
          description: 'Cannot display QR code on mobile browser in low light.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: eventMongoId.toString(),
          category: 'CREDENTIAL_QR_ISSUE',
          reason: 'Cannot display QR code on mobile browser in low light.',
          reporterUserId: attendeeUser.id,
          reporterEmail: attendeeUser.email,
        })
      );
    });

    it('denies attendees from viewing event support reports (403 AuthorizationError)', async () => {
      jest.spyOn(EventMemberModel, 'findOne').mockImplementation((() => {
        return {
          lean: () => ({ exec: async () => null }),
          exec: async () => null,
        } as any;
      }) as any);

      const res = await request(app)
        .get(`/api/support/events/${eventMongoId.toString()}/reports`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/not authorized/i);
    });

    it('allows event owner/host to view reports filed for their event', async () => {
      const mockReports = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: eventMongoId,
          category: 'CREDENTIAL_QR_ISSUE',
          reason: 'QR code not scanning at gate',
          status: 'PENDING',
        },
      ];

      jest.spyOn(MongoEventReportRepository.prototype, 'findByEventId').mockResolvedValue(mockReports as any);

      const res = await request(app)
        .get(`/api/support/events/${eventMongoId.toString()}/reports`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });
  });

  describe('4. Attendee Workspace Self-Service API', () => {
    it('returns empty registration gracefully if attendee is not registered for event', async () => {
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'findByEventAndUser').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/events/${eventMongoId.toString()}/my-registration`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registration).toBeNull();
    });

    it('allows an attendee to query their team status', async () => {
      jest.spyOn(MongoEventTeamRepository.prototype, 'findByMemberEmail').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/events/${eventMongoId.toString()}/my-team`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
