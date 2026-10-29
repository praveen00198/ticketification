import request from 'supertest';
import app from '../../src/app';
import { createJwtToken, generateRefreshToken } from '../../src/utils/local-auth';
import { authService } from '../../src/modules/auth/services/auth.service';
import { mongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRegistrationRepository } from '../../src/modules/events/repositories/mongo-event-registration.repository';
import { mongoEventCredentialRepository } from '../../src/modules/events/repositories/mongo-event-credential.repository';

describe('Tier 1: Requirement R1 — Bearer Tokens & Session Lifecycle E2E Suite', () => {
  const testUser = {
    id: 'usr_e2e_attendee_001',
    email: 'attendee_e2e@example.com',
    role: 'USER' as const,
    name: 'E2E Attendee',
  };

  const mockMongoUser: any = {
    _id: testUser.id,
    supabaseUserId: testUser.id,
    email: testUser.email,
    name: testUser.name,
    platformRole: 'USER',
    status: 'ACTIVE',
  };

  const validToken = createJwtToken({
    id: testUser.id,
    email: testUser.email,
    role: testUser.role,
  });

  beforeEach(() => {
    jest.spyOn(mongoUserRepository, 'findById').mockResolvedValue(mockMongoUser);
    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue(mockMongoUser);
    jest.spyOn(mongoUserRepository, 'findByEmail').mockResolvedValue(mockMongoUser);
    jest.spyOn(mongoEventRegistrationRepository, 'findByUserSupabaseId').mockResolvedValue([]);
    jest.spyOn(mongoEventCredentialRepository, 'findByEmail').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('R1.1: Protected Endpoints Bearer Token Enforcement', () => {
    it('R1-TC1: allows access to protected wallet endpoint when valid Bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('R1-TC2: returns 401 Unauthorized with exact error message when Authorization header is omitted', async () => {
      const res = await request(app).get('/api/attendee/wallet');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBe('Authentication required. Missing Bearer token.');
    });

    it('R1-TC3: returns 401 when Authorization header is malformed, missing "Bearer", or empty', async () => {
      // 1. Missing prefix entirely
      const res1 = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', validToken);
      expect(res1.status).toBe(401);
      expect(res1.body.error.message).toBe('Authentication required. Missing Bearer token.');

      // 2. Non-Bearer scheme (Basic)
      const res2 = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res2.status).toBe(401);
      expect(res2.body.error.message).toBe('Authentication required. Missing Bearer token.');

      // 3. Bearer with only whitespace
      const res3 = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', 'Bearer    ');
      expect(res3.status).toBe(401);
      expect(res3.body.error.message).toBe('Authentication required. Missing Bearer token.');
    });

    it('R1-TC4: returns 401 when token is tampered, cryptographically invalid, or expired', async () => {
      // Tampered token signature
      const tamperedToken = `${validToken.substring(0, validToken.length - 6)}ABCDEF`;
      const res1 = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(res1.status).toBe(401);
      expect(res1.body.error.message).toBe('Invalid or expired authentication token.');

      // Expired token (negative lifespan: -3600 seconds)
      const expiredToken = createJwtToken(
        { id: testUser.id, email: testUser.email, role: testUser.role },
        -3600
      );
      const res2 = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res2.status).toBe(401);
      expect(res2.body.error.message).toBe('Invalid or expired authentication token.');
    });

    it('R1-TC5: handles case-insensitive "bearer" and tolerates arbitrary whitespace', async () => {
      const res = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `bearer   ${validToken}   `);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('R1.2: Session Refresh Lifecycle & Token Rotation', () => {
    it('R1-TC6: successfully rotates tokens via POST /api/auth/refresh when provided valid refresh token', async () => {
      const mockRawRefreshToken = generateRefreshToken();
      const newAccessToken = createJwtToken({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });
      const newRefreshToken = generateRefreshToken();

      // Mock authService.refreshSession to simulate successful rotation
      jest.spyOn(authService, 'refreshSession').mockResolvedValueOnce({
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
          name: 'E2E Attendee',
        },
      } as any);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockRawRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe(newAccessToken);
      expect(res.body.data.refreshToken).toBe(newRefreshToken);
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('R1-TC7: returns 400/401 with safe error message when refresh token is missing or invalid', async () => {
      // 1. Missing refreshToken in request body
      const res1 = await request(app)
        .post('/api/auth/refresh')
        .send({});
      expect([400, 401]).toContain(res1.status);
      expect(res1.body.success).toBe(false);

      // 2. Unknown or expired refresh token
      const res2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'unrecognized_nonexistent_refresh_token_99999' });
      expect([400, 401]).toContain(res2.status);
      expect(res2.body.success).toBe(false);
      // Ensure no raw database query or stack trace is exposed
      expect(JSON.stringify(res2.body)).not.toContain('MongoError');
      expect(JSON.stringify(res2.body)).not.toContain('drizzle');
    });

    it('R1-TC8: guarantees that sensitive secrets and tokens are stripped from error responses', async () => {
      const res = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', 'Bearer invalid-secret-token-payload');

      expect(res.status).toBe(401);
      const stringified = JSON.stringify(res.body);
      expect(stringified).not.toContain('jwtSecret');
      expect(stringified).not.toContain('Ticketification_Default_Secret');
      expect(stringified).not.toContain('password');
      expect(stringified).not.toContain('hash');
    });
  });
});
