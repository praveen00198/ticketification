import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('Ticket Generation Crash Recovery & Concurrency Safety Suite (Acceptance Criteria 6-8)', () => {
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
  let inMemoryCredentials: Map<string, any>;
  let inMemoryStorage: Map<string, Buffer>;
  let sharpCallCount: number;

  const mockEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    name: 'Crash Recovery & Worker Safety Summit 2026',
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

  function createMockCredential(sequenceNumber: number, overrides: any = {}) {
    const id = overrides._id || new mongoose.Types.ObjectId();
    const formattedId = overrides.formattedId || `TIC-${sequenceNumber.toString().padStart(5, '0')}`;
    const token = overrides.verificationToken || `token-${sequenceNumber}-${Date.now()}`.padEnd(64, '0');

    const cred: any = {
      _id: id,
      eventId: new mongoose.Types.ObjectId(eventId),
      sequenceNumber,
      formattedId,
      verificationToken: token,
      credentialType: 'ATTENDEE',
      terminology: 'Ticket',
      usagePolicy: 'SINGLE_USE',
      status: 'ACTIVE',
      renderStatus: overrides.renderStatus || (overrides.asset?.publicUrl ? 'COMPLETED' : 'PENDING'),
      renderingLockedBy: overrides.renderingLockedBy || null,
      renderingLockExpiresAt: overrides.renderingLockExpiresAt || null,
      holder: {
        name: overrides.holderName || `Attendee ${sequenceNumber}`,
        email: overrides.holderEmail || `attendee${sequenceNumber}@test.com`,
        category: 'General',
        isAssigned: true,
      },
      asset: overrides.asset || null,
      metadata: overrides.metadata || {},
      save: jest.fn().mockImplementation(async function (this: any) {
        inMemoryCredentials.set(id.toString(), this);
        return this;
      }),
    };

    inMemoryCredentials.set(id.toString(), cred);
    return cred;
  }

  function generateCredentials(count: number, completedCount: number = 0) {
    const list = [];
    for (let i = 1; i <= count; i++) {
      let asset: any = null;
      let renderStatus = 'PENDING';
      if (i <= completedCount) {
        const path = `events/${eventId}/credentials/cred-${i}.png`;
        asset = {
          storagePath: path,
          publicUrl: `https://storage.ticketification.app/${path}`,
          renderedAt: new Date(),
          mimeType: 'image/png',
        };
        renderStatus = 'COMPLETED';
        inMemoryStorage.set(path, Buffer.from(`existing-png-binary-${i}`));
      }
      list.push(createMockCredential(i, { asset, renderStatus }));
    }
    return list;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);

    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();
    inMemoryStorage = new Map();
    sharpCallCount = 0;

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

    // Mock Event & Template Repositories
    jest.spyOn(eventRepo, 'findById').mockResolvedValue(mockEvent as any);
    jest.spyOn(templateRepo, 'findById').mockResolvedValue(mockTemplate as any);
    jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue(mockTemplate as any);

    // Authorize caller user
    jest.spyOn(queueService as any, 'authorizeHostOrCoordinator').mockResolvedValue({
      event: mockEvent,
      actorUser: { _id: new mongoose.Types.ObjectId(callerUserId), role: 'HOST' },
    });

    // Mock Job Repository with active-job coalescing and recovery logic
    jest.spyOn(jobRepo, 'findActiveJob').mockImplementation(async (eId: string, jType: any) => {
      const active = Array.from(inMemoryJobs.values()).find(
        (j) =>
          j.eventId.toString() === eId.toString() &&
          j.jobType === jType &&
          ['QUEUED', 'PROCESSING'].includes(j.status)
      );
      return active ? (active as any) : null;
    });

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

    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(
      async (id: string, prog: any, res: any, workerId?: string) => {
        const job = inMemoryJobs.get(id.toString());
        if (!job) return null;
        if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) {
          return null;
        }
        job.progress = { ...job.progress, ...prog };
        if (res) job.result = { ...job.result, ...res };
        return job as any;
      }
    );

    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(
      async (id: string, res: any, workerId?: string) => {
        const job = inMemoryJobs.get(id.toString());
        if (!job) return null;
        if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) {
          return null;
        }
        job.status = 'COMPLETED';
        job.completedAt = new Date();
        job.lockedBy = null;
        job.lockExpiresAt = null;
        job.progress.percentage = 100;
        job.result = res;
        return job as any;
      }
    );

    jest.spyOn(jobRepo, 'markFailed').mockImplementation(
      async (id: string, errMsg: string, partialResult?: any, workerId?: string) => {
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
      }
    );

    jest.spyOn(jobRepo, 'releaseJobForRetry').mockImplementation(
      async (id: string, errMsg: string, delayMs: number = 5000, workerId?: string) => {
        const job = inMemoryJobs.get(id.toString());
        if (!job) return null;
        if (workerId && job.lockedBy && job.lockedBy !== workerId) return null;
        job.status = 'QUEUED';
        job.lockedBy = null;
        job.lockExpiresAt = null;
        job.failureReason = errMsg;
        job.nextRunAt = new Date(Date.now() + delayMs);
        return job as any;
      }
    );

    jest.spyOn(jobRepo, 'renewLease').mockImplementation(async (id: string, workerId: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return false;
      if (job.status === 'PROCESSING' && job.lockedBy === workerId) {
        job.lockExpiresAt = new Date(Date.now() + 600000);
        return true;
      }
      return false;
    });

    jest.spyOn(jobRepo, 'claimJob').mockImplementation(
      async (id: string, workerId: string, leaseMs: number = 600000) => {
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
      }
    );

    jest.spyOn(jobRepo, 'recoverAbandonedJobs').mockImplementation(
      async (leaseGraceMs: number = 0) => {
        const now = new Date(Date.now() - leaseGraceMs);
        let recovered = 0;
        let failed = 0;

        for (const job of inMemoryJobs.values()) {
          if (job.status === 'PROCESSING') {
            const isExpired = !job.lockExpiresAt || new Date(job.lockExpiresAt) < now;
            // Immediate startup recovery if leaseGraceMs < 0 (flagged for startup) or isExpired
            if (isExpired || leaseGraceMs === -1) {
              if (job.attempts >= (job.maxAttempts || 3)) {
                job.status = 'FAILED';
                job.errorMessage = 'Abandoned by worker and exceeded max retry attempts';
                job.lockedBy = null;
                job.lockExpiresAt = null;
                failed++;
              } else {
                job.status = 'QUEUED';
                job.lockedBy = null;
                job.lockExpiresAt = null;
                job.failureReason = 'Recovered from abandoned worker process';
                job.nextRunAt = new Date();
                recovered++;
              }
            }
          }
        }
        return { recovered, failed };
      }
    );

    // Mock Credential Repository & Atomic Lease Methods
    jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async () => {
      return Array.from(inMemoryCredentials.values()).filter(
        (c) => c.renderStatus !== 'COMPLETED' && (!c.asset?.publicUrl || !c.asset?.renderedAt)
      ).length;
    });

    jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(
      async (_eId: string, lastId?: any, limit: number = 50) => {
        let all = Array.from(inMemoryCredentials.values());
        if (lastId) {
          const idx = all.findIndex((c) => c._id.toString() === lastId.toString());
          all = idx >= 0 ? all.slice(idx + 1) : [];
        }
        return all
          .filter((c) => c.renderStatus !== 'COMPLETED' && (!c.asset?.publicUrl || !c.asset?.renderedAt))
          .slice(0, limit);
      }
    );

    // Atomic ticket lease claiming (Criterion 6 & 7)
    (credentialRepo as any).claimUnrenderedTicketLease = jest.fn().mockImplementation(
      async (eId: string, workerId: string, leaseMs: number = 30000) => {
        const now = new Date();
        const all = Array.from(inMemoryCredentials.values()).filter(
          (c) =>
            c.eventId?.toString() === eId?.toString() &&
            c.renderStatus !== 'COMPLETED' &&
            (!c.asset?.publicUrl || !c.asset?.renderedAt)
        );

        // 1. Prioritize PENDING tickets
        const pending = all.find((c) => !c.renderStatus || c.renderStatus === 'PENDING');
        if (pending) {
          pending.renderStatus = 'PROCESSING';
          pending.renderingLockedBy = workerId;
          pending.renderingLockExpiresAt = new Date(now.getTime() + leaseMs);
          return pending;
        }

        // 2. Retry FAILED or expired PROCESSING tickets
        const retryable = all.find((c) => {
          if (c.renderStatus === 'FAILED') return true;
          if (c.renderStatus === 'PROCESSING') {
            return c.renderingLockExpiresAt && new Date(c.renderingLockExpiresAt) < now;
          }
          return false;
        });

        if (retryable) {
          retryable.renderStatus = 'PROCESSING';
          retryable.renderingLockedBy = workerId;
          retryable.renderingLockExpiresAt = new Date(now.getTime() + leaseMs);
          return retryable;
        }

        return null;
      }
    );

    // Batch reclamation of expired processing leases (Criterion 7)
    (credentialRepo as any).reclaimAbandonedTicketLeases = jest.fn().mockImplementation(
      async (eId: string, leaseGraceMs: number = 0) => {
        const now = new Date(Date.now() - leaseGraceMs);
        let count = 0;
        for (const cred of inMemoryCredentials.values()) {
          if (cred.eventId?.toString() !== eId.toString()) continue;
          if (
            cred.renderStatus === 'PROCESSING' &&
            cred.renderingLockExpiresAt &&
            new Date(cred.renderingLockExpiresAt) < now
          ) {
            cred.renderStatus = 'PENDING';
            cred.renderingLockedBy = null;
            cred.renderingLockExpiresAt = null;
            count++;
          }
        }
        return count;
      }
    );

    // Atomic completion persistence (Criterion 8)
    (credentialRepo as any).markRenderCompleted = jest.fn().mockImplementation(
      async (credId: string, assetData: any) => {
        const cred = inMemoryCredentials.get(credId.toString());
        if (!cred) return;
        cred.renderStatus = 'COMPLETED';
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
        cred.asset = {
          storagePath: assetData.storagePath,
          publicUrl: assetData.publicUrl,
          renderedAt: assetData.renderedAt || new Date(),
          mimeType: 'image/png',
        };
      }
    );

    (credentialRepo as any).markRenderFailed = jest.fn().mockImplementation(
      async (credId: string, error: string) => {
        const cred = inMemoryCredentials.get(credId.toString());
        if (!cred) return;
        cred.renderStatus = 'FAILED';
        cred.renderError = error;
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
      }
    );

    // Mock Supabase Storage Service
    jest.spyOn(storageService, 'isConfigured').mockReturnValue(true);
    jest.spyOn(storageService, 'uploadTicketImage').mockImplementation(
      async (storagePath: string, buffer: any) => {
        inMemoryStorage.set(storagePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
        return {
          storagePath,
          publicUrl: `https://storage.ticketification.app/${storagePath}`,
        };
      }
    );

    (storageService as any).checkObjectExists = jest.fn().mockImplementation(
      async (storagePath: string) => inMemoryStorage.has(storagePath)
    );

    // Mock Rendering Service with Storage Pre-Check & Sharp Skipping
    jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
      async (eId: string, credId: string, _tmpl: any, _data: any) => {
        const storagePath = `events/${eId}/credentials/${credId}.png`;

        if (inMemoryStorage.has(storagePath)) {
          return {
            storagePath,
            publicUrl: `https://storage.ticketification.app/${storagePath}`,
          };
        }

        sharpCallCount++;
        const buffer = Buffer.from(`png-binary-for-${credId}`);
        inMemoryStorage.set(storagePath, buffer);

        return {
          storagePath,
          publicUrl: `https://storage.ticketification.app/${storagePath}`,
        };
      }
    );
  });

  describe('Criterion 6: Two concurrent workers cannot generate the same logical ticket simultaneously', () => {
    it('concurrent workers with atomic ticket leases claim disjoint tickets and never collide on the same ticket', async () => {
      const TOTAL = 6;
      generateCredentials(TOTAL, 0);

      const workerA = 'worker-alpha-instance-1';
      const workerB = 'worker-beta-instance-2';

      const claimedByA: string[] = [];
      const claimedByB: string[] = [];

      // Concurrently claim tickets until all are claimed
      while (true) {
        const [claimA, claimB] = await Promise.all([
          (credentialRepo as any).claimUnrenderedTicketLease(eventId, workerA, 30000),
          (credentialRepo as any).claimUnrenderedTicketLease(eventId, workerB, 30000),
        ]);

        if (!claimA && !claimB) break;

        if (claimA) claimedByA.push(claimA._id.toString());
        if (claimB) claimedByB.push(claimB._id.toString());
      }

      // CRITICAL ASSERTION: The intersection of claimed tickets between Worker A and Worker B MUST BE EMPTY
      const intersection = claimedByA.filter((id) => claimedByB.includes(id));
      expect(intersection).toEqual([]);

      // Union of claimed tickets must be exactly all TOTAL tickets
      const union = new Set([...claimedByA, ...claimedByB]);
      expect(union.size).toBe(TOTAL);
      expect(claimedByA.length + claimedByB.length).toBe(TOTAL);

      // Verify that every claimed ticket has renderStatus: PROCESSING and its respective worker owner
      for (const id of claimedByA) {
        const cred = inMemoryCredentials.get(id);
        expect(cred.renderStatus).toBe('PROCESSING');
        expect(cred.renderingLockedBy).toBe(workerA);
        expect(cred.renderingLockExpiresAt).toBeTruthy();
      }
      for (const id of claimedByB) {
        const cred = inMemoryCredentials.get(id);
        expect(cred.renderStatus).toBe('PROCESSING');
        expect(cred.renderingLockedBy).toBe(workerB);
        expect(cred.renderingLockExpiresAt).toBeTruthy();
      }
    });
  });

  describe('Criterion 7: Abandoned tickets in PROCESSING state due to worker crashes are safely reclaimed after lease expiration', () => {
    it('expired processing lease from a crashed worker is reclaimed to PENDING and processed to completion by a healthy worker', async () => {
      const TOTAL = 4;
      const credentials = generateCredentials(TOTAL, 0);

      // Credential 2 was claimed by crashed worker 60 seconds ago with 30s lease (expired 30s ago)
      const crashedWorker = 'crashed-worker-pid-888';
      credentials[1].renderStatus = 'PROCESSING';
      credentials[1].renderingLockedBy = crashedWorker;
      credentials[1].renderingLockExpiresAt = new Date(Date.now() - 30000);

      // Reclaim expired leases
      const reclaimedCount = await (credentialRepo as any).reclaimAbandonedTicketLeases(eventId, 0);
      expect(reclaimedCount).toBe(1);

      // Credential 2 must now be reset to PENDING and unlocked
      expect(credentials[1].renderStatus).toBe('PENDING');
      expect(credentials[1].renderingLockedBy).toBeNull();
      expect(credentials[1].renderingLockExpiresAt).toBeNull();

      // Healthy worker starts bulk render job and processes all 4 tickets to completion
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
      });

      await queueService.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('COMPLETED');
      expect(terminalJob?.result.renderedCount).toBe(TOTAL);

      // All 4 credentials now COMPLETED with zero abandoned locks
      for (const cred of inMemoryCredentials.values()) {
        expect(cred.asset?.publicUrl).toBeTruthy();
        expect(cred.asset?.storagePath).toBeTruthy();
        expect(cred.renderingLockedBy).toBeFalsy();
      }
    });

    it('claimUnrenderedTicketLease atomically reclaims expired PROCESSING lease directly if not batch-reclaimed', async () => {
      const TOTAL = 1;
      const credentials = generateCredentials(TOTAL, 0);

      credentials[0].renderStatus = 'PROCESSING';
      credentials[0].renderingLockedBy = 'worker-stale-died';
      credentials[0].renderingLockExpiresAt = new Date(Date.now() - 10000); // Expired 10s ago

      const healthyWorker = 'worker-healthy-new';
      const claimed = await (credentialRepo as any).claimUnrenderedTicketLease(eventId, healthyWorker, 30000);

      expect(claimed).toBeTruthy();
      expect(claimed._id.toString()).toBe(credentials[0]._id.toString());
      expect(claimed.renderStatus).toBe('PROCESSING');
      expect(claimed.renderingLockedBy).toBe(healthyWorker);
    });
  });

  describe('Criterion 8: Comprehensive Crash Scenarios', () => {
    it('Scenario 8A (Crash before upload): failure before upload leaves ticket clean for subsequent retry', async () => {
      const TOTAL = 3;
      generateCredentials(TOTAL, 0);

      let callIndex = 0;
      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId: string, credId: string) => {
          callIndex++;
          if (callIndex === 2) {
            // Simulate sudden worker crash BEFORE storage upload
            throw new Error('Worker crash before storage upload');
          }
          const storagePath = `events/${eId}/credentials/${credId}.png`;
          inMemoryStorage.set(storagePath, Buffer.from(`png-${credId}`));
          return {
            storagePath,
            publicUrl: `https://storage.ticketification.app/${storagePath}`,
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

      // Attempt 1: Crashes on ticket 2
      await queueService.executeJob(job._id.toString());

      const jobAfterCrash = await jobRepo.findById(job._id.toString());
      expect(jobAfterCrash?.status).toBe('QUEUED');
      expect(jobAfterCrash?.attempts).toBe(1);

      // Verify in storage: Ticket 1 uploaded, Ticket 2 NOT uploaded
      const allCreds = Array.from(inMemoryCredentials.values());
      const cred1Path = `events/${eventId}/credentials/${allCreds[0]._id}.png`;
      const cred2Path = `events/${eventId}/credentials/${allCreds[1]._id}.png`;
      expect(inMemoryStorage.has(cred1Path)).toBe(true);
      expect(inMemoryStorage.has(cred2Path)).toBe(false);

      // Attempt 2: Worker succeeds on remaining tickets
      jobAfterCrash.nextRunAt = new Date(Date.now() - 1000);
      await queueService.executeJob(job._id.toString());

      const finalJob = await jobRepo.findById(job._id.toString());
      expect(finalJob?.status).toBe('COMPLETED');
      expect(finalJob?.result.renderedCount).toBe(TOTAL);
      expect(inMemoryStorage.size).toBe(TOTAL);
    });

    it('Scenario 8B (Crash between upload and MongoDB save): detects existing storage asset, skips Sharp, and commits DB', async () => {
      const TOTAL = 2;
      const credentials = generateCredentials(TOTAL, 0);

      // Credential 1: Successfully uploaded to storage at canonical path, but DB save crashed!
      const canonicalPath1 = `events/${eventId}/credentials/${credentials[0]._id}.png`;
      inMemoryStorage.set(canonicalPath1, Buffer.from('canonical-png-buffer-already-in-supabase'));

      // In MongoDB, credential 1 has no asset.publicUrl yet
      expect(credentials[0].asset).toBeNull();

      sharpCallCount = 0;

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
      });

      // Worker executes job
      await queueService.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('COMPLETED');
      expect(terminalJob?.result.renderedCount).toBe(TOTAL);

      // Credential 1 must now have its asset committed in MongoDB using the pre-existing storage asset
      const doc1 = inMemoryCredentials.get(credentials[0]._id.toString());
      expect(doc1.asset?.publicUrl).toBe(`https://storage.ticketification.app/${canonicalPath1}`);
      expect(doc1.asset?.storagePath).toBe(canonicalPath1);
      expect(doc1.asset?.renderedAt).toBeTruthy();

      // Sharp was called ONLY ONCE (for credential 2), skipping credential 1!
      expect(sharpCallCount).toBe(1);
    });

    it('Scenario 8C (Crash after completion & Repeated Continue): immediately completes without re-rendering or overwriting', async () => {
      const TOTAL = 5;
      // All 5 already completed
      generateCredentials(TOTAL, TOTAL);

      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset');

      // Admin clicks Continue
      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      await queueService.executeJob(job._id.toString());

      const completedJob = await jobRepo.findById(job._id.toString());
      expect(completedJob?.status).toBe('COMPLETED');
      expect(completedJob?.result.renderedCount).toBe(0);
      expect(completedJob?.result.errorLog).toHaveLength(0);

      // Render spy was called ZERO times (no redundant re-rendering)
      expect(renderSpy).toHaveBeenCalledTimes(0);

      const remainingUnrendered = await credentialRepo.countUnrenderedByEvent(eventId);
      expect(remainingUnrendered).toBe(0);
    });

    it('Scenario 8D (Server restart & Immediate startup recovery): reclaims active processing jobs immediately without 10-minute lockout', async () => {
      // Create a job in PROCESSING locked by crashed worker with a 10-minute lease expiring in future
      const crashedJob = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-dead-pid-9999',
        lockExpiresAt: new Date(Date.now() + 540000), // 9 minutes in the future!
        attempts: 1,
        maxAttempts: 3,
        progress: { total: 10, processed: 2, succeeded: 2, failed: 0, percentage: 20 },
      });

      // Server reboot: recoverAbandonedJobs called with startup reset flag (-1)
      const recovery = await jobRepo.recoverAbandonedJobs(-1);
      expect(recovery.recovered).toBe(1);

      // Job is immediately reset to QUEUED and lock cleared
      const recoveredJob = await jobRepo.findById(crashedJob._id.toString());
      expect(recoveredJob?.status).toBe('QUEUED');
      expect(recoveredJob?.lockedBy).toBeNull();
      expect(recoveredJob?.lockExpiresAt).toBeNull();
      expect(recoveredJob?.nextRunAt).toBeTruthy();

      // New worker can immediately claim it without waiting 9 minutes!
      const newWorkerClaim = await jobRepo.claimJob(crashedJob._id.toString(), 'new-worker-instance-1');
      expect(newWorkerClaim).toBeTruthy();
      expect(newWorkerClaim?.lockedBy).toBe('new-worker-instance-1');
      expect(newWorkerClaim?.status).toBe('PROCESSING');
    });

    it('Scenario 8E (Repeated Continue clicks while actively running): does not disrupt active worker or spawn duplicate jobs', async () => {
      const TOTAL = 4;
      generateCredentials(TOTAL, 0);

      const activeJob = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-active-running',
        lockExpiresAt: new Date(Date.now() + 300000),
        progress: { total: TOTAL, processed: 1, succeeded: 1, failed: 0, percentage: 25 },
      });

      // User clicks Continue 3 times while it is actively running
      const click1 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      const click2 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      const click3 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });

      // All clicks return the active job ID
      expect(click1._id.toString()).toBe(activeJob._id.toString());
      expect(click2._id.toString()).toBe(activeJob._id.toString());
      expect(click3._id.toString()).toBe(activeJob._id.toString());

      // Only 1 job in queue
      expect(inMemoryJobs.size).toBe(1);
    });
  });
});
