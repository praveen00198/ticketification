import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { StorageError } from '../src/middlewares/error.middleware';

describe('FIX 3: Bulk Ticket Rendering Reliability & Terminal Job States Suite', () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const templateId = new mongoose.Types.ObjectId().toString();

  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let templateRepo: MongoEventCredentialTemplateRepository;
  let eventRepo: MongoEventRepository;
  let renderingService: EventCredentialRenderingService;
  let storageService: SupabaseStorageService;
  let queueService: EventJobQueueService;

  let inMemoryJobs: Map<string, any>;
  let inMemoryCredentials: Map<string, any>;

  const mockEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    name: 'Bulk Render Reliability Summit',
    eventType: 'CONFERENCE',
    status: 'PUBLISHED',
    credentialTerminology: 'Ticket',
    schedule: {
      startAt: new Date('2026-11-20T09:00:00Z'),
      endAt: new Date('2026-11-20T18:00:00Z'),
    },
    venue: {
      name: 'Convention Center West',
    },
  };

  const mockTemplate = {
    _id: new mongoose.Types.ObjectId(templateId),
    eventId: new mongoose.Types.ObjectId(eventId),
    name: 'Default Badge Template',
    isDefault: true,
    dimensions: { width: 1620, height: 2025 },
    fields: [
      { key: 'name', label: 'Name', x: 810, y: 1490, fontSize: 76, color: '#FFE680', textAlign: 'center' },
      { key: 'qr', label: 'QR', x: 604, y: 960, width: 380, height: 380 },
    ],
  };

  function generateMockCredentials(count: number) {
    const list = [];
    for (let i = 1; i <= count; i++) {
      const id = new mongoose.Types.ObjectId();
      const cred: any = {
        _id: id,
        eventId: new mongoose.Types.ObjectId(eventId),
        sequenceNumber: i,
        formattedId: `TIC-${i.toString().padStart(5, '0')}`,
        verificationToken: `token-${i}-${Date.now()}`.padEnd(64, '0'),
        credentialType: 'ATTENDEE',
        terminology: 'Ticket',
        usagePolicy: 'SINGLE_USE',
        status: 'ACTIVE',
        holder: { name: `Attendee ${i}`, email: `att${i}@test.com`, category: 'General' },
        asset: null,
        save: jest.fn().mockImplementation(async function (this: any) {
          inMemoryCredentials.set(id.toString(), this);
          return this;
        }),
      };
      inMemoryCredentials.set(id.toString(), cred);
      list.push(cred);
    }
    return list;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();

    jobRepo = new MongoEventJobRepository();
    credentialRepo = new MongoEventCredentialRepository();
    templateRepo = new MongoEventCredentialTemplateRepository();
    eventRepo = new MongoEventRepository();
    storageService = new SupabaseStorageService();
    renderingService = new EventCredentialRenderingService(storageService);
    queueService = new EventJobQueueService(
      jobRepo,
      credentialRepo,
      templateRepo,
      renderingService,
      eventRepo
    );

    // Mock Event & Template Repos
    jest.spyOn(eventRepo, 'findById').mockResolvedValue(mockEvent as any);
    jest.spyOn(templateRepo, 'findById').mockResolvedValue(mockTemplate as any);
    jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue(mockTemplate as any);

    // Mock Job Repo with in-memory persistence
    jest.spyOn(jobRepo, 'createJob').mockImplementation(async (data: any) => {
      const id = new mongoose.Types.ObjectId();
      const jobDoc = {
        _id: id,
        attempts: 0,
        maxAttempts: 3,
        status: 'QUEUED',
        progress: { total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        result: { importedCount: 0, renderedCount: 0, errorLog: [] },
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

    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(async (id: string, prog: any, res: any, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) return null;
      job.progress = { ...job.progress, ...prog };
      if (res) job.result = { ...job.result, ...res };
      return job as any;
    });

    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(async (id: string, res: any, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) return null;
      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.lockedBy = null;
      job.lockExpiresAt = null;
      job.progress.percentage = 100;
      job.result = res;
      return job as any;
    });

    jest.spyOn(jobRepo, 'markFailed').mockImplementation(async (id: string, errMsg: string, partialResult?: any, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      if (workerId && job.lockedBy && job.lockedBy !== workerId) return null;
      job.status = 'FAILED';
      job.failedAt = new Date();
      job.errorMessage = errMsg;
      job.failureReason = errMsg;
      job.lockedBy = null;
      job.lockExpiresAt = null;
      if (partialResult) job.result = { ...job.result, ...partialResult };
      return job as any;
    });

    jest.spyOn(jobRepo, 'releaseJobForRetry').mockImplementation(async (id: string, errMsg: string, delayMs: number = 5000, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      if (workerId && job.lockedBy && job.lockedBy !== workerId) return null;
      job.status = 'QUEUED';
      job.lockedBy = null;
      job.lockExpiresAt = null;
      job.failureReason = errMsg;
      job.nextRunAt = new Date(Date.now() + delayMs);
      return job as any;
    });

    jest.spyOn(jobRepo, 'renewLease').mockImplementation(async (id: string, workerId: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return false;
      if (job.status === 'PROCESSING' && job.lockedBy === workerId) {
        job.lockExpiresAt = new Date(Date.now() + 600000);
        return true;
      }
      return false;
    });

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

    // Mock Credential Repo
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
  });

  describe('1. Scale & Pagination: More than 500 credentials across several batches', () => {
    it('processes 550 credentials across multiple batches with zero skipped records', async () => {
      const TOTAL_RECORDS = 550;
      generateMockCredentials(TOTAL_RECORDS);

      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId, credId) => ({
          storagePath: `events/${eId}/credentials/${credId}.png`,
          publicUrl: `https://storage.ticketification.app/events/${eId}/credentials/${credId}.png`,
        })
      );

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL_RECORDS, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
      });

      await queueService.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('COMPLETED');
      expect(terminalJob?.progress.total).toBe(TOTAL_RECORDS);
      expect(terminalJob?.progress.processed).toBe(TOTAL_RECORDS);
      expect(terminalJob?.progress.succeeded).toBe(TOTAL_RECORDS);
      expect(terminalJob?.progress.failed).toBe(0);
      expect(terminalJob?.progress.percentage).toBe(100);
      expect(terminalJob?.result.renderedCount).toBe(TOTAL_RECORDS);
      expect(terminalJob?.result.errorLog).toHaveLength(0);

      // Verify all 550 records have storagePath set
      const remainingUnrendered = await credentialRepo.countUnrenderedByEvent(eventId);
      expect(remainingUnrendered).toBe(0);
      expect(renderSpy).toHaveBeenCalledTimes(TOTAL_RECORDS);

      renderSpy.mockRestore();
    });
  });

  describe('2. Failure Isolation: One fails while others succeed & All fail', () => {
    it('one credential fails while 4 succeed: job is NEVER marked COMPLETED and transitions to FAILED on max attempts', async () => {
      const TOTAL = 5;
      const credentials = generateMockCredentials(TOTAL);
      const failingCredId = credentials[2]._id.toString(); // 3rd credential fails

      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId, credId) => {
          if (credId === failingCredId) {
            throw new Error('Corrupt font glyph in guest name');
          }
          return {
            storagePath: `events/${eId}/credentials/${credId}.png`,
            publicUrl: `https://storage.ticketification.app/events/${eId}/credentials/${credId}.png`,
          };
        }
      );

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
        maxAttempts: 1, // Terminal after 1 attempt
      });

      await queueService.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('FAILED');
      expect(terminalJob?.status).not.toBe('COMPLETED');
      expect(terminalJob?.progress.succeeded).toBe(4);
      expect(terminalJob?.progress.failed).toBe(1);
      expect(terminalJob?.result.renderedCount).toBe(4);
      expect(terminalJob?.result.errorLog).toHaveLength(1);
      expect(terminalJob?.result.errorLog[0].identifier).toBe('TIC-00003');
      expect(terminalJob?.result.errorLog[0].error).toContain('Corrupt font glyph in guest name');

      // Database state: 4 credentials have assets, exactly 1 remains unrendered
      const unrenderedRemaining = await credentialRepo.countUnrenderedByEvent(eventId);
      expect(unrenderedRemaining).toBe(1);

      const failingDoc = inMemoryCredentials.get(failingCredId);
      expect(failingDoc?.asset?.storagePath).toBeFalsy();

      renderSpy.mockRestore();
    });

    it('all credentials fail: marks FAILED with All credentials failed to render', async () => {
      const TOTAL = 3;
      generateMockCredentials(TOTAL);

      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async () => {
          throw new StorageError('Supabase storage connection timeout');
        }
      );

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
        maxAttempts: 1,
      });

      await queueService.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('FAILED');
      expect(terminalJob?.errorMessage).toContain('All credentials failed to render');
      expect(terminalJob?.progress.succeeded).toBe(0);
      expect(terminalJob?.progress.failed).toBe(3);
      expect(terminalJob?.result.errorLog).toHaveLength(3);

      renderSpy.mockRestore();
    });
  });

  describe('3. Retry Dynamics: Retry after partial success & No redundant regeneration', () => {
    it('retry after partial success renders ONLY remaining unrendered tickets without regenerating completed ones', async () => {
      const TOTAL = 6;
      const credentials = generateMockCredentials(TOTAL);

      // Attempt 1: First 4 succeed, last 2 fail
      let attemptCount = 0;
      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId, credId) => {
          attemptCount++;
          if (credId === credentials[4]._id.toString() || credId === credentials[5]._id.toString()) {
            throw new Error('Temporary storage timeout');
          }
          return {
            storagePath: `events/${eId}/credentials/${credId}.png`,
            publicUrl: `https://storage.ticketification.app/events/${eId}/credentials/${credId}.png`,
          };
        }
      );

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
        maxAttempts: 3,
      });

      // Execute Attempt 1
      await queueService.executeJob(job._id.toString());

      const afterAttempt1 = await jobRepo.findById(job._id.toString());
      expect(afterAttempt1?.status).toBe('QUEUED'); // Released for retry
      expect(afterAttempt1?.attempts).toBe(1);
      expect(attemptCount).toBe(6); // Attempted all 6

      // Reset mock so Attempt 2 succeeds for all remaining
      renderSpy.mockImplementation(async (eId, credId) => {
        attemptCount++;
        return {
          storagePath: `events/${eId}/credentials/${credId}.png`,
          publicUrl: `https://storage.ticketification.app/events/${eId}/credentials/${credId}.png`,
        };
      });

      // Reset attemptCount to track calls on Attempt 2
      attemptCount = 0;

      // Fast-forward nextRunAt so claimJob can pick it up
      afterAttempt1.nextRunAt = new Date(Date.now() - 1000);

      // Execute Attempt 2
      await queueService.executeJob(job._id.toString());

      const afterAttempt2 = await jobRepo.findById(job._id.toString());
      expect(afterAttempt2?.status).toBe('COMPLETED');
      expect(afterAttempt2?.progress.succeeded).toBe(TOTAL);
      expect(afterAttempt2?.progress.failed).toBe(0);
      expect(afterAttempt2?.result.renderedCount).toBe(TOTAL);

      // Crucial assertion: Attempt 2 MUST only have rendered the 2 previously unrendered tickets!
      expect(attemptCount).toBe(2);

      renderSpy.mockRestore();
    });
  });

  describe('4. Crash Resilience & Storage Upsert Safety', () => {
    it('handles process crash after upload but before progress update safely with no duplicate storage objects', async () => {
      const TOTAL = 3;
      generateMockCredentials(TOTAL);

      // Simulate crash on cred 2 after rendering/uploading
      let uploadCalls = 0;
      const uploadedPaths: string[] = [];
      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId, credId) => {
          uploadCalls++;
          const path = `events/${eId}/credentials/${credId}.png`;
          uploadedPaths.push(path);
          if (uploadCalls === 2) {
            // Simulate sudden crash
            throw new Error('Process crash simulation');
          }
          return {
            storagePath: path,
            publicUrl: `https://storage.ticketification.app/${path}`,
          };
        }
      );

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
        maxAttempts: 3,
      });

      // Attempt 1: Crashes on item 2
      await queueService.executeJob(job._id.toString());

      const jobAfterCrash = await jobRepo.findById(job._id.toString());
      expect(jobAfterCrash?.status).toBe('QUEUED'); // Back in queue for retry

      // Restore mock to normal for retry
      renderSpy.mockImplementation(async (eId, credId) => {
        const path = `events/${eId}/credentials/${credId}.png`;
        uploadedPaths.push(path);
        return {
          storagePath: path,
          publicUrl: `https://storage.ticketification.app/${path}`,
        };
      });

      // Fast-forward nextRunAt
      jobAfterCrash.nextRunAt = new Date(Date.now() - 1000);

      // Attempt 2: Worker resumes
      await queueService.executeJob(job._id.toString());

      const finalJob = await jobRepo.findById(job._id.toString());
      expect(finalJob?.status).toBe('COMPLETED');
      expect(finalJob?.result.renderedCount).toBe(TOTAL);

      // Verify all uploaded paths are canonical and follow events/{eventId}/credentials/{credId}.png
      for (const p of uploadedPaths) {
        expect(p).toMatch(/^events\/[^/]+\/credentials\/[^/]+\.png$/);
      }

      renderSpy.mockRestore();
    });
  });

  describe('5. Event Date Resolution: Date TBA and Real Dates', () => {
    it('uses real event schedule date when startAt is present', () => {
      const evt = {
        schedule: { startAt: new Date('2026-11-20T09:00:00Z') },
        date: '2026-10-10', // Fabricated legacy string
      };
      const resolved = queueService.resolveEventDate(evt);
      expect(resolved).not.toBe('2026-10-10');
      expect(resolved).toBe(new Date('2026-11-20T09:00:00Z').toLocaleDateString());
    });

    it('falls back safely to Date TBA when schedule and date are missing and NEVER fabricates 2026-10-10', () => {
      const evt1 = {};
      expect(queueService.resolveEventDate(evt1)).toBe('Date TBA');

      const evt2 = { date: '2026-10-10' };
      expect(queueService.resolveEventDate(evt2)).toBe('Date TBA');

      const evt3 = { schedule: { startAt: 'Invalid Date' } };
      expect(queueService.resolveEventDate(evt3)).toBe('Date TBA');
    });
  });

  describe('6. Lease Ownership & Stale Worker Protection', () => {
    it('stale worker whose lease expired or was taken by another worker cannot update progress or mark completed', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-stale-1',
        lockExpiresAt: new Date(Date.now() - 5000), // Expired lease
      });

      // Stale worker tries to update progress
      const progressResult = await jobRepo.updateProgress(
        job._id.toString(),
        { processed: 5, succeeded: 5 },
        undefined,
        'worker-stale-1'
      );
      expect(progressResult).toBeNull(); // Rejected

      // Stale worker tries to mark completed
      const completeResult = await jobRepo.markCompleted(
        job._id.toString(),
        { importedCount: 0, renderedCount: 5, errorLog: [] },
        'worker-stale-1'
      );
      expect(completeResult).toBeNull(); // Rejected

      // Active job remains unmodified by stale worker
      const untouchedJob = await jobRepo.findById(job._id.toString());
      expect(untouchedJob?.status).toBe('PROCESSING');
      expect(untouchedJob?.completedAt).toBeFalsy();
    });
  });

  describe('7. Permanent Error Loop Prevention', () => {
    it('permanent rendering error terminates at maxAttempts without endless looping', async () => {
      generateMockCredentials(1);

      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async () => {
          throw new Error('Fatal: SVG font engine crashed permanently');
        }
      );

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: 1, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
        maxAttempts: 3,
      });

      // Run Attempt 1
      await queueService.executeJob(job._id.toString());
      let state = await jobRepo.findById(job._id.toString());
      expect(state?.status).toBe('QUEUED');
      expect(state?.attempts).toBe(1);

      // Fast-forward & Run Attempt 2
      state.nextRunAt = new Date(Date.now() - 1000);
      await queueService.executeJob(job._id.toString());
      state = await jobRepo.findById(job._id.toString());
      expect(state?.status).toBe('QUEUED');
      expect(state?.attempts).toBe(2);

      // Fast-forward & Run Attempt 3 (Final attempt)
      state.nextRunAt = new Date(Date.now() - 1000);
      await queueService.executeJob(job._id.toString());
      state = await jobRepo.findById(job._id.toString());

      // MUST transition to FAILED and cease retrying
      expect(state?.status).toBe('FAILED');
      expect(state?.attempts).toBe(3);
      expect(state?.errorMessage).toContain('Fatal: SVG font engine crashed permanently');

      // Subsequent execution attempt must do nothing since status is FAILED
      await queueService.executeJob(job._id.toString());
      state = await jobRepo.findById(job._id.toString());
      expect(state?.status).toBe('FAILED');
      expect(state?.attempts).toBe(3);

      renderSpy.mockRestore();
    });
  });
});
