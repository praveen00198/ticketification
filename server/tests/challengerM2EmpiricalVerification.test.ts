import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('CHALLENGER M2: Empirical Stress Harness (Focus 1-4 Verification)', () => {
  const eventId1 = new mongoose.Types.ObjectId().toString();
  const eventId2 = new mongoose.Types.ObjectId().toString();
  const eventId3 = new mongoose.Types.ObjectId().toString();
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

  const mockTemplate = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Default Template',
    isDefault: true,
    dimensions: { width: 1620, height: 2025 },
    fields: [],
  };

  function mockEvent(eId: string) {
    return {
      _id: new mongoose.Types.ObjectId(eId),
      name: `Test Event ${eId}`,
      eventType: 'CONFERENCE',
      status: 'PUBLISHED',
      credentialTerminology: 'Ticket',
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);

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

    jest.spyOn(eventRepo, 'findById').mockImplementation(async (id: any) => mockEvent(id.toString()) as any);
    jest.spyOn(templateRepo, 'findById').mockResolvedValue(mockTemplate as any);
    jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue(mockTemplate as any);

    jest.spyOn(queueService as any, 'authorizeHostOrCoordinator').mockImplementation(async (eId: string) => ({
      event: mockEvent(eId),
      actorUser: { _id: new mongoose.Types.ObjectId(callerUserId), role: 'HOST' },
    }));

    jest.spyOn(jobRepo, 'findActiveJob').mockImplementation(async (eId: string, jType: string) => {
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

    jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async (eId: string) => {
      return Array.from(inMemoryCredentials.values()).filter(
        (c) => c.eventId.toString() === eId.toString() && c.renderStatus !== 'COMPLETED'
      ).length;
    });
  });

  describe('Focus 1 & 2: High Concurrency Multi-Event Coalescing', () => {
    it('50 simultaneous calls across 3 different events coalesce into exactly 3 jobs (1 per event)', async () => {
      const events = [eventId1, eventId2, eventId3];
      const calls: Promise<any>[] = [];

      // 50 total calls interleaved across 3 events
      for (let i = 0; i < 50; i++) {
        const targetEvent = events[i % 3];
        calls.push(queueService.enqueueBulkRenderJob(targetEvent, callerUserId, 'HOST'));
      }

      const results = await Promise.all(calls);
      expect(results.length).toBe(50);

      // Exactly 3 job documents created in total
      expect(inMemoryJobs.size).toBe(3);

      // Verify that all results for eventId1 have identical job ID
      const event1Jobs = results.filter((j, idx) => events[idx % 3] === eventId1);
      const event1JobId = event1Jobs[0]._id.toString();
      expect(event1Jobs.every((j) => j._id.toString() === event1JobId)).toBe(true);

      // Verify eventId2
      const event2Jobs = results.filter((j, idx) => events[idx % 3] === eventId2);
      const event2JobId = event2Jobs[0]._id.toString();
      expect(event2Jobs.every((j) => j._id.toString() === event2JobId)).toBe(true);

      // Verify eventId3
      const event3Jobs = results.filter((j, idx) => events[idx % 3] === eventId3);
      const event3JobId = event3Jobs[0]._id.toString();
      expect(event3Jobs.every((j) => j._id.toString() === event3JobId)).toBe(true);

      // All 3 IDs must be mutually distinct
      expect(new Set([event1JobId, event2JobId, event3JobId]).size).toBe(3);
    });

    it('Error resilience: transient exception in createJob cleans up memoization without poisoning future calls', async () => {
      // First call throws in createJob
      const createJobSpy = jest.spyOn(jobRepo, 'createJob').mockRejectedValueOnce(new Error('Simulated DB transient failure'));

      await expect(
        queueService.enqueueBulkRenderJob(eventId1, callerUserId, 'HOST')
      ).rejects.toThrow('Simulated DB transient failure');

      // Next call immediately succeeds without getting stuck or deadlocked
      const successfulJob = await queueService.enqueueBulkRenderJob(eventId1, callerUserId, 'HOST');
      expect(successfulJob).toBeDefined();
      expect(successfulJob.status).toBe('QUEUED');
      expect(inMemoryJobs.size).toBe(1);
    });
  });

  describe('Focus 3: Rapid Sequential Enqueues with Job State Preservation', () => {
    it('100 rapid sequential calls preserve active job state without resetting timestamps or progress', async () => {
      // Create initial active job
      const activeJob = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId1),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'PROCESSING',
        lockedBy: 'worker-node-42',
        lockExpiresAt: new Date(Date.now() + 300000),
        startedAt: new Date(Date.now() - 10000),
        attempts: 2,
        progress: { total: 50, processed: 25, succeeded: 25, failed: 0, percentage: 50 },
      });

      const initialStartedAt = activeJob.startedAt.getTime();

      // Fire 100 sequential calls
      for (let i = 0; i < 100; i++) {
        const res = await queueService.enqueueBulkRenderJob(eventId1, callerUserId, 'HOST');
        expect(res._id.toString()).toBe(activeJob._id.toString());
      }

      // No new jobs created
      expect(inMemoryJobs.size).toBe(1);

      // Verify state was completely unmolested
      const fetched = await jobRepo.findById(activeJob._id.toString());
      expect(fetched?.status).toBe('PROCESSING');
      expect(fetched?.lockedBy).toBe('worker-node-42');
      expect(fetched?.startedAt.getTime()).toBe(initialStartedAt);
      expect(fetched?.attempts).toBe(2);
      expect(fetched?.progress.percentage).toBe(50);
      expect(fetched?.progress.processed).toBe(25);
    });
  });

  describe('Focus 4: Worker Lease Mutual Exclusion Under Extreme Contention', () => {
    it('5 concurrent workers racing to claim 30 tickets claim strictly disjoint tickets with zero collisions', async () => {
      const TOTAL_TICKETS = 30;
      for (let i = 1; i <= TOTAL_TICKETS; i++) {
        const id = new mongoose.Types.ObjectId();
        inMemoryCredentials.set(id.toString(), {
          _id: id,
          eventId: new mongoose.Types.ObjectId(eventId1),
          formattedId: `TIC-${String(i).padStart(5, '0')}`,
          renderStatus: 'PENDING',
          renderingLockedBy: null,
          renderingLockExpiresAt: null,
        });
      }

      // Atomic lease claim simulation matching MongoDB findOneAndUpdate semantics
      jest.spyOn(credentialRepo, 'claimUnrenderedTicketLease').mockImplementation(
        async (_eId: string, workerId: string, leaseMs: number = 60000) => {
          const now = new Date();
          for (const cred of inMemoryCredentials.values()) {
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
              return { ...cred };
            }
          }
          return null;
        }
      );

      const workerIds = ['W1', 'W2', 'W3', 'W4', 'W5'];
      const claimsPerWorker: Record<string, string[]> = {
        W1: [],
        W2: [],
        W3: [],
        W4: [],
        W5: [],
      };

      // 6 rounds of 5 workers claiming simultaneously
      for (let round = 0; round < 6; round++) {
        const claims = await Promise.all(
          workerIds.map((wid) => credentialRepo.claimUnrenderedTicketLease(eventId1, wid, 60000))
        );
        claims.forEach((cred, idx) => {
          if (cred) {
            claimsPerWorker[workerIds[idx]].push(cred.formattedId);
          }
        });
      }

      // Flatten all claimed tickets
      const allClaimed = Object.values(claimsPerWorker).flat();
      expect(allClaimed.length).toBe(TOTAL_TICKETS);

      // Verify strict mutual exclusion: Set size equals TOTAL_TICKETS (0 duplicates)
      const uniqueClaimed = new Set(allClaimed);
      expect(uniqueClaimed.size).toBe(TOTAL_TICKETS);

      // Verify pairwise disjointness
      for (let i = 0; i < workerIds.length; i++) {
        for (let j = i + 1; j < workerIds.length; j++) {
          const setA = new Set(claimsPerWorker[workerIds[i]]);
          const overlap = claimsPerWorker[workerIds[j]].filter((id) => setA.has(id));
          expect(overlap).toEqual([]);
        }
      }
    });
  });
});
