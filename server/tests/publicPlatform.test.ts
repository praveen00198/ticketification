import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventReportRepository } from '../src/modules/events/repositories/mongo-event-report.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { EventRegistrationModel } from '../src/db/mongo/models/event-registration.model';
import { AuditService } from '../src/modules/events/services/audit.service';
import { publicEventService } from '../src/modules/events/services/public-event.service';

describe('Phase 21: Interactive Public Platform Engine', () => {
  jest.setTimeout(30000);

  const eventId = new mongoose.Types.ObjectId().toString();
  const hostId = new mongoose.Types.ObjectId().toString();
  const reportId = new mongoose.Types.ObjectId().toString();

  const mockPublicEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    ownerId: new mongoose.Types.ObjectId(hostId),
    ownerSupabaseId: 'host-supabase-123',
    name: 'Global Tech Summit 2026',
    eventType: 'CONFERENCE',
    description: 'Premier technology gathering in San Francisco.',
    credentialTerminology: 'Conference Badge',
    attendanceMode: 'TICKETIFICATION_REGISTRATION',
    status: 'PUBLISHED',
    venue: {
      type: 'PHYSICAL',
      name: 'Moscone Center',
      city: 'San Francisco',
      country: 'USA',
    },
    schedule: {
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
      timezone: 'America/Los_Angeles',
    },
    registration: {
      capacity: 500,
      pricingModel: 'FREE',
      registrationRequired: true,
    },
    verificationLevel: 'HIGH',
    verificationStatus: 'VERIFIED',
    createdAt: new Date(),
  };

  const mockHostUser = {
    _id: new mongoose.Types.ObjectId(hostId),
    supabaseUserId: 'host-supabase-123',
    name: 'Tech Events Global',
    email: 'admin@techevents.org',
    platformRole: 'USER',
    status: 'ACTIVE',
    hostVerificationStatus: 'HIGH',
    hostProfile: {
      organizationName: 'Tech Events Global Inc.',
      institutionType: 'CORPORATE',
      institutionName: 'Tech Global Foundation',
      website: 'https://techevents.org',
      bio: 'Leading organizer of developer and technology summits globally.',
      logoUrl: 'https://storage.supabase.co/techevents-logo.png',
      onboardedAt: new Date(),
    },
  };

  const mockReport = {
    _id: new mongoose.Types.ObjectId(reportId),
    eventId: new mongoose.Types.ObjectId(eventId),
    reporterEmail: 'concerned@visitor.org',
    reporterName: 'Alice Visitor',
    category: 'MISLEADING_INFO',
    reason: 'The event states it takes place at Moscone Center, but venue does not have it listed.',
    status: 'PENDING',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    publicEventService.clearCache();
  });

  describe('1. Public Event Discovery & Catalog', () => {
    it('should query and return paginated public events', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findPublicEvents').mockResolvedValue({
        events: [mockPublicEvent as any],
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/public/events')
        .query({ eventType: 'CONFERENCE', city: 'San Francisco', page: 1, limit: 12 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0].name).toBe('Global Tech Summit 2026');
      expect(res.body.data.events[0].id).toBe(eventId);
      expect(res.body.data.total).toBe(1);
    });

    it('should support search and filter query parameters', async () => {
      const spy = jest.spyOn(MongoEventRepository.prototype, 'findPublicEvents').mockResolvedValue({
        events: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/public/events')
        .query({ search: 'summit', venueType: 'PHYSICAL', pricingModel: 'FREE' });

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'summit',
          venueType: 'PHYSICAL',
          pricingModel: 'FREE',
        })
      );
    });

    it('should serve repeated catalog queries from in-memory cache and support cache clearing', async () => {
      publicEventService.clearCache();
      const spy = jest.spyOn(MongoEventRepository.prototype, 'findPublicEvents').mockResolvedValue({
        events: [mockPublicEvent as any],
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });

      // First query -> calls repository
      const res1 = await request(app).get('/api/public/events').query({ page: 1, limit: 12 });
      expect(res1.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);

      // Second identical query -> served from cache without repository hit
      const res2 = await request(app).get('/api/public/events').query({ page: 1, limit: 12 });
      expect(res2.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);

      // Invalidate cache
      publicEventService.clearCache();

      // Third query -> hits repository again
      const res3 = await request(app).get('/api/public/events').query({ page: 1, limit: 12 });
      expect(res3.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. Standalone Public Event Details Microsite', () => {
    it('should return public event details with sanitized host profile and live capacity metrics', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findPublicById').mockResolvedValue(mockPublicEvent as any);
      jest.spyOn(MongoUserRepository.prototype, 'findById').mockResolvedValue(mockHostUser as any);
      jest.spyOn(EventRegistrationModel, 'countDocuments').mockReturnValue({
        exec: jest.fn().mockResolvedValue(150),
      } as any);

      const res = await request(app).get(`/api/public/events/${eventId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.name).toBe('Global Tech Summit 2026');
      expect(res.body.data.host.organizationName).toBe('Tech Events Global Inc.');
      expect(res.body.data.host.hostVerificationStatus).toBe('HIGH');
      // Verify PII is NOT leaked
      expect(res.body.data.host.email).toBeUndefined();
      expect(res.body.data.host.phone).toBeUndefined();
      // Verify live metrics
      expect(res.body.data.metrics.confirmedCount).toBe(150);
      expect(res.body.data.metrics.remainingCapacity).toBe(350); // 500 - 150
      expect(res.body.data.metrics.isSoldOut).toBe(false);
    });

    it('should return 404 if event is not found or is in DRAFT/SUSPENDED status', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findPublicById').mockResolvedValue(null);

      const res = await request(app).get(`/api/public/events/${eventId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });
  });

  describe('3. Public Organizer Profiles', () => {
    it('should return public host profile and their active events', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findById').mockResolvedValue(mockHostUser as any);
      jest.spyOn(MongoEventRepository.prototype, 'findPublicByHost').mockResolvedValue([mockPublicEvent as any]);

      const res = await request(app).get(`/api/public/hosts/${hostId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.host.organizationName).toBe('Tech Events Global Inc.');
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0].name).toBe('Global Tech Summit 2026');
    });

    it('should return 404 if host profile does not exist', async () => {
      jest.spyOn(MongoUserRepository.prototype, 'findById').mockResolvedValue(null);
      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockResolvedValue(null);

      const res = await request(app).get(`/api/public/hosts/${hostId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Organizer not found');
    });
  });

  describe('4. Trust & Safety Reporting Channel', () => {
    it('should allow public visitors to submit an abuse report against an event', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockPublicEvent as any);
      jest.spyOn(MongoEventReportRepository.prototype, 'create').mockResolvedValue(mockReport as any);
      const auditSpy = jest.spyOn(AuditService.prototype, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post(`/api/public/events/${eventId}/report`)
        .send({
          reporterEmail: 'concerned@visitor.org',
          reporterName: 'Alice Visitor',
          category: 'MISLEADING_INFO',
          reason: 'The event states it takes place at Moscone Center, but venue does not have it listed.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reportId).toBe(reportId);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVENT_REPORTED',
          targetEntity: 'EVENT',
          targetId: eventId,
        })
      );
    });

    it('should reject report submission when email is invalid', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockPublicEvent as any);

      const res = await request(app)
        .post(`/api/public/events/${eventId}/report`)
        .send({
          reporterEmail: 'not-an-email',
          category: 'SCAM',
          reason: 'This event appears to be fraudulent with fake speakers.',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('valid reporter email');
    });

    it('should reject report submission with invalid category', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockPublicEvent as any);

      const res = await request(app)
        .post(`/api/public/events/${eventId}/report`)
        .send({
          reporterEmail: 'visitor@test.com',
          category: 'INVALID_CATEGORY',
          reason: 'This event is fraudulent and misleading.',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid report category');
    });

    it('should reject report submission with reason under 10 characters', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(mockPublicEvent as any);

      const res = await request(app)
        .post(`/api/public/events/${eventId}/report`)
        .send({
          reporterEmail: 'visitor@test.com',
          category: 'SCAM',
          reason: 'scam',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 10 characters');
    });

    it('should return 404 when reporting a non-existent event', async () => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/public/events/${eventId}/report`)
        .send({
          reporterEmail: 'visitor@test.com',
          category: 'SCAM',
          reason: 'This event appears to be fraudulent and fake.',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Event not found');
    });
  });
});
