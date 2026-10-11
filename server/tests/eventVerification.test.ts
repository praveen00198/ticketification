const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
  supabasePublic: null,
}));

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventVerificationRepository } from '../src/modules/events/repositories/mongo-event-verification.repository';
import { eventVerificationService } from '../src/modules/events/services/event-verification.service';
import { supabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';

describe('Phase 5: Event Verification & Risk Engine', () => {
  const hostToken = 'valid-host-token-phase5';
  const intruderToken = 'valid-intruder-token-phase5';
  const adminToken = 'valid-admin-token-phase5';

  const hostUser = {
    id: 'host-user-uuid-ph5',
    email: 'host.phase5@college.edu',
    role: 'USER' as const,
  };

  const intruderUser = {
    id: 'intruder-user-uuid-ph5',
    email: 'intruder.phase5@example.com',
    role: 'USER' as const,
  };

  const adminUser = {
    id: 'admin-user-uuid-ph5',
    email: 'admin.phase5@ticketification.com',
    role: 'ADMIN' as const,
  };

  const hostMongoId = new mongoose.Types.ObjectId();
  const intruderMongoId = new mongoose.Types.ObjectId();
  const adminMongoId = new mongoose.Types.ObjectId();

  const draftEventId = new mongoose.Types.ObjectId();
  const paidEventId = new mongoose.Types.ObjectId();

  // In-memory mock store
  let mockEvents: Map<string, any>;
  let mockVerifications: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockVerifications = new Map();

    // Seed mock draft event
    const draftEventObj: any = {
      _id: draftEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'National Campus Hackathon 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: { type: 'PHYSICAL', name: 'Convention Hall', city: 'Bengaluru', country: 'India' },
      schedule: { startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 172800000), timezone: 'Asia/Kolkata' },
      registration: { pricingModel: 'FREE', registrationRequired: true, capacity: 150 },
      status: 'DRAFT',
      verificationStatus: 'UNVERIFIED',
      verificationLevel: 'UNVERIFIED',
    };
    draftEventObj.save = jest.fn().mockImplementation(async () => {
      mockEvents.set(draftEventId.toString(), draftEventObj);
      return draftEventObj;
    });
    mockEvents.set(draftEventId.toString(), draftEventObj);

    // Seed mock paid event
    const paidEventObj: any = {
      _id: paidEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Grand City Music Festival',
      eventType: 'CONCERT',
      credentialTerminology: 'Ticket',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: { type: 'PHYSICAL', name: 'Open Arena', city: 'Mumbai', country: 'India' },
      schedule: { startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 172800000), timezone: 'Asia/Kolkata' },
      registration: { pricingModel: 'PAID', registrationRequired: true, capacity: 3000 },
      status: 'DRAFT',
      verificationStatus: 'UNVERIFIED',
      verificationLevel: 'UNVERIFIED',
    };
    paidEventObj.save = jest.fn().mockImplementation(async () => {
      mockEvents.set(paidEventId.toString(), paidEventObj);
      return paidEventObj;
    });
    mockEvents.set(paidEventId.toString(), paidEventObj);

    // Seed mock verification for draft event
    mockVerifications.set(draftEventId.toString(), {
      eventId: draftEventId,
      ownerId: hostMongoId,
      institutionName: 'National Engineering College',
      institutionType: 'COLLEGE_UNIVERSITY',
      officialEmail: 'dean@college.edu',
      department: 'Computer Science & Engineering',
      designation: 'Head of Department',
      websiteUrl: 'https://college.edu',
      documentUrls: ['https://test.supabase.co/storage/events/mock/verification/doc.pdf'],
      otpVerified: false,
      status: 'DRAFT',
    });

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) {
        return { data: { user: { id: hostUser.id, email: hostUser.email, user_metadata: { name: 'Host Professor' } } }, error: null };
      }
      if (token === intruderToken) {
        return { data: { user: { id: intruderUser.id, email: intruderUser.email, user_metadata: { name: 'Intruder' } } }, error: null };
      }
      if (token === adminToken) {
        return { data: { user: { id: adminUser.id, email: adminUser.email, user_metadata: { name: 'Platform Admin' } } }, error: null };
      }
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    // Mock PostgreSQL user repository
    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host Professor', email: hostUser.email, role: 'USER' };
      if (id === intruderUser.id) return { id: intruderUser.id, name: 'Intruder', email: intruderUser.email, role: 'USER' };
      if (id === adminUser.id) return { id: adminUser.id, name: 'Platform Admin', email: adminUser.email, role: 'ADMIN' };
      return null;
    });

    // Mock Mongo user repository
    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) {
        return {
          _id: hostMongoId,
          supabaseUserId: hostUser.id,
          email: hostUser.email,
          name: 'Host Professor',
          platformRole: 'USER',
          status: 'ACTIVE',
          workspaceStatus: 'ACTIVE',
          hostProfile: { organizationName: 'National Engineering College', institutionType: 'COLLEGE_UNIVERSITY' },
        };
      }
      if (id === intruderUser.id) {
        return {
          _id: intruderMongoId,
          supabaseUserId: intruderUser.id,
          email: intruderUser.email,
          name: 'Intruder',
          platformRole: 'USER',
          status: 'ACTIVE',
          workspaceStatus: 'ACTIVE',
        };
      }
      if (id === adminUser.id) {
        return {
          _id: adminMongoId,
          supabaseUserId: adminUser.id,
          email: adminUser.email,
          name: 'Platform Admin',
          platformRole: 'ADMIN',
          status: 'ACTIVE',
        };
      }
      return null;
    });

    // Mock Mongo Event repository
    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      const found = mockEvents.get(id.toString());
      return found || null;
    });

    // Mock Mongo Verification repository
    jest.spyOn(mongoEventVerificationRepository, 'findByEventId').mockImplementation(async (id: any): Promise<any> => {
      return mockVerifications.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventVerificationRepository, 'findByEventIdWithSecrets').mockImplementation(async (id: any): Promise<any> => {
      return mockVerifications.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventVerificationRepository, 'upsertDraft').mockImplementation(
      async (eventId: any, ownerId: any, data: any): Promise<any> => {
        const existing = mockVerifications.get(eventId.toString()) || {
          eventId,
          ownerId,
          documentUrls: [],
          otpVerified: false,
          status: 'DRAFT',
        };
        const updated = { ...existing, ...data };
        mockVerifications.set(eventId.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventVerificationRepository, 'updateOtp').mockImplementation(
      async (eventId: any, officialEmail: string, otpHash: string, otpExpiresAt: Date): Promise<any> => {
        const existing = mockVerifications.get(eventId.toString()) || {
          eventId,
          ownerId: hostMongoId,
          documentUrls: [],
          status: 'DRAFT',
        };
        const updated = {
          ...existing,
          officialEmail,
          otpHash,
          otpExpiresAt,
          otpVerified: false,
        };
        mockVerifications.set(eventId.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventVerificationRepository, 'markOtpVerified').mockImplementation(
      async (eventId: any): Promise<any> => {
        const existing = mockVerifications.get(eventId.toString());
        if (!existing) return null;
        existing.otpVerified = true;
        delete existing.otpHash;
        delete existing.otpExpiresAt;
        mockVerifications.set(eventId.toString(), existing);
        return existing;
      }
    );

    jest.spyOn(mongoEventVerificationRepository, 'addDocumentUrl').mockImplementation(
      async (eventId: any, docUrl: string): Promise<any> => {
        const existing = mockVerifications.get(eventId.toString()) || {
          eventId,
          ownerId: hostMongoId,
          documentUrls: [],
          status: 'DRAFT',
        };
        if (!existing.documentUrls) existing.documentUrls = [];
        existing.documentUrls.push(docUrl);
        mockVerifications.set(eventId.toString(), existing);
        return existing;
      }
    );

    jest.spyOn(mongoEventVerificationRepository, 'submitVerification').mockImplementation(
      async (eventId: any, riskScore: number, riskTier: any, riskFactors: any): Promise<any> => {
        const existing = mockVerifications.get(eventId.toString());
        if (!existing) return null;
        existing.status = 'PENDING';
        existing.riskScore = riskScore;
        existing.riskTier = riskTier;
        existing.riskFactors = riskFactors;
        existing.submittedAt = new Date();
        mockVerifications.set(eventId.toString(), existing);
        return existing;
      }
    );

    jest.spyOn(mongoEventVerificationRepository, 'reviewVerification').mockImplementation(
      async (eventId: any, status: any, reviewedBy: any, reviewNotes?: string): Promise<any> => {
        const existing = mockVerifications.get(eventId.toString());
        if (!existing) return null;
        existing.status = status;
        existing.reviewedBy = reviewedBy;
        existing.reviewNotes = reviewNotes;
        existing.reviewedAt = new Date();
        mockVerifications.set(eventId.toString(), existing);
        return existing;
      }
    );

    jest.spyOn(mongoEventVerificationRepository, 'listVerifications').mockImplementation(
      async (params?: any): Promise<any> => {
        const list = Array.from(mockVerifications.values()).filter((v) => {
          if (params?.status && v.status !== params.status) return false;
          return true;
        });
        return {
          verifications: list.map((v) => ({
            ...v,
            ownerId: { name: 'Host Professor', email: hostUser.email },
            eventId: mockEvents.get(v.eventId.toString()),
          })),
          total: list.length,
        };
      }
    );

    // Mock storage service
    jest.spyOn(supabaseStorageService, 'uploadVerificationDocument').mockResolvedValue({
      publicUrl: 'https://test.supabase.co/storage/events/mock/verification/doc.pdf',
      storagePath: 'events/mock/verification/doc.pdf',
    });
  });

  describe('1. Risk-Scoring Heuristics Engine (Unit Rules)', () => {
    it('should assign LOW risk tier to free event with capacity < 200, verified institutional domain, and doc', () => {
      const mockEvent = mockEvents.get(draftEventId.toString());
      const risk = eventVerificationService.calculateRisk(mockEvent, {
        officialEmail: 'dean@engineering.edu',
        otpVerified: true,
        documentUrls: ['https://test.supabase.co/doc.pdf'],
      });

      expect(risk.tier).toBe('LOW');
      expect(risk.score).toBeLessThan(25);
    });

    it('should assign HIGH risk tier to paid events with high capacity and unverified webmail', () => {
      const mockEvent = mockEvents.get(paidEventId.toString());
      const risk = eventVerificationService.calculateRisk(mockEvent, {
        officialEmail: 'organizer@gmail.com',
        otpVerified: false,
        documentUrls: [],
      });

      expect(risk.tier).toBe('HIGH');
      expect(risk.score).toBeGreaterThan(60);
      expect(risk.factors).toContain('PAID_EVENT_FINANCIAL_EXPOSURE');
      expect(risk.factors).toContain('LARGE_SCALE_CAPACITY_OVER_2000');
    });
  });

  describe('2. Draft Verification Details', () => {
    it('should allow event owner to save verification draft', async () => {
      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/draft`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          institutionName: 'National Engineering College',
          institutionType: 'COLLEGE_UNIVERSITY',
          officialEmail: 'dean@college.edu',
          department: 'Computer Science & Engineering',
          designation: 'Head of Department',
          websiteUrl: 'https://college.edu',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.institutionName).toBe('National Engineering College');
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should reject non-owner attempting to save verification draft (IDOR protection, HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/draft`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({
          institutionName: 'Hacker University',
          officialEmail: 'hacker@college.edu',
          department: 'CSE',
          designation: 'Dean',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Institutional Email OTP Verification Flow', () => {
    it('should send 6-digit OTP to official institutional email and return devOtp in test environment', async () => {
      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/send-otp`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          officialEmail: 'hod.cse@college.edu',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.devOtp).toBeDefined();
      expect(res.body.devOtp).toHaveLength(6);
    });

    it('should reject invalid OTP code with HTTP 400', async () => {
      // Send OTP first so an active OTP hash exists
      await request(app)
        .post(`/api/events/${draftEventId}/verification/send-otp`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ officialEmail: 'hod.cse@college.edu' });

      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/verify-otp`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          code: '000000',
        });

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message || res.body.error;
      expect(errMsg).toContain('Invalid verification code');
    });

    it('should successfully verify official email with correct 6-digit OTP code', async () => {
      const sendRes = await request(app)
        .post(`/api/events/${draftEventId}/verification/send-otp`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ officialEmail: 'hod.cse@college.edu' });

      const activeOtp = sendRes.body.devOtp;

      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/verify-otp`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          code: activeOtp,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const record = mockVerifications.get(draftEventId.toString());
      expect(record?.otpVerified).toBe(true);
    });
  });

  describe('4. Document Upload for Verification', () => {
    it('should upload official authorization document and append to documentUrls', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.4 Mock Authorization Document');

      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/document`)
        .set('Authorization', `Bearer ${hostToken}`)
        .attach('document', fakePdfBuffer, 'college_permission.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentUrl).toContain('verification');

      const record = mockVerifications.get(draftEventId.toString());
      expect(record?.documentUrls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Submit Verification for Review', () => {
    it('should reject verification submission if OTP is not verified', async () => {
      const record = mockVerifications.get(draftEventId.toString());
      record.otpVerified = false;

      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/submit`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message || res.body.error;
      expect(errMsg).toContain('verify your official institutional email');
    });

    it('should reject verification submission for paid events if no documents are uploaded', async () => {
      // Setup paid event with OTP verified but no docs
      mockVerifications.set(paidEventId.toString(), {
        eventId: paidEventId,
        ownerId: hostMongoId,
        institutionName: 'Music Org',
        officialEmail: 'concert@music.org',
        department: 'Events',
        designation: 'Director',
        otpVerified: true,
        documentUrls: [],
        status: 'DRAFT',
      });

      const res = await request(app)
        .post(`/api/events/${paidEventId}/verification/submit`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message || res.body.error;
      expect(errMsg).toContain('require at least one official authorization document');
    });

    it('should successfully submit verification for review and transition event status to SUBMITTED', async () => {
      // Re-enable OTP and ensure docs exist for draftEvent
      const record = mockVerifications.get(draftEventId.toString());
      record.otpVerified = true;
      record.documentUrls = ['https://test.supabase.co/storage/events/mock/verification/doc.pdf'];

      const res = await request(app)
        .post(`/api/events/${draftEventId}/verification/submit`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');

      // Check event state in database
      const updatedEvent = mockEvents.get(draftEventId.toString());
      expect(updatedEvent?.status).toBe('SUBMITTED');
      expect(updatedEvent?.verificationStatus).toBe('PENDING');
    });
  });

  describe('6. Platform Administrator Review Workflow', () => {
    it('should reject non-admin from accessing admin verification list (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/admin/verifications')
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow platform admin to list pending verifications', async () => {
      mockVerifications.set(draftEventId.toString(), {
        eventId: draftEventId,
        ownerId: hostMongoId,
        institutionName: 'National Engineering College',
        officialEmail: 'dean@college.edu',
        department: 'CSE',
        designation: 'HOD',
        documentUrls: ['https://test.supabase.co/doc.pdf'],
        otpVerified: true,
        status: 'PENDING',
        riskTier: 'LOW',
        riskScore: 20,
      });

      const res = await request(app)
        .get('/api/admin/verifications?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const matched = res.body.data.find(
        (v: any) => v.eventId?._id?.toString() === draftEventId.toString()
      );
      expect(matched).toBeDefined();
    });

    it('should allow platform admin to approve verification and set Event to APPROVED', async () => {
      mockVerifications.set(draftEventId.toString(), {
        eventId: draftEventId,
        ownerId: hostMongoId,
        institutionName: 'National Engineering College',
        officialEmail: 'dean@college.edu',
        department: 'CSE',
        designation: 'HOD',
        documentUrls: ['https://test.supabase.co/doc.pdf'],
        otpVerified: true,
        status: 'PENDING',
        riskTier: 'LOW',
        riskScore: 20,
      });

      const res = await request(app)
        .post(`/api/admin/verifications/${draftEventId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
          reviewNotes: 'Institutional permission letter verified and authentic.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedEvent = mockEvents.get(draftEventId.toString());
      expect(updatedEvent?.status).toBe('APPROVED');
      expect(updatedEvent?.verificationStatus).toBe('VERIFIED');
      expect(updatedEvent?.verificationLevel).toBe('LOW');

      const updatedVerif = mockVerifications.get(draftEventId.toString());
      expect(updatedVerif?.status).toBe('VERIFIED');
      expect(updatedVerif?.reviewNotes).toBe(
        'Institutional permission letter verified and authentic.'
      );
    });

    it('should allow platform admin to reject verification with notes and reset Event to DRAFT', async () => {
      mockVerifications.set(draftEventId.toString(), {
        eventId: draftEventId,
        ownerId: hostMongoId,
        institutionName: 'National Engineering College',
        officialEmail: 'dean@college.edu',
        department: 'CSE',
        designation: 'HOD',
        documentUrls: ['https://test.supabase.co/doc.pdf'],
        otpVerified: true,
        status: 'PENDING',
        riskTier: 'LOW',
        riskScore: 20,
      });

      const res = await request(app)
        .post(`/api/admin/verifications/${draftEventId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECTED',
          reviewNotes: 'Document signature could not be verified with college administration.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedEvent = mockEvents.get(draftEventId.toString());
      expect(updatedEvent?.status).toBe('DRAFT');
      expect(updatedEvent?.verificationStatus).toBe('REJECTED');

      const record = mockVerifications.get(draftEventId.toString());
      expect(record?.status).toBe('REJECTED');
    });
  });
});
