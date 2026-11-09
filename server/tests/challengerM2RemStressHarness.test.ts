import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('CHALLENGER M2 REM 2: Empirical Error Handling & Resilience Stress Harness', () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const templateId = new mongoose.Types.ObjectId().toString();
  const callerUserId = new mongoose.Types.ObjectId().toString();

  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let templateRepo: MongoEventCredentialTemplateRepository;
  let eventRepo: MongoEventRepository;
  let renderingService: EventCredentialRenderingService;
  let storageService: SupabaseStorageService;
  let queueService: EventJobQueueService;

  let inMemoryJobs: Map<string, any>;

  const mockEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    name: 'Disaster Recovery & Error Resilience Summit 2026',
    eventType: 'CONFERENCE',
    status: 'PUBLISHED',
    credentialTerminology: 'Ticket',
    schedule: {
      startAt: new Date('2026-11-20T09:00:00Z'),
      endAt: new Date('2026-11-20T18:00:00Z'),
    },
    venue: {
      name: 'Resilience Center West',
    },
  };

  const mockTemplate = {
    _id: new mongoose.Types.ObjectId(templateId),
    eventId: new mongoose.Types.ObjectId(eventId),
    name: 'Resilience Template',
    isDefault: true,
    dimensions: { width: 1620, height: 2025 },
    fields: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);

    inMemoryJobs = new Map();

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

    jest.spyOn(eventRepo, 'findById').mockResolvedValue(mockEvent as any);
    jest.spyOn(templateRepo, 'findById').mockResolvedValue(mockTemplate as any);
    jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue(mockTemplate as any);

    jest.spyOn(queueService as any, 'authorizeHostOrCoordinator').mockResolvedValue({
      event: mockEvent,
      actorUser: { _id: new mongoose.Types.ObjectId(callerUserId), role: 'HOST' },
    });
  });

  describe('Requirement 1: Worker failure transitions job to FAILED when attempts exceed maxAttempts', () => {
    it('EMPIRICAL VERIFICATION: Job transitions through exponential retry backoffs and firmly transitions to FAILED upon reaching maxAttempts', async () => {
      // Setup job with maxAttempts = 3
      const jobId = new mongoose.Types.ObjectId().toString();
      const mockJob: any = {
        _id: new mongoose.Types.ObjectId(jobId),
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: (queueService as any).workerId,
        lockExpiresAt: new Date(Date.now() + 600000),
        attempts: 1,
        maxAttempts: 3,
        payload: { templateId },
        progress: { total: 10, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        result: { importedCount: 0, renderedCount: 0, errorLog: [] },
      };
      inMemoryJobs.set(jobId, mockJob);

      jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: string) => {
        return inMemoryJobs.get(id.toString()) || null;
      });

      const releaseSpy = jest.spyOn(jobRepo, 'releaseJobForRetry').mockImplementation(
        async (id: string, errMsg: string, delayMs: number = 5000, workerId?: string) => {
          const j = inMemoryJobs.get(id);
          if (!j) return null;
          j.status = 'QUEUED';
          j.lockedBy = null;
          j.lockExpiresAt = null;
          j.failureReason = errMsg;
          j.nextRunAt = new Date(Date.now() + delayMs);
          return j;
        }
      );

      const markFailedSpy = jest.spyOn(jobRepo, 'markFailed').mockImplementation(
        async (id: string, errMsg: string, partialResult?: any, workerId?: string) => {
          const j = inMemoryJobs.get(id);
          if (!j) return null;
          j.status = 'FAILED';
          j.lockedBy = null;
          j.lockExpiresAt = null;
          j.errorMessage = errMsg;
          j.failureReason = errMsg;
          j.failedAt = new Date();
          return j;
        }
      );

      // Force processBulkRenderJob to throw a fatal error
      jest.spyOn(queueService as any, 'processBulkRenderJob').mockRejectedValue(
        new Error('Storage quota exceeded: postgres://user:secretpass@db.internal:5432/ticket_db')
      );

      // Attempt 1 Failure
      await (queueService as any).executeClaimedJob(mockJob);
      expect(releaseSpy).toHaveBeenCalledTimes(1);
      expect(markFailedSpy).not.toHaveBeenCalled();
      expect(mockJob.status).toBe('QUEUED');
      expect(mockJob.failureReason).toContain('Storage quota exceeded');
      // Verify sensitive URL credential was sanitized
      expect(mockJob.failureReason).not.toContain('secretpass');

      // Prepare for Attempt 2
      mockJob.status = 'PROCESSING';
      mockJob.attempts = 2;
      mockJob.lockedBy = (queueService as any).workerId;
      mockJob.lockExpiresAt = new Date(Date.now() + 600000);

      // Attempt 2 Failure
      await (queueService as any).executeClaimedJob(mockJob);
      expect(releaseSpy).toHaveBeenCalledTimes(2);
      expect(markFailedSpy).not.toHaveBeenCalled();
      expect(mockJob.status).toBe('QUEUED');

      // Prepare for Attempt 3 (attempts reaches maxAttempts)
      mockJob.status = 'PROCESSING';
      mockJob.attempts = 3;
      mockJob.lockedBy = (queueService as any).workerId;
      mockJob.lockExpiresAt = new Date(Date.now() + 600000);

      // Attempt 3 Failure (attempts >= maxAttempts)
      await (queueService as any).executeClaimedJob(mockJob);

      // MUST NOT call releaseJobForRetry again; MUST call markFailed
      expect(releaseSpy).toHaveBeenCalledTimes(2);
      expect(markFailedSpy).toHaveBeenCalledTimes(1);
      expect(mockJob.status).toBe('FAILED');
      expect(mockJob.lockedBy).toBeNull();
      expect(mockJob.failedAt).toBeDefined();
    });
  });

  describe('Requirement 2: Database disconnects fall closed safely without crashing event loop', () => {
    it('EMPIRICAL VERIFICATION: Repository methods return safe closed states when DB is disconnected', async () => {
      // Disconnect mongoose mock
      const originalReadyState = mongoose.connection.readyState;
      try {
        Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

        // 1. findActiveJob returns null
        const active = await jobRepo.findActiveJob(eventId, 'BULK_RENDER_ASSETS');
        expect(active).toBeNull();

        // 2. claimNextAvailableJob returns null
        const next = await jobRepo.claimNextAvailableJob('worker-test-1');
        expect(next).toBeNull();

        // 3. recoverAbandonedJobs returns safe { recovered: 0, failed: 0 }
        const recovery = await jobRepo.recoverAbandonedJobs(true);
        expect(recovery).toEqual({ recovered: 0, failed: 0 });
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
      }
    });

    it('EMPIRICAL VERIFICATION: Worker background polling loop survives database disconnect and reconnect without unhandled rejections', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      let dbConnected = false;
      let jobExecuted = false;
      const fakeJobDoc: any = {
        _id: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: 3,
        payload: { templateId },
      };

      // Mock claimNextAvailableJob to simulate DB down, throwing error, and then recovering
      jest.spyOn(jobRepo, 'claimNextAvailableJob').mockImplementation(async () => {
        if (!dbConnected) {
          // Simulate driver throw when socket breaks
          throw new Error('MongoServerSelectionError: connection timed out');
        }
        if (!jobExecuted) {
          return fakeJobDoc;
        }
        return null;
      });

      const executeSpy = jest.spyOn(queueService as any, 'executeClaimedJob').mockImplementation(async () => {
        jobExecuted = true;
      });

      try {
        // Start worker with 20ms poll interval
        queueService.startWorker(20);

        // Wait 60ms with DB disconnected: ticks fail, catch block handles them, no unhandled rejection crashes process
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[JobQueueWorker] Worker tick error: MongoServerSelectionError: connection timed out')
        );

        // Reconnect DB
        dbConnected = true;

        // Wait 80ms with DB reconnected
        await new Promise((resolve) => setTimeout(resolve, 80));

        // Worker cleanly picked up job once DB recovered
        expect(executeSpy).toHaveBeenCalledWith(fakeJobDoc);
      } finally {
        // Stop worker cleanly
        await queueService.stopWorker();
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
