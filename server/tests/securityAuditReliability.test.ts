import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { AuditLogModel } from '../src/db/mongo/models/audit-log.model';
import {
  AuditService,
  auditService,
} from '../src/modules/events/services/audit.service';
import { MongoAuditLogRepository } from '../src/modules/events/repositories/mongo-audit-log.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { createRateLimiter } from '../src/middlewares/rate-limit.middleware';

// Mock auth middleware for RBAC testing
jest.mock('../src/middlewares/auth.middleware', () => {
  const handler = (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.includes('host-token')) {
      req.user = { id: 'host-user-id', role: 'USER', email: 'host@test.com' };
    } else if (authHeader.includes('volunteer-token')) {
      req.user = { id: 'volunteer-user-id', role: 'USER', email: 'volunteer@test.com' };
    } else if (authHeader.includes('attacker-token')) {
      req.user = { id: 'attacker-user-id', role: 'USER', email: 'attacker@test.com' };
    } else {
      req.user = { id: 'host-user-id', role: 'USER', email: 'host@test.com' };
    }
    next();
  };
  return {
    authMiddleware: handler,
    authenticateUser: handler,
    default: handler,
  };
});

describe('Phase 18: Security, Audit, and Reliability Engine', () => {
  const eventId1 = new mongoose.Types.ObjectId().toString();
  const eventId2 = new mongoose.Types.ObjectId().toString();
  const hostUserId = 'host-user-id';
  const volunteerUserId = 'volunteer-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Immutable Audit Log Ledger Enforcement', () => {
    it('should reject update mutations on AuditLog documents', async () => {
      await expect(
        AuditLogModel.updateOne({ _id: new mongoose.Types.ObjectId() }, { action: 'MUTATE' }).exec()
      ).rejects.toThrow(/immutable and cannot be modified/);

      await expect(
        AuditLogModel.updateMany({}, { action: 'MUTATE' }).exec()
      ).rejects.toThrow(/immutable and cannot be modified/);

      await expect(
        AuditLogModel.findOneAndUpdate({ _id: new mongoose.Types.ObjectId() }, { action: 'MUTATE' }).exec()
      ).rejects.toThrow(/immutable and cannot be modified/);
    });

    it('should reject delete mutations on AuditLog documents', async () => {
      await expect(
        AuditLogModel.deleteOne({ _id: new mongoose.Types.ObjectId() }).exec()
      ).rejects.toThrow(/strictly immutable and cannot be modified or deleted/);

      await expect(
        AuditLogModel.deleteMany({}).exec()
      ).rejects.toThrow(/strictly immutable and cannot be modified or deleted/);

      await expect(
        AuditLogModel.findOneAndDelete({ _id: new mongoose.Types.ObjectId() }).exec()
      ).rejects.toThrow(/strictly immutable and cannot be modified or deleted/);
    });
  });

  describe('2. AuditService Recording & Event Queries', () => {
    it('should record an immutable audit entry and format attributes', async () => {
      const mockCreated = {
        _id: new mongoose.Types.ObjectId(),
        actorId: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001'),
        actorEmail: 'host@test.com',
        actorRole: 'HOST',
        eventId: new mongoose.Types.ObjectId(eventId1),
        action: 'CREDENTIAL_REVOKED',
        targetEntity: 'event_credentials',
        targetId: 'cred-123',
        metadata: { reason: 'Disqualified' },
        createdAt: new Date(),
      };

      jest.spyOn(MongoAuditLogRepository.prototype, 'create').mockResolvedValue(mockCreated as any);

      const entry = await auditService.record({
        actorId: '60c72b2f9b1d8b2bad000001',
        actorEmail: 'host@test.com',
        actorRole: 'HOST',
        eventId: eventId1,
        action: 'CREDENTIAL_REVOKED',
        targetEntity: 'event_credentials',
        targetId: 'cred-123',
        metadata: { reason: 'Disqualified' },
      });

      expect(entry).toBeDefined();
      expect(entry?.action).toBe('CREDENTIAL_REVOKED');
      expect(entry?.actorEmail).toBe('host@test.com');
    });

    it('should query paginated audit logs for a specific event', async () => {
      const mockLogs = [
        {
          _id: new mongoose.Types.ObjectId(),
          action: 'STAFF_INVITED',
          actorEmail: 'host@test.com',
          actorRole: 'HOST',
          targetEntity: 'event_members',
          targetId: 'member-1',
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          action: 'STORAGE_PURGED',
          actorEmail: 'host@test.com',
          actorRole: 'HOST',
          targetEntity: 'storage',
          targetId: eventId1,
          createdAt: new Date(),
        },
      ];

      jest.spyOn(MongoAuditLogRepository.prototype, 'findByEvent').mockResolvedValue({
        logs: mockLogs as any,
        total: 2,
        page: 1,
        totalPages: 1,
      });

      const res = await auditService.getEventAuditLogs(eventId1, {}, { page: 1, limit: 10 });
      expect(res.logs.length).toBe(2);
      expect(res.total).toBe(2);
      expect(res.logs[0].action).toBe('STAFF_INVITED');
    });
  });

  describe('3. Rate Limiting Token-Bucket & Burst Governors', () => {
    it('should throttle excessive requests with HTTP 429 and Retry-After header', async () => {
      const testLimiter = createRateLimiter({
        windowMs: 1000,
        max: 2,
        message: 'Burst rate limit exceeded.',
      });

      const mockReq: any = {
        headers: { 'x-forwarded-for': '192.168.1.100' },
        socket: { remoteAddress: '192.168.1.100' },
      };

      const setHeader = jest.fn();
      const status = jest.fn().mockReturnThis();
      const json = jest.fn();
      const mockRes: any = { setHeader, status, json };
      const next = jest.fn();

      // Req 1: Allowed
      testLimiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Req 2: Allowed
      testLimiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Req 3: Throttled (429 Too Many Requests)
      testLimiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOO_MANY_REQUESTS',
          }),
        })
      );
    });
  });

  describe('4. Zero-Trust RBAC & IDOR Prevention on Audit Queries', () => {
    beforeEach(() => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockImplementation(async (eid: string) => {
        if (eid === eventId1) {
          return {
            _id: new mongoose.Types.ObjectId(eventId1),
            name: 'Conference 2026',
            ownerId: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001'),
            ownerSupabaseId: hostUserId,
          } as any;
        }
        if (eid === eventId2) {
          return {
            _id: new mongoose.Types.ObjectId(eventId2),
            name: 'External Hackathon',
            ownerId: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000099'),
            ownerSupabaseId: 'external-owner-id',
          } as any;
        }
        return null;
      });

      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockImplementation(async (id: string) => {
        if (id === hostUserId) {
          return { _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001'), email: 'host@test.com' } as any;
        }
        if (id === volunteerUserId) {
          return { _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000002'), email: 'volunteer@test.com' } as any;
        }
        if (id === 'attacker-user-id') {
          return { _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000003'), email: 'attacker@test.com' } as any;
        }
        return null;
      });

      jest.spyOn(MongoEventMemberRepository.prototype, 'findByEventAndUser').mockImplementation(async (eid: any, uid: any) => {
        if (uid.toString() === '60c72b2f9b1d8b2bad000002') {
          return { role: 'VOLUNTEER', status: 'ACTIVE' } as any;
        }
        return null;
      });
    });

    it('GET /api/events/:eventId/audit-logs should return 200 OK for authorized host', async () => {
      jest.spyOn(auditService, 'getEventAuditLogs').mockResolvedValue({
        logs: [
          {
            _id: new mongoose.Types.ObjectId(),
            actorEmail: 'host@test.com',
            actorRole: 'HOST',
            action: 'STAFF_INVITED',
            targetEntity: 'event_members',
            targetId: 'm-1',
            createdAt: new Date(),
          } as any,
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app)
        .get(`/api/events/${eventId1}/audit-logs`)
        .set('Authorization', 'Bearer host-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs.length).toBe(1);
      expect(res.body.data.logs[0].action).toBe('STAFF_INVITED');
    });

    it('GET /api/events/:eventId/audit-logs should return 403 Forbidden for unauthorized volunteer', async () => {
      const res = await request(app)
        .get(`/api/events/${eventId1}/audit-logs`)
        .set('Authorization', 'Bearer volunteer-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/permission|host|coordinator/i);
    });

    it('GET /api/events/:eventId/audit-logs should prevent cross-event IDOR leaks', async () => {
      // Attacker tries to access audit trail of Event 2 where they have no membership
      const res = await request(app)
        .get(`/api/events/${eventId2}/audit-logs`)
        .set('Authorization', 'Bearer attacker-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
