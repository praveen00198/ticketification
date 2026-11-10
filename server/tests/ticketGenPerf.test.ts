import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { ticketImageService, isPngBuffer } from '../src/modules/tickets/services/ticket-image.service';
import { eventStorageGovernanceService } from '../src/modules/events/services/event-storage-governance.service';
import { memoryBudgetGovernor } from '../src/utils/memory-budget-governor';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('Ticket Generation Performance & CPU Optimization Suite (R3 & R4)', () => {
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
    name: 'Performance & Optimization Summit 2026',
    eventType: 'CONFERENCE',
    status: 'PUBLISHED',
    credentialTerminology: 'Ticket',
    schedule: {
      startAt: new Date('2026-11-20T09:00:00Z'),
      endAt: new Date('2026-11-20T18:00:00Z'),
    },
    venue: {
      name: 'Main Auditorium',
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
      renderStatus: overrides.renderStatus || 'PENDING',
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

  function generateCredentials(count: number) {
    const list = [];
    for (let i = 1; i <= count; i++) {
      list.push(createMockCredential(i));
    }
    return list;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);

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

    // Mock Storage Allowance & Leases
    jest.spyOn(eventStorageGovernanceService, 'assertStorageAllowance').mockResolvedValue(undefined as any);
    (credentialRepo as any).reclaimAbandonedTicketLeases = jest.fn().mockResolvedValue(0);

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

    jest.spyOn(credentialRepo, 'claimUnrenderedTicketLease').mockImplementation(
      async (eId: string, workerId: string, leaseMs: number = 30000) => {
        const now = new Date();
        const all = Array.from(inMemoryCredentials.values()).filter(
          (c) =>
            c.eventId?.toString() === eId?.toString() &&
            c.renderStatus !== 'COMPLETED' &&
            (!c.asset?.publicUrl || !c.asset?.renderedAt)
        );

        const pending = all.find((c) => !c.renderStatus || c.renderStatus === 'PENDING');
        if (pending) {
          pending.renderStatus = 'PROCESSING';
          pending.renderingLockedBy = workerId;
          pending.renderingLockExpiresAt = new Date(now.getTime() + leaseMs);
          return pending;
        }
        return null;
      }
    );

    (credentialRepo as any).markRenderCompleted = jest.fn().mockImplementation(
      async (credId: string, assetData: any) => {
        const cred = inMemoryCredentials.get(credId.toString());
        if (!cred) return null;
        cred.asset = assetData;
        cred.renderStatus = 'COMPLETED';
        cred.renderingLockedBy = null;
        cred.renderingLockExpiresAt = null;
        return cred;
      }
    );

    // Fast mock for rendering and storage upload
    jest.spyOn(renderingService, 'renderAndUploadAsset').mockImplementation(
      async (eId: string, credId: string) => {
        const path = `events/${eId}/credentials/cred-${credId}.png`;
        inMemoryStorage.set(path, Buffer.from('mock-png-buffer'));
        return {
          storagePath: path,
          publicUrl: `https://storage.ticketification.app/${path}`,
        };
      }
    );
  });

  describe('CPU Optimization & Cooperative Yielding in Worker Loops', () => {
    it('should invoke cooperative event loop yielding per ticket during bulk rendering', async () => {
      generateCredentials(5);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId);
      await queueService.executeJob(job._id.toString());

      // Should have yielded with setTimeout at least 5 times (20ms per ticket)
      const yields = setTimeoutSpy.mock.calls.filter((call) => call[1] === 20);
      expect(yields.length).toBeGreaterThanOrEqual(5);

      setTimeoutSpy.mockRestore();
    });

    it('should throttle worker lease renewals to every 10 tickets rather than every ticket', async () => {
      generateCredentials(25);
      const renewLeaseSpy = jest.spyOn(jobRepo, 'renewLease');

      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId);
      await queueService.executeJob(job._id.toString());

      // With 25 tickets: renewals occur at ticket 0, ticket 10, ticket 20 (exactly 3 calls instead of 25)
      expect(renewLeaseSpy).toHaveBeenCalledTimes(3);
    });

    it('should NOT call duplicate cred.save() after atomic markRenderCompleted', async () => {
      const creds = generateCredentials(5);

      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId);
      await queueService.executeJob(job._id.toString());

      // Verify markRenderCompleted was called for each ticket
      expect((credentialRepo as any).markRenderCompleted).toHaveBeenCalledTimes(5);

      // Verify cred.save() was never called redundantly after markRenderCompleted
      for (const cred of creds) {
        expect(cred.save).not.toHaveBeenCalled();
      }
    });

    it('should throttle proactive garbage collection calls instead of running on every ticket', async () => {
      generateCredentials(15);
      const gcSpy = jest.spyOn(memoryBudgetGovernor, 'triggerGarbageCollection');
      jest.spyOn(memoryBudgetGovernor, 'getStatus').mockReturnValue({
        isMemoryConstrained: false,
        heapUsedMB: 120,
        heapLimitMB: 512,
        heapUsedRatio: 0.23,
      } as any);

      const job = await queueService.enqueueBulkRenderJob(eventId, callerUserId);
      await queueService.executeJob(job._id.toString());

      // For 15 tickets with unconstrained memory, GC is called only at ticket 0 (0 % 25 === 0)
      // Exactly 1 time, NOT 15 times!
      expect(gcSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('SVG Font Optimization & Removal of Base64 Inlining', () => {
    it('should NOT embed ~600KB base64 font or external HTTP @import in EventCredentialRenderingService SVG', () => {
      const fields = [
        { key: 'name', label: 'Name', x: 810, y: 1490, fontSize: 76, color: '#FFE680', textAlign: 'center' },
      ];
      const data = {
        name: 'अमित कुमार (Amit Kumar)',
        sequence: 'TIC-00001',
      };

      const svg = (renderingService as any).buildSvgOverlay(fields, data, 1620, 2025);

      // Must not contain base64 font data URI
      expect(svg).not.toContain('data:font/truetype;charset=utf-8;base64');
      // Must not contain remote Google Fonts @import url
      expect(svg).not.toContain('@import url');
      // Must reference local Fontconfig font
      expect(svg).toContain("local('Noto Sans Devanagari Bold')");
      // SVG size should be lightweight (< 10 KB, far below the old ~600 KB)
      expect(Buffer.byteLength(svg, 'utf-8')).toBeLessThan(10240);
    });

    it('should NOT embed ~600KB base64 font or external HTTP @import in TicketImageService SVG', () => {
      const ticketData = {
        ticketId: 'PASS-00001',
        guestName: 'विकास शर्मा (Vikas Sharma)',
        eventName: 'Tech Summit 2026',
        eventDate: '2026-11-20',
        ticketType: 'VIP Attendee',
        venue: 'Grand Arena',
      };

      const svg = (ticketImageService as any).buildSvg(ticketData);

      // Must not contain base64 font data URI
      expect(svg).not.toContain('data:font/truetype;charset=utf-8;base64');
      // Must not contain remote Google Fonts @import url
      expect(svg).not.toContain('@import url');
      // Must reference local Fontconfig font
      expect(svg).toContain("local('Noto Sans Devanagari Bold')");
      // SVG size should be compact (< 25 KB)
      expect(Buffer.byteLength(svg, 'utf-8')).toBeLessThan(25000);
    });
  });

  describe('Sharp PNG Compression Configuration & Binary Validation', () => {
    it('should verify Sharp PNG compressionLevel: 6 and effort: 2 in codebase files', () => {
      const ticketImageServicePath = path.resolve(
        __dirname,
        '../src/modules/tickets/services/ticket-image.service.ts'
      );
      const credentialRenderingPath = path.resolve(
        __dirname,
        '../src/modules/events/services/event-credential-rendering.service.ts'
      );

      const ticketImageSource = fs.readFileSync(ticketImageServicePath, 'utf-8');
      const credentialRenderingSource = fs.readFileSync(credentialRenderingPath, 'utf-8');

      // Verify compressionLevel: 6 and effort: 2 in ticket-image.service.ts
      expect(ticketImageSource).toContain('compressionLevel: 6, effort: 2');
      // Verify compressionLevel: 6 and effort: 2 in event-credential-rendering.service.ts
      expect(credentialRenderingSource).toContain('compressionLevel: 6, effort: 2');
      // Verify compressionLevel: 8 has been completely eliminated
      expect(credentialRenderingSource).not.toContain('compressionLevel: 8');
    });

    it('should render a valid PNG buffer with magic header 0x89504E47', async () => {
      const ticketData = {
        ticketId: 'PASS-00001',
        guestName: 'Rahul Sharma',
        eventName: 'Annual Convention',
        eventDate: '2026-12-01',
        ticketType: 'General Admission',
        venue: 'Center Hall',
        verificationToken: 'sample-verification-token-0123456789abcdef0123456789abcdef01234567',
      };

      const rendered = await ticketImageService.generateTicketImage(ticketData);
      expect(rendered).toBeDefined();
      expect(rendered.pngBuffer).toBeInstanceOf(Buffer);

      // Validate PNG magic bytes [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
      const buf = rendered.pngBuffer;
      expect(isPngBuffer(buf)).toBe(true);
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
      expect(buf[4]).toBe(0x0d);
      expect(buf[5]).toBe(0x0a);
      expect(buf[6]).toBe(0x1a);
      expect(buf[7]).toBe(0x0a);
    }, 60000);
  });
});
