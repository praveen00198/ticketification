import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { createJwtToken } from '../../src/utils/local-auth';
import { mongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRegistrationRepository } from '../../src/modules/events/repositories/mongo-event-registration.repository';
import { mongoEventCredentialRepository } from '../../src/modules/events/repositories/mongo-event-credential.repository';
import { eventRegistrationService } from '../../src/modules/events/services/event-registration.service';
import { mongoEventReportRepository } from '../../src/modules/events/repositories/mongo-event-report.repository';

describe('Tier 1: Requirements R3 & R4 — Dashboard Separation & Registrations Routing E2E Suite', () => {
  const testAttendee = {
    id: 'usr_e2e_attendee_r3',
    email: 'attendee_r3@example.com',
    role: 'USER' as const,
    name: 'R3 Attendee',
  };

  const mockMongoUser: any = {
    _id: testAttendee.id,
    supabaseUserId: testAttendee.id,
    email: testAttendee.email,
    name: testAttendee.name,
    platformRole: 'USER',
    status: 'ACTIVE',
  };

  const attendeeToken = createJwtToken({
    id: testAttendee.id,
    email: testAttendee.email,
    role: testAttendee.role,
  });

  const mockEventId = new mongoose.Types.ObjectId().toString();

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

  describe('R3: Global User Dashboard vs Attendee Workspace Separation', () => {
    it('R3-TC1: global wallet endpoint returns isolated passes belonging strictly to caller', async () => {
      const mockWalletItem = {
        credentialId: new mongoose.Types.ObjectId().toString(),
        eventId: mockEventId,
        eventName: 'Global Developer Conference',
        eventType: 'CONFERENCE',
        status: 'ACTIVE',
        formattedId: 'DEV-00001',
        verificationToken: 'a'.repeat(64),
      };

      jest.spyOn(eventRegistrationService, 'getMyWallet').mockResolvedValueOnce([mockWalletItem as any]);

      const res = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].eventName).toBe('Global Developer Conference');
      expect(res.body.data[0].formattedId).toBe('DEV-00001');
    });

    it('R3-TC2: attendee accessing /my-registration retrieves personal event registration info', async () => {
      const mockRegistration = {
        _id: new mongoose.Types.ObjectId(),
        eventId: mockEventId,
        status: 'CONFIRMED',
        registrationType: 'ATTENDEE',
        attendeeDetails: {
          name: testAttendee.name,
          email: testAttendee.email,
        },
      };

      jest.spyOn(eventRegistrationService, 'getMyRegistration').mockResolvedValueOnce(mockRegistration as any);

      const res = await request(app)
        .get(`/api/events/${mockEventId}/my-registration`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.attendeeDetails.email).toBe(testAttendee.email);
    });

    it('R3-TC3: contextual issue report rejects submissions with missing reason or reason < 10 characters', async () => {
      const res = await request(app)
        .post('/api/support/report')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: mockEventId,
          category: 'EVENT_ACCESS',
          reason: 'Too short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('minimum 10 characters');
    });

    it('R3-TC4: contextual issue report successfully records issue and attributes reporter identity from session', async () => {
      const mockCreatedReport: any = {
        _id: new mongoose.Types.ObjectId(),
        eventId: mockEventId,
        reporterEmail: testAttendee.email,
        reporterName: testAttendee.name,
        reporterUserId: testAttendee.id,
        category: 'EVENT_ACCESS',
        reason: 'Unable to view dynamic turnstile QR code for this event',
        status: 'PENDING',
        createdAt: new Date(),
      };

      jest.spyOn(mongoEventReportRepository, 'create').mockResolvedValueOnce(mockCreatedReport);

      const res = await request(app)
        .post('/api/support/report')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: mockEventId,
          category: 'EVENT_ACCESS',
          reason: 'Unable to view dynamic turnstile QR code for this event',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reporterEmail).toBe(testAttendee.email);
      expect(res.body.data.category).toBe('EVENT_ACCESS');
    });

    it('R3-TC5: authenticated attendee can view their own submitted reports via /api/support/my-reports', async () => {
      const mockReports: any[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: mockEventId,
          reporterEmail: testAttendee.email,
          reporterUserId: testAttendee.id,
          category: 'BADGE_ISSUE',
          reason: 'Name was misspelled on badge asset',
          status: 'RESOLVED',
        },
      ];

      jest.spyOn(mongoEventReportRepository, 'findByReporterUserId').mockResolvedValueOnce(mockReports);

      const res = await request(app)
        .get('/api/support/my-reports')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].category).toBe('BADGE_ISSUE');
    });
  });

  describe('R4: Registrations Routing & Lifecycle Status', () => {
    it('R4-TC1: loads active registrations for authenticated user with canonical status', async () => {
      const mockRegItem = {
        id: new mongoose.Types.ObjectId().toString(),
        eventId: mockEventId,
        eventName: 'AI Hackathon 2026',
        eventType: 'HACKATHON',
        status: 'CONFIRMED',
        registrationType: 'ATTENDEE',
        attendeeDetails: {
          name: testAttendee.name,
          email: testAttendee.email,
        },
        credential: {
          id: new mongoose.Types.ObjectId().toString(),
          formattedId: 'HCK-00042',
          status: 'ACTIVE',
        },
      };

      jest.spyOn(eventRegistrationService, 'getMyRegistrations').mockResolvedValueOnce([mockRegItem as any]);

      const res = await request(app)
        .get('/api/attendee/registrations')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('CONFIRMED');
      expect(res.body.data[0].credential.formattedId).toBe('HCK-00042');
    });

    it('R4-TC2: allows attendee to cancel registration and updates status cleanly', async () => {
      jest.spyOn(eventRegistrationService, 'cancelRegistration').mockResolvedValueOnce({
        success: true,
        message: 'Registration cancelled successfully and spot released',
      });

      const res = await request(app)
        .delete(`/api/events/${mockEventId}/my-registration`)
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({ reason: 'Schedule conflict' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('cancelled successfully');
    });

    it('R4-TC3: gracefully renders CANCELLED or REFUNDED status in attendee registrations query', async () => {
      const cancelledReg = {
        id: new mongoose.Types.ObjectId().toString(),
        eventId: mockEventId,
        eventName: 'Cancelled Workshop',
        status: 'CANCELLED',
        cancellationReason: 'Event rescheduled',
      };

      jest.spyOn(eventRegistrationService, 'getMyRegistrations').mockResolvedValueOnce([cancelledReg as any]);

      const res = await request(app)
        .get('/api/attendee/registrations')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].status).toBe('CANCELLED');
    });
  });
});
