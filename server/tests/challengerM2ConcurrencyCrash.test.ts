import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { EventJobModel } from '../src/db/mongo/models/event-job.model';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('CHALLENGER M2: Concurrency, Lease Safety & Crash Recovery Adversarial Suite', () => {
  jest.setTimeout(30000);

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

  const mockEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    name: 'M2 Concurrency & Crash Summit 2026',
    eventType: 'CONFERENCE',
    status: 'PUBLISHED',
    credentialTerminology: 'Ticket',
    schedule: {
      startAt: new Date('2026-11-20T09:00:00Z'),
      endAt: new Date('2026-11-20T18:00:00Z'),
    },
    venue: {
      name: 'Auditorium Alpha',
    },
  };

  const mockTemplate = {
    _id: new mongoose.Types.ObjectId(templateId),
    eventId: new mongoose.Types.ObjectId(eventId),
    name: 'Standard Badge Template',
    isDefault: true,
    dimensions: { width: 1620, height: 2025 },
    fields: [
      { key: 'name', label: 'Name', x: 810, y: 1490, fontSize: 76, color: '#FFFFFF', textAlign: 'center' },
      { key: 'qr', label: 'QR', x: 604, y: 960, width: 380, height: 380 },
    ],
  };

  function createCredentialDoc(seqNum: number, overrides: any = {}) {
    const id = overrides._id || new mongoose.Types.ObjectId();
    const doc: any = {
      _id: id,
      eventId: new mongoose.Types.ObjectId(eventId),
      sequenceNumber: seqNum,
      formattedId: overrides.formattedId || `TIC-${String(seqNum).padStart(5, '0')}`,
      verificationToken: overrides.verificationToken || `token-${seqNum}`.padEnd(64, '0'),
      credentialType: 'ATTENDEE_PASS',
      terminology: 'Ticket',
      usagePolicy: 'SINGLE_USE',
      status: 'ACTIVE',
      renderStatus: overrides.renderStatus || 'PENDING',
      renderAttempts: overrides.renderAttempts || 0,
      renderError: overrides.renderError || null,
      renderingLockedBy: overrides.renderingLockedBy || null,
      renderingLockExpiresAt: overrides.renderingLockExpiresAt || null,
      holder: {
        name: overrides.holderName || `Attendee ${seqNum}`,
        email: overrides.holderEmail || `attendee${seqNum}@example.com`,
        category: 'PARTICIPANT',
        isAssigned: true,
      },
      asset: overrides.asset || null,
      metadata: overrides.metadata || {},
      save: jest.fn().mockImplementation(async function (this: any) {
        inMemoryCredentials.set(id.toString(), { ...this });
        return this;
      }),
    };
    inMemoryCredentials.set(id.toString(), doc);
    return doc;
  }

  function seedCredentials(count: number, completedCount: number = 0) {
    const docs = [];
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
        inMemoryStorage.set(path, Buffer.from(`png-data-${i}`));
      }
      docs.push(createCredentialDoc(i, { asset, renderStatus }));
    }
    return docs;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true,
      writable: true,
    });

    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();
    inMemoryStorage = new Map();

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

    // Mock Storage Service
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

    // Mock EventCredentialModel find and countDocuments
    jest.spyOn(EventCredentialModel, 'countDocuments').mockImplementation((query: any) => {
      const unrendered = Array.from(inMemoryCredentials.values()).filter(
        (c) => c.renderStatus !== 'COMPLETED' && (!c.asset?.publicUrl || !c.asset?.renderedAt)
      );
      return {
        exec: async () => unrendered.length,
      } as any;
    });

    jest.spyOn(EventCredentialModel, 'find').mockImplementation((query: any) => {
      let unrendered = Array.from(inMemoryCredentials.values()).filter(
        (c) => c.renderStatus !== 'COMPLETED' && (!c.asset?.publicUrl || !c.asset?.renderedAt)
      );
      if (query._id?.$gt) {
        const lastIdStr = query._id.$gt.toString();
        unrendered = unrendered.filter((c) => c._id.toString() > lastIdStr);
      }
      return {
        sort: () => ({
          limit: (n: number) => ({
            exec: async () => unrendered.slice(0, n).map((c) => ({ ...c })),
          }),
          exec: async () => unrendered.map((c) => ({ ...c })),
        }),
        limit: (n: number) => ({
          exec: async () => unrendered.slice(0, n).map((c) => ({ ...c })),
        }),
        exec: async () => unrendered.map((c) => ({ ...c })),
      } as any;
    });

    // Realistic atomic Mongoose mock for EventJobModel
    jest.spyOn(EventJobModel, 'create').mockImplementation(async (data: any) => {
      const id = data._id || new mongoose.Types.ObjectId();
      const jobDoc: any = {
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
      return jobDoc;
    });

    jest.spyOn(EventJobModel, 'findById').mockImplementation((id: any) => {
      const doc = inMemoryJobs.get(id?.toString());
      return {
        exec: async () => (doc ? { ...doc } : null),
      } as any;
    });

    jest.spyOn(EventJobModel, 'findOne').mockImplementation((query: any) => {
      const now = new Date();
      let matched: any = null;
      for (const job of inMemoryJobs.values()) {
        if (query.eventId && job.eventId.toString() !== query.eventId.toString()) continue;
        if (query.jobType && job.jobType !== query.jobType) continue;
        if (query.status?.$in && !query.status.$in.includes(job.status)) continue;
        if (query.status && typeof query.status === 'string' && job.status !== query.status) continue;
        matched = job;
        break;
      }
      return {
        sort: () => ({
          exec: async () => (matched ? { ...matched } : null),
        }),
        exec: async () => (matched ? { ...matched } : null),
      } as any;
    });

    jest.spyOn(EventJobModel, 'find').mockImplementation((query: any) => {
      const now = new Date();
      const matched = Array.from(inMemoryJobs.values()).filter((job) => {
        if (query.status && job.status !== query.status) return false;
        if (query.lockExpiresAt?.$lt) {
          if (!job.lockExpiresAt || new Date(job.lockExpiresAt) >= query.lockExpiresAt.$lt) {
            return false;
          }
        }
        return true;
      });
      return {
        exec: async () => matched.map((j) => ({ ...j })),
      } as any;
    });

    // Atomic findOneAndUpdate on EventJobModel
    jest.spyOn(EventJobModel, 'findOneAndUpdate').mockImplementation((query: any, update: any) => {
      const now = new Date();
      let targetJob: any = null;

      // Handle query by _id
      if (query._id) {
        const idStr = query._id.toString();
        const candidate = inMemoryJobs.get(idStr);
        if (candidate) {
          // Check status constraint
          let matchStatus = true;
          if (query.status) {
            if (typeof query.status === 'string' && candidate.status !== query.status) matchStatus = false;
            else if (query.status.$in && !query.status.$in.includes(candidate.status)) matchStatus = false;
          }
          // Check query.$and containing $or condition (e.g. claimJob)
          if (query.$and) {
            for (const cond of query.$and) {
              if (cond.$or) {
                const orMatch = cond.$or.some((branch: any) => {
                  if (branch.status === 'QUEUED') return candidate.status === 'QUEUED';
                  if (branch.status === 'PROCESSING') {
                    if (candidate.status !== 'PROCESSING') return false;
                    if (branch.lockExpiresAt?.$lt) {
                      return candidate.lockExpiresAt && new Date(candidate.lockExpiresAt) < branch.lockExpiresAt.$lt;
                    }
                  }
                  return false;
                });
                if (!orMatch) matchStatus = false;
              }
            }
          }
          // Check worker ownership if query specifies lockedBy
          if (query.lockedBy && candidate.lockedBy !== query.lockedBy) matchStatus = false;
          if (query.lockExpiresAt?.$gte && (!candidate.lockExpiresAt || new Date(candidate.lockExpiresAt) < now)) {
            matchStatus = false;
          }
          if (query.lockExpiresAt?.$lt && (candidate.lockExpiresAt && new Date(candidate.lockExpiresAt) >= now)) {
            matchStatus = false;
          }
          if (query.lockExpiresAt?.$gte && (!candidate.lockExpiresAt || new Date(candidate.lockExpiresAt) < now)) {
            matchStatus = false;
          }
          if (query.lockExpiresAt?.$lt && (candidate.lockExpiresAt && new Date(candidate.lockExpiresAt) >= now)) {
            matchStatus = false;
          }
          if (matchStatus) targetJob = candidate;
        }
      } else {
        // Find next eligible job for worker claim (claimNextAvailableJob)
        for (const candidate of inMemoryJobs.values()) {
          const isQueued = candidate.status === 'QUEUED';
          const isExpiredProcessing =
            candidate.status === 'PROCESSING' &&
            candidate.lockExpiresAt &&
            new Date(candidate.lockExpiresAt) < now;

          if (isQueued || isExpiredProcessing) {
            if (candidate.attempts < (candidate.maxAttempts || 3)) {
              targetJob = candidate;
              break;
            }
          }
        }
      }

      if (!targetJob) {
        return { exec: async () => null } as any;
      }

      // Apply updates
      if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
          if (k.startsWith('progress.')) {
            targetJob.progress = targetJob.progress || {};
            targetJob.progress[k.replace('progress.', '')] = v;
          } else if (k.startsWith('result.')) {
            targetJob.result = targetJob.result || {};
            targetJob.result[k.replace('result.', '')] = v;
          } else {
            targetJob[k] = v;
          }
        }
      }
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          targetJob[key] = (targetJob[key] || 0) + (val as number);
        }
      }
      targetJob.updatedAt = new Date();

      return {
        exec: async () => ({ ...targetJob }),
      } as any;
    });

    // Realistic atomic Mongoose mock for EventCredentialModel
    jest.spyOn(EventCredentialModel, 'findOneAndUpdate').mockImplementation((query: any, update: any) => {
      const now = new Date();
      let matchedDoc: any = null;

      if (query._id) {
        matchedDoc = inMemoryCredentials.get(query._id.toString());
      } else {
        // Query for unrendered ticket lease
        for (const cred of inMemoryCredentials.values()) {
          if (query.eventId && cred.eventId.toString() !== query.eventId.toString()) continue;
          if (query.renderStatus?.$ne && cred.renderStatus === query.renderStatus.$ne) continue;

          if (query.$or) {
            const matchesOr = query.$or.some((branch: any) => {
              if (branch.renderStatus === 'PENDING') return cred.renderStatus === 'PENDING';
              if (branch.renderStatus === 'FAILED') return cred.renderStatus === 'FAILED';
              if (branch.renderStatus === 'PROCESSING') {
                if (cred.renderStatus !== 'PROCESSING') return false;
                if (branch.$or) {
                  return branch.$or.some((sub: any) => {
                    if (sub.renderingLockExpiresAt?.$lte) {
                      return !cred.renderingLockExpiresAt || new Date(cred.renderingLockExpiresAt) <= sub.renderingLockExpiresAt.$lte;
                    }
                    if (sub.renderingLockExpiresAt === null) return cred.renderingLockExpiresAt === null;
                    return false;
                  });
                }
              }
              return false;
            });
            if (matchesOr) {
              matchedDoc = cred;
              break;
            }
          }
        }
      }

      if (!matchedDoc) {
        return { exec: async () => null } as any;
      }

      if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
          if (k.startsWith('asset.')) {
            matchedDoc.asset = matchedDoc.asset || {};
            matchedDoc.asset[k.replace('asset.', '')] = v;
          } else {
            matchedDoc[k] = v;
          }
        }
      }
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          matchedDoc[k] = (matchedDoc[k] || 0) + (val as any);
        }
      }

      return {
        exec: async () => ({ ...matchedDoc }),
      } as any;
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Concurrency Safety & Double-Processing Impossibility
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 1: Concurrency Safety & Double-Processing Impossibility', () => {
    it('CH-1.1: 10 concurrent workers competing to claim 5 queued jobs claim disjoint jobs with zero collisions', async () => {
      // Seed 5 queued jobs
      for (let i = 1; i <= 5; i++) {
        await jobRepo.createJob({
          eventId: new mongoose.Types.ObjectId(eventId),
          jobType: 'BULK_RENDER_ASSETS',
          status: 'QUEUED',
          payload: { jobIndex: i },
        });
      }
      expect(inMemoryJobs.size).toBe(5);

      const workers = Array.from({ length: 10 }, (_, i) => `worker-contender-${i + 1}`);

      // All 10 workers race to claimNextAvailableJob simultaneously
      const claimResults = await Promise.all(
        workers.map((workerId) => jobRepo.claimNextAvailableJob(workerId, 30000))
      );

      const successfulClaims = claimResults.filter((j): j is any => j !== null);
      const claimedJobIds = successfulClaims.map((j) => j._id.toString());
      const uniqueJobIds = new Set(claimedJobIds);

      // Invariant 1: Exactly 5 claims must succeed (since only 5 jobs existed)
      expect(successfulClaims.length).toBe(5);
      // Invariant 2: No two workers claimed the same job (disjoint claiming)
      expect(uniqueJobIds.size).toBe(5);

      // Invariant 3: The other 5 workers received null (bounded queue)
      const failedClaims = claimResults.filter((j) => j === null);
      expect(failedClaims.length).toBe(5);

      // Invariant 4: Each claimed job has PROCESSING status, its respective workerId, and attempts === 1
      for (const job of successfulClaims) {
        expect(job.status).toBe('PROCESSING');
        expect(job.attempts).toBe(1);
        expect(workers).toContain(job.lockedBy);
        expect(new Date(job.lockExpiresAt).getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('CH-1.2: Disjoint ticket leases are claimed monotonically across concurrent workers', async () => {
      const TOTAL_TICKETS = 12;
      seedCredentials(TOTAL_TICKETS, 0);

      // Wire credentialRepo mock to simulate atomic findOneAndUpdate claiming
      jest.spyOn(credentialRepo, 'claimUnrenderedTicketLease').mockImplementation(
        async (eId: string, workerId: string, leaseMs: number = 30000) => {
          const now = new Date();
          for (const cred of inMemoryCredentials.values()) {
            if (cred.eventId.toString() !== eId.toString()) continue;
            if (cred.renderStatus === 'COMPLETED') continue;

            const isPending = !cred.renderStatus || cred.renderStatus === 'PENDING';
            const isExpired =
              cred.renderStatus === 'PROCESSING' &&
              cred.renderingLockExpiresAt &&
              new Date(cred.renderingLockExpiresAt) < now;

            if (isPending || isExpired) {
              cred.renderStatus = 'PROCESSING';
              cred.renderingLockedBy = workerId;
              cred.renderingLockExpiresAt = new Date(now.getTime() + leaseMs);
              cred.renderAttempts = (cred.renderAttempts || 0) + 1;
              return { ...cred };
            }
          }
          return null;
        }
      );

      (credentialRepo as any).markRenderFailed = jest.fn().mockImplementation(
        async (credId: string, error: string) => {
          const cred = inMemoryCredentials.get(credId.toString());
          if (!cred) return;
          cred.renderStatus = 'FAILED';
          cred.renderError = error;
          cred.renderingLockedBy = null;
          cred.renderingLockExpiresAt = new Date(Date.now() + 60000);
        }
      );

      const workerA = 'worker-node-1';
      const workerB = 'worker-node-2';
      const workerC = 'worker-node-3';

      const claimsByWorker: Record<string, string[]> = {
        [workerA]: [],
        [workerB]: [],
        [workerC]: [],
      };

      // 4 concurrent rounds of 3 workers claiming tickets
      for (let round = 0; round < 4; round++) {
        const [cA, cB, cC] = await Promise.all([
          credentialRepo.claimUnrenderedTicketLease(eventId, workerA, 60000),
          credentialRepo.claimUnrenderedTicketLease(eventId, workerB, 60000),
          credentialRepo.claimUnrenderedTicketLease(eventId, workerC, 60000),
        ]);

        if (cA) claimsByWorker[workerA].push(cA.formattedId);
        if (cB) claimsByWorker[workerB].push(cB.formattedId);
        if (cC) claimsByWorker[workerC].push(cC.formattedId);
      }

      const allClaimed = [
        ...claimsByWorker[workerA],
        ...claimsByWorker[workerB],
        ...claimsByWorker[workerC],
      ];

      // Total claims must be exactly 12
      expect(allClaimed.length).toBe(TOTAL_TICKETS);
      // Zero duplicate ticket claims across all workers
      const uniqueClaims = new Set(allClaimed);
      expect(uniqueClaims.size).toBe(TOTAL_TICKETS);

      // Further attempt by any worker must return null (all tickets leased)
      const excessClaim = await credentialRepo.claimUnrenderedTicketLease(eventId, workerA, 60000);
      expect(excessClaim).toBeNull();
    });

    it('CH-1.3: Active unexpired worker leases cannot be stolen by competing workers', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
      });

      // Worker 1 claims job with 10-minute lease
      const worker1 = 'worker-original-owner';
      const claimed = await jobRepo.claimJob(job._id.toString(), worker1, 600000);
      expect(claimed).toBeTruthy();
      expect(claimed?.lockedBy).toBe(worker1);

      // Worker 2 attempts to claim the same job while unexpired
      const worker2 = 'worker-hostile-intruder';
      const intruderClaim = await jobRepo.claimJob(job._id.toString(), worker2, 600000);
      // Must be rejected!
      expect(intruderClaim).toBeNull();

      // Intruder attempts to mark job completed or update progress
      const intruderProgress = await jobRepo.updateProgress(
        job._id.toString(),
        { processed: 5 },
        undefined,
        worker2
      );
      expect(intruderProgress).toBeNull();

      const intruderComplete = await jobRepo.markCompleted(
        job._id.toString(),
        { importedCount: 0, renderedCount: 10, errorLog: [] },
        worker2
      );
      expect(intruderComplete).toBeNull();

      // Original worker can still update progress and renew lease
      const ownerRenew = await jobRepo.renewLease(job._id.toString(), worker1, 600000);
      expect(ownerRenew).toBe(true);

      const ownerProgress = await jobRepo.updateProgress(
        job._id.toString(),
        { processed: 5, succeeded: 5 },
        undefined,
        worker1
      );
      expect(ownerProgress).toBeTruthy();
      expect(ownerProgress?.progress.processed).toBe(5);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Crash Recovery & Immediate Startup Reset
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 2: Crash Recovery & Immediate Startup Reset', () => {
    it('CH-2.1: recoverAbandonedJobs(true) immediately resets active PROCESSING jobs to QUEUED on server startup', async () => {
      // Simulate crashed worker leaving job in PROCESSING with 9 minutes remaining on lease
      const activeJob = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-crashed-pid-777',
        lockExpiresAt: new Date(Date.now() + 540000), // 9 min in future
        attempts: 1,
        maxAttempts: 3,
        progress: { total: 10, processed: 4, succeeded: 4, failed: 0, percentage: 40 },
      });

      // Regular recovery with 0ms grace does NOT touch unexpired lease
      const regularRecovery = await jobRepo.recoverAbandonedJobs(0, false);
      expect(regularRecovery.recovered).toBe(0);

      const stillProcessing = await jobRepo.findById(activeJob._id.toString());
      expect(stillProcessing?.status).toBe('PROCESSING');

      // Server restart triggers startup recovery: recoverAbandonedJobs(true)
      const startupRecovery = await jobRepo.recoverAbandonedJobs(true);
      expect(startupRecovery.recovered).toBe(1);
      expect(startupRecovery.failed).toBe(0);

      // Job is immediately reset to QUEUED, lock cleared, nextRunAt set to now
      const recoveredJob = await jobRepo.findById(activeJob._id.toString());
      expect(recoveredJob?.status).toBe('QUEUED');
      expect(recoveredJob?.lockedBy).toBeNull();
      expect(recoveredJob?.lockExpiresAt).toBeNull();
      expect(recoveredJob?.failureReason).toBe('Recovered from abandoned worker process');

      // Healthy worker can immediately claim and resume without waiting 9 minutes
      const newWorkerClaim = await jobRepo.claimJob(activeJob._id.toString(), 'worker-healthy-new');
      expect(newWorkerClaim).toBeTruthy();
      expect(newWorkerClaim?.status).toBe('PROCESSING');
      expect(newWorkerClaim?.lockedBy).toBe('worker-healthy-new');
      expect(newWorkerClaim?.attempts).toBe(2);
    });

    it('CH-2.2: recoverAbandonedJobs marks exhausted jobs FAILED instead of infinitely requeueing', async () => {
      // Job that already reached maxAttempts (3) crashes on its 3rd attempt
      const exhaustedJob = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-crashed-pid-999',
        lockExpiresAt: new Date(Date.now() + 540000),
        attempts: 3,
        maxAttempts: 3,
        progress: { total: 10, processed: 2, succeeded: 2, failed: 0, percentage: 20 },
      });

      const recovery = await jobRepo.recoverAbandonedJobs(true);
      expect(recovery.failed).toBe(1);
      expect(recovery.recovered).toBe(0);

      const finalJob = await jobRepo.findById(exhaustedJob._id.toString());
      expect(finalJob?.status).toBe('FAILED');
      expect(finalJob?.errorMessage).toContain('exceeded maximum retry attempts');
      expect(finalJob?.lockedBy).toBeNull();
    });

    it('CH-2.3: Stale crashed worker cannot write progress or completion after lease reclaim', async () => {
      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-stale-alpha',
        lockExpiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago!
        attempts: 1,
        maxAttempts: 3,
      });

      // Worker Beta reclaims the expired job
      const workerBeta = 'worker-active-beta';
      const reclaimed = await jobRepo.claimJob(job._id.toString(), workerBeta, 30000);
      expect(reclaimed).toBeTruthy();
      expect(reclaimed?.lockedBy).toBe(workerBeta);

      // Stale Worker Alpha wakes up from GC pause and tries to update progress
      const staleProgress = await jobRepo.updateProgress(
        job._id.toString(),
        { processed: 5, succeeded: 5 },
        undefined,
        'worker-stale-alpha'
      );
      // Must be rejected!
      expect(staleProgress).toBeNull();

      // Stale Worker Alpha tries to markCompleted
      const staleComplete = await jobRepo.markCompleted(
        job._id.toString(),
        { importedCount: 0, renderedCount: 10, errorLog: [] },
        'worker-stale-alpha'
      );
      // Must be rejected!
      expect(staleComplete).toBeNull();

      // Job is still owned by Worker Beta
      const currentJob = await jobRepo.findById(job._id.toString());
      expect(currentJob?.lockedBy).toBe(workerBeta);
      expect(currentJob?.status).toBe('PROCESSING');
    });

    it('CH-2.4: Mid-batch crash during rendering leaves completed assets intact and resumes only remaining tickets', async () => {
      const TOTAL = 6;
      const credentials = seedCredentials(TOTAL, 0);

      // Wire credentialRepo methods to in-memory state
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

      (credentialRepo as any).markRenderFailed = jest.fn().mockImplementation(
        async (credId: string, error: string) => {
          const cred = inMemoryCredentials.get(credId.toString());
          if (!cred) return;
          cred.renderStatus = 'FAILED';
          cred.renderError = error;
          cred.renderingLockedBy = null;
          cred.renderingLockExpiresAt = new Date(Date.now() + 60000);
        }
      );

      (credentialRepo as any).claimUnrenderedTicketLease = jest.fn().mockImplementation(
        async (eId: string, workerId: string, leaseMs: number = 30000) => {
          const now = new Date();
          for (const cred of inMemoryCredentials.values()) {
            if (cred.eventId.toString() !== eId.toString()) continue;
            if (cred.renderStatus === 'COMPLETED') continue;

            const isPending = !cred.renderStatus || cred.renderStatus === 'PENDING';
            const isExpired =
              (cred.renderStatus === 'PROCESSING' || cred.renderStatus === 'FAILED') &&
              cred.renderingLockExpiresAt &&
              new Date(cred.renderingLockExpiresAt) < now;

            if (isPending || isExpired) {
              cred.renderStatus = 'PROCESSING';
              cred.renderingLockedBy = workerId;
              cred.renderingLockExpiresAt = new Date(now.getTime() + leaseMs);
              return cred;
            }
          }
          return null;
        }
      );

      (credentialRepo as any).markRenderFailed = jest.fn().mockImplementation(
        async (credId: string, error: string) => {
          const cred = inMemoryCredentials.get(credId.toString());
          if (!cred) return;
          cred.renderStatus = 'FAILED';
          cred.renderError = error;
          cred.renderingLockedBy = null;
          cred.renderingLockExpiresAt = new Date(Date.now() + 60000);
        }
      );

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
          cred.renderingLockExpiresAt = new Date(Date.now() + 60000);
        }
      );

      let renderAttempts = 0;
      let sharpCalls = 0;

      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId: string, credId: string) => {
          renderAttempts++;
          const storagePath = `events/${eId}/credentials/${credId}.png`;

          // If asset already in storage, skip Sharp
          if (inMemoryStorage.has(storagePath)) {
            return {
              storagePath,
              publicUrl: `https://storage.ticketification.app/${storagePath}`,
            };
          }

          // Simulate worker crash on ticket 4
          if (renderAttempts === 4) {
            throw new Error('Fatal worker crash during Sharp rasterization of ticket 4');
          }

          sharpCalls++;
          inMemoryStorage.set(storagePath, Buffer.from(`png-content-${credId}`));
          return {
            storagePath,
            publicUrl: `https://storage.ticketification.app/${storagePath}`,
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
          cred.renderingLockExpiresAt = new Date(Date.now() + 60000);
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

      // Worker 1 runs and crashes on ticket 4
      await queueService.executeJob(job._id.toString());

      // Job was released for retry
      const jobAfterCrash = await jobRepo.findById(job._id.toString());
      expect(jobAfterCrash?.status).toBe('QUEUED');
      expect(jobAfterCrash?.attempts).toBe(1);

      // Tickets 1, 2, 3, 5, 6 succeeded; Ticket 4 failed
      expect(inMemoryStorage.size).toBe(5);
      expect(credentials[0].renderStatus).toBe('COMPLETED');
      expect(credentials[1].renderStatus).toBe('COMPLETED');
      expect(credentials[2].renderStatus).toBe('COMPLETED');
      expect(credentials[3].renderStatus).toBe('FAILED');
      expect(credentials[4].renderStatus).toBe('COMPLETED');
      expect(credentials[5].renderStatus).toBe('COMPLETED');

      // Expire any lingering lock on ticket 4
      credentials[3].renderingLockExpiresAt = new Date(Date.now() - 1000);
      const inMemCred4 = inMemoryCredentials.get(credentials[3]._id.toString());
      if (inMemCred4) inMemCred4.renderingLockExpiresAt = new Date(Date.now() - 1000);
      jobAfterCrash.nextRunAt = new Date(Date.now() - 1000);

      // Worker 2 takes over and finishes the job
      await queueService.executeJob(job._id.toString());

      const finalJob = await jobRepo.findById(job._id.toString());
      expect(finalJob?.status).toBe('COMPLETED');
      expect(finalJob?.result.renderedCount).toBe(TOTAL);

      // All 6 tickets completed in storage and DB
      expect(inMemoryStorage.size).toBe(TOTAL);
      for (const cred of inMemoryCredentials.values()) {
        expect(cred.renderStatus).toBe('COMPLETED');
        expect(cred.asset?.publicUrl).toBeTruthy();
      }

      // Tickets 1, 2, 3 were NOT re-rasterized with Sharp on resume!
      // Total Sharp calls: 3 (attempt 1) + 3 (attempt 2 for tickets 4, 5, 6) = 6
      expect(sharpCalls).toBe(TOTAL);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: Active Job Coalescing & Repeat Clicks
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 3: Active Job Coalescing & Repeat Clicks', () => {
    it('CH-3.1: Sequential repeated Continue clicks correctly coalesce into existing active job', async () => {
      // Mock findActiveJob in repository to inspect in-memory jobs
      jest.spyOn(jobRepo, 'findActiveJob').mockImplementation(async (eId: string, type: any) => {
        for (const job of inMemoryJobs.values()) {
          if (
            job.eventId.toString() === eId.toString() &&
            job.jobType === type &&
            ['QUEUED', 'PROCESSING'].includes(job.status)
          ) {
            return { ...job };
          }
        }
        return null;
      });

      // Sequential clicks: Click 1 creates active job
      const job1 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      expect(inMemoryJobs.size).toBe(1);

      // Clicks 2, 3, 4, 5 arrive sequentially while job is active
      const job2 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      const job3 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      const job4 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      const job5 = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });

      // Invariant: Exactly ONE job document exists in the queue
      expect(inMemoryJobs.size).toBe(1);

      // Invariant: All calls returned the exact same job ID
      expect(job2._id.toString()).toBe(job1._id.toString());
      expect(job3._id.toString()).toBe(job1._id.toString());
      expect(job4._id.toString()).toBe(job1._id.toString());
      expect(job5._id.toString()).toBe(job1._id.toString());
    });

    it('CH-3.2: In-Flight Coalescing: 20 simultaneous enqueue calls are coalesced and create exactly 1 job', async () => {
      // Mock findActiveJob to query inMemoryJobs with immediate async resolution (simulating DB query)
      jest.spyOn(jobRepo, 'findActiveJob').mockImplementation(async (eId: string, type: any) => {
        const active = Array.from(inMemoryJobs.values()).find(
          (j) =>
            j.eventId.toString() === eId.toString() &&
            j.jobType === type &&
            ['QUEUED', 'PROCESSING'].includes(j.status)
        );
        return active ? { ...active } : null;
      });

      // Fire 20 simultaneous calls concurrently
      const enqueueCalls = await Promise.all(
        Array.from({ length: 20 }, () =>
          queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId })
        )
      );

      expect(enqueueCalls.length).toBe(20);
      const uniqueIds = new Set(enqueueCalls.map((j) => j._id.toString()));
      expect(uniqueIds.size).toBe(1);
    });

    it('CH-3.3: findActiveJob in repository returns active job when database is connected', async () => {
      // Un-mock findActiveJob to test actual repository code
      const realRepo = new MongoEventJobRepository();

      // Seed an active job in memory
      await EventJobModel.create({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
      });

      const activeJob = await realRepo.findActiveJob(eventId, 'BULK_RENDER_ASSETS');
      expect(activeJob).not.toBeNull();
      expect(activeJob?.status).toBe('PROCESSING');
    });
  });
});
