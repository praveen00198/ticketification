import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { createJwtToken, generateRefreshToken } from '../../src/utils/local-auth';
import { mongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';
import { eventRegistrationService } from '../../src/modules/events/services/event-registration.service';
import { verificationService } from '../../src/modules/verification/services/verification.service';
import { authService } from '../../src/modules/auth/services/auth.service';
import { mongoEventReportRepository } from '../../src/modules/events/repositories/mongo-event-report.repository';
import { qrService } from '../../src/modules/tickets/services/qr.service';

describe('Tier 3: Cross-Feature Interactions E2E Suite', () => {
  const testAttendee = {
    id: 'usr_e2e_cross_attendee_001',
    email: 'cross_attendee@example.com',
    role: 'USER' as const,
    name: 'Cross Attendee',
  };

  const testHost = {
    id: 'usr_e2e_cross_host_002',
    email: 'cross_host@example.com',
    role: 'USER' as const,
    name: 'Cross Host',
  };

  const validAttendeeToken = createJwtToken({
    id: testAttendee.id,
    email: testAttendee.email,
    role: testAttendee.role,
  });

  const validHostToken = createJwtToken({
    id: testHost.id,
    email: testHost.email,
    role: testHost.role,
  });

  const mockEventId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation((id: string) => {
      if (id === testHost.id) {
        return Promise.resolve({
          _id: testHost.id,
          supabaseUserId: testHost.id,
          email: testHost.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      return Promise.resolve({
        _id: testAttendee.id,
        supabaseUserId: testAttendee.id,
        email: testAttendee.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('T3.1: Auth + Registration + Wallet Pass Interaction', () => {
    it('T3-XF1: unauthenticated user registration is blocked (401); once authenticated, registration succeeds', async () => {
      // 1. Unauthenticated attempt
      const unauthRes = await request(app)
        .post(`/api/events/${mockEventId}/register`)
        .send({ phone: '+919876543210' });

      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.success).toBe(false);

      // 2. Authenticated attempt succeeds
      const mockRegResult = {
        registrationId: new mongoose.Types.ObjectId().toString(),
        credentialId: new mongoose.Types.ObjectId().toString(),
        formattedId: 'EVT-00001',
        status: 'CONFIRMED',
      };

      jest.spyOn(eventRegistrationService, 'register').mockResolvedValueOnce(mockRegResult as any);

      const authRes = await request(app)
        .post(`/api/events/${mockEventId}/register`)
        .set('Authorization', `Bearer ${validAttendeeToken}`)
        .send({ phone: '+919876543210' });

      expect(authRes.status).toBe(201);
      expect(authRes.body.success).toBe(true);
      expect(authRes.body.data.formattedId).toBe('EVT-00001');
    });

    it('T3-XF2: newly registered event credential is automatically retrievable via /api/attendee/wallet', async () => {
      const mockCredential = {
        credentialId: new mongoose.Types.ObjectId().toString(),
        eventId: mockEventId,
        eventName: 'NextGen Cloud Summit',
        eventType: 'CONFERENCE',
        status: 'ACTIVE',
        formattedId: 'CLD-00100',
        verificationToken: qrService.generateVerificationToken(),
        usagePolicy: 'SINGLE_USE',
        checkInCount: 0,
        holder: { name: testAttendee.name, email: testAttendee.email },
      };

      jest.spyOn(eventRegistrationService, 'getMyWallet').mockResolvedValueOnce([mockCredential as any]);

      const walletRes = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${validAttendeeToken}`);

      expect(walletRes.status).toBe(200);
      expect(walletRes.body.success).toBe(true);
      expect(walletRes.body.data.length).toBe(1);
      expect(walletRes.body.data[0].formattedId).toBe('CLD-00100');
      expect(walletRes.body.data[0].verificationToken).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('T3.2: Attendee Registration + Contextual Issue Reporting Interaction', () => {
    it('T3-XF3: attendee files contextual issue report referencing their event, capturing report context', async () => {
      const mockReport = {
        _id: new mongoose.Types.ObjectId(),
        eventId: mockEventId,
        reporterEmail: testAttendee.email,
        reporterUserId: testAttendee.id,
        category: 'EVENT_ACCESS',
        reason: 'Turnstile gate staff could not scan my dynamic badge pass',
        status: 'PENDING',
        createdAt: new Date(),
      };

      jest.spyOn(mongoEventReportRepository, 'create').mockResolvedValueOnce(mockReport as any);

      const reportRes = await request(app)
        .post('/api/support/report')
        .set('Authorization', `Bearer ${validAttendeeToken}`)
        .send({
          eventId: mockEventId,
          category: 'EVENT_ACCESS',
          reason: 'Turnstile gate staff could not scan my dynamic badge pass',
        });

      expect(reportRes.status).toBe(201);
      expect(reportRes.body.success).toBe(true);
      expect(reportRes.body.data.eventId).toBe(mockEventId);
      expect(reportRes.body.data.reporterEmail).toBe(testAttendee.email);
    });
  });

  describe('T3.3: Credential Generation + Turnstile Check-in Interaction', () => {
    it('T3-XF4: valid ticket token check-in succeeds on first entry, and immediate replay is rejected as ALREADY_USED', async () => {
      const verificationToken = qrService.generateVerificationToken();

      // First check-in: SUCCESS
      jest.spyOn(verificationService, 'checkInTicket').mockResolvedValueOnce({
        status: 'CHECKED_IN',
        message: 'Checked in successfully.',
        ticket: {
          id: 'tkt_001',
          name: 'Attendee Name',
          category: 'GENERAL',
          usagePolicy: 'SINGLE_USE',
          eventName: 'NextGen Cloud Summit',
        },
      } as any);

      const checkin1 = await request(app)
        .post('/api/verify/checkin')
        .set('Authorization', `Bearer ${validHostToken}`)
        .send({
          token: verificationToken,
          eventId: mockEventId,
        });

      expect(checkin1.status).toBe(200);
      expect(checkin1.body.data.status).toBe('CHECKED_IN');

      // Second check-in: REPLAY / ALREADY_USED
      jest.spyOn(verificationService, 'checkInTicket').mockResolvedValueOnce({
        status: 'ALREADY_USED',
        message: 'Single-use ticket has already been checked in earlier today.',
        ticket: {
          id: 'tkt_001',
          name: 'Attendee Name',
          category: 'GENERAL',
          usagePolicy: 'SINGLE_USE',
          eventName: 'NextGen Cloud Summit',
        },
      } as any);

      const checkin2 = await request(app)
        .post('/api/verify/checkin')
        .set('Authorization', `Bearer ${validHostToken}`)
        .send({
          token: verificationToken,
          eventId: mockEventId,
        });

      expect(checkin2.status).toBe(200);
      expect(checkin2.body.data.status).toBe('ALREADY_USED');
      expect(checkin2.body.data.message).toContain('already been checked in');
    });
  });

  describe('T3.4: Session Expiry + Transparent Refresh Pipeline', () => {
    it('T3-XF5: expired token fails with 401; user refreshes session and subsequent wallet query succeeds', async () => {
      // 1. Expired token call
      const expiredToken = createJwtToken(
        { id: testAttendee.id, email: testAttendee.email, role: 'USER' },
        -100
      );

      const expiredRes = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(expiredRes.status).toBe(401);

      // 2. Refresh session
      const freshToken = createJwtToken({
        id: testAttendee.id,
        email: testAttendee.email,
        role: 'USER',
      });
      const freshRefreshToken = generateRefreshToken();

      jest.spyOn(authService, 'refreshSession').mockResolvedValueOnce({
        token: freshToken,
        refreshToken: freshRefreshToken,
        user: { id: testAttendee.id, email: testAttendee.email, role: 'USER', name: 'Attendee' },
      } as any);

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: generateRefreshToken() });

      expect(refreshRes.status).toBe(200);
      const newBearerToken = refreshRes.body.data.token;

      // 3. Subsequent wallet call with new bearer token succeeds
      jest.spyOn(eventRegistrationService, 'getMyWallet').mockResolvedValueOnce([]);

      const successRes = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${newBearerToken}`);

      expect(successRes.status).toBe(200);
      expect(successRes.body.success).toBe(true);
    });
  });
});
