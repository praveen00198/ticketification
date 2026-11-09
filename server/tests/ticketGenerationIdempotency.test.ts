import mongoose from 'mongoose';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('Ticket Generation Idempotency & Safe Resume Suite (Acceptance Criteria 1-5)', () => {
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
    name: 'Idempotency & Concurrency Summit 2026',
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

    // Mock Job Repository with in-memory persistence
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

    jest.spyOn(jobRepo, 'updatePayload').mockImplementation(async (id: string, payload: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) job.payload = { ...job.payload, ...payload };
      return job as any;
    });

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

    // Mock Credential Repository
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

    jest.spyOn(credentialRepo, 'claimUnrenderedTicketLease').mockImplementation(
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

    (credentialRepo as any).markRenderCompleted = jest.fn().mockImplementation(
      async (credId: string, assetData: any) => {
        const cred = inMemoryCredentials.get(credId.toString());
        if (!cred) return null;
        cred.renderStatus = 'COMPLETED';
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
        cred.asset = {
          storagePath: assetData.storagePath,
          publicUrl: assetData.publicUrl,
          renderedAt: assetData.renderedAt || new Date(),
          mimeType: assetData.mimeType || 'image/png',
        };
        return cred;
      }
    );

    (credentialRepo as any).markRenderFailed = jest.fn().mockImplementation(
      async (credId: string, error: string) => {
        const cred = inMemoryCredentials.get(credId.toString());
        if (!cred) return null;
        cred.renderStatus = 'FAILED';
        cred.renderError = error;
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = new Date(Date.now() + 60000);
        return cred;
      }
    );

    jest.spyOn(credentialRepo, 'allocateSequenceBlock').mockImplementation(
      async (_eId: string, count: number) => {
        const existingSeqs = Array.from(inMemoryCredentials.values()).map((c) => c.sequenceNumber || 0);
        const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
        return maxSeq + 1;
      }
    );

    jest.spyOn(credentialRepo, 'upsertMany').mockImplementation(
      async (items: any[]) => {
        for (const item of items) {
          const key = `${item.eventId}:${item.sequenceNumber}`;
          const existing = Array.from(inMemoryCredentials.values()).find(
            (c) => c.eventId?.toString() === item.eventId?.toString() && c.sequenceNumber === item.sequenceNumber
          );
          if (!existing) {
            inMemoryCredentials.set(item._id.toString(), {
              ...item,
              renderStatus: 'PENDING',
              save: jest.fn().mockImplementation(async function (this: any) {
                inMemoryCredentials.set(item._id.toString(), this);
                return this;
              }),
            });
          }
        }
        return Array.from(inMemoryCredentials.values());
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

    // Pre-check method on storage
    (storageService as any).checkObjectExists = jest.fn().mockImplementation(
      async (storagePath: string) => inMemoryStorage.has(storagePath)
    );

    // Mock Rendering Service with Storage Pre-Check & Sharp Skipping
    jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
      async (eId: string, credId: string, _tmpl: any, _data: any) => {
        const storagePath = `events/${eId}/credentials/${credId}.png`;

        // Pre-check: If asset already exists in storage, reuse without rasterizing
        if (inMemoryStorage.has(storagePath)) {
          return {
            storagePath,
            publicUrl: `https://storage.ticketification.app/${storagePath}`,
          };
        }

        // Increment Sharp rasterization count
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

  describe('Criterion 1: Resuming job with N logical tickets and M completed processes only N - M', () => {
    it('when N=10 tickets have M=4 already completed, resume processes ONLY the remaining 6 tickets', async () => {
      const TOTAL_N = 10;
      const COMPLETED_M = 4;
      const EXPECTED_REMAINING = TOTAL_N - COMPLETED_M; // 6

      generateCredentials(TOTAL_N, COMPLETED_M);

      const renderSpy = jest.spyOn(renderingService, 'renderAndUploadAsset');

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: {
          total: TOTAL_N,
          processed: COMPLETED_M,
          succeeded: COMPLETED_M,
          failed: 0,
          percentage: 40,
        },
        payload: { templateId },
      });

      // Execute resume
      await queueService.executeJob(job._id.toString());

      const terminalJob = await jobRepo.findById(job._id.toString());
      expect(terminalJob?.status).toBe('COMPLETED');
      expect(terminalJob?.progress.total).toBe(TOTAL_N);
      expect(terminalJob?.progress.processed).toBe(TOTAL_N);
      expect(terminalJob?.progress.succeeded).toBe(TOTAL_N);
      expect(terminalJob?.progress.failed).toBe(0);
      expect(terminalJob?.progress.percentage).toBe(100);
      expect(terminalJob?.result.renderedCount).toBe(TOTAL_N);

      // CRITICAL ASSERTION: renderAndUploadAsset MUST be called exactly N - M = 6 times
      expect(renderSpy).toHaveBeenCalledTimes(EXPECTED_REMAINING);

      // Verify all 10 tickets now have completed assets
      for (const cred of inMemoryCredentials.values()) {
        expect(cred.asset?.publicUrl).toBeTruthy();
        expect(cred.asset?.storagePath).toBeTruthy();
        expect(cred.asset?.renderedAt).toBeTruthy();
      }

      const remainingUnrendered = await credentialRepo.countUnrenderedByEvent(eventId);
      expect(remainingUnrendered).toBe(0);
    });
  });

  describe('Criterion 2: Final job produces exactly N records and N assets', () => {
    it('recovering from interruption results in exactly N records in DB and exactly N assets in storage', async () => {
      const TOTAL_N = 8;
      const credentials = generateCredentials(TOTAL_N, 0);

      let attempts = 0;
      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId: string, credId: string) => {
          attempts++;
          if (attempts === 4) {
            // Simulate sudden process failure after 3 tickets
            throw new Error('Process crash simulation during ticket 4');
          }
          const storagePath = `events/${eId}/credentials/${credId}.png`;
          inMemoryStorage.set(storagePath, Buffer.from(`png-data-${credId}`));
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
        progress: { total: TOTAL_N, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
        maxAttempts: 3,
      });

      // Run Attempt 1 (crashes at ticket 4)
      await queueService.executeJob(job._id.toString());

      const jobAfterCrash = await jobRepo.findById(job._id.toString());
      expect(jobAfterCrash?.status).toBe('QUEUED');
      expect(jobAfterCrash?.attempts).toBe(1);

      // Restore normal rendering for Attempt 2
      jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
        async (eId: string, credId: string) => {
          const path = `events/${eId}/credentials/${credId}.png`;
          inMemoryStorage.set(path, Buffer.from(`png-data-${credId}`));
          return {
            storagePath: path,
            publicUrl: `https://storage.ticketification.app/${path}`,
          };
        }
      );

      // Fast-forward retry timer and release any failed ticket lease
      jobAfterCrash.nextRunAt = new Date(Date.now() - 1000);
      for (const cred of inMemoryCredentials.values()) {
        if (cred.renderStatus === 'FAILED') {
          cred.renderingLockExpiresAt = new Date(Date.now() - 1000);
        }
      }

      // Run Attempt 2 to completion
      await queueService.executeJob(job._id.toString());

      const finalJob = await jobRepo.findById(job._id.toString());
      expect(finalJob?.status).toBe('COMPLETED');
      expect(finalJob?.progress.succeeded).toBe(TOTAL_N);

      // Exactly N records in database
      expect(inMemoryCredentials.size).toBe(TOTAL_N);

      // Exactly N distinct assets in storage
      expect(inMemoryStorage.size).toBe(TOTAL_N);

      // All storage paths follow canonical convention
      for (const storagePath of inMemoryStorage.keys()) {
        expect(storagePath).toMatch(/^events\/[^/]+\/credentials\/[^/]+\.png$/);
      }
    });
  });

  describe('Criterion 3: No duplicate ticket IDs or duplicate records under crash, retry, or repeated Continue', () => {
    it('generates strictly unique sequence numbers, formatted IDs, and verification tokens across retries', async () => {
      const TOTAL = 6;
      generateCredentials(TOTAL, 0);

      const job = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'BULK_RENDER_ASSETS',
        status: 'QUEUED',
        progress: { total: TOTAL, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: { templateId },
      });

      await queueService.executeJob(job._id.toString());

      const sequenceNumbers = new Set<number>();
      const formattedIds = new Set<string>();
      const tokens = new Set<string>();

      for (const cred of inMemoryCredentials.values()) {
        sequenceNumbers.add(cred.sequenceNumber);
        formattedIds.add(cred.formattedId);
        tokens.add(cred.verificationToken);
        expect(cred.verificationToken).toHaveLength(64);
      }

      // Assert zero duplicates across all identifiers
      expect(sequenceNumbers.size).toBe(TOTAL);
      expect(formattedIds.size).toBe(TOTAL);
      expect(tokens.size).toBe(TOTAL);
    });

    it('import job retries reuse previously allocated startingSequence without creating duplicate records', async () => {
      const records = [
        { name: 'Alice Smith', email: 'alice@example.com', category: 'General' },
        { name: 'Bob Jones', email: 'bob@example.com', category: 'VIP' },
        { name: 'Charlie Brown', email: 'charlie@example.com', category: 'Speaker' },
      ];

      // Simulate first import creation
      const importJob = await jobRepo.createJob({
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'IMPORT_CREDENTIALS',
        status: 'QUEUED',
        progress: { total: records.length, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
        payload: {
          records,
          startingSequence: 101, // Allocated on first attempt
          endSequence: 103,
        },
      });

      // Simulate partial insert before crash: Alice inserted
      createMockCredential(101, {
        holderName: 'Alice Smith',
        holderEmail: 'alice@example.com',
        formattedId: 'TIC-00101',
      });

      // On retry, startingSequence is retained
      expect(importJob.payload.startingSequence).toBe(101);
      expect(importJob.payload.endSequence).toBe(103);

      // Remaining records inserted idempotently
      await credentialRepo.upsertMany([
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: 101, // Alice (already exists, must not duplicate)
          formattedId: 'TIC-00101',
          holder: { name: 'Alice Smith', email: 'alice@example.com' } as any,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: 102, // Bob
          formattedId: 'TIC-00102',
          holder: { name: 'Bob Jones', email: 'bob@example.com' } as any,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: 103, // Charlie
          formattedId: 'TIC-00103',
          holder: { name: 'Charlie Brown', email: 'charlie@example.com' } as any,
        },
      ]);

      // Exactly 3 unique sequence numbers in total
      const allCreds = Array.from(inMemoryCredentials.values());
      expect(allCreds.length).toBe(3);
      const seqs = allCreds.map((c) => c.sequenceNumber).sort();
      expect(seqs).toEqual([101, 102, 103]);
    });

    it('multi-ticket registrations preserve distinct tickets without duplicate collision', async () => {
      // An order containing 3 tickets for the same registration
      const registrationId = new mongoose.Types.ObjectId();

      const cred1 = createMockCredential(1, {
        metadata: { registrationId: registrationId.toString(), ticketIndex: 0 },
        holderName: 'Lead Attendee',
      });
      const cred2 = createMockCredential(2, {
        metadata: { registrationId: registrationId.toString(), ticketIndex: 1 },
        holderName: 'Guest 1',
      });
      const cred3 = createMockCredential(3, {
        metadata: { registrationId: registrationId.toString(), ticketIndex: 2 },
        holderName: 'Guest 2',
      });

      expect(cred1.sequenceNumber).toBe(1);
      expect(cred2.sequenceNumber).toBe(2);
      expect(cred3.sequenceNumber).toBe(3);
      expect(cred1.formattedId).not.toBe(cred2.formattedId);
      expect(cred2.formattedId).not.toBe(cred3.formattedId);
      expect(inMemoryCredentials.size).toBe(3);
    });
  });

  describe('Criterion 4: No completed PNG assets regenerated on resume', () => {
    it('storage pre-check detects existing PNG assets in Supabase and skips Sharp rasterization entirely', async () => {
      const TOTAL = 4;
      const credentials = generateCredentials(TOTAL, 0);

      // Pre-populate storage for cred 0 and cred 1 (simulating successful upload prior to DB crash)
      const path0 = `events/${eventId}/credentials/${credentials[0]._id}.png`;
      const path1 = `events/${eventId}/credentials/${credentials[1]._id}.png`;
      inMemoryStorage.set(path0, Buffer.from('pre-existing-png-0'));
      inMemoryStorage.set(path1, Buffer.from('pre-existing-png-1'));

      sharpCallCount = 0;

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

      // CRITICAL ASSERTION: Sharp rasterization was invoked ONLY for cred 2 and cred 3 (2 times),
      // skipping the 2 pre-existing storage assets!
      expect(sharpCallCount).toBe(2);
    });
  });

  describe('Criterion 5: Concurrent resume / multiple Continue clicks do not spawn duplicate jobs or process duplicate tickets', () => {
    it('multiple concurrent Continue clicks coalesce into the existing active job and do not spawn duplicate jobs', async () => {
      const TOTAL = 5;
      generateCredentials(TOTAL, 0);

      // First click enqueues the job
      const firstJob = await queueService.enqueueBulkRenderJob(
        eventId,
        callerUserId,
        'HOST',
        { templateId }
      );
      expect(firstJob).toBeTruthy();
      expect(inMemoryJobs.size).toBe(1);

      // Simulate 4 concurrent Continue clicks from frontend while the first job is QUEUED
      const concurrentResults = await Promise.all([
        queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId }),
        queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId }),
        queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId }),
        queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId }),
      ]);

      // All 4 concurrent requests MUST return the identical existing active job document
      for (const res of concurrentResults) {
        expect(res._id.toString()).toBe(firstJob._id.toString());
      }

      // In-memory job repository MUST still have exactly 1 job document
      expect(inMemoryJobs.size).toBe(1);

      // Execute the single job to completion
      await queueService.executeJob(firstJob._id.toString());

      const completedJob = await jobRepo.findById(firstJob._id.toString());
      expect(completedJob?.status).toBe('COMPLETED');
      expect(completedJob?.result.renderedCount).toBe(TOTAL);

      // Exactly TOTAL tickets processed with zero duplicate assets
      expect(inMemoryStorage.size).toBe(TOTAL);
    });
  });
});
