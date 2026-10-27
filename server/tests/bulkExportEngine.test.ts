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

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { mongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { mongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { supabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { eventExportService } from '../src/modules/events/services/event-export.service';
import { eventJobQueueService } from '../src/modules/events/services/event-job-queue.service';

import { createJwtToken } from '../src/utils/local-auth';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('Phase 16: Export Jobs Engine', () => {
  jest.setTimeout(30000);

  const hostUser = { id: 'host-auth-id-16', email: 'host16@event.com', role: 'HOST' };
  const coordinatorUser = { id: 'coord-auth-id-16', email: 'coord16@event.com', role: 'COORDINATOR' };
  const volunteerUser = { id: 'vol-auth-16', email: 'vol16@event.com', role: 'VOLUNTEER' };
  const outsiderUser = { id: 'outsider-16', email: 'outsider16@event.com', role: 'ATTENDEE' };

  const hostToken = createJwtToken({ id: hostUser.id, email: hostUser.email, role: 'USER' });
  const coordinatorToken = createJwtToken({ id: coordinatorUser.id, email: coordinatorUser.email, role: 'USER' });
  const volunteerToken = createJwtToken({ id: volunteerUser.id, email: volunteerUser.email, role: 'USER' });
  const outsiderToken = createJwtToken({ id: outsiderUser.id, email: outsiderUser.email, role: 'USER' });

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
      name: 'CloudConf 2026',
      eventType: 'CONFERENCE',
      credentialTerminology: 'Conference Badge',
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

    setMongoConnectedForTesting(true);

    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id || id === hostMongoId.toString()) return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host', platformRole: 'USER', status: 'ACTIVE' };
      if (id === coordinatorUser.id || id === coordinatorMongoId.toString()) return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, name: 'Coordinator', platformRole: 'USER', status: 'ACTIVE' };
      if (id === volunteerUser.id || id === volunteerMongoId.toString()) return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, name: 'Volunteer', platformRole: 'USER', status: 'ACTIVE' };
      if (id === outsiderUser.id || id === outsiderMongoId.toString()) return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider', platformRole: 'USER', status: 'ACTIVE' };
      return null;
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
      if (uId.toString() === coordinatorMongoId.toString() || uId.toString() === coordinatorUser.id) {
        return {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          userId: coordinatorMongoId,
          role: 'COORDINATOR',
          status: 'ACTIVE',
        };
      }
      if (uId.toString() === volunteerMongoId.toString() || uId.toString() === volunteerUser.id) {
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

    // Mock Event Job Repository
    jest.spyOn(mongoEventJobRepository, 'createJob').mockImplementation(async (data: any) => {
      const jobId = new mongoose.Types.ObjectId();
      const doc: any = {
        _id: jobId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockJobs.set(jobId.toString(), doc);
      return doc;
    });

    jest.spyOn(mongoEventJobRepository, 'findById').mockImplementation(async (id: string) => {
      return mockJobs.get(id) || null;
    });

    jest.spyOn(mongoEventJobRepository, 'findByEventId').mockImplementation(async () => {
      return Array.from(mockJobs.values());
    });

    jest.spyOn(mongoEventJobRepository, 'markStarted').mockImplementation(async (id: string) => {
      const job = mockJobs.get(id);
      if (job) {
        job.status = 'PROCESSING';
        job.startedAt = new Date();
      }
      return job;
    });

    jest.spyOn(mongoEventJobRepository, 'updateProgress').mockImplementation(async (id: string, progress: any) => {
      const job = mockJobs.get(id);
      if (job) {
        job.progress = { ...job.progress, ...progress };
      }
      return job;
    });

    jest.spyOn(mongoEventJobRepository, 'markCompleted').mockImplementation(async (id: string, result: any) => {
      const job = mockJobs.get(id);
      if (job) {
        job.status = 'COMPLETED';
        job.progress.percentage = 100;
        job.result = result;
        job.completedAt = new Date();
      }
      return job;
    });

    jest.spyOn(mongoEventJobRepository, 'markCancelled').mockImplementation(async (id: string) => {
      const job = mockJobs.get(id);
      if (job) {
        job.status = 'CANCELLED';
      }
      return job;
    });

    // Mock Sample Credentials
    const sampleCred1: any = {
      _id: new mongoose.Types.ObjectId(),
      eventId: testEventId,
      sequenceNumber: 1,
      formattedId: 'BDG-00001',
      verificationToken: 'token-64-character-string-alpha-beta-gamma-delta-epsilon-01',
      credentialType: 'CONFERENCE_BADGE',
      status: 'ACTIVE',
      usagePolicy: 'SINGLE_USE',
      checkInCount: 1,
      firstCheckedInAt: new Date('2026-10-10T09:00:00Z'),
      lastCheckedInAt: new Date('2026-10-10T09:00:00Z'),
      holder: {
        name: 'Sarah Connor',
        email: 'sarah@cyberdyne.com',
        phone: '+15550192',
        category: 'SPEAKER',
        organization: 'Cyberdyne',
      },
      asset: {
        storagePath: `events/${testEventId}/credentials/sarah-BDG-00001.png`,
      },
      issuedAt: new Date(),
    };

    const sampleCred2: any = {
      _id: new mongoose.Types.ObjectId(),
      eventId: testEventId,
      sequenceNumber: 2,
      formattedId: 'BDG-00002',
      verificationToken: 'token-64-character-string-alpha-beta-gamma-delta-epsilon-02',
      credentialType: 'CONFERENCE_BADGE',
      status: 'ACTIVE',
      usagePolicy: 'SINGLE_USE',
      checkInCount: 0,
      holder: {
        name: 'John Connor',
        email: 'john@resistance.org',
        category: 'DELEGATE',
        organization: 'TechResistance',
      },
      asset: {
        storagePath: `events/${testEventId}/credentials/john-BDG-00002.png`,
      },
      issuedAt: new Date(),
    };

    mockCredentials.set(sampleCred1._id.toString(), sampleCred1);
    mockCredentials.set(sampleCred2._id.toString(), sampleCred2);

    jest.spyOn(mongoEventCredentialRepository, 'findAllForExport').mockImplementation(async () => {
      return Array.from(mockCredentials.values());
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'findDefaultByEventId').mockResolvedValue(null);

    // Mock Supabase Storage operations
    jest.spyOn(supabaseStorageService, 'downloadTicketImage').mockImplementation(async () => {
      // Mock minimal 1x1 PNG buffer with valid magic header
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
    });

    jest.spyOn(supabaseStorageService, 'uploadExportFile').mockImplementation(async (eId: string, _buf: Buffer, filename: string) => {
      return {
        storagePath: `events/${eId}/exports/${filename}`,
        signedUrl: `https://mock-supabase.storage.co/events/${eId}/exports/${filename}?token=presigned123`,
        publicUrl: `https://mock-supabase.storage.co/events/${eId}/exports/${filename}`,
      };
    });
  });

  describe('1. Asynchronous Export Enqueuing (HTTP 202 Accepted)', () => {
    it('accepts and enqueues ZIP_PASSES export job responding with 202 Accepted', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/export`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          exportFormat: 'ZIP_PASSES',
          filters: { status: 'ACTIVE' },
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.jobType).toBe('EXPORT_CREDENTIALS');
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.payload.exportFormat).toBe('ZIP_PASSES');
    });

    it('coordinator can also enqueue export jobs', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/export`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          exportFormat: 'ROSTER_XLSX',
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payload.exportFormat).toBe('ROSTER_XLSX');
    });
  });

  describe('2. Background Worker Execution for ZIP Passes', () => {
    it('packages credential passes into a streaming ZIP and uploads with presigned URL', async () => {
      const job = await eventJobQueueService.enqueueExportJob(
        testEventId.toString(),
        { exportFormat: 'ZIP_PASSES' },
        hostUser.id,
        'HOST'
      );

      // Execute background processing directly
      await eventExportService.processExportJob(job);

      const completed = mockJobs.get(job._id.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.progress.percentage).toBe(100);
      expect(completed.result.exportedCount).toBe(2);
      expect(completed.result.downloadUrl).toContain('passes-');
      expect(completed.result.downloadUrl).toContain('presigned123');
      expect(completed.result.storagePath).toContain(`events/${testEventId}/exports/`);
      expect(completed.result.fileSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('3. Background Worker Execution for Attendee Roster (XLSX / CSV)', () => {
    it('generates an attendee roster spreadsheet and stores with presigned URL', async () => {
      const job = await eventJobQueueService.enqueueExportJob(
        testEventId.toString(),
        { exportFormat: 'ROSTER_XLSX' },
        hostUser.id,
        'HOST'
      );

      await eventExportService.processExportJob(job);

      const completed = mockJobs.get(job._id.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.progress.percentage).toBe(100);
      expect(completed.result.exportedCount).toBe(2);
      expect(completed.result.downloadUrl).toContain('roster-');
      expect(completed.result.storagePath).toContain('.xlsx');
      expect(completed.result.fileSizeBytes).toBeGreaterThan(0);
    });

    it('generates an attendee roster CSV file correctly', async () => {
      const job = await eventJobQueueService.enqueueExportJob(
        testEventId.toString(),
        { exportFormat: 'ROSTER_CSV' },
        hostUser.id,
        'HOST'
      );

      await eventExportService.processExportJob(job);

      const completed = mockJobs.get(job._id.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.result.exportedCount).toBe(2);
      expect(completed.result.storagePath).toContain('.csv');
    });
  });

  describe('4. Zero-Trust Staff RBAC Verification', () => {
    it('rejects volunteer without export permissions with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/export`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ exportFormat: 'ZIP_PASSES' });

      expect(res.status).toBe(403);
    });

    it('rejects outside attendee with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/export`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ exportFormat: 'ZIP_PASSES' });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated caller with 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/jobs/export`)
        .send({ exportFormat: 'ZIP_PASSES' });

      expect(res.status).toBe(401);
    });
  });
});
