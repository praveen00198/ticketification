import request from 'supertest';
import app from '../src/app';
import {
  validateRegisterInput,
  validateLoginInput,
  validateChangePasswordInput,
} from '../src/modules/auth/auth.validation';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../src/middlewares/error.middleware';

describe('Phase 1: Auth & Error Handling Subsystem', () => {
  jest.setTimeout(30000);

  describe('Input Validation', () => {
    it('should reject registration with missing name', () => {
      expect(() =>
        validateRegisterInput({ name: '', email: 'test@example.com', password: 'password123' })
      ).toThrow(ValidationError);
    });

    it('should reject registration with invalid email', () => {
      expect(() =>
        validateRegisterInput({ name: 'Admin', email: 'not-an-email', password: 'password123' })
      ).toThrow(ValidationError);
    });

    it('should reject registration with password under 6 characters', () => {
      expect(() =>
        validateRegisterInput({ name: 'Admin', email: 'test@example.com', password: '123' })
      ).toThrow(ValidationError);
    });

    it('should sanitize and accept valid registration input', () => {
      const result = validateRegisterInput({
        name: '  Aman Kumar  ',
        email: '  TEST@Example.com  ',
        password: 'securepassword123',
      });
      expect(result.name).toBe('Aman Kumar');
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('securepassword123');
    });

    it('should reject login with invalid email format', () => {
      expect(() =>
        validateLoginInput({ email: 'bad-email', password: 'password' })
      ).toThrow(ValidationError);
    });

    it('should reject change-password with short password', () => {
      expect(() =>
        validateChangePasswordInput({ newPassword: '123' })
      ).toThrow(ValidationError);
    });
  });

  describe('Typed Error Class Hierarchy', () => {
    it('should instantiate ValidationError with status 400', () => {
      const err = new ValidationError('Bad input');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('VALIDATION_ERROR');
      expect(err.isAppError).toBe(true);
    });

    it('should instantiate AuthenticationError with status 401', () => {
      const err = new AuthenticationError();
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('AUTHENTICATION_ERROR');
    });

    it('should instantiate AuthorizationError with status 403', () => {
      const err = new AuthorizationError();
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('AUTHORIZATION_ERROR');
    });

    it('should instantiate NotFoundError with status 404', () => {
      const err = new NotFoundError('Event not found');
      expect(err.statusCode).toBe(404);
      expect(err.errorCode).toBe('NOT_FOUND');
    });

    it('should instantiate ConflictError with status 409', () => {
      const err = new ConflictError('Already exists');
      expect(err.statusCode).toBe(409);
      expect(err.errorCode).toBe('CONFLICT_ERROR');
    });
  });

  describe('HTTP Endpoints & Middleware Enforcement', () => {
    it('POST /api/auth/register should return 400 on invalid input', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '', email: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/login should return 400 on missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/auth/me should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('GET /api/auth/me should return 401 when Bearer token is empty or invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('POST /api/auth/change-password should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ newPassword: 'newpassword123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/logout should return 200 with success message', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('GET /api/health should return 200 with OK status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
    });

    it('POST /api/auth/login with nonexistent account should reject with 401 and ACCOUNT_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent-user-12345@testdomain.org',
          password: 'somepassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
      expect(res.body.error.message).toContain('No Ticketification account found');
    });

    it('POST /api/auth/refresh should reject with 400 when refreshToken is missing', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/refresh should reject with 401 on invalid/unknown refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'deadbeef00000000000000000000000000000000000000000000000000000000' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Custom Cryptographic & JWT Security Utilities', () => {
    // Import local auth utilities directly
    const {
      hashPassword,
      verifyPassword,
      createJwtToken,
      verifyJwtToken,
      generateRefreshToken,
      hashToken,
    } = require('../src/utils/local-auth');

    it('should hash and verify passwords using PBKDF2-SHA512', () => {
      const plaintext = 'SuperSecret123!';
      const hash1 = hashPassword(plaintext);
      const hash2 = hashPassword(plaintext);

      // Hashes must use unique salts
      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(':');

      // Valid password verifies
      expect(verifyPassword(plaintext, hash1)).toBe(true);
      expect(verifyPassword(plaintext, hash2)).toBe(true);

      // Invalid password fails
      expect(verifyPassword('WrongPassword', hash1)).toBe(false);
      expect(verifyPassword('', hash1)).toBe(false);
      expect(verifyPassword(plaintext, 'invalid-hash-string')).toBe(false);
    });

    it('should issue and verify custom backend HS256 JWT tokens', () => {
      const payload = { id: 'usr-12345', email: 'attendee@ticketification.com', role: 'USER' };
      const token = createJwtToken(payload, 3600);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = verifyJwtToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe('usr-12345');
      expect(decoded?.email).toBe('attendee@ticketification.com');
      expect(decoded?.role).toBe('USER');
      expect(decoded?.iss).toBe('ticketification-auth');
    });

    it('should reject tampered or signature-mismatched JWT tokens', () => {
      const payload = { id: 'usr-12345', email: 'attendee@ticketification.com', role: 'USER' };
      const token = createJwtToken(payload, 3600);

      const parts = token.split('.');
      // Tamper with payload (middle part)
      const tamperedPayload = Buffer.from(JSON.stringify({ id: 'usr-admin', role: 'SUPER_ADMIN' })).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const decoded = verifyJwtToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it('should reject expired JWT tokens', () => {
      const payload = { id: 'usr-12345', email: 'attendee@ticketification.com', role: 'USER' };
      // Expired 10 seconds ago
      const expiredToken = createJwtToken(payload, -10);

      const decoded = verifyJwtToken(expiredToken);
      expect(decoded).toBeNull();
    });

    it('should generate secure opaque refresh tokens and hash with SHA-256', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();

      expect(token1).toHaveLength(96); // 48 bytes hex
      expect(token2).toHaveLength(96);
      expect(token1).not.toBe(token2);

      const hash1 = hashToken(token1);
      const hash2 = hashToken(token1); // deterministic
      expect(hash1).toHaveLength(64); // SHA-256 hex
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashToken(token2));
    });
  });
});
