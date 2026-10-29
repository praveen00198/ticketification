import request from 'supertest';
import app from '../src/app';
import { authService } from '../src/modules/auth/services/auth.service';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { sessionRepository } from '../src/modules/auth/repositories/session.repository';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('Registration & CORS Reliability Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);
  });

  describe('CORS Enforcement & Status Reporting', () => {
    it('permits requests from canonical production origin', async () => {
      const res = await request(app)
        .options('/api/auth/register')
        .set('Origin', 'https://ticketification.vercel.app')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://ticketification.vercel.app');
    });

    it('permits requests from Vercel preview and branch deployments', async () => {
      const res = await request(app)
        .options('/api/auth/register')
        .set('Origin', 'https://ticketification-git-main-praveen-patels-projects.vercel.app')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://ticketification-git-main-praveen-patels-projects.vercel.app'
      );
    });

    it('rejects untrusted third-party origins with 403 Forbidden and structured error', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', 'https://malicious-phishing-site.example.com')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
      expect(res.body.error.message).toContain('Origin not allowed by CORS policy');
    });
  });

  describe('Registration Flow & Error Classification', () => {
    it('returns 400 ValidationError for invalid email or short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'not-an-email',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 ConflictError when email already exists', async () => {
      jest.spyOn(mongoUserRepository, 'findByEmail').mockResolvedValueOnce({
        id: 'usr_existing_123',
        email: 'duplicate@example.com',
        name: 'Existing User',
      } as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Registrant',
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT_ERROR');
      expect(res.body.error.message).toContain('already exists');
    });

    it('returns 201 Created and properly issues JWT for new user registration', async () => {
      jest.spyOn(mongoUserRepository, 'findByEmail').mockResolvedValueOnce(null);
      jest.spyOn(mongoUserRepository, 'create').mockResolvedValueOnce({
        id: 'usr_new_789',
        supabaseUserId: 'usr_new_789',
        name: 'Alice Wonder',
        email: 'alice@example.com',
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
      jest.spyOn(sessionRepository, 'createSession').mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Wonder',
          email: 'alice@example.com',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user.role).toBe('USER');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });
});
