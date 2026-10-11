import request from 'supertest';
import express from 'express';
import app from '../src/app';
import { securityHeadersMiddleware } from '../src/middlewares/security-headers.middleware';
import { createRateLimiter } from '../src/middlewares/rate-limit.middleware';
import { errorHandler, AppError } from '../src/middlewares/error.middleware';
import config from '../src/config/env';

describe('Security Hardening & Production Readiness Verification', () => {
  describe('1. Security Headers Middleware', () => {
    it('sets all required OWASP security headers on API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-xss-protection']).toBe('0');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['permissions-policy']).toContain('camera=()');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('strips x-powered-by header to prevent technology stack fingerprinting', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('2. Rate Limiter User-Scoping & Abuse Prevention', () => {
    it('isolates authenticated users from each other even if they share an IP', async () => {
      const testLimiter = createRateLimiter({
        windowMs: 60000,
        max: 2,
        message: 'Rate limit exceeded',
      });

      const testApp = express();
      testApp.use((req: any, _res, next) => {
        const userId = req.headers['x-test-user-id'];
        if (userId) {
          req.user = { id: userId, email: `${userId}@test.com` };
        }
        next();
      });
      testApp.use(testLimiter);
      testApp.get('/test-route', (_req, res) => res.json({ ok: true }));

      // User A makes 2 requests (exhausts allowance)
      const resA1 = await request(testApp).get('/test-route').set('x-test-user-id', 'user_A');
      expect(resA1.status).toBe(200);
      const resA2 = await request(testApp).get('/test-route').set('x-test-user-id', 'user_A');
      expect(resA2.status).toBe(200);

      // User A 3rd request -> 429
      const resA3 = await request(testApp).get('/test-route').set('x-test-user-id', 'user_A');
      expect(resA3.status).toBe(429);
      expect(resA3.body.error.code).toBe('TOO_MANY_REQUESTS');

      // User B makes request from SAME socket/IP -> must succeed (not starved by User A!)
      const resB1 = await request(testApp).get('/test-route').set('x-test-user-id', 'user_B');
      expect(resB1.status).toBe(200);
    });
  });

  describe('3. Production Error Details Sanitization', () => {
    it('suppresses internal stack traces and raw error messages on 500 in production mode', async () => {
      const originalIsProd = config.env.isProduction;
      try {
        config.env.isProduction = true;

        const errorApp = express();
        errorApp.get('/throw-500', () => {
          const err = new Error('Sensitive DB connection postgres://user:secret@db.internal failed');
          throw err;
        });
        errorApp.use(errorHandler);

        const res = await request(errorApp).get('/throw-500');
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        // Message should be masked
        expect(res.body.error.message).not.toContain('postgres://user:secret');
        // Details should be absent in production for 500 errors
        expect(res.body.error.details).toBeUndefined();
      } finally {
        config.env.isProduction = originalIsProd;
      }
    });

    it('passes structured validation details for 400 AppErrors even in production', async () => {
      const originalIsProd = config.env.isProduction;
      try {
        config.env.isProduction = true;

        const errorApp = express();
        errorApp.get('/throw-400', () => {
          throw new AppError('Invalid input payload', 400, [{ field: 'name', message: 'Name is required' }]);
        });
        errorApp.use(errorHandler);

        const res = await request(errorApp).get('/throw-400');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.details).toEqual([{ field: 'name', message: 'Name is required' }]);
      } finally {
        config.env.isProduction = originalIsProd;
      }
    });
  });

  describe('4. Diagnostic Endpoints & Internal Telemetry Protection', () => {
    it('public GET /api/health returns minimal status without leaking internal metrics', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.memory).toBeUndefined();
      expect(res.body.process).toBeUndefined();
    });

    it('rejects unauthenticated access to /api/health/memory with 401', async () => {
      const res = await request(app).get('/api/health/memory');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-admin authenticated users from /api/health/memory with 403', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_regular_diag_test',
        email: 'regular_diag@test.com',
        name: 'Regular User',
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      const token = createJwtToken({
        id: 'usr_regular_diag_test',
        email: 'regular_diag@test.com',
        role: 'USER',
      });

      const res = await request(app)
        .get('/api/health/memory')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows platform administrators to inspect /api/health/memory', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_admin_diag_test',
        email: 'admin_diag@test.com',
        name: 'Admin User',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
      } as any);

      const token = createJwtToken({
        id: 'usr_admin_diag_test',
        email: 'admin_diag@test.com',
        role: 'ADMIN',
      });

      const res = await request(app)
        .get('/api/health/memory')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.memory).toBeDefined();
      expect(res.body.memory.rss).toBeDefined();
      expect(res.body.sharp).toBeDefined();
      expect(res.body.process).toBeUndefined();
    });
  });

  describe('5. Production CORS Invariants', () => {
    it('blocks untrusted origins including arbitrary .vercel.app preview URLs in production', async () => {
      const originalIsProd = config.env.isProduction;
      try {
        config.env.isProduction = true;

        const res = await request(app)
          .get('/api/health')
          .set('Origin', 'https://malicious-attacker-preview.vercel.app');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      } finally {
        config.env.isProduction = originalIsProd;
      }
    });

    it('permits configured trusted appUrl origin in production', async () => {
      const originalIsProd = config.env.isProduction;
      try {
        config.env.isProduction = true;

        const res = await request(app)
          .get('/api/health')
          .set('Origin', config.env.appUrl);

        expect(res.headers['access-control-allow-origin']).toBe(config.env.appUrl);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
      } finally {
        config.env.isProduction = originalIsProd;
      }
    });
  });

  describe('6. Suspended Account Access Rejection', () => {
    it('rejects authentication token if user status is SUSPENDED', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_suspended_test',
        email: 'suspended_user@test.com',
        name: 'Suspended User',
        platformRole: 'USER',
        status: 'SUSPENDED',
      } as any);

      const token = createJwtToken({
        id: 'usr_suspended_test',
        email: 'suspended_user@test.com',
        role: 'USER',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Account is suspended');
    });
  });
});
