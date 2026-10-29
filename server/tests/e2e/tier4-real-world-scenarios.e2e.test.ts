import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { createJwtToken } from '../../src/utils/local-auth';
import { mongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';
import { eventRegistrationService } from '../../src/modules/events/services/event-registration.service';
import { verificationService } from '../../src/modules/verification/services/verification.service';
import { mongoEventReportRepository } from '../../src/modules/events/repositories/mongo-event-report.repository';
import { guestRepository } from '../../src/modules/guests/repositories/guest.repository';
import { mongoEventCredentialRepository } from '../../src/modules/events/repositories/mongo-event-credential.repository';
import { eventRepository } from '../../src/modules/events/repositories/event.repository';
import { EventModel } from '../../src/db/mongo/models/event.model';
import { EventMemberModel } from '../../src/db/mongo/models/event-member.model';
import { qrService } from '../../src/modules/tickets/services/qr.service';

describe('Tier 4: Real-World Application Scenarios E2E Suite', () => {
  const attendeeUser = {
    id: 'usr_rw_attendee_001',
    email: 'alice_attendee@example.com',
    role: 'USER' as const,
    name: 'Alice Attendee',
  };

  const hostAUser = {
    id: 'usr_rw_host_a_002',
    email: 'host_a@example.com',
    role: 'USER' as const,
    name: 'Host Alpha',
  };

  const hostBUser = {
    id: 'usr_rw_host_b_003',
    email: 'host_b@example.com',
    role: 'USER' as const,
    name: 'Host Beta',
  };

  const attendeeToken = createJwtToken({
    id: attendeeUser.id,
    email: attendeeUser.email,
    role: attendeeUser.role,
  });

  const hostAToken = createJwtToken({
    id: hostAUser.id,
    email: hostAUser.email,
    role: hostAUser.role,
  });

  const hostBToken = createJwtToken({
    id: hostBUser.id,
    email: hostBUser.email,
    role: hostBUser.role,
  });

  const eventAId = new mongoose.Types.ObjectId().toString();
  const eventBId = new mongoose.Types.ObjectId().toString();

  const mockEventA = {
    _id: new mongoose.Types.ObjectId(eventAId),
    id: eventAId,
    name: 'Alpha AI Conference 2026',
    createdBy: hostAUser.id,
    ownerSupabaseId: hostAUser.id,
    status: 'PUBLISHED',
  };

  const mockEventB = {
    _id: new mongoose.Types.ObjectId(eventBId),
    id: eventBId,
    name: 'Beta Robotics Expo 2026',
    createdBy: hostBUser.id,
    ownerSupabaseId: hostBUser.id,
    status: 'PUBLISHED',
  };

  beforeEach(() => {
    jest.spyOn(EventMemberModel, 'findOne').mockResolvedValue(null);

    jest.spyOn(mongoUserRepository, 'findById').mockImplementation((id: string) => {
      if (id === hostAUser.id) {
        return Promise.resolve({
          _id: hostAUser.id,
          supabaseUserId: hostAUser.id,
          email: hostAUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      if (id === hostBUser.id) {
        return Promise.resolve({
          _id: hostBUser.id,
          supabaseUserId: hostBUser.id,
          email: hostBUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      return Promise.resolve({
        _id: attendeeUser.id,
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation((id: string) => {
      if (id === hostAUser.id) {
        return Promise.resolve({
          _id: hostAUser.id,
          supabaseUserId: hostAUser.id,
          email: hostAUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      if (id === hostBUser.id) {
        return Promise.resolve({
          _id: hostBUser.id,
          supabaseUserId: hostBUser.id,
          email: hostBUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      return Promise.resolve({
        _id: attendeeUser.id,
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
    });

    jest.spyOn(eventRepository, 'findById').mockImplementation((id: string) => {
      if (id === eventAId) return Promise.resolve(mockEventA as any);
      if (id === eventBId) return Promise.resolve(mockEventB as any);
      return Promise.resolve(null);
    });

    jest.spyOn(EventModel, 'findById').mockImplementation((id: string) => {
      if (id === eventAId) return Promise.resolve(mockEventA as any);
      if (id === eventBId) return Promise.resolve(mockEventB as any);
      return Promise.resolve(null);
    });

    jest.spyOn(eventRepository, 'findByIdAndOwner').mockImplementation((eventId: string, userId: string) => {
      if (eventId === eventAId && userId === hostAUser.id) return Promise.resolve(mockEventA as any);
      if (eventId === eventBId && userId === hostBUser.id) return Promise.resolve(mockEventB as any);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('T4.1: End-to-End User Journeys', () => {
    it('T4-RW1: complete attendee journey: register -> wallet pass -> turnstile check-in -> duplicate rejection', async () => {
      const verificationToken = qrService.generateVerificationToken();

      // Step 1: Attendee registers
      jest.spyOn(eventRegistrationService, 'register').mockResolvedValueOnce({
        registrationId: 'reg_001',
        credentialId: 'cred_001',
        formattedId: 'ALPHA-00042',
        status: 'CONFIRMED',
      } as any);

      const regRes = await request(app)
        .post(`/api/events/${eventAId}/register`)
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({ name: attendeeUser.name, email: attendeeUser.email });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.formattedId).toBe('ALPHA-00042');

      // Step 2: Attendee views wallet pass
      jest.spyOn(eventRegistrationService, 'getMyWallet').mockResolvedValueOnce([
        {
          credentialId: 'cred_001',
          eventId: eventAId,
          eventName: mockEventA.name,
          formattedId: 'ALPHA-00042',
          verificationToken,
          status: 'ACTIVE',
        } as any,
      ]);

      const walletRes = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(walletRes.status).toBe(200);
      expect(walletRes.body.data[0].verificationToken).toBe(verificationToken);

      // Step 3: Turnstile staff scans badge pass
      jest.spyOn(verificationService, 'checkInTicket').mockResolvedValueOnce({
        status: 'CHECKED_IN',
        message: 'Checked in successfully.',
        ticket: { formattedId: 'ALPHA-00042', status: 'CHECKED_IN' },
      } as any);

      const scan1 = await request(app)
        .post('/api/verify/checkin')
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ token: verificationToken, eventId: eventAId });

      expect(scan1.status).toBe(200);
      expect(scan1.body.data.status).toBe('CHECKED_IN');

      // Step 4: Turnstile rejects duplicate second entry
      jest.spyOn(verificationService, 'checkInTicket').mockResolvedValueOnce({
        status: 'ALREADY_USED',
        message: 'Single-use ticket has already been checked in earlier today.',
        ticket: { formattedId: 'ALPHA-00042', status: 'USED' },
      } as any);

      const scan2 = await request(app)
        .post('/api/verify/checkin')
        .set('Authorization', `Bearer ${hostAToken}`)
        .send({ token: verificationToken, eventId: eventAId });

      expect(scan2.status).toBe(200);
      expect(scan2.body.data.status).toBe('ALREADY_USED');
    });

    it('T4-RW2: host roster management: list guests and inspect issued tickets', async () => {
      jest.spyOn(guestRepository, 'findByEventId').mockResolvedValueOnce([
        { id: 'gst_01', name: 'Dr. Jane Doe', category: 'VIP', email: 'jane@example.com' } as any,
      ]);
      jest.spyOn(guestRepository, 'countByEventId').mockResolvedValueOnce(1);

      const guestRes = await request(app)
        .get(`/api/guests/events/${eventAId}`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(guestRes.status).toBe(200);
      expect(guestRes.body.data.guests.length).toBe(1);
      expect(guestRes.body.data.guests[0].name).toBe('Dr. Jane Doe');

      // Host inspects issued tickets
      jest.spyOn(mongoEventCredentialRepository, 'findByEvent').mockResolvedValueOnce({
        credentials: [
          {
            _id: new mongoose.Types.ObjectId(),
            sequenceNumber: 1,
            verificationToken: qrService.generateVerificationToken(),
            terminology: 'VIP Pass',
            status: 'ACTIVE',
            credentialType: 'VIP',
          } as any,
        ],
        total: 1,
      });

      const ticketRes = await request(app)
        .get(`/api/tickets/events/${eventAId}`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(ticketRes.status).toBe(200);
      expect(ticketRes.body.data.tickets.length).toBe(1);
      expect(ticketRes.body.data.tickets[0].id).toBeDefined();
      expect(ticketRes.body.data.tickets[0].sequenceNumber).toBe(1);
      expect(ticketRes.body.data.tickets[0].status).toBe('ACTIVE');
    });

    it('T4-RW3: zero-trust perimeter: ordinary attendee systematically blocked from host operations', async () => {
      // 1. Blocked from listing guests
      const res1 = await request(app)
        .get(`/api/guests/events/${eventAId}`)
        .set('Authorization', `Bearer ${attendeeToken}`);
      expect([403, 404]).toContain(res1.status);

      // 2. Blocked from ticket list
      const res2 = await request(app)
        .get(`/api/tickets/events/${eventAId}`)
        .set('Authorization', `Bearer ${attendeeToken}`);
      expect([403, 404]).toContain(res2.status);

      // 3. Blocked from creating guests
      const res3 = await request(app)
        .post(`/api/guests/events/${eventAId}`)
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({ name: 'Infiltrator', category: 'VIP' });
      expect([403, 404]).toContain(res3.status);
    });

    it('T4-RW4: multi-tenant isolation: Host B cannot access or mutate Event A resources', async () => {
      // Host B attempts to list guests of Event A
      const res1 = await request(app)
        .get(`/api/guests/events/${eventAId}`)
        .set('Authorization', `Bearer ${hostBToken}`);

      expect([403, 404]).toContain(res1.status);

      // Host B attempts to list tickets of Event A
      const res2 = await request(app)
        .get(`/api/tickets/events/${eventAId}`)
        .set('Authorization', `Bearer ${hostBToken}`);

      expect([403, 404]).toContain(res2.status);
    });

    it('T4-RW5: issue reporting workflow: attendee reports issue -> recorded with context', async () => {
      const mockReport = {
        _id: new mongoose.Types.ObjectId(),
        eventId: eventAId,
        reporterEmail: attendeeUser.email,
        reporterUserId: attendeeUser.id,
        category: 'EVENT_ACCESS',
        reason: 'QR scanner at Gate 3 is rejecting valid credentials',
        status: 'PENDING',
      };

      jest.spyOn(mongoEventReportRepository, 'create').mockResolvedValueOnce(mockReport as any);

      const reportRes = await request(app)
        .post('/api/support/report')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: eventAId,
          category: 'EVENT_ACCESS',
          reason: 'QR scanner at Gate 3 is rejecting valid credentials',
        });

      expect(reportRes.status).toBe(201);
      expect(reportRes.body.data.category).toBe('EVENT_ACCESS');
      expect(reportRes.body.data.eventId).toBe(eventAId);
    });
  });
});
