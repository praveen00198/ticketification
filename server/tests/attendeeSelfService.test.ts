import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import {
  EventRegistrationService,
  eventRegistrationService,
} from '../src/modules/events/services/event-registration.service';
import { MongoEventRegistrationRepository } from '../src/modules/events/repositories/mongo-event-registration.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventTeamRepository } from '../src/modules/events/repositories/mongo-event-team.repository';
import { EventCredentialService } from '../src/modules/events/services/event-credential.service';
import { EventTeamService, eventTeamService } from '../src/modules/events/services/event-team.service';

// Mock auth middleware
jest.mock('../src/middlewares/auth.middleware', () => {
  const handler = (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.includes('attendee-token')) {
      req.user = { id: 'attendee-supabase-id', sub: 'attendee-supabase-id', role: 'USER', email: 'attendee@test.com' };
    } else if (authHeader.includes('other-attendee-token')) {
      req.user = { id: 'other-supabase-id', sub: 'other-supabase-id', role: 'USER', email: 'other@test.com' };
    } else {
      req.user = { id: 'attendee-supabase-id', sub: 'attendee-supabase-id', role: 'USER', email: 'attendee@test.com' };
    }
    next();
  };
  return {
    authMiddleware: handler,
    authenticateUser: handler,
    default: handler,
  };
});

describe('Phase 20: Attendee Self-Service Platform Engine', () => {
  jest.setTimeout(30000);

  const eventId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const credentialId = new mongoose.Types.ObjectId().toString();
  const registrationId = new mongoose.Types.ObjectId().toString();

  const mockUser = {
    _id: new mongoose.Types.ObjectId(userId),
    supabaseId: 'attendee-supabase-id',
    name: 'Rahul Sharma',
    email: 'attendee@test.com',
    platformRole: 'USER',
  };

  const mockEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    name: 'HackNova 2026',
    eventType: 'HACKATHON',
    credentialTerminology: 'Hacker Pass',
    status: 'PUBLISHED',
    venue: { type: 'PHYSICAL', name: 'Main Auditorium', city: 'Bengaluru' },
    schedule: { startAt: new Date(), endAt: new Date(Date.now() + 86400000), timezone: 'Asia/Kolkata' },
    registration: { capacity: 100, pricingModel: 'FREE' },
  };

  const mockCredential = {
    _id: new mongoose.Types.ObjectId(credentialId),
    eventId: new mongoose.Types.ObjectId(eventId),
    sequenceNumber: 1,
    formattedId: 'PASS-00001',
    verificationToken: 'a'.repeat(64),
    credentialType: 'ATTENDEE',
    terminology: 'Hacker Pass',
    usagePolicy: 'SINGLE_USE',
    status: 'ACTIVE',
    holder: {
      name: 'Rahul Sharma',
      email: 'attendee@test.com',
      category: 'ATTENDEE',
      isAssigned: true,
    },
    asset: { storagePath: `events/${eventId}/credentials/pass-00001.png`, mimeType: 'image/png' },
    createdAt: new Date(),
  };

  const mockRegistration = {
    _id: new mongoose.Types.ObjectId(registrationId),
    eventId: new mongoose.Types.ObjectId(eventId),
    userId: new mongoose.Types.ObjectId(userId),
    userSupabaseId: 'attendee-supabase-id',
    credentialId: new mongoose.Types.ObjectId(credentialId),
    status: 'CONFIRMED',
    registrationType: 'ATTENDEE',
    attendeeDetails: {
      name: 'Rahul Sharma',
      email: 'attendee@test.com',
      organization: 'Tech University',
    },
    responses: { github: 'rahulsharma' },
    registeredAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Self-Registration & Credential Auto-Issuance', () => {
    it('should register attendee and auto-issue active credential', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockEvent as any);
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'findByEventAndUser').mockResolvedValue(null);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'countByEvent').mockResolvedValue(10);
      jest
        .spyOn(EventCredentialService.prototype, 'issueRegistrationCredential')
        .mockResolvedValue(mockCredential as any);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'create').mockResolvedValue(mockRegistration as any);

      const res = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set('Authorization', 'Bearer attendee-token')
        .send({
          organization: 'Tech University',
          responses: { github: 'rahulsharma' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registration.status).toBe('CONFIRMED');
      expect(res.body.data.credential.formattedId).toBe('PASS-00001');
      expect(res.body.data.credential.verificationToken).toBe('a'.repeat(64));
    });

    it('should enforce idempotency by returning existing registration if already registered', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockEvent as any);
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest
        .spyOn(MongoEventRegistrationRepository.prototype, 'findByEventAndUser')
        .mockResolvedValue(mockRegistration as any);
      jest.spyOn(MongoEventCredentialRepository.prototype, 'findById').mockResolvedValue(mockCredential as any);

      const res = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set('Authorization', 'Bearer attendee-token')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registration._id).toBe(registrationId);
    });

    it('should reject registration when event capacity is reached', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockEvent as any);
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'findByEventAndUser').mockResolvedValue(null);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'countByEvent').mockResolvedValue(100); // at limit

      const res = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set('Authorization', 'Bearer attendee-token')
        .send({});

      expect(res.status).toBe(400);
      const errMsg = res.body.error?.message || res.body.message;
      expect(errMsg).toMatch(/capacity limit/i);
    });

    it('should reject registration when event status is DRAFT or SUSPENDED', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue({
        ...mockEvent,
        status: 'SUSPENDED',
      } as any);

      const res = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set('Authorization', 'Bearer attendee-token')
        .send({});

      expect(res.status).toBe(400);
      const errMsg = res.body.error?.message || res.body.message;
      expect(errMsg).toMatch(/currently unavailable/i);
    });
  });

  describe('2. Registration Cancellation & Credential Revocation', () => {
    it('should cancel registration and atomically revoke linked credential', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest
        .spyOn(MongoEventRegistrationRepository.prototype, 'findByEventAndUser')
        .mockResolvedValue(mockRegistration as any);
      const updateStatusSpy = jest
        .spyOn(MongoEventRegistrationRepository.prototype, 'updateStatus')
        .mockResolvedValue(mockRegistration as any);
      const revokeCredSpy = jest
        .spyOn(MongoEventCredentialRepository.prototype, 'updateStatus')
        .mockResolvedValue({ ...mockCredential, status: 'REVOKED' } as any);

      const res = await request(app)
        .delete(`/api/events/${eventId}/my-registration`)
        .set('Authorization', 'Bearer attendee-token')
        .send({ reason: 'Schedule conflict' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateStatusSpy).toHaveBeenCalledWith(registrationId, eventId, 'CANCELLED', expect.any(Date), 'Schedule conflict');
      expect(revokeCredSpy).toHaveBeenCalledWith(eventId, credentialId, 'REVOKED', 'Schedule conflict');
    });

    it('should return 404 when cancelling without an active registration', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'findByEventAndUser').mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/events/${eventId}/my-registration`)
        .set('Authorization', 'Bearer attendee-token')
        .send({});

      expect(res.status).toBe(404);
    });
  });

  describe('3. Cross-Event Attendee Wallet', () => {
    it('should aggregate credentials across events for the attendee wallet', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventRegistrationRepository.prototype, 'findByUserSupabaseId').mockResolvedValue([
        {
          ...mockRegistration,
          eventId: mockEvent,
          credentialId: mockCredential,
        },
      ] as any);
      jest.spyOn(MongoEventCredentialRepository.prototype, 'findByEmail').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/attendee/wallet')
        .set('Authorization', 'Bearer attendee-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].formattedId).toBe('PASS-00001');
      expect(res.body.data[0].eventName).toBe('HackNova 2026');
      expect(res.body.data[0].credentialTerminology).toBe('Hacker Pass');
    });
  });

  describe('4. Attendee Hackathon Teaming & Submission', () => {
    const teamId = new mongoose.Types.ObjectId().toString();
    const mockTeam = {
      _id: new mongoose.Types.ObjectId(teamId),
      eventId: new mongoose.Types.ObjectId(eventId),
      teamName: 'CyberKnights',
      track: 'AI/ML',
      leaderName: 'Rahul Sharma',
      leaderEmail: 'attendee@test.com',
      members: [
        { name: 'Rahul Sharma', email: 'attendee@test.com', role: 'Team Lead', checkedIn: false },
      ],
      status: 'FORMED',
    };

    it('should allow attendee to create a team and become leader', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventTeamRepository.prototype, 'findByMemberEmail').mockResolvedValue(null);
      jest.spyOn(MongoEventTeamRepository.prototype, 'findByEventAndName').mockResolvedValue(null);
      jest.spyOn(MongoEventTeamRepository.prototype, 'createTeam').mockResolvedValue(mockTeam as any);

      const res = await request(app)
        .post(`/api/events/${eventId}/my-team`)
        .set('Authorization', 'Bearer attendee-token')
        .send({ teamName: 'CyberKnights', track: 'AI/ML' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teamName).toBe('CyberKnights');
      expect(res.body.data.leaderEmail).toBe('attendee@test.com');
    });

    it('should reject creating a team if user is already part of another team', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventTeamRepository.prototype, 'findByMemberEmail').mockResolvedValue(mockTeam as any);

      const res = await request(app)
        .post(`/api/events/${eventId}/my-team`)
        .set('Authorization', 'Bearer attendee-token')
        .send({ teamName: 'SecondTeam' });

      expect(res.status).toBe(409);
      const errMsg = res.body.error?.message || res.body.message;
      expect(errMsg).toMatch(/already part of a team/i);
    });

    it('should allow attendee to submit project details', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(mockUser as any);
      jest.spyOn(MongoEventTeamRepository.prototype, 'findByMemberEmail').mockResolvedValue(mockTeam as any);
      jest.spyOn(MongoEventTeamRepository.prototype, 'updateTeam').mockResolvedValue({
        ...mockTeam,
        projectTitle: 'AI Fraud Sentinel',
        repoUrl: 'https://github.com/rahul/sentinel',
        status: 'SUBMITTED',
      } as any);

      const res = await request(app)
        .put(`/api/events/${eventId}/my-team/submit`)
        .set('Authorization', 'Bearer attendee-token')
        .send({
          projectTitle: 'AI Fraud Sentinel',
          repoUrl: 'https://github.com/rahul/sentinel',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUBMITTED');
    });
  });
});
