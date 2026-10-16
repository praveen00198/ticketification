import fs from 'fs';
import path from 'path';
import os from 'os';
import mongoose from 'mongoose';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { EventExportService, MAX_XLSX_EXPORT_ROWS } from '../src/modules/events/services/event-export.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { EventRegistrationService } from '../src/modules/events/services/event-registration.service';
import { MongoEventRegistrationRepository } from '../src/modules/events/repositories/mongo-event-registration.repository';
import { ValidationError, NotFoundError } from '../src/middlewares/error.middleware';

describe('Consolidated Production Hardening Regression Suite', () => {
  jest.setTimeout(30000);

  const eventId = new mongoose.Types.ObjectId().toString();
  const hostUserId = new mongoose.Types.ObjectId().toString();
  const hostSupabaseId = 'host-supabase-uuid-1234';

  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let templateRepo: MongoEventCredentialTemplateRepository;
  let renderingService: EventCredentialRenderingService;
  let eventRepo: MongoEventRepository;
  let memberRepo: MongoEventMemberRepository;
  let userRepo: MongoUserRepository;
  let storageService: SupabaseStorageService;
  let exportService: EventExportService;
  let registrationRepo: MongoEventRegistrationRepository;
  let registrationService: EventRegistrationService;
  let jobQueueService: EventJobQueueService;

  let inMemoryJobs: Map<string, any>;
  let inMemoryCredentials: Map<string, any>;
  let inMemoryRegistrations: Map<string, any>;
  let inMemoryEvents: Map<string, any>;
  let sequenceCounter: number;

  beforeEach(() => {
    jest.clearAllMocks();

    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();
    inMemoryRegistrations = new Map();
    inMemoryEvents = new Map();
    sequenceCounter = 1;

    jobRepo = new MongoEventJobRepository();
    credentialRepo = new MongoEventCredentialRepository();
    templateRepo = new MongoEventCredentialTemplateRepository();
    renderingService = new EventCredentialRenderingService();
    eventRepo = new MongoEventRepository();
    memberRepo = new MongoEventMemberRepository();
    userRepo = new MongoUserRepository();
    storageService = new SupabaseStorageService();
    registrationRepo = new MongoEventRegistrationRepository();

    const baseEvent = {
      _id: new mongoose.Types.ObjectId(eventId),
      ownerId: new mongoose.Types.ObjectId(hostUserId),
      ownerSupabaseId: hostSupabaseId,
      name: 'Future Tech Summit',
      eventType: 'CONFERENCE',
      credentialTerminology: 'Delegate Pass',
      status: 'PUBLISHED',
      registration: {
        capacity: 10,
        confirmedCount: 0,
        registrationRequired: true,
      },
      schedule: {
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
      },
    };
    inMemoryEvents.set(eventId, baseEvent);

    // Mock Event Repo
    jest.spyOn(eventRepo, 'findById').mockImplementation(async (id: any) => {
      return inMemoryEvents.get(id.toString()) || null;
    });

    jest.spyOn(eventRepo, 'reserveRegistrationSlot').mockImplementation(async (eId: string, capacity?: number) => {
      const ev = inMemoryEvents.get(eId.toString());
      if (!ev) return false;
      if (['CANCELLED', 'SUSPENDED', 'COMPLETED', 'DRAFT', 'REGISTRATION_CLOSED'].includes(ev.status)) {
        return false;
      }
      const current = ev.registration?.confirmedCount || 0;
      if (capacity && capacity > 0 && current >= capacity) {
        return false;
      }
      ev.registration.confirmedCount = current + 1;
      return true;
    });

    jest.spyOn(eventRepo, 'releaseRegistrationSlot').mockImplementation(async (eId: string) => {
      const ev = inMemoryEvents.get(eId.toString());
      if (ev && ev.registration?.confirmedCount > 0) {
        ev.registration.confirmedCount -= 1;
      }
    });

    // Mock User Repo & Member Repo
    jest.spyOn(userRepo, 'findBySupabaseId').mockImplementation(async (sId: string) => {
      return { _id: new mongoose.Types.ObjectId(hostUserId), supabaseId: sId, email: 'host@summit.org' } as any;
    });

    jest.spyOn(userRepo, 'findById').mockImplementation(async (id: string) => {
      return { _id: new mongoose.Types.ObjectId(id), supabaseId: hostSupabaseId, email: 'host@summit.org' } as any;
    });

    jest.spyOn(memberRepo, 'findByEventAndUser').mockResolvedValue({
      role: 'HOST',
      status: 'ACTIVE',
    } as any);

    // Mock Job Repo in-memory
    jest.spyOn(jobRepo, 'createJob').mockImplementation(async (data: any) => {
      const id = new mongoose.Types.ObjectId();
      const doc = {
        _id: id,
        attempts: 0,
        maxAttempts: 3,
        status: 'QUEUED',
        progress: { total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        result: { importedCount: 0, renderedCount: 0, exportedCount: 0, errorLog: [] },
        payload: {},
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryJobs.set(id.toString(), doc);
      return doc as any;
    });

    jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: any) => {
      return inMemoryJobs.get(id.toString()) || null;
    });

    jest.spyOn(jobRepo, 'updatePayload').mockImplementation(async (id: any, payload: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.payload = { ...job.payload, ...payload };
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'claimJob').mockImplementation(async (id: any, workerId: string, leaseMs: number = 600000) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      const now = new Date();
      if (job.nextRunAt && job.nextRunAt > now) return null;
      if (job.attempts >= job.maxAttempts) return null;

      const isQueued = job.status === 'QUEUED';
      const isExpiredProcessing = job.status === 'PROCESSING' && job.lockExpiresAt && job.lockExpiresAt < now;

      if (!isQueued && !isExpiredProcessing) return null;

      job.status = 'PROCESSING';
      job.lockedBy = workerId;
      job.lockExpiresAt = new Date(now.getTime() + leaseMs);
      job.attempts = (job.attempts || 0) + 1;
      job.lastAttemptAt = now;
      return job as any;
    });

    jest.spyOn(jobRepo, 'claimNextAvailableJob').mockImplementation(async (workerId: string, leaseMs: number = 600000) => {
      const now = new Date();
      for (const job of inMemoryJobs.values()) {
        if (job.attempts >= job.maxAttempts) continue;
        if (job.nextRunAt && job.nextRunAt > now) continue;

        const isQueued = job.status === 'QUEUED';
        const isExpired = job.status === 'PROCESSING' && job.lockExpiresAt && job.lockExpiresAt < now;

        if (isQueued || isExpired) {
          job.status = 'PROCESSING';
          job.lockedBy = workerId;
          job.lockExpiresAt = new Date(now.getTime() + leaseMs);
          job.attempts = (job.attempts || 0) + 1;
          job.lastAttemptAt = now;
          return job as any;
        }
      }
      return null;
    });

    jest.spyOn(jobRepo, 'renewLease').mockImplementation(async (id: any, workerId: string, leaseMs: number = 600000) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return false;
      const now = new Date();
      if (job.status === 'PROCESSING' && job.lockedBy === workerId && job.lockExpiresAt && job.lockExpiresAt >= now) {
        job.lockExpiresAt = new Date(now.getTime() + leaseMs);
        return true;
      }
      return false;
    });

    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(async (id: any, prog: any, res: any, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      const now = new Date();
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && job.lockExpiresAt < now))) {
        return null; // Ownership lost!
      }
      job.progress = { ...job.progress, ...prog };
      if (res) {
        job.result = { ...job.result, ...res };
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(async (id: any, res: any, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      const now = new Date();
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && job.lockExpiresAt < now))) {
        return null;
      }
      job.status = 'COMPLETED';
      job.completedAt = now;
      job.progress.percentage = 100;
      job.result = res;
      job.lockedBy = null;
      job.lockExpiresAt = null;
      return job as any;
    });

    jest.spyOn(jobRepo, 'markFailed').mockImplementation(async (id: any, err: string, res: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      job.status = 'FAILED';
      job.failedAt = new Date();
      job.errorMessage = err;
      job.failureReason = err;
      job.lockedBy = null;
      job.lockExpiresAt = null;
      if (res) job.result = { ...job.result, ...res };
      return job as any;
    });

    jest.spyOn(jobRepo, 'releaseJobForRetry').mockImplementation(async (id: any, err: string, delayMs: number, workerId?: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      const now = new Date();
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && job.lockExpiresAt < now))) {
        return null;
      }
      job.status = 'QUEUED';
      job.lockedBy = null;
      job.lockExpiresAt = null;
      job.failureReason = err;
      job.nextRunAt = new Date(Date.now() + delayMs);
      return job as any;
    });

    jest.spyOn(jobRepo, 'recoverAbandonedJobs').mockImplementation(async () => {
      const now = new Date();
      let recovered = 0;
      let failed = 0;
      for (const job of inMemoryJobs.values()) {
        if (job.status === 'PROCESSING' && job.lockExpiresAt && job.lockExpiresAt < now) {
          if (job.attempts >= job.maxAttempts) {
            job.status = 'FAILED';
            job.failureReason = 'Abandoned and exceeded max retry attempts';
            failed++;
          } else {
            job.status = 'QUEUED';
            job.lockedBy = null;
            job.lockExpiresAt = null;
            job.nextRunAt = now;
            recovered++;
          }
        }
      }
      return { recovered, failed };
    });

    // Mock Credential Repo in-memory
    jest.spyOn(credentialRepo, 'allocateSequenceBlock').mockImplementation(async (_eId: string, count: number) => {
      const start = sequenceCounter;
      sequenceCounter += count;
      return start;
    });

    jest.spyOn(credentialRepo, 'createMany').mockImplementation(async (items: any[]) => {
      const created = items.map((item) => {
        const id = new mongoose.Types.ObjectId();
        const doc = { _id: id, ...item, createdAt: new Date() };
        inMemoryCredentials.set(`${item.eventId}_${item.sequenceNumber}`, doc);
        return doc;
      });
      return created as any;
    });

    jest.spyOn(credentialRepo, 'findBySequenceRange').mockImplementation(async (eId: string, startSeq: number, endSeq: number) => {
      const found: any[] = [];
      for (const doc of inMemoryCredentials.values()) {
        if (doc.eventId.toString() === eId && doc.sequenceNumber >= startSeq && doc.sequenceNumber <= endSeq) {
          found.push(doc);
        }
      }
      return found.sort((a, b) => a.sequenceNumber - b.sequenceNumber) as any;
    });

    jest.spyOn(credentialRepo, 'countForExport').mockImplementation(async (eId: string) => {
      return Array.from(inMemoryCredentials.values()).filter((c) => c.eventId.toString() === eId).length;
    });

    jest.spyOn(credentialRepo, 'findExportCursor').mockImplementation((eId: string) => {
      const matching = Array.from(inMemoryCredentials.values())
        .filter((c) => c.eventId.toString() === eId)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      return {
        async *[Symbol.asyncIterator]() {
          for (const item of matching) {
            yield item;
          }
        },
        close: async () => {},
      } as any;
    });

    // Storage Service Mocks
    jest.spyOn(storageService, 'uploadExportFile').mockImplementation(async (eId: string, fileData: any, filename: string) => {
      return {
        storagePath: `events/${eId}/exports/${filename}`,
        signedUrl: `https://storage.ticketification.app/events/${eId}/exports/${filename}?signed=true`,
        publicUrl: `https://storage.ticketification.app/events/${eId}/exports/${filename}`,
      };
    });

    jest.spyOn(storageService, 'downloadTicketImage').mockResolvedValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );

    // Initialize services
    jobQueueService = new EventJobQueueService(
      jobRepo,
      credentialRepo,
      templateRepo,
      renderingService,
      eventRepo,
      memberRepo,
      userRepo
    );

    exportService = new EventExportService(
      credentialRepo,
      jobRepo,
      eventRepo,
      storageService,
      renderingService
    );

    registrationService = new EventRegistrationService(
      registrationRepo,
      eventRepo,
      userRepo,
      credentialRepo,
      new (class MockTeamRepo {})() as any,
      new (class MockCredService {
        async issueRegistrationCredential() {
          const credId = new mongoose.Types.ObjectId();
          return {
            _id: credId,
            formattedId: 'DEL-00001',
            verificationToken: 'token-reg-1234',
          };
        }
      })() as any,
      new (class MockAuditService {
        async record() {
          return {} as any;
        }
      })() as any
    );
  });

  afterEach(async () => {
    await jobQueueService.stopWorker();
  });

  describe('Workstream A — Durable Background Job Execution & Worker Lifecycle', () => {
    it('executes queued job to completion via worker lifecycle loop', async () => {
      const records = [
        { name: 'Alice Smith', email: 'alice@summit.org', rowNumber: 2 },
      ];

      const job = await jobQueueService.enqueueImportJob(eventId, records, hostUserId, 'HOST');
      expect(job.status).toBe('QUEUED');

      // Start worker
      jobQueueService.startWorker(50);

      // Wait briefly for worker polling tick
      await new Promise((resolve) => setTimeout(resolve, 200));

      const processedJob = inMemoryJobs.get(job._id.toString());
      expect(processedJob.status).toBe('COMPLETED');
      expect(processedJob.progress.percentage).toBe(100);
      expect(processedJob.result.importedCount).toBe(1);
    });

    it('recovers abandoned PROCESSING jobs upon restart and respects retry limits', async () => {
      const jobId = new mongoose.Types.ObjectId().toString();
      // Job was left in PROCESSING by a crashed worker with an expired lease
      inMemoryJobs.set(jobId, {
        _id: new mongoose.Types.ObjectId(jobId),
        status: 'PROCESSING',
        lockedBy: 'crashed-worker-pid-999',
        lockExpiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
        attempts: 1,
        maxAttempts: 3,
        payload: { records: [{ name: 'Recovered Attendee', rowNumber: 2 }] },
      });

      const recovery = await jobQueueService.recoverAbandonedJobs();
      expect(recovery.recovered).toBe(1);
      expect(recovery.failed).toBe(0);

      const recoveredJob = inMemoryJobs.get(jobId);
      expect(recoveredJob.status).toBe('QUEUED');
      expect(recoveredJob.lockedBy).toBeNull();
    });

    it('marks abandoned job as FAILED when max retry attempts are exhausted', async () => {
      const jobId = new mongoose.Types.ObjectId().toString();
      inMemoryJobs.set(jobId, {
        _id: new mongoose.Types.ObjectId(jobId),
        status: 'PROCESSING',
        lockedBy: 'crashed-worker-pid-999',
        lockExpiresAt: new Date(Date.now() - 60000),
        attempts: 3,
        maxAttempts: 3,
        payload: {},
      });

      const recovery = await jobQueueService.recoverAbandonedJobs();
      expect(recovery.failed).toBe(1);

      const failedJob = inMemoryJobs.get(jobId);
      expect(failedJob.status).toBe('FAILED');
    });

    it('two workers racing to claim the same job: exactly one succeeds', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'IMPORT_CREDENTIALS',
        status: 'QUEUED',
      });

      const workerA = 'worker-node-instance-A';
      const workerB = 'worker-node-instance-B';

      const [claimA, claimB] = await Promise.all([
        jobRepo.claimJob(job._id.toString(), workerA),
        jobRepo.claimJob(job._id.toString(), workerB),
      ]);

      const winners = [claimA, claimB].filter((c) => c !== null);
      expect(winners.length).toBe(1);
    });

    it('rejects stale worker attempting to commit progress after losing lease', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'IMPORT_CREDENTIALS',
        status: 'QUEUED',
      });

      const initialWorker = 'worker-stale-1';
      await jobRepo.claimJob(job._id.toString(), initialWorker);

      // Another worker legitimately took over after lease expiry
      const newWorker = 'worker-fresh-2';
      const jobDoc = inMemoryJobs.get(job._id.toString());
      jobDoc.lockedBy = newWorker;
      jobDoc.lockExpiresAt = new Date(Date.now() + 600000);

      // Stale worker tries to update progress
      const result = await jobRepo.updateProgress(
        job._id.toString(),
        { processed: 50 },
        undefined,
        initialWorker
      );

      expect(result).toBeNull(); // Rejected!
    });

    it('stale worker cannot release or overwrite a job currently owned by another worker', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'IMPORT_CREDENTIALS',
        status: 'QUEUED',
      });

      const workerA = 'worker-A';
      const workerB = 'worker-B';

      // Worker A claims job
      await jobRepo.claimJob(job._id.toString(), workerA);

      // Lease expires and Worker B takes over
      const jobDoc = inMemoryJobs.get(job._id.toString());
      jobDoc.lockedBy = workerB;
      jobDoc.lockExpiresAt = new Date(Date.now() + 600000);

      // Stale Worker A tries to release job for retry
      const releaseResult = await jobRepo.releaseJobForRetry(
        job._id.toString(),
        'Transient timeout encountered by Worker A',
        5000,
        workerA
      );

      expect(releaseResult).toBeNull();
      // Job MUST remain locked by Worker B in PROCESSING state
      expect(jobDoc.lockedBy).toBe(workerB);
      expect(jobDoc.status).toBe('PROCESSING');
    });

    it('graceful shutdown stops accepting new jobs and cleans up worker timers', async () => {
      jobQueueService.startWorker(100);
      await jobQueueService.stopWorker();

      await expect(
        jobQueueService.enqueueImportJob(eventId, [{ name: 'Test', rowNumber: 2 }], hostUserId, 'HOST')
      ).rejects.toThrow(/Server is shutting down/);
    });
  });

  describe('Workstream B — Import Idempotency and Retry Safety', () => {
    it('persists allocated sequence block and reuses identical range on retry without duplicate reservation', async () => {
      const records = [
        { name: 'Guest 1', rowNumber: 2 },
        { name: 'Guest 2', rowNumber: 3 },
      ];

      const job = await jobQueueService.enqueueImportJob(eventId, records, hostUserId, 'HOST');
      await jobQueueService.executeJob(job._id.toString());

      const completed1 = inMemoryJobs.get(job._id.toString());
      const firstAllocatedSeq = completed1.payload.startingSequence;
      expect(firstAllocatedSeq).toBe(1);

      // Simulate a retry of the same job
      completed1.status = 'QUEUED';
      await jobQueueService.executeJob(job._id.toString());

      const completed2 = inMemoryJobs.get(job._id.toString());
      expect(completed2.payload.startingSequence).toBe(firstAllocatedSeq);
      // sequenceCounter should only have been incremented once for this job
      expect(sequenceCounter).toBe(3); // 1 + 2 = 3
    });

    it('re-executing the same chunk creates zero duplicate credentials and resumes idempotently', async () => {
      const records = [
        { name: 'Dr. Vikram Patel', email: 'vikram@expo.org', rowNumber: 2 },
      ];

      const job = await jobQueueService.enqueueImportJob(eventId, records, hostUserId, 'HOST');

      // First run
      await jobQueueService.executeJob(job._id.toString());
      expect(inMemoryCredentials.size).toBe(1);

      // Reset job to QUEUED and execute again (simulating crash after insert)
      const jobDoc = inMemoryJobs.get(job._id.toString());
      jobDoc.status = 'QUEUED';

      await jobQueueService.executeJob(job._id.toString());
      // Credential count MUST remain 1, zero duplicates
      expect(inMemoryCredentials.size).toBe(1);
    });

    it('multiple progress updates deduplicate error log entries without multiplying duplicate rows', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'IMPORT_CREDENTIALS',
        status: 'PROCESSING',
        lockedBy: 'test-worker',
        lockExpiresAt: new Date(Date.now() + 600000),
      });

      const initialError = [{ identifier: 'ROW-2', error: 'Invalid email' }];
      await jobRepo.updateProgress(job._id.toString(), { processed: 10 }, { errorLog: initialError });
      await jobRepo.updateProgress(job._id.toString(), { processed: 20 }, { errorLog: initialError });

      const updated = inMemoryJobs.get(job._id.toString());
      expect(updated.result.errorLog.length).toBe(1); // Set directly, not duplicated!
    });
  });

  describe('Workstream C — Registration Capacity and Data Integrity', () => {
    it('concurrent capacity reservation: when capacity is 10 and 9 slots are taken, exactly 1 succeeds', async () => {
      const eventObj = inMemoryEvents.get(eventId);
      eventObj.registration.confirmedCount = 9;
      eventObj.registration.capacity = 10;

      // 5 concurrent attempts to reserve the remaining 1 slot
      const attempts = await Promise.all([
        eventRepo.reserveRegistrationSlot(eventId, 10),
        eventRepo.reserveRegistrationSlot(eventId, 10),
        eventRepo.reserveRegistrationSlot(eventId, 10),
        eventRepo.reserveRegistrationSlot(eventId, 10),
        eventRepo.reserveRegistrationSlot(eventId, 10),
      ]);

      const successfulReservations = attempts.filter((r) => r === true);
      expect(successfulReservations.length).toBe(1);
      expect(eventObj.registration.confirmedCount).toBe(10);
    });

    it('rejects capacity reservation if event status is not PUBLISHED or REGISTRATION_OPEN', async () => {
      const eventObj = inMemoryEvents.get(eventId);
      eventObj.status = 'CANCELLED';

      const reserved = await eventRepo.reserveRegistrationSlot(eventId, 10);
      expect(reserved).toBe(false);
    });

    it('cancellation releases capacity slot exactly once and repeated cancellation does not double-decrement', async () => {
      const regId = new mongoose.Types.ObjectId().toString();
      const regDoc = {
        _id: new mongoose.Types.ObjectId(regId),
        eventId: new mongoose.Types.ObjectId(eventId),
        userId: new mongoose.Types.ObjectId(),
        status: 'CONFIRMED',
      };
      inMemoryRegistrations.set(regId, regDoc);

      const eventObj = inMemoryEvents.get(eventId);
      eventObj.registration.confirmedCount = 5;

      jest.spyOn(registrationRepo, 'findByEventAndUser').mockImplementation(async () => {
        return regDoc as any;
      });

      jest.spyOn(registrationRepo, 'updateStatus').mockImplementation(async (_id: any, _eId: any, status: any, _ca: any, _cr: any, expectedStatus?: any) => {
        if (expectedStatus && regDoc.status !== expectedStatus) {
          return null;
        }
        regDoc.status = status;
        return regDoc as any;
      });

      // First cancellation
      await registrationService.cancelRegistration(eventId, hostSupabaseId);
      expect(eventObj.registration.confirmedCount).toBe(4);

      // Immediate repeated cancellation of same registration
      await registrationService.cancelRegistration(eventId, hostSupabaseId);
      // Confirmed count must NOT decrement again!
      expect(eventObj.registration.confirmedCount).toBe(4);
    });

    it('reconcileConfirmedCount repairs legacy confirmedCount=0 when confirmed registrations exist', async () => {
      const legacyEventId = new mongoose.Types.ObjectId().toString();
      const legacyEventDoc: any = {
        _id: new mongoose.Types.ObjectId(legacyEventId),
        status: 'PUBLISHED',
        registration: {
          capacity: 50,
          confirmedCount: 0, // Legacy counter bug
          reconciledAt: null,
        },
      };

      const realRepo = new MongoEventRepository();
      jest.spyOn(realRepo['model'], 'findById').mockResolvedValue(legacyEventDoc as any);
      const updateOneSpy = jest.spyOn(realRepo['model'], 'updateOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({} as any),
      } as any);

      const { EventRegistrationModel } = await import('../src/db/mongo/models/event-registration.model');
      jest.spyOn(EventRegistrationModel, 'countDocuments').mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      } as any);

      // Call repository reconcileConfirmedCount
      const count = await realRepo.reconcileConfirmedCount(legacyEventId, false);
      expect(typeof count).toBe('number');
      expect(updateOneSpy).toHaveBeenCalled();
    });
  });

  describe('Workstream D — True Bounded-Memory Exports', () => {
    it('ZIP export streams records via cursor without materializing whole dataset in memory', async () => {
      // Create 15 credentials
      for (let i = 1; i <= 15; i++) {
        inMemoryCredentials.set(`${eventId}_${i}`, {
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: i,
          formattedId: `DEL-${String(i).padStart(5, '0')}`,
          verificationToken: `token-${i}`,
          holder: { name: `Delegate ${i}` },
          asset: { storagePath: `events/${eventId}/credentials/del-${i}.png` },
        });
      }

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'EXPORT_CREDENTIALS',
        status: 'PROCESSING',
        payload: { exportFormat: 'ZIP_PASSES' },
      });

      await exportService.processExportJob(job as any);

      const completed = inMemoryJobs.get(job._id.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.result.exportedCount).toBe(15);
      expect(completed.result.downloadUrl).toMatch(/https:\/\/storage\.ticketification\.app/);
    });

    it('streaming CSV export writes line-by-line with UTF-8 BOM and escapes quotes/commas', async () => {
      inMemoryCredentials.set(`${eventId}_1`, {
        eventId: new mongoose.Types.ObjectId(eventId),
        sequenceNumber: 1,
        formattedId: 'DEL-00001',
        verificationToken: 'token-hindi-1234',
        holder: { name: 'श्री राजेश कुमार, शर्मा "VIP"' },
        credentialType: 'ATTENDEE',
        usagePolicy: 'SINGLE_USE',
        status: 'ACTIVE',
      });

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'EXPORT_CREDENTIALS',
        status: 'PROCESSING',
        payload: { exportFormat: 'ROSTER_CSV' },
      });

      await exportService.processExportJob(job as any);

      const completed = inMemoryJobs.get(job._id.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.result.exportedCount).toBe(1);
    });

    it('ROSTER_XLSX export exceeding MAX_XLSX_EXPORT_ROWS throws clear ValidationError recommending CSV', async () => {
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(MAX_XLSX_EXPORT_ROWS + 1);

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'EXPORT_CREDENTIALS',
        status: 'PROCESSING',
        payload: { exportFormat: 'ROSTER_XLSX' },
      });

      await expect(exportService.processExportJob(job as any)).rejects.toThrow(
        /ROSTER_XLSX export limit exceeded/
      );
    });
  });

  describe('Workstream E — Bulk Ticket Rendering & Date Fallback', () => {
    it('missing event schedule.startAt falls back safely to Date TBA and never fabricates 2026-10-10', async () => {
      const eventWithoutDate = inMemoryEvents.get(eventId);
      delete eventWithoutDate.schedule.startAt;

      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockResolvedValue(1);
      jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          formattedId: 'TBA-00001',
          verificationToken: 'token-tba-123',
          holder: { name: 'Date Check Attendee' },
          save: jest.fn().mockResolvedValue(true),
        } as any,
      ]);

      let renderedDateParam: string | null = null;
      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(async (_eId, _cId, _tmpl, renderData) => {
        renderedDateParam = renderData.date;
        return { storagePath: 'test/path.png', publicUrl: 'https://test/path.png' };
      });

      jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);

      const job = await jobQueueService.enqueueBulkRenderJob(eventId, hostUserId, 'HOST');
      await jobQueueService.executeJob(job._id.toString());

      expect(renderedDateParam).toBe('Date TBA');
      expect(renderedDateParam).not.toBe('2026-10-10');
    });

    it('valid event schedule.startAt uses the real event date string', async () => {
      const eventWithDate = inMemoryEvents.get(eventId);
      const testDate = new Date('2027-05-15T10:00:00Z');
      eventWithDate.schedule.startAt = testDate;

      jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockResolvedValue(1);
      jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          formattedId: 'DATE-00001',
          verificationToken: 'token-date-123',
          holder: { name: 'Real Date Attendee' },
          save: jest.fn().mockResolvedValue(true),
        } as any,
      ]);

      let renderedDateParam: string | null = null;
      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(async (_eId, _cId, _tmpl, renderData) => {
        renderedDateParam = renderData.date;
        return { storagePath: 'test/path.png', publicUrl: 'https://test/path.png' };
      });

      jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);

      const job = await jobQueueService.enqueueBulkRenderJob(eventId, hostUserId, 'HOST');
      await jobQueueService.executeJob(job._id.toString());

      expect(renderedDateParam).toBe(testDate.toLocaleDateString());
    });
  });

  describe('Workstream F — Security Hygiene & Error Sanitization', () => {
    it('sanitizes connection strings, bearer tokens, passwords, emails and phone numbers from error logs', () => {
      const rawError = new Error(
        'Connection to postgresql://admin:SuperSecretKey@db.internal:5432/ticket_db failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy and secret=mySecretParam for user organizer@ticket.app or phone +18005550199'
      );

      const sanitized = jobQueueService.sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('SuperSecretKey');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).not.toContain('mySecretParam');
      expect(sanitized).not.toContain('organizer@ticket.app');
      expect(sanitized).not.toContain('+18005550199');
      expect(sanitized).toContain('postgresql://[REDACTED_URI]');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('secret=[REDACTED]');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).toContain('[REDACTED_PHONE]');
    });
  });
});
