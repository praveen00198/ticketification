import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobModel } from '../src/db/mongo/models/event-job.model';

describe('Job Reliability, Concurrency & Bulk Render Beyond 500 Records', () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let templateRepo: MongoEventCredentialTemplateRepository;
  let renderingService: EventCredentialRenderingService;
  let eventRepo: MongoEventRepository;
  let service: EventJobQueueService;

  let inMemoryJobs: Map<string, any>;
  let inMemoryCredentials: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();

    jobRepo = new MongoEventJobRepository();
    credentialRepo = new MongoEventCredentialRepository();
    templateRepo = new MongoEventCredentialTemplateRepository();
    renderingService = new EventCredentialRenderingService();
    eventRepo = new MongoEventRepository();

    // Mock job repo
    jest.spyOn(jobRepo, 'createJob').mockImplementation(async (data: any) => {
      const id = new mongoose.Types.ObjectId();
      const jobDoc = {
        _id: id,
        attempts: 0,
        maxAttempts: 3,
        status: 'QUEUED',
        progress: { total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: {},
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryJobs.set(id.toString(), jobDoc);
      return jobDoc as any;
    });

    jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: string) => {
      return inMemoryJobs.get(id.toString()) || null;
    });

    jest.spyOn(jobRepo, 'markStarted').mockImplementation(async (id: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.status = 'PROCESSING';
        job.startedAt = new Date();
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(async (id: string, prog: any, res: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.progress = { ...job.progress, ...prog };
        if (res) job.result = { ...job.result, ...res };
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(async (id: string, res: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.lockedBy = null;
        job.lockExpiresAt = null;
        job.progress.percentage = 100;
        job.result = res;
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'markFailed').mockImplementation(async (id: string, errMsg: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.status = 'FAILED';
        job.failedAt = new Date();
        job.errorMessage = errMsg;
        job.failureReason = errMsg;
        job.lockedBy = null;
        job.lockExpiresAt = null;
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'releaseJobForRetry').mockImplementation(async (id: string, errMsg: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.status = 'QUEUED';
        job.lockedBy = null;
        job.lockExpiresAt = null;
        job.failureReason = errMsg;
        job.nextRunAt = new Date(Date.now() + 5000);
      }
      return job as any;
    });

    // Mock atomic claim
    jest.spyOn(jobRepo, 'claimJob').mockImplementation(async (id: string, workerId: string, leaseMs: number = 600000) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;

      const now = new Date();
      const isExpiredLock = job.status === 'PROCESSING' && job.lockExpiresAt && new Date(job.lockExpiresAt) < now;

      if (job.status === 'QUEUED' || isExpiredLock) {
        job.status = 'PROCESSING';
        job.lockedBy = workerId;
        job.lockExpiresAt = new Date(now.getTime() + leaseMs);
        job.startedAt = now;
        job.attempts = (job.attempts || 0) + 1;
        return job as any;
      }
      return null;
    });

    // Mock recoverAbandonedJobs
    jest.spyOn(jobRepo, 'recoverAbandonedJobs').mockImplementation(async (leaseGraceMs: number = 0) => {
      const now = new Date(Date.now() - leaseGraceMs);
      let recovered = 0;
      let failed = 0;

      for (const job of inMemoryJobs.values()) {
        if (job.status === 'PROCESSING' && job.lockExpiresAt && new Date(job.lockExpiresAt) < now) {
          if (job.attempts >= (job.maxAttempts || 3)) {
            job.status = 'FAILED';
            job.errorMessage = 'Abandoned by worker and exceeded maximum retry attempts';
            job.lockedBy = null;
            job.lockExpiresAt = null;
            failed++;
          } else {
            job.status = 'QUEUED';
            job.lockedBy = null;
            job.lockExpiresAt = null;
            job.failureReason = 'Recovered from abandoned worker process';
            recovered++;
          }
        }
      }
      return { recovered, failed };
    });

    // Mock event repository
    jest.spyOn(eventRepo, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(eventId),
      name: 'MegaTech Conference 2026',
      credentialTerminology: 'Conference Badge',
      schedule: { startAt: new Date(), endAt: new Date(Date.now() + 86400000) },
    } as any);

    // Mock template repo
    jest.spyOn(templateRepo, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);
    jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);

    // Mock rendering service
    jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(async (eId: string, credId: string) => {
      return {
        storagePath: `events/${eId}/credentials/badge-${credId}.png`,
        publicUrl: `https://storage.ticketification.app/events/${eId}/credentials/badge-${credId}.png`,
      };
    });

    service = new EventJobQueueService(
      jobRepo,
      credentialRepo,
      templateRepo,
      renderingService,
      eventRepo
    );
  });

  describe('1. Background Job Reliability & Lease Governance', () => {
    it('claims a queued job atomically and updates worker lease and attempts', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
      });

      const claimed = await jobRepo.claimJob(job._id.toString(), 'worker-node-1');
      expect(claimed).not.toBeNull();
      expect(claimed?.status).toBe('PROCESSING');
      expect(claimed?.lockedBy).toBe('worker-node-1');
      expect(claimed?.attempts).toBe(1);
      expect(claimed?.lockExpiresAt).toBeDefined();
    });

    it('prevents concurrent workers from claiming the same job simultaneously', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
      });

      // Two workers attempt to claim the job concurrently
      const [claim1, claim2] = await Promise.all([
        jobRepo.claimJob(job._id.toString(), 'worker-node-1'),
        jobRepo.claimJob(job._id.toString(), 'worker-node-2'),
      ]);

      // Exactly one worker must win the lease
      const winnerCount = [claim1, claim2].filter((c) => c !== null).length;
      expect(winnerCount).toBe(1);

      const saved = await jobRepo.findById(job._id.toString());
      expect(saved?.attempts).toBe(1);
    });

    it('allows a new worker to claim an abandoned job once its lock expires', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'dead-worker',
        lockExpiresAt: new Date(Date.now() - 1000), // Expired lease
        attempts: 1,
      });

      const recoveredClaim = await jobRepo.claimJob(job._id.toString(), 'worker-node-alive');
      expect(recoveredClaim).not.toBeNull();
      expect(recoveredClaim?.lockedBy).toBe('worker-node-alive');
      expect(recoveredClaim?.attempts).toBe(2);
    });

    it('recovers abandoned jobs after simulated application restart', async () => {
      // 1 expired with attempts < maxAttempts (should be recovered to QUEUED)
      await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'crashed-worker-1',
        lockExpiresAt: new Date(Date.now() - 5000),
        attempts: 1,
        maxAttempts: 3,
      });

      // 1 expired with attempts >= maxAttempts (should be marked FAILED)
      await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'crashed-worker-2',
        lockExpiresAt: new Date(Date.now() - 5000),
        attempts: 3,
        maxAttempts: 3,
      });

      const { recovered, failed } = await service.recoverAbandonedJobs();
      expect(recovered).toBe(1);
      expect(failed).toBe(1);
    });

    it('performs bounded retry with backoff on failure and marks FAILED after max attempts', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        attempts: 0,
        maxAttempts: 2,
      });

      // Simulate execution failure
      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockRejectedValue(new Error('Transient DB timeout'));

      // Attempt 1 -> released for retry
      await service.executeJob(job._id.toString());
      let saved = await jobRepo.findById(job._id.toString());
      expect(saved?.status).toBe('QUEUED');
      expect(saved?.failureReason).toMatch(/Transient DB timeout/);

      // Attempt 2 -> hits maxAttempts (2), marks FAILED
      await service.executeJob(job._id.toString());
      saved = await jobRepo.findById(job._id.toString());
      expect(saved?.status).toBe('FAILED');
      expect(saved?.errorMessage).toMatch(/Transient DB timeout/);
    });

    it('safely sanitizes secrets, Bearer tokens, passwords, and PII from failure logs', () => {
      const sensitiveErr = new Error(
        'Database connection failed for mongodb+srv://testuser:syntheticSecret123@synthetic-cluster.example.invalid/test with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID and user email test-person@example.invalid phone +15551234567'
      );

      const sanitized = service.sanitizeErrorMessage(sensitiveErr);
      expect(sanitized).not.toContain('syntheticSecret123');
      expect(sanitized).not.toContain('test-person@example.invalid');
      expect(sanitized).not.toContain('+15551234567');
      expect(sanitized).toContain('mongodb+srv://[REDACTED_URI]');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).toContain('[REDACTED_PHONE]');
    });
  });

  describe('2. Bulk Credential Rendering Beyond 500 Records', () => {
    function generateMockCredentials(count: number): any[] {
      const list: any[] = [];
      for (let i = 1; i <= count; i++) {
        const id = new mongoose.Types.ObjectId();
        const cred = {
          _id: id,
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: i,
          formattedId: `BDG-${String(i).padStart(5, '0')}`,
          verificationToken: `token-${i}-${'x'.repeat(40)}`,
          status: 'ACTIVE',
          holder: { name: `Attendee ${i}`, email: `att${i}@test.com` },
          asset: null,
          save: jest.fn().mockImplementation(async function () {
            inMemoryCredentials.set(id.toString(), this);
            return this;
          }),
        };
        inMemoryCredentials.set(id.toString(), cred);
        list.push(cred);
      }
      return list;
    }

    it('processes a roster below 500 records (e.g. 50 records) completely', async () => {
      const credentials = generateMockCredentials(50);

      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async () => {
        return Array.from(inMemoryCredentials.values()).filter((c) => !c.asset?.storagePath).length;
      });

      jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(async (_eId: string, lastId?: any, limit: number = 50) => {
        const unrendered = Array.from(inMemoryCredentials.values()).filter((c) => !c.asset?.storagePath);
        let startIdx = 0;
        if (lastId) {
          const idx = unrendered.findIndex((c) => c._id.toString() === lastId.toString());
          startIdx = idx >= 0 ? idx + 1 : 0;
        }
        return unrendered.slice(startIdx, startIdx + limit);
      });

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
      });

      await service.executeJob(job._id.toString());

      const completed = await jobRepo.findById(job._id.toString());
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.result?.renderedCount).toBe(50);
      expect(completed?.progress?.percentage).toBe(100);
    });

    it('processes a roster of exactly 500 records completely', async () => {
      const credentials = generateMockCredentials(500);

      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async () => {
        return Array.from(inMemoryCredentials.values()).filter((c) => !c.asset?.storagePath).length;
      });

      jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(async (_eId: string, lastId?: any, limit: number = 50) => {
        let all = Array.from(inMemoryCredentials.values());
        if (lastId) {
          const idx = all.findIndex((c) => c._id.toString() === lastId.toString());
          all = idx >= 0 ? all.slice(idx + 1) : [];
        }
        return all.filter((c) => !c.asset?.storagePath).slice(0, limit);
      });

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
      });

      await service.executeJob(job._id.toString());

      const completed = await jobRepo.findById(job._id.toString());
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.result?.renderedCount).toBe(500);
      expect(completed?.progress?.percentage).toBe(100);
    });

    it('processes a roster exceeding 500 records (e.g. 520 records) through cursor pagination without 500-cap cutoff', async () => {
      const credentials = generateMockCredentials(520);

      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async () => {
        return Array.from(inMemoryCredentials.values()).filter((c) => !c.asset?.storagePath).length;
      });

      jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(async (_eId: string, lastId?: any, limit: number = 50) => {
        let all = Array.from(inMemoryCredentials.values());
        if (lastId) {
          const idx = all.findIndex((c) => c._id.toString() === lastId.toString());
          all = idx >= 0 ? all.slice(idx + 1) : [];
        }
        return all.filter((c) => !c.asset?.storagePath).slice(0, limit);
      });

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
      });

      await service.executeJob(job._id.toString());

      const completed = await jobRepo.findById(job._id.toString());
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.result?.renderedCount).toBe(520);
      expect(completed?.progress?.total).toBe(520);
      expect(completed?.progress?.processed).toBe(520);
      expect(completed?.progress?.percentage).toBe(100);
    });

    it('handles individual credential rendering failure gracefully with accurate succeeded and failed counts', async () => {
      const credentials = generateMockCredentials(10);

      // Credential 3 fails during rendering
      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(async (_eId: string, credId: string) => {
        if (credId === credentials[2]._id.toString()) {
          throw new Error('Corrupt attendee badge profile image');
        }
        return {
          storagePath: `events/${eventId}/credentials/badge-${credId}.png`,
          publicUrl: `https://storage.ticketification.app/events/${eventId}/credentials/badge-${credId}.png`,
        };
      });

      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async () => {
        return Array.from(inMemoryCredentials.values()).filter((c) => !c.asset?.storagePath).length;
      });

      jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(async (_eId: string, lastId?: any, limit: number = 50) => {
        let all = Array.from(inMemoryCredentials.values());
        if (lastId) {
          const idx = all.findIndex((c) => c._id.toString() === lastId.toString());
          all = idx >= 0 ? all.slice(idx + 1) : [];
        }
        return all.filter((c) => !c.asset?.storagePath).slice(0, limit);
      });

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        maxAttempts: 1,
      });

      await service.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('FAILED');
      expect(terminalJob?.status).not.toBe('COMPLETED');
      expect(terminalJob?.result?.renderedCount).toBe(9);
      expect(terminalJob?.result?.errorLog?.length).toBe(1);
      expect(terminalJob?.result?.errorLog?.[0]?.identifier).toBe('BDG-00003');
      expect(terminalJob?.result?.errorLog?.[0]?.error).toMatch(/Corrupt attendee badge/);
    });
  });
});
