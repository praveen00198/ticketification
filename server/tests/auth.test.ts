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
  });
});
