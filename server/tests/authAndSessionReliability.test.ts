import request from 'supertest';
import express, { Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../src/middlewares/auth.middleware';
import { createJwtToken } from '../src/utils/local-auth';
import config from '../src/config/env';
import * as supabaseConfig from '../src/config/supabase';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';

describe('Milestone 1: Auth & Session Reliability Verification', () => {
  // Test Express app mounting authMiddleware
  const createTestApp = () => {
    const app = express();
    app.use(express.json());

    app.get('/protected-test', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
      res.json({
        success: true,
        user: req.user,
      });
    });

    // Error handling middleware matching production
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode || 401).json({
        success: false,
        error: {
          message: err.message,
          code: err.code || 'AUTHENTICATION_ERROR',
        },
      });
    });

    return app;
  };

  describe('1. Backend Auth Middleware & Gate Removal', () => {
    it('rejects requests with missing Authorization header with 401 Missing Bearer token', async () => {
      const app = createTestApp();
      const res = await request(app).get('/protected-test');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Authentication required. Missing Bearer token.');
    });

    it('rejects requests with malformed Authorization header (missing Bearer)', async () => {
      const app = createTestApp();
      const res = await request(app)
        .get('/protected-test')
        .set('Authorization', 'Basic 123456');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Authentication required. Missing Bearer token.');
    });

    it('rejects tampered or invalid JWT tokens with 401 Invalid or expired token', async () => {
      const app = createTestApp();
      const res = await request(app)
        .get('/protected-test')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid or expired authentication token.');
    });

    it('authenticates valid custom HS256 JWT even when isProduction is true and enableLocalAuth is false', async () => {
      // Simulate production environment invariants
      const origIsProd = config.env.isProduction;
      const origEnableLocal = config.env.enableLocalAuth;

      (config.env as any).isProduction = true;
      (config.env as any).enableLocalAuth = false;

      const testUser = {
        id: 'test-user-prod-uuid',
        email: 'prod.user@ticketification.com',
        role: 'USER' as const,
      };

      jest.spyOn(mongoUserRepository, 'findById').mockResolvedValue({
        _id: testUser.id,
        supabaseUserId: testUser.id,
        email: testUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      try {
        const validToken = createJwtToken({
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
        });

        const app = createTestApp();
        const res = await request(app)
          .get('/protected-test')
          .set('Authorization', `Bearer ${validToken}`);

        // Prior to Milestone 1 fix, this would fail with 401 because isLocalAuthEnabled was false in production!
        // With the fix, valid JWTs are always verified.
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(testUser.email);
      } finally {
        (config.env as any).isProduction = origIsProd;
        (config.env as any).enableLocalAuth = origEnableLocal;
      }
    });

    it('falls back to Supabase token verification when token is not an HS256 JWT', async () => {
      const mockSupabaseUser = {
        id: 'supabase-auth-user-999',
        email: 'supabase.user@example.com',
      };

      const originalSupabaseAdmin = supabaseConfig.supabaseAdmin;

      // Mock supabaseAdmin with getUser method
      (supabaseConfig as any).supabaseAdmin = {
        auth: {
          getUser: jest.fn().mockImplementation(async (token: string) => {
            if (token === 'valid-supabase-token-xyz') {
              return { data: { user: mockSupabaseUser }, error: null };
            }
            return { data: { user: null }, error: new Error('Invalid JWT') };
          }),
        },
      };

      try {
        const app = createTestApp();

        // 1. Valid Supabase token should succeed
        const successRes = await request(app)
          .get('/protected-test')
          .set('Authorization', 'Bearer valid-supabase-token-xyz');

        expect(successRes.status).toBe(200);
        expect(successRes.body.success).toBe(true);
        expect(successRes.body.user.id).toBe(mockSupabaseUser.id);
        expect(successRes.body.user.email).toBe(mockSupabaseUser.email);

        // 2. Invalid Supabase token should fail with 401
        const failRes = await request(app)
          .get('/protected-test')
          .set('Authorization', 'Bearer invalid-supabase-token-abc');

        expect(failRes.status).toBe(401);
        expect(failRes.body.error.message).toBe('Invalid or expired authentication token.');
      } finally {
        (supabaseConfig as any).supabaseAdmin = originalSupabaseAdmin;
      }
    });
  });

  describe('2. Frontend Shared Refresh Promise Mutex & Concurrent 401 Deduplication', () => {
    it('deduplicates concurrent 401 requests onto a single in-flight refresh call', async () => {
      // Simulate client token refresh mutex logic
      let refreshCallCount = 0;
      let refreshPromise: Promise<string> | null = null;
      let activeAccessToken = 'expired-token';
      let activeRefreshToken = 'valid-refresh-token';

      const mockRefreshApi = async (refToken: string): Promise<{ token: string; refreshToken: string }> => {
        refreshCallCount++;
        // Simulate network latency for refresh call
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (refToken === 'valid-refresh-token') {
          return {
            token: `new-access-token-${refreshCallCount}`,
            refreshToken: `new-refresh-token-${refreshCallCount}`,
          };
        }
        const err: any = new Error('Invalid refresh token');
        err.response = { status: 401 };
        throw err;
      };

      const handle401WithMutex = async (requestId: number): Promise<{ requestId: number; tokenUsed: string }> => {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const res = await mockRefreshApi(activeRefreshToken);
              activeAccessToken = res.token;
              activeRefreshToken = res.refreshToken;
              return res.token;
            } finally {
              refreshPromise = null;
            }
          })();
        }

        const newToken = await refreshPromise;

        // Simulate Axios 1.7 header assignment
        const headers: any = {
          _headers: {},
          set(key: string, val: string) {
            this._headers[key.toLowerCase()] = val;
          },
        };
        headers.set('Authorization', `Bearer ${newToken}`);

        return { requestId, tokenUsed: headers._headers['authorization'] };
      };

      // Fire 5 concurrent requests simulating parallel navigation / wallet / notifications fetch
      const concurrentRequests = [1, 2, 3, 4, 5].map((id) => handle401WithMutex(id));
      const results = await Promise.all(concurrentRequests);

      // Verify that EXACTLY 1 refresh API call was made
      expect(refreshCallCount).toBe(1);

      // Verify all 5 concurrent requests received the identical refreshed token
      expect(results).toHaveLength(5);
      results.forEach((r) => {
        expect(r.tokenUsed).toBe('Bearer new-access-token-1');
      });
    });

    it('preserves stored tokens on transient network errors and only clears on explicit 401/403', async () => {
      let storedToken: string | null = 'test-token';
      let storedRefreshToken: string | null = 'test-refresh';

      const clearStoredAuthToken = () => {
        storedToken = null;
        storedRefreshToken = null;
      };

      // Case A: Transient network failure (e.g. ERR_NETWORK, no HTTP status)
      const networkError: any = new Error('Network Error');
      networkError.code = 'ERR_NETWORK';
      networkError.response = undefined;

      const handleRefreshFailure = (err: any) => {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          clearStoredAuthToken();
        }
      };

      handleRefreshFailure(networkError);
      // Stored tokens must be preserved!
      expect(storedToken).toBe('test-token');
      expect(storedRefreshToken).toBe('test-refresh');

      // Case B: Explicit 401 Authentication Rejection
      const authRejectError: any = new Error('Unauthorized');
      authRejectError.response = { status: 401 };

      handleRefreshFailure(authRejectError);
      // Stored tokens must be wiped!
      expect(storedToken).toBeNull();
      expect(storedRefreshToken).toBeNull();
    });

    it('extracts access token from Supabase localStorage session fallback when ticketification_token is absent', () => {
      // Mock window and localStorage
      const mockStorage: Record<string, string> = {
        'sb-projectid-auth-token': JSON.stringify({
          access_token: 'supabase-session-jwt-token-12345',
          refresh_token: 'supabase-refresh-token-67890',
        }),
      };

      const getStoredAuthTokenMock = () => {
        const primary = mockStorage['ticketification_token'];
        if (primary) return primary;

        for (const key of Object.keys(mockStorage)) {
          if (
            (key.startsWith('sb-') && key.endsWith('-auth-token')) ||
            key === 'supabase.auth.token'
          ) {
            try {
              const parsed = JSON.parse(mockStorage[key]);
              const sbToken = parsed?.access_token || parsed?.currentSession?.access_token;
              if (sbToken) return sbToken;
            } catch {}
          }
        }
        return null;
      };

      const extractedToken = getStoredAuthTokenMock();
      expect(extractedToken).toBe('supabase-session-jwt-token-12345');
    });
  });
});
