import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { dashboardService } from '../src/modules/dashboard/services/dashboard.service';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';
import { EventRegistrationModel } from '../src/db/mongo/models/event-registration.model';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { setMongoConnectedForTesting } from '../src/db/mongodb';
import { createJwtToken } from '../src/utils/local-auth';

describe('Dashboard MongoDB Resilience & Authorization Test Suite', () => {
  const hostUser = {
    id: 'mock-dashboard-host-uuid',
    email: 'host@dash-test.org',
    role: 'USER' as const,
  };
  const coordinatorUser = {
    id: 'mock-dashboard-coord-uuid',
    email: 'coord@dash-test.org',
    role: 'USER' as const,
  };
  const outsiderUser = {
    id: 'mock-dashboard-outsider-uuid',
    email: 'outsider@other.org',
    role: 'USER' as const,
  };
  const adminUser = {
    id: 'mock-dashboard-admin-uuid',
    email: 'admin@platform.org',
    role: 'ADMIN' as const,
  };

  const hostToken = createJwtToken(hostUser);
  const coordinatorToken = createJwtToken(coordinatorUser);
  const outsiderToken = createJwtToken(outsiderUser);
  const adminToken = createJwtToken(adminUser);

  const testEventId = new mongoose.Types.ObjectId();
  const hostMongoId = new mongoose.Types.ObjectId();

  beforeAll(() => {
    setMongoConnectedForTesting(true);
  });

  afterAll(() => {
    setMongoConnectedForTesting(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock mongoUserRepository.findById
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id || id === hostMongoId.toString()) {
        return {
          _id: hostMongoId,
          id: hostUser.id,
          supabaseUserId: hostUser.id,
          email: hostUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        };
      }
      if (id === coordinatorUser.id) {
        return {
          _id: new mongoose.Types.ObjectId(),
          id: coordinatorUser.id,
          supabaseUserId: coordinatorUser.id,
          email: coordinatorUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        };
      }
      if (id === outsiderUser.id) {
        return {
          _id: new mongoose.Types.ObjectId(),
          id: outsiderUser.id,
          supabaseUserId: outsiderUser.id,
          email: outsiderUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        };
      }
      if (id === adminUser.id) {
        return {
          _id: new mongoose.Types.ObjectId(),
          id: adminUser.id,
          supabaseUserId: adminUser.id,
          email: adminUser.email,
          platformRole: 'ADMIN',
          status: 'ACTIVE',
        };
      }
      return null;
    });

    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id.toString() === testEventId.toString()) {
        return {
          _id: testEventId,
          ownerId: hostMongoId,
          ownerSupabaseId: hostUser.id,
          name: 'Innovate Summit 2026',
          status: 'PUBLISHED',
        };
      }
      return null;
    });

    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(
      async (evId: string, uId: string): Promise<any> => {
        if (evId.toString() === testEventId.toString() && uId === coordinatorUser.id) {
          return {
            eventId: testEventId,
            userId: coordinatorUser.id,
            role: 'COORDINATOR',
            permissions: ['MANAGE_ATTENDEES'],
            status: 'ACTIVE',
          };
        }
        return null;
      }
    );
  });

  describe('1. DashboardService Unit Tests', () => {
    it('returns zeroes and empty list when no eventId provided', async () => {
      const result = await dashboardService.getDashboardStats();
      expect(result.stats.totalGuests).toBe(0);
      expect(result.stats.ticketsGenerated).toBe(0);
      expect(result.stats.ticketsActive).toBe(0);
      expect(result.stats.ticketsUsed).toBe(0);
      expect(result.stats.ticketsRemaining).toBe(0);
      expect(result.recentActivity).toEqual([]);
    });

    it('aggregates MongoDB credentials and registrations correctly', async () => {
      jest.spyOn(EventCredentialModel, 'countDocuments').mockImplementation(async (query: any) => {
        if (query && query.status && query.status.$in) {
          return 25; // used / checked-in count
        }
        return 100; // total credentials
      });

      jest.spyOn(EventRegistrationModel, 'countDocuments').mockImplementation(async () => {
        return 120; // total registrations
      });

      jest.spyOn(EventCredentialModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(),
                verificationToken: 'token-abc-123',
                sequenceNumber: 1,
                status: 'CHECKED_IN',
                holder: { name: 'Alice Wonderland', email: 'alice@wonder.land' },
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      } as any);

      const result = await dashboardService.getDashboardStats(testEventId.toString());

      expect(result.stats.totalGuests).toBe(120);
      expect(result.stats.ticketsGenerated).toBe(100);
      expect(result.stats.ticketsUsed).toBe(25);
      expect(result.stats.ticketsActive).toBe(75);
      expect(result.stats.ticketsRemaining).toBe(75);
      expect(result.recentActivity.length).toBe(1);
      expect(result.recentActivity[0].name).toBe('Alice Wonderland');
      expect(result.recentActivity[0].status).toBe('USED');
    });
  });

  describe('2. DashboardController Authorization and Zero-Trust Protection', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/dashboard/stats?eventId=${testEventId}`);
      expect(res.status).toBe(401);
    });

    it('denies outsider with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/dashboard/stats?eventId=${testEventId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('allows event owner to access stats', async () => {
      const res = await request(app)
        .get(`/api/dashboard/stats?eventId=${testEventId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('allows active coordinator to access stats', async () => {
      const res = await request(app)
        .get(`/api/dashboard/stats?eventId=${testEventId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows platform administrator to access stats for any event', async () => {
      const res = await request(app)
        .get(`/api/dashboard/stats?eventId=${testEventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent event', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/dashboard/stats?eventId=${nonExistentId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(404);
    });
  });
});
