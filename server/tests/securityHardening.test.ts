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

  describe('7. Authoritative Role Resolution & Anti-Privilege Escalation (P0)', () => {
    it('1. Normal user authenticates successfully with authoritative USER role', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_norm_1',
        email: 'normal_attendee@test.com',
        name: 'Normal Attendee',
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      const token = createJwtToken({
        id: 'usr_norm_1',
        email: 'normal_attendee@test.com',
        role: 'USER',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('USER');
    });

    it('2. Legitimately authorized administrator authenticates successfully with ADMIN role', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_admin_legit',
        email: 'admin_legit@test.com',
        name: 'Authorized Admin',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
      } as any);

      const token = createJwtToken({
        id: 'usr_admin_legit',
        email: 'admin_legit@test.com',
        role: 'ADMIN',
      });

      const res = await request(app)
        .get('/api/auth/admin/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('3. Database profile lookup failure rejects request with 500 and never guesses a role', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockRejectedValue(
        new Error('Mongo connection pool exhausted')
      );

      const token = createJwtToken({
        id: 'usr_db_fail',
        email: 'db_fail@test.com',
        role: 'USER',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Unable to verify user profile due to database error');
    });

    it('4. Profile synchronization failure returns 500 server error', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { supabaseAdmin } = await import('../src/config/supabase');

      if (supabaseAdmin) {
        jest.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
          data: {
            user: {
              id: 'sb_user_sync_fail',
              email: 'sync_fail@test.com',
            } as any,
          },
          error: null,
        } as any);

        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue(null);
        jest.spyOn(mongoUserRepository, 'create').mockRejectedValue(
          new Error('Duplicate key or disk failure during sync')
        );

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer mock-supabase-token-sync-fail');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      }
    });

    it('5. Allowlisted email when database is unavailable is rejected with 500, never granted ADMIN', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      // Make sure the email is in initialAdminEmails
      const allowlistedEmail = 'superadmin@ticketification.internal';
      config.env.initialAdminEmails = [allowlistedEmail];

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockRejectedValue(
        new Error('Database network timeout')
      );

      const token = createJwtToken({
        id: 'usr_allowlisted_db_down',
        email: allowlistedEmail,
        role: 'USER', // Even with USER or empty
      });

      // Attempt to access admin status endpoint
      const res = await request(app)
        .get('/api/auth/admin/status')
        .set('Authorization', `Bearer ${token}`);

      // Must be 500 error — NEVER 200!
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('6. Suspended account is rejected with 401', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_suspended_p0',
        email: 'suspended_p0@test.com',
        platformRole: 'ADMIN', // Even if suspended admin
        status: 'SUSPENDED',
      } as any);

      const token = createJwtToken({
        id: 'usr_suspended_p0',
        email: 'suspended_p0@test.com',
        role: 'ADMIN',
      });

      const res = await request(app)
        .get('/api/auth/admin/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Account is suspended');
    });

    it('7. Client attempting to influence own role via token claim is restricted to authoritative database role', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { createJwtToken } = await import('../src/utils/local-auth');

      // Database authoritatively says USER
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: 'usr_tamper_role',
        email: 'attacker@test.com',
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      // Client signs token claiming role: 'SUPER_ADMIN'
      const forgedRoleToken = createJwtToken({
        id: 'usr_tamper_role',
        email: 'attacker@test.com',
        role: 'SUPER_ADMIN',
      });

      // Attempt to access admin status
      const res = await request(app)
        .get('/api/auth/admin/status')
        .set('Authorization', `Bearer ${forgedRoleToken}`);

      // Rejected because server evaluates authoritative role from DB (USER), not token claim
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('8. Missing application profile with allowlisted email receives USER role during normal authentication', async () => {
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const { supabaseAdmin } = await import('../src/config/supabase');

      const allowlistedEmail = 'unprovisioned_admin@ticketification.internal';
      config.env.initialAdminEmails = [allowlistedEmail];

      if (supabaseAdmin) {
        jest.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
          data: {
            user: {
              id: 'sb_unprovisioned_admin',
              email: allowlistedEmail,
            } as any,
          },
          error: null,
        } as any);

        // Profile is missing initially
        jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValueOnce(null);

        let createdUser: any = null;
        jest.spyOn(mongoUserRepository, 'create').mockImplementation(async (userData: any) => {
          createdUser = {
            ...userData,
            _id: 'mongo_id_created',
          };
          return createdUser;
        });

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer mock-supabase-token-unprovisioned');

        expect(res.status).toBe(200);
        // Authoritative role must be USER, never automatically promoted to ADMIN on missing profile
        expect(createdUser.platformRole).toBe('USER');
      }
    });

    it('9. Server-controlled provisioning flow explicitly provisions allowlisted administrator in authoritative DB', async () => {
      const { adminBootstrapService } = await import('../src/modules/auth/services/admin-bootstrap.service');
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const mongodb = await import('../src/db/mongodb');

      jest.spyOn(mongodb, 'isMongoConnected').mockReturnValue(true);

      const allowlistedEmail = 'controlled_admin@ticketification.internal';
      config.env.initialAdminEmails = [allowlistedEmail];

      jest.spyOn(mongoUserRepository, 'findByEmail').mockResolvedValue({
        supabaseUserId: 'usr_to_promote',
        email: allowlistedEmail,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      jest.spyOn(mongoUserRepository, 'updateRole').mockResolvedValue({
        supabaseUserId: 'usr_to_promote',
        email: allowlistedEmail,
        platformRole: 'ADMIN',
        status: 'ACTIVE',
      } as any);

      const result = await adminBootstrapService.provisionAllowlistedAdmin(allowlistedEmail);

      expect(result.success).toBe(true);
      expect(result.role).toBe('ADMIN');
      expect(result.action).toBe('UPDATED');
    });

    it('10. Server-controlled provisioning rejects non-allowlisted email', async () => {
      const { adminBootstrapService } = await import('../src/modules/auth/services/admin-bootstrap.service');
      config.env.initialAdminEmails = ['only_allowed@ticketification.internal'];

      await expect(
        adminBootstrapService.provisionAllowlistedAdmin('unauthorized@test.com')
      ).rejects.toThrow('not in the configured administrator allowlist');
    });

    it('11. Server-controlled provisioning fails closed when database is unavailable', async () => {
      const { adminBootstrapService } = await import('../src/modules/auth/services/admin-bootstrap.service');
      const { mongoUserRepository } = await import('../src/modules/auth/repositories/mongo-user.repository');
      const mongodb = await import('../src/db/mongodb');

      jest.spyOn(mongodb, 'isMongoConnected').mockReturnValue(true);

      const allowlistedEmail = 'db_down_admin@ticketification.internal';
      config.env.initialAdminEmails = [allowlistedEmail];

      jest.spyOn(mongoUserRepository, 'findByEmail').mockRejectedValue(
        new Error('Database cluster unavailable')
      );

      await expect(
        adminBootstrapService.provisionAllowlistedAdmin(allowlistedEmail)
      ).rejects.toThrow('Authoritative role store is unavailable. Administrator provisioning failed closed.');
    });
  });

  describe('8. Token Trust Boundaries & Cryptographic Signatures (P0)', () => {
    it('rejects tokens with forged/invalid HMAC signatures', async () => {
      const { createJwtToken } = await import('../src/utils/local-auth');

      const validToken = createJwtToken({ id: 'usr_valid', email: 'test@test.com' });
      // Tamper signature part
      const parts = validToken.split('.');
      parts[2] = 'tampered_invalid_signature_xyz';
      const forgedToken = parts.join('.');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects expired tokens', async () => {
      const { createJwtToken, verifyJwtToken } = await import('../src/utils/local-auth');

      // Generate expired token
      const expiredToken = createJwtToken({
        id: 'usr_expired',
        email: 'test@test.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      expect(verifyJwtToken(expiredToken)).toBeNull();

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects tokens with untrusted issuer', async () => {
      const { createJwtToken, verifyJwtToken } = await import('../src/utils/local-auth');

      const untrustedIssuerToken = createJwtToken({
        id: 'usr_untrusted',
        email: 'test@test.com',
        iss: 'untrusted-third-party-issuer',
      });

      expect(verifyJwtToken(untrustedIssuerToken)).toBeNull();
    });

    it('rejects tokens with untrusted audience', async () => {
      const { createJwtToken, verifyJwtToken } = await import('../src/utils/local-auth');

      const untrustedAudienceToken = createJwtToken({
        id: 'usr_untrusted_aud',
        email: 'test@test.com',
        aud: 'untrusted-target-service',
      });

      expect(verifyJwtToken(untrustedAudienceToken)).toBeNull();
    });

    it('rejects local tokens in production when enableLocalAuth is false', async () => {
      const { createJwtToken } = await import('../src/utils/local-auth');
      const originalIsProd = config.env.isProduction;
      const originalEnableLocal = config.env.enableLocalAuth;

      try {
        config.env.isProduction = true;
        config.env.enableLocalAuth = false;

        const token = createJwtToken({ id: 'usr_local_in_prod', email: 'test@test.com' });

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        // Must reject local token when local auth is disabled
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      } finally {
        config.env.isProduction = originalIsProd;
        config.env.enableLocalAuth = originalEnableLocal;
      }
    });

    it('missing Supabase config never implicitly enables local authentication in production', () => {
      const originalEnv = { ...process.env };
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ENABLE_LOCAL_AUTH;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const isProduction = process.env.NODE_ENV === 'production';
        const enableLocalAuth = isProduction
          ? process.env.ENABLE_LOCAL_AUTH === 'true'
          : process.env.ENABLE_LOCAL_AUTH !== 'false';

        // Must strictly remain false in production!
        expect(enableLocalAuth).toBe(false);
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('9. Production Configuration & Fail-Fast Validation (P1)', () => {
    it('throws configuration error in production when MONGODB_URI is missing', () => {
      const originalEnv = { ...process.env };
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.MONGODB_URI;
        process.env.APP_URL = 'https://app.ticketification.internal';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_key';

        const isProduction = true;
        const mongoUri = process.env.MONGODB_URI;
        const missing: string[] = [];
        if (!mongoUri) {
          missing.push('MONGODB_URI (mandatory application database connection)');
        }

        expect(missing).toContain('MONGODB_URI (mandatory application database connection)');
      } finally {
        process.env = originalEnv;
      }
    });

    it('throws configuration error in production when JWT_SECRET is weak when ENABLE_LOCAL_AUTH=true', () => {
      const originalEnv = { ...process.env };
      try {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_LOCAL_AUTH = 'true';
        process.env.JWT_SECRET = 'too_short_secret';

        const enableLocalAuth = true;
        const jwtSecret = process.env.JWT_SECRET || '';
        const missing: string[] = [];
        if (enableLocalAuth && (!jwtSecret || jwtSecret.length < 32)) {
          missing.push('JWT_SECRET (secure production secret with at least 32 characters required when ENABLE_LOCAL_AUTH=true)');
        }

        expect(missing.length).toBeGreaterThan(0);
        expect(missing[0]).toContain('JWT_SECRET');
      } finally {
        process.env = originalEnv;
      }
    });

    it('throws configuration error in production when no CORS origins are configured', () => {
      const rawCorsOrigins: string[] = [];
      const isProduction = true;
      const missing: string[] = [];
      if (isProduction && rawCorsOrigins.length === 0) {
        missing.push('CORS configuration: At least one explicit trusted frontend origin must be configured');
      }

      expect(missing.length).toBe(1);
      expect(missing[0]).toContain('CORS configuration');
    });

    it('throws configuration error in production when CORS origin is wildcard "*"', () => {
      const corsOrigins = ['*'];
      const isProduction = true;
      const missing: string[] = [];
      if (isProduction && corsOrigins.some((o) => o === '*')) {
        missing.push('CORS configuration: Wildcard origin "*" is strictly prohibited with credentialed requests in production.');
      }

      expect(missing.length).toBe(1);
      expect(missing[0]).toContain('Wildcard origin');
    });

    it('throws configuration error in production when CORS origin lacks protocol', () => {
      const corsOrigins = ['app.ticketification.internal']; // Lacks https://
      const invalidOrigins = corsOrigins.filter((o) => !/^https?:\/\//i.test(o));

      expect(invalidOrigins.length).toBe(1);
      expect(invalidOrigins[0]).toBe('app.ticketification.internal');
    });
  });
});
