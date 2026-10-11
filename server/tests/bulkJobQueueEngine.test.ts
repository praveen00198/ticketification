const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: null,
  supabasePublic: null,
}));

import * as xlsx from 'xlsx';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { mongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { eventImportParserService } from '../src/modules/events/services/event-import-parser.service';
import { eventJobQueueService } from '../src/modules/events/services/event-job-queue.service';

describe('Phase 15: Import + Bulk Credential Generation Jobs Engine', () => {
  jest.setTimeout(30000);

  const hostUser = { id: 'host-auth-id-15', email: 'host15@event.com', role: 'HOST' };
  const coordinatorUser = { id: 'coord-auth-id-15', email: 'coord15@event.com', role: 'COORDINATOR' };
  const volunteerUser = { id: 'vol-auth-15', email: 'vol15@event.com', role: 'VOLUNTEER' };
  const outsiderUser = { id: 'outsider-15', email: 'outsider15@event.com', role: 'ATTENDEE' };

  const hostToken = 'valid-host-token-15';
  const coordinatorToken = 'valid-coord-token-15';
  const volunteerToken = 'valid-vol-token-15';
  const outsiderToken = 'valid-outsider-token-15';

  const testEventId = new mongoose.Types.ObjectId();
  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const volunteerMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  let mockJobs: Map<string, any>;
  let mockCredentials: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJobs = new Map();
    mockCredentials = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'HackAI 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };

    mockGetUser.mockImplementation(async (token: string) => {
      if (token === hostToken) return { data: { user: hostUser }, error: null };
      if (token === coordinatorToken) return { data: { user: coordinatorUser }, error: null };
      if (token === volunteerToken) return { data: { user: volunteerUser }, error: null };
      if (token === outsiderToken) return { data: { user: outsiderUser }, error: null };
      return { data: { user: null }, error: new Error('Invalid token') };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === hostUser.id) return { id: hostUser.id, email: hostUser.email, role: 'HOST' } as any;
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, email: coordinatorUser.email, role: 'COORDINATOR' } as any;
      if (id === volunteerUser.id) return { id: volunteerUser.id, email: volunteerUser.email, role: 'VOLUNTEER' } as any;
      if (id === outsiderUser.id) return { id: outsiderUser.id, email: outsiderUser.email, role: 'ATTENDEE' } as any;
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (supabaseId: string) => {
      if (supabaseId === hostUser.id) return { _id: hostMongoId, supabaseId: hostUser.id, email: hostUser.email, platformRole: 'HOST' } as any;
      if (supabaseId === coordinatorUser.id) return { _id: coordinatorMongoId, supabaseId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'COORDINATOR' } as any;
      if (supabaseId === volunteerUser.id) return { _id: volunteerMongoId, supabaseId: volunteerUser.id, email: volunteerUser.email, platformRole: 'VOLUNTEER' } as any;
      if (supabaseId === outsiderUser.id) return { _id: outsiderMongoId, supabaseId: outsiderUser.id, email: outsiderUser.email, platformRole: 'ATTENDEE' } as any;
      return null;
    });

    jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(baseEvent);

    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(async (eId: any, uId: any): Promise<any> => {
      if (uId.toString() === coordinatorMongoId.toString()) {
        return {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          userId: coordinatorMongoId,
          role: 'COORDINATOR',
          status: 'ACTIVE',
        };
      }
      if (uId.toString() === volunteerMongoId.toString()) {
        return {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          userId: volunteerMongoId,
          role: 'VOLUNTEER',
          status: 'ACTIVE',
        };
      }
      return null;
    });

    // Mock Job Repo
    jest.spyOn(mongoEventJobRepository, 'createJob').mockImplementation(async (data: any) => {
      const jobId = new mongoose.Types.ObjectId();
      const doc = {
        _id: jobId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockJobs.set(jobId.toString(), doc);
      return doc as any;
    });

    jest.spyOn(mongoEventJobRepository, 'findById').mockImplementation(async (id: any) => {
      return mockJobs.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventJobRepository, 'findByEventId').mockImplementation(async (eId: any) => {
      return Array.from(mockJobs.values()).filter((j) => j.eventId.toString() === eId.toString());
    });

    jest.spyOn(mongoEventJobRepository, 'markStarted').mockImplementation(async (id: any) => {
      const job = mockJobs.get(id.toString());
      if (job) {
        job.status = 'PROCESSING';
        job.startedAt = new Date();
      }
      return job as any;
    });

    jest.spyOn(mongoEventJobRepository, 'updateProgress').mockImplementation(async (id: any, prog: any, res: any) => {
      const job = mockJobs.get(id.toString());
      if (job) {
        job.progress = { ...job.progress, ...prog };
        if (res) job.result = { ...job.result, ...res };
      }
      return job as any;
    });

    jest.spyOn(mongoEventJobRepository, 'markCompleted').mockImplementation(async (id: any, res: any) => {
      const job = mockJobs.get(id.toString());
      if (job) {
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.progress.percentage = 100;
        job.result = res;
      }
      return job as any;
    });

    jest.spyOn(mongoEventJobRepository, 'markCancelled').mockImplementation(async (id: any) => {
      const job = mockJobs.get(id.toString());
      if (job) {
        job.status = 'CANCELLED';
        job.completedAt = new Date();
      }
      return job as any;
    });

    // Mock Credential Repo sequence allocation
    jest.spyOn(mongoEventCredentialRepository, 'allocateSequenceBlock').mockResolvedValue(1);

    jest.spyOn(mongoEventCredentialRepository, 'createMany').mockImplementation(async (items: any[]) => {
      const created = items.map((item) => {
        const id = new mongoose.Types.ObjectId();
        const doc = { _id: id, ...item, createdAt: new Date() };
        mockCredentials.set(id.toString(), doc);
        return doc;
      });
      return created as any;
    });
  });

  describe('1. Spreadsheet Parsing & Header Auto-Detection Engine', () => {
    it('detects fuzzy column synonyms and separates valid vs invalid rows', () => {
      const sampleData = [
        {
          'Attendee Name': 'Rahul Sharma',
          'Contact Email': 'rahul@tech.com',
          'Mobile Number': '9876543210',
          Role: 'DELEGATE',
          College: 'IIT Bombay',
        },
        {
          'Attendee Name': 'Sneha Patel',
          'Contact Email': 'sneha@startup.io',
          'Mobile Number': '9123456789',
          Role: 'HACKER',
          College: 'BITS Pilani',
        },
        {
          'Attendee Name': '', // Invalid: missing name
          'Contact Email': 'anonymous@domain.com',
        },
        {
          'Attendee Name': 'Vikram Rao',
          'Contact Email': 'invalid-email-string', // Invalid email format
        },
      ];

      const worksheet = xlsx.utils.json_to_sheet(sampleData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendees');
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const preview = eventImportParserService.parseSpreadsheetBuffer(buffer);

      expect(preview.totalRows).toBe(4);
      expect(preview.validCount).toBe(2);
      expect(preview.invalidCount).toBe(2);
      expect(preview.detectedHeaders.name).toBe('Attendee Name');
      expect(preview.detectedHeaders.email).toBe('Contact Email');
      expect(preview.detectedHeaders.phone).toBe('Mobile Number');
      expect(preview.detectedHeaders.category).toBe('Role');
      expect(preview.detectedHeaders.organization).toBe('College');

      expect(preview.allValidRecords[0].name).toBe('Rahul Sharma');
      expect(preview.allValidRecords[0].email).toBe('rahul@tech.com');
      expect(preview.allValidRecords[0].category).toBe('DELEGATE');
      expect(preview.allValidRecords[0].organization).toBe('IIT Bombay');

      expect(preview.validationErrors.length).toBe(2);
      expect(preview.validationErrors[0].error).toMatch(/name is required/i);
      expect(preview.validationErrors[1].error).toMatch(/invalid email/i);
    });

    it('handles synchronous preview endpoint via HTTP', async () => {
      const sampleData = [{ 'Full Name': 'Pooja Iyer', Email: 'pooja@event.org' }];
      const worksheet = xlsx.utils.json_to_sheet(sampleData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64 = buffer.toString('base64');

      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/preview-import`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ fileBase64: base64 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.validCount).toBe(1);
      expect(res.body.data.sampleRows[0].name).toBe('Pooja Iyer');
    });
  });

  describe('2. Asynchronous Job Enqueuing (HTTP 202 Accepted)', () => {
    it('accepts and enqueues import job responding with 202 Accepted', async () => {
      const records = [
        { name: 'Dev User 1', email: 'dev1@example.com', rowNumber: 2 },
        { name: 'Dev User 2', email: 'dev2@example.com', rowNumber: 3 },
      ];

      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/import`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ records });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.progress.total).toBe(2);
    });

    it('coordinator can also enqueue import jobs', async () => {
      const records = [{ name: 'Coord Guest', rowNumber: 2 }];

      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/import`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ records });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('rejects empty records payload with 400 Validation Error', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/import`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ records: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('3. Background Worker Execution & Atomic Sequence Reservation', () => {
    it('processes import job and reserves monotonic sequence block without collisions', async () => {
      const records = [
        { name: 'Candidate A', email: 'a@hacker.io', category: 'DEV', rowNumber: 2 },
        { name: 'Candidate B', email: 'b@hacker.io', category: 'DEV', rowNumber: 3 },
        { name: 'Candidate C', email: 'c@hacker.io', category: 'DEV', rowNumber: 4 },
      ];

      const job = await eventJobQueueService.enqueueImportJob(
        testEventId.toString(),
        records,
        hostUser.id,
        'HOST'
      );

      // Execute background job directly
      await eventJobQueueService.executeJob(job._id.toString());

      const completed = mockJobs.get(job._id.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.progress.percentage).toBe(100);
      expect(completed.result.importedCount).toBe(3);

      expect(mongoEventCredentialRepository.allocateSequenceBlock).toHaveBeenCalledWith(
        testEventId.toString(),
        3
      );
      expect(mockCredentials.size).toBe(3);

      const credList = Array.from(mockCredentials.values());
      expect(credList[0].formattedId).toBe('HCK-00001');
      expect(credList[1].formattedId).toBe('HCK-00002');
      expect(credList[2].formattedId).toBe('HCK-00003');
    });
  });

  describe('4. Job Query, Status Tracking & Cancellation', () => {
    it('queries job status and tracks real-time progress', async () => {
      const job = await mongoEventJobRepository.createJob({
        eventId: testEventId,
        jobType: 'IMPORT_CREDENTIALS',
        status: 'PROCESSING',
        progress: { total: 100, processed: 50, succeeded: 50, failed: 0, percentage: 50 },
        createdBy: hostMongoId,
      });

      const res = await request(app)
        .get(`/api/events/${testEventId}/jobs/${job._id}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.progress.percentage).toBe(50);
      expect(res.body.data.status).toBe('PROCESSING');
    });

    it('cancels an in-progress or queued job', async () => {
      const job = await mongoEventJobRepository.createJob({
        eventId: testEventId,
        jobType: 'IMPORT_CREDENTIALS',
        status: 'QUEUED',
        progress: { total: 10, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        createdBy: hostMongoId,
      });

      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/${job._id}/cancel`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
    });
  });

  describe('5. Zero-Trust Staff RBAC Verification', () => {
    it('rejects volunteer without job management permissions with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/import`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ records: [{ name: 'Unauthorized Record', rowNumber: 2 }] });

      expect(res.status).toBe(403);
    });

    it('rejects outside attendee with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/import`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ records: [{ name: 'Outsider Record', rowNumber: 2 }] });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/import`)
        .send({ records: [{ name: 'Anonymous Record', rowNumber: 2 }] });

      expect(res.status).toBe(401);
    });
  });
});
