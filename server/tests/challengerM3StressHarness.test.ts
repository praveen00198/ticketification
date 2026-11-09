import mongoose from 'mongoose';
import config from '../src/config/env';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { setMongoConnectedForTesting } from '../src/db/mongodb';
import { StorageError } from '../src/middlewares/error.middleware';

describe('Adversarial Challenger M3: Empirical Stress Harness for Asset Reuse & Sharp Rasterization Skipping', () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const templateId = new mongoose.Types.ObjectId().toString();
  const callerUserId = new mongoose.Types.ObjectId().toString();

  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let templateRepo: MongoEventCredentialTemplateRepository;
  let eventRepo: MongoEventRepository;
  let storageService: SupabaseStorageService;
  let renderingService: EventCredentialRenderingService;
  let queueService: EventJobQueueService;

  let inMemoryJobs: Map<string, any>;
  let inMemoryCredentials: Map<string, any>;
  let inMemoryStorage: Map<string, Buffer>;
  let sharpBufferCallCount: number;

  const mockEvent = {
    _id: new mongoose.Types.ObjectId(eventId),
    name: 'Challenger M3 Stress Summit 2026',
    eventType: 'CONFERENCE',
    status: 'PUBLISHED',
    credentialTerminology: 'Ticket',
    schedule: {
      startAt: new Date('2026-11-20T09:00:00Z'),
      endAt: new Date('2026-11-20T18:00:00Z'),
    },
    venue: {
      name: 'Empirical Arena',
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

  // Valid 1x1 PNG buffer to satisfy binary PNG validation
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  function createMockCredential(sequenceNumber: number, overrides: any = {}) {
    const id = overrides._id || new mongoose.Types.ObjectId();
    const formattedId = overrides.formattedId || `CHAL-${sequenceNumber.toString().padStart(5, '0')}`;
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
        name: overrides.holderName || `Challenger Attendee ${sequenceNumber}`,
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

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);

    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();
    inMemoryStorage = new Map();
    sharpBufferCallCount = 0;

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

    // Repositories
    jest.spyOn(eventRepo, 'findById').mockResolvedValue(mockEvent as any);
    jest.spyOn(templateRepo, 'findById').mockResolvedValue(mockTemplate as any);
    jest.spyOn(templateRepo, 'findDefaultByEventId').mockResolvedValue(mockTemplate as any);

    jest.spyOn(queueService as any, 'authorizeHostOrCoordinator').mockResolvedValue({
      event: mockEvent,
      actorUser: { _id: new mongoose.Types.ObjectId(callerUserId), role: 'HOST' },
    });

    // Mock in-memory Job Repo
    jest.spyOn(jobRepo, 'findActiveJob').mockImplementation(async (eId: string, jType: any) => {
      return Array.from(inMemoryJobs.values()).find(
        (j) => j.eventId?.toString() === eId && j.jobType === jType && ['QUEUED', 'PROCESSING'].includes(j.status)
      ) || null;
    });

    jest.spyOn(jobRepo, 'createJob').mockImplementation(async (data: any) => {
      const id = new mongoose.Types.ObjectId().toString();
      const job: any = {
        _id: new mongoose.Types.ObjectId(id),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: data.attempts || 0,
        maxAttempts: data.maxAttempts || 3,
        result: data.result || { renderedCount: 0, errorLog: [] },
      };
      inMemoryJobs.set(id, job);
      return job;
    });

    jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: string) => {
      return inMemoryJobs.get(id.toString()) || null;
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

    jest.spyOn(jobRepo, 'renewLease').mockImplementation(async (id: string, workerId: string) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return false;
      if (job.status === 'PROCESSING' && job.lockedBy === workerId) {
        job.lockExpiresAt = new Date(Date.now() + 600000);
        return true;
      }
      return false;
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

    // Mock in-memory Credential Repo
    jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockImplementation(async (eId: string) => {
      return Array.from(inMemoryCredentials.values()).filter(
        (c) => c.eventId?.toString() === eId && c.renderStatus !== 'COMPLETED' && (!c.asset?.publicUrl || !c.asset?.renderedAt)
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

    // Atomic ticket lease claiming
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

    (credentialRepo as any).markRenderCompleted = jest.fn().mockImplementation(
      async (credId: string, assetData: any) => {
        const cred = inMemoryCredentials.get(credId.toString());
        if (!cred) return;
        cred.asset = assetData;
        cred.renderStatus = 'COMPLETED';
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
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

    // Mock storageService configuration and in-memory backing
    jest.spyOn(storageService, 'isConfigured').mockReturnValue(true);

    jest.spyOn(storageService, 'checkObjectExists').mockImplementation(
      async (storagePath: string) => {
        const clean = storageService.normalizeStoragePath(storagePath);
        return inMemoryStorage.has(clean);
      }
    );

    jest.spyOn(storageService, 'getPublicUrl').mockImplementation((storagePath: string) => {
      const clean = storageService.normalizeStoragePath(storagePath);
      return `https://storage.ticketification.app/${clean}`;
    });

    jest.spyOn(storageService, 'uploadTicketImage').mockImplementation(
      async (storagePath: string, buffer: any) => {
        const clean = storageService.normalizeStoragePath(storagePath);
        inMemoryStorage.set(clean, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
        return {
          storagePath: clean,
          publicUrl: `https://storage.ticketification.app/${clean}`,
        };
      }
    );

    // Spy on the ACTUAL renderCredentialBuffer method of EventCredentialRenderingService
    // instead of replacing renderAndUploadAsset!
    jest.spyOn(renderingService as any, 'renderCredentialBuffer').mockImplementation(
      async (_template: any, _data: any) => {
        sharpBufferCallCount++;
        return validPngBuffer;
      }
    );
  });

  describe('Challenge Objective 1: Scenario 8B Crash Recovery (Asset in Storage, Missing from DB)', () => {
    it('when 2 tickets are queued and Ticket 1 has asset in Supabase from prior crash, Sharp is skipped (sharpCallCount === 1) and both reach COMPLETED', async () => {
      // 2 tickets created with renderStatus: 'PENDING'
      const cred1 = createMockCredential(1, { renderStatus: 'PENDING' });
      const cred2 = createMockCredential(2, { renderStatus: 'PENDING' });

      // Scenario 8B: Ticket 1 asset was already uploaded to Supabase Storage before a previous crash
      const cred1StoragePath = storageService.buildCredentialStoragePath(eventId, cred1._id.toString());
      inMemoryStorage.set(cred1StoragePath, validPngBuffer);

      // Verify initial conditions
      expect(cred1.renderStatus).toBe('PENDING');
      expect(cred1.asset).toBeNull();
      expect(cred2.renderStatus).toBe('PENDING');
      expect(cred2.asset).toBeNull();
      expect(inMemoryStorage.has(cred1StoragePath)).toBe(true);

      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      expect(job.status).toBe('QUEUED');

      // Execute the job sequentially
      await queueService.executeJob(job._id.toString());

      const finalJob = await jobRepo.findById(job._id.toString());
      expect(finalJob?.status).toBe('COMPLETED');
      expect(finalJob?.result.renderedCount).toBe(2);

      // CRITICAL ASSERTION 1: Sharp buffer rendering must be called EXACTLY ONCE for Ticket 2, and SKIPPED for Ticket 1
      expect(sharpBufferCallCount).toBe(1);

      // CRITICAL ASSERTION 2: Ticket 1 asset reused from storage
      const updatedCred1 = inMemoryCredentials.get(cred1._id.toString());
      expect(updatedCred1.renderStatus).toBe('COMPLETED');
      expect(updatedCred1.asset?.storagePath).toBe(cred1StoragePath);
      expect(updatedCred1.asset?.publicUrl).toBe(`https://storage.ticketification.app/${cred1StoragePath}`);
      expect(updatedCred1.renderingLockedBy).toBeNull();
      expect(updatedCred1.renderingLockExpiresAt).toBeNull();

      // CRITICAL ASSERTION 3: Ticket 2 asset rendered and uploaded
      const cred2StoragePath = storageService.buildCredentialStoragePath(eventId, cred2._id.toString());
      const updatedCred2 = inMemoryCredentials.get(cred2._id.toString());
      expect(updatedCred2.renderStatus).toBe('COMPLETED');
      expect(updatedCred2.asset?.storagePath).toBe(cred2StoragePath);
      expect(updatedCred2.asset?.publicUrl).toBe(`https://storage.ticketification.app/${cred2StoragePath}`);
      expect(inMemoryStorage.has(cred2StoragePath)).toBe(true);
      expect(updatedCred2.renderingLockedBy).toBeNull();
      expect(updatedCred2.renderingLockExpiresAt).toBeNull();

      // CRITICAL ASSERTION 4: Exactly 2 assets exist in storage (0 duplicates)
      expect(inMemoryStorage.size).toBe(2);
    });
  });

  describe('Challenge Objective 2: Multiple Partial Crashes & Selective Sharp Skipping', () => {
    it('under a 5-ticket batch where tickets 1, 2, 4 exist in storage, Sharp is called exactly 2 times (for tickets 3, 5)', async () => {
      const TOTAL = 5;
      const creds: any[] = [];
      for (let i = 1; i <= TOTAL; i++) {
        creds.push(createMockCredential(i, { renderStatus: 'PENDING' }));
      }

      // Pre-populate storage for tickets 1, 2, 4
      const existingIndices = [0, 1, 3]; // 1, 2, 4 (0-based)
      for (const idx of existingIndices) {
        const path = storageService.buildCredentialStoragePath(eventId, creds[idx]._id.toString());
        inMemoryStorage.set(path, validPngBuffer);
      }

      expect(inMemoryStorage.size).toBe(3);

      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId, 'HOST', { templateId });
      await queueService.executeJob(job._id.toString());

      const finalJob = await jobRepo.findById(job._id.toString());
      expect(finalJob?.status).toBe('COMPLETED');
      expect(finalJob?.result.renderedCount).toBe(TOTAL);

      // Sharp must be invoked ONLY for ticket 3 and ticket 5
      expect(sharpBufferCallCount).toBe(2);

      // All 5 tickets must now be COMPLETED in MongoDB
      for (let i = 1; i <= TOTAL; i++) {
        const c = inMemoryCredentials.get(creds[i - 1]._id.toString());
        expect(c.renderStatus).toBe('COMPLETED');
        expect(c.asset?.publicUrl).toBeTruthy();
        expect(c.asset?.storagePath).toBe(
          storageService.buildCredentialStoragePath(eventId, c._id.toString())
        );
      }

      // Exactly 5 assets in storage (0 duplicate assets)
      expect(inMemoryStorage.size).toBe(5);
    });
  });

  describe('Challenge Objective 3: Storage Pre-Check Adversarial Edge Cases', () => {
    it('when reuseExistingStorageAsset is false, Sharp is invoked even if asset exists in storage', async () => {
      const cred = createMockCredential(1, { renderStatus: 'PENDING' });
      const path = storageService.buildCredentialStoragePath(eventId, cred._id.toString());
      inMemoryStorage.set(path, validPngBuffer);

      // Direct call with reuseExistingStorageAsset: false
      const result = await renderingService.renderAndUploadAsset(
        eventId,
        cred._id.toString(),
        mockTemplate as any,
        { name: 'Force Re-render' } as any,
        { reuseExistingStorageAsset: false }
      );

      expect(result.reused).toBe(false);
      expect(sharpBufferCallCount).toBe(1);
    });

    it('when storageService.checkObjectExists throws an unexpected warning/error, it gracefully falls back to rendering without failing', async () => {
      const cred = createMockCredential(1, { renderStatus: 'PENDING' });
      jest.spyOn(storageService, 'checkObjectExists').mockRejectedValueOnce(new Error('Network timeout during HEAD'));

      const result = await renderingService.renderAndUploadAsset(
        eventId,
        cred._id.toString(),
        mockTemplate as any,
        { name: 'Fallback Test' } as any
      );

      // Gracefully rendered via Sharp fallback
      expect(result.reused).toBe(false);
      expect(sharpBufferCallCount).toBe(1);
      expect(result.publicUrl).toBeTruthy();
    });

    it('when getPublicUrl returns null, it safely does not mark as reused and renders buffer', async () => {
      const cred = createMockCredential(1, { renderStatus: 'PENDING' });
      const path = storageService.buildCredentialStoragePath(eventId, cred._id.toString());
      inMemoryStorage.set(path, validPngBuffer);

      // Mock getPublicUrl returning null
      jest.spyOn(storageService, 'getPublicUrl').mockReturnValueOnce(null);

      const result = await renderingService.renderAndUploadAsset(
        eventId,
        cred._id.toString(),
        mockTemplate as any,
        { name: 'Null URL Test' } as any
      );

      expect(result.reused).toBe(false);
      expect(sharpBufferCallCount).toBe(1);
    });
  });

  describe('Challenge Objective 4: Native SupabaseStorageService.checkObjectExists Contract', () => {
    const origUrl = config.env.supabaseUrl;

    beforeEach(() => {
      (config.env as any).supabaseUrl = 'https://test-project.supabase.co';
    });

    afterEach(() => {
      (config.env as any).supabaseUrl = origUrl;
    });

    it('returns true when client.storage.from().exists() returns true (0 byte HEAD request)', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        exists: jest.fn().mockResolvedValue({ data: true, error: null }),
      };

      const storageModule = require('../src/config/supabase');
      const origStorageAdmin = storageModule.supabaseStorageAdmin;
      const origAdmin = storageModule.supabaseAdmin;

      const mockAdminObj = {
        storage: {
          getBucket: mockStorage.getBucket,
          from: () => mockStorage,
        },
      };

      (storageModule as any).supabaseStorageAdmin = mockAdminObj;
      (storageModule as any).supabaseAdmin = mockAdminObj;

      const directStorage = new SupabaseStorageService();
      const exists = await directStorage.checkObjectExists('events/evt-1/credentials/cred-1.png');

      expect(exists).toBe(true);
      expect(mockStorage.exists).toHaveBeenCalledWith('events/evt-1/credentials/cred-1.png');

      (storageModule as any).supabaseStorageAdmin = origStorageAdmin;
      (storageModule as any).supabaseAdmin = origAdmin;
    });

    it('returns false when client.storage.from().exists() returns 404 error', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        exists: jest.fn().mockResolvedValue({ data: false, error: { status: 404, message: 'Not found' } }),
      };

      const storageModule = require('../src/config/supabase');
      const origStorageAdmin = storageModule.supabaseStorageAdmin;
      const origAdmin = storageModule.supabaseAdmin;

      const mockAdminObj = {
        storage: {
          getBucket: mockStorage.getBucket,
          from: () => mockStorage,
        },
      };

      (storageModule as any).supabaseStorageAdmin = mockAdminObj;
      (storageModule as any).supabaseAdmin = mockAdminObj;

      const directStorage = new SupabaseStorageService();
      const exists = await directStorage.checkObjectExists('events/evt-1/credentials/nonexistent.png');

      expect(exists).toBe(false);

      (storageModule as any).supabaseStorageAdmin = origStorageAdmin;
      (storageModule as any).supabaseAdmin = origAdmin;
    });

    it('throws StorageError when client.storage.from().exists() encounters 500 error', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        exists: jest.fn().mockResolvedValue({ data: null, error: { status: 500, message: 'Supabase storage cluster failure' } }),
      };

      const storageModule = require('../src/config/supabase');
      const origStorageAdmin = storageModule.supabaseStorageAdmin;
      const origAdmin = storageModule.supabaseAdmin;

      const mockAdminObj = {
        storage: {
          getBucket: mockStorage.getBucket,
          from: () => mockStorage,
        },
      };

      (storageModule as any).supabaseStorageAdmin = mockAdminObj;
      (storageModule as any).supabaseAdmin = mockAdminObj;

      const directStorage = new SupabaseStorageService();
      await expect(
        directStorage.checkObjectExists('events/evt-1/credentials/error.png')
      ).rejects.toThrow(StorageError);

      (storageModule as any).supabaseStorageAdmin = origStorageAdmin;
      (storageModule as any).supabaseAdmin = origAdmin;
    });

    it('correctly normalizes diverse storage path representations (leading slash, bucket prefix, full CDN URL)', () => {
      const s = new SupabaseStorageService();

      expect(s.normalizeStoragePath('/events/evt-1/credentials/c-1.png')).toBe('events/evt-1/credentials/c-1.png');
      expect(s.normalizeStoragePath('ticket-images/events/evt-1/credentials/c-1.png')).toBe('events/evt-1/credentials/c-1.png');
      expect(s.normalizeStoragePath('https://myproject.supabase.co/storage/v1/object/public/ticket-images/events/evt-1/credentials/c-1.png')).toBe('events/evt-1/credentials/c-1.png');
      expect(s.normalizeStoragePath('https://myproject.supabase.co/storage/v1/object/sign/ticket-images/events/evt-1/credentials/c-1.png?token=xyz')).toBe('events/evt-1/credentials/c-1.png');
    });
  });
});
