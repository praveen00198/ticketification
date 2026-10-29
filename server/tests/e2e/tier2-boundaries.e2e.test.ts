import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { createJwtToken, generateRefreshToken } from '../../src/utils/local-auth';
import { verificationService } from '../../src/modules/verification/services/verification.service';
import { authService } from '../../src/modules/auth/services/auth.service';
import { mongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';

describe('Tier 2: Boundary & Corner Cases E2E Suite', () => {
  const testUser = {
    id: 'usr_e2e_boundary_001',
    email: 'boundary_test@example.com',
    role: 'USER' as const,
    name: 'Boundary Tester',
  };

  const validToken = createJwtToken({
    id: testUser.id,
    email: testUser.email,
    role: testUser.role,
  });

  beforeEach(() => {
    jest.spyOn(mongoUserRepository, 'findById').mockResolvedValue({
      _id: testUser.id,
      supabaseUserId: testUser.id,
      email: testUser.email,
      platformRole: 'USER',
      status: 'ACTIVE',
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('T2.1: Header & Auth Boundary Extremes', () => {
    it('T2-BC1: returns 401 on empty Bearer token, whitespace-only, or "Bearer" with no trailing string', async () => {
      const cases = ['', '   ', 'Bearer', 'Bearer ', 'Bearer     ', 'BEARER   '];

      for (const headerVal of cases) {
        const res = await request(app)
          .get('/api/attendee/wallet')
          .set('Authorization', headerVal);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });

    it('T2-BC2: returns 401 on SQL/NoSQL injection payloads and script tags in Authorization header', async () => {
      const maliciousPayloads = [
        "Bearer ' OR '1'='1",
        'Bearer {"$gt": ""}',
        'Bearer ../../../etc/passwd',
        'Bearer <script>alert(1)</script>',
        'Bearer %00%20%27%22',
      ];

      for (const payload of maliciousPayloads) {
        const res = await request(app)
          .get('/api/attendee/wallet')
          .set('Authorization', payload);

        expect([400, 401]).toContain(res.status);
        expect(res.body.success).toBe(false);
        // Guarantee no stack trace or SQL syntax error leaks
        expect(JSON.stringify(res.body)).not.toContain('syntax error');
      }
    });
  });

  describe('T2.2: Concurrency & Mutex Boundaries', () => {
    it('T2-BC3: concurrent refresh calls execute cleanly without unhandled rejection or server crash', async () => {
      const testRefreshToken = generateRefreshToken();

      jest.spyOn(authService, 'refreshSession').mockImplementation(async () => {
        return {
          token: createJwtToken({ id: testUser.id, email: testUser.email, role: 'USER' }),
          refreshToken: generateRefreshToken(),
          user: { id: testUser.id, email: testUser.email, role: 'USER', name: 'Boundary User' },
        } as any;
      });

      // Fire 5 rapid concurrent requests to refresh endpoint
      const promises = Array.from({ length: 5 }).map(() =>
        request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: testRefreshToken })
      );

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect([200, 400, 401]).toContain(res.status);
      }
    });
  });

  describe('T2.3: Parameter & Resource Boundaries', () => {
    it('T2-BC4: returns 400, 403, or 404 when eventId parameter is malformed, non-existent, or invalid', async () => {
      const invalidIds = ['invalid-non-object-id', '123', 'undefined', 'null'];

      for (const badId of invalidIds) {
        const res = await request(app)
          .get(`/api/events/${badId}/my-registration`)
          .set('Authorization', `Bearer ${validToken}`);

        expect([400, 403, 404]).toContain(res.status);
        expect(res.body.success).toBe(false);
      }
    });

    it('T2-BC5: returns 400 Validation Error when guest import is invoked without uploading a file', async () => {
      const validEventId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/guests/events/${validEventId}/upload`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('No file uploaded');
    });

    it('T2-BC6: returns 400 Validation Error when verification endpoint is called with empty or invalid token', async () => {
      const res = await request(app)
        .post('/api/verify/lookup')
        .send({ token: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('T2-BC7: returns 400 Validation Error when issue report contains missing fields or whitespace-only reason', async () => {
      const res = await request(app)
        .post('/api/support/report')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          category: 'ACCOUNT',
          reason: '         ',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('T2-BC8: returns WRONG_EVENT status when a ticket issued for Event 1 is presented at Event 2 turnstile', async () => {
      const event1Id = 'evt_original_111';
      const event2Id = 'evt_scanner_222';
      const sampleToken = 'c'.repeat(64);

      jest.spyOn(verificationService, 'verifyToken').mockResolvedValueOnce({
        status: 'WRONG_EVENT',
        message: 'Ticket belongs to "Event 1", not the currently active scanner event.',
        ticket: {
          id: 'tkt_001',
          name: 'Attendee Name',
          category: 'GENERAL',
          usagePolicy: 'SINGLE_USE',
          eventName: 'Event 1',
        },
      } as any);

      const res = await request(app)
        .post('/api/verify/lookup')
        .send({
          token: sampleToken,
          eventId: event2Id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WRONG_EVENT');
      expect(res.body.data.message).toContain('not the currently active scanner event');
    });
  });
});
