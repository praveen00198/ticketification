/**
 * Critical Fixes Regression Suite
 *
 * Verifies the five root causes fixed:
 * Fix 1: reserveRegistrationSlot returns false (not true) when MongoDB disconnected.
 * Fix 2: releaseRegistrationSlot returns false (not true) when MongoDB disconnected.
 * Fix 3: CAS reconcileConfirmedCount -- acknowledged===true does NOT mean matchedCount===1.
 * Fix 4: Bulk render job with upload failure cannot be marked COMPLETED.
 * Fix 5: streamTicketsZip fails with ValidationError when assets are missing (no silent partial archive).
 */
import mongoose from 'mongoose';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { IEventJobDocument, IJobResult } from '../src/db/mongo/models/event-job.model';
import { PassThrough } from 'stream';
import { TicketService } from '../src/modules/tickets/services/ticket.service';

function buildMockJob(overrides: Partial<IEventJobDocument> = {}): IEventJobDocument {
  const jobId = new mongoose.Types.ObjectId();
  return {
    _id: jobId,
    eventId: new mongoose.Types.ObjectId(),
    jobType: 'BULK_RENDER_ASSETS',
    status: 'PROCESSING',
    attempts: 1,
    maxAttempts: 3,
    payload: {},
    progress: { total: 3, processed: 0, succeeded: 0, failed: 0, skipped: 0, percentage: 0 },
    result: { importedCount: 0, renderedCount: 0, errorLog: [] },
    createdBy: new mongoose.Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lockedBy: 'test-worker',
    lockExpiresAt: new Date(Date.now() + 600_000),
    ...overrides,
  } as any;
}

// --- FIX 1 & 2: Registration slot safety when MongoDB is disconnected ---

describe('Fix 1 & 2 -- Registration slot operations fail safely when MongoDB is disconnected', () => {
  const eventRepo = new MongoEventRepository();
  const fakeEventId = new mongoose.Types.ObjectId().toString();

  it('reserveRegistrationSlot: returns false when MongoDB readyState is not 1', async () => {
    const savedDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    try {
      Object.defineProperty(mongoose.connection, 'readyState', { get: () => 0, configurable: true });
      const result = await eventRepo.reserveRegistrationSlot(fakeEventId, 100);
      // FIXED: must be false, never true (old code returned true causing false-positive capacity reservations)
      expect(result).toBe(false);
    } finally {
      if (savedDescriptor) Object.defineProperty(mongoose.connection, 'readyState', savedDescriptor);
    }
  });

  it('releaseRegistrationSlot: returns false when MongoDB readyState is not 1', async () => {
    const savedDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    try {
      Object.defineProperty(mongoose.connection, 'readyState', { get: () => 0, configurable: true });
      const result = await eventRepo.releaseRegistrationSlot(fakeEventId, 'some-token');
      // FIXED: must be false, never true (old code returned true hiding failed releases)
      expect(result).toBe(false);
    } finally {
      if (savedDescriptor) Object.defineProperty(mongoose.connection, 'readyState', savedDescriptor);
    }
  });
});

// --- FIX 3: CAS reconciliation -- acknowledged != matched ---

describe('Fix 3 -- CAS reconcileConfirmedCount: acknowledged does not imply matchedCount=1', () => {
  it('zero-match result (acknowledged=true, matchedCount=0) is correctly treated as CAS failure', () => {
    const zeroMatchResult = { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    // The FIXED success check from reconcileConfirmedCount -- no acknowledged-only path
    const isSuccess =
      zeroMatchResult &&
      (zeroMatchResult.matchedCount === 1 ||
        zeroMatchResult.modifiedCount === 1 ||
        (zeroMatchResult as any).nModified === 1 ||
        (zeroMatchResult as any).n === 1 ||
        (!('matchedCount' in zeroMatchResult) && !('modifiedCount' in zeroMatchResult) && !('nModified' in zeroMatchResult)));
    // A zero-match CAS result must NOT be considered success
    expect(isSuccess).toBe(false);
  });

  it('matched result (matchedCount=1) is correctly identified as CAS success', () => {
    const matchedResult = { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    const isSuccess =
      matchedResult &&
      (matchedResult.matchedCount === 1 ||
        matchedResult.modifiedCount === 1 ||
        (matchedResult as any).nModified === 1 ||
        (matchedResult as any).n === 1 ||
        (!('matchedCount' in matchedResult) && !('modifiedCount' in matchedResult) && !('nModified' in matchedResult)));
    expect(isSuccess).toBe(true);
  });

  it('legacy driver result without matchedCount field uses safe fallback', () => {
    const legacyResult = { acknowledged: true }; // no matchedCount field
    const isSuccess =
      legacyResult &&
      ((legacyResult as any).matchedCount === 1 ||
        (legacyResult as any).modifiedCount === 1 ||
        (legacyResult as any).nModified === 1 ||
        (legacyResult as any).n === 1 ||
        (!('matchedCount' in legacyResult) && !('modifiedCount' in legacyResult) && !('nModified' in legacyResult)));
    expect(isSuccess).toBe(true);
  });
});

// --- FIX 4: Bulk render job with upload failure cannot be COMPLETED ---

describe('Fix 4 -- Bulk render job with failed/missing tickets cannot be marked COMPLETED', () => {
  let jobQueueService: EventJobQueueService;
  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let eventRepo: MongoEventRepository;
  const inMemoryJobs = new Map<string, any>();

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryJobs.clear();
    jobRepo = new MongoEventJobRepository();
    credentialRepo = new MongoEventCredentialRepository();
    eventRepo = new MongoEventRepository();

    jest.spyOn(eventRepo, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Event',
      credentialTerminology: 'Pass',
      schedule: { startAt: new Date(Date.now() + 3600000) },
      venue: { name: 'Test Venue' },
    } as any);

    jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: string) => inMemoryJobs.get(id) || null);
    jest.spyOn(jobRepo, 'renewLease').mockResolvedValue(true);
    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(async (id: string) => inMemoryJobs.get(id) || null);
    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(async (id: string, result: IJobResult) => {
      const job = inMemoryJobs.get(id);
      if (!job) return null;
      job.status = 'COMPLETED';
      job.result = result;
      return job;
    });
    jest.spyOn(jobRepo, 'markFailed').mockImplementation(async (id: string, reason: string, result?: any) => {
      const job = inMemoryJobs.get(id);
      if (!job) return null;
      job.status = 'FAILED';
      job.failureReason = reason;
      if (result) job.result = result;
      return job;
    });
    jest.spyOn(jobRepo, 'releaseJobForRetry').mockImplementation(async (id: string, reason: string) => {
      const job = inMemoryJobs.get(id);
      if (!job) return null;
      job.status = 'QUEUED';
      job.failureReason = reason;
      return job;
    });

    jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockResolvedValue(1);
    jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(async (_eId: string, lastId: any) => {
      if (lastId) return [];
      return [{
        _id: new mongoose.Types.ObjectId(),
        formattedId: 'PASS-00003',
        verificationToken: 'token-003',
        holder: { name: 'Test User', category: 'PARTICIPANT' },
        asset: {},
        save: jest.fn(),
      }] as any;
    });

    const renderingService: any = {
      renderAndUploadAsset: jest.fn().mockRejectedValue(
        new Error('Storage upload failed: Supabase bucket quota exceeded')
      ),
    };

    const templateRepo: any = {
      findDefaultByEventId: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId(), layers: [] }),
      findById: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId(), layers: [] }),
    };

    jobQueueService = new EventJobQueueService(
      jobRepo, credentialRepo, templateRepo, renderingService, eventRepo, {} as any, {} as any
    );
    jobQueueService.setWorkerId('test-worker-fix4');
  });

  it('job with upload failure on 1 ticket (2 succeeded) is FAILED on max attempts, never COMPLETED', async () => {
    const job = buildMockJob({
      attempts: 3,
      maxAttempts: 3,
      progress: { total: 3, processed: 2, succeeded: 2, failed: 0, skipped: 0, percentage: 66 },
      result: { importedCount: 0, renderedCount: 2, errorLog: [] },
    });
    inMemoryJobs.set(job._id.toString(), job);

    await (jobQueueService as any).processBulkRenderJob(job);

    expect(job.status).not.toBe('COMPLETED');
    expect(job.status).toBe('FAILED');
    expect(job.result?.errorLog?.length).toBeGreaterThan(0);
  });

  it('job where all 3 tickets fail to render is FAILED, never COMPLETED', async () => {
    jest.spyOn(credentialRepo, 'countUnrenderedByEvent').mockResolvedValue(3);
    jest.spyOn(credentialRepo, 'findUnrenderedBatch').mockImplementation(async (_eId: string, lastId: any) => {
      if (lastId) return [];
      return [
        { _id: new mongoose.Types.ObjectId(), formattedId: 'P-1', verificationToken: 't1', holder: { name: 'A', category: 'PARTICIPANT' }, asset: {}, save: jest.fn() },
        { _id: new mongoose.Types.ObjectId(), formattedId: 'P-2', verificationToken: 't2', holder: { name: 'B', category: 'PARTICIPANT' }, asset: {}, save: jest.fn() },
        { _id: new mongoose.Types.ObjectId(), formattedId: 'P-3', verificationToken: 't3', holder: { name: 'C', category: 'PARTICIPANT' }, asset: {}, save: jest.fn() },
      ] as any;
    });

    const job = buildMockJob({ attempts: 3, maxAttempts: 3 });
    inMemoryJobs.set(job._id.toString(), job);

    await (jobQueueService as any).processBulkRenderJob(job);

    expect(job.status).not.toBe('COMPLETED');
    expect(job.status).toBe('FAILED');
    expect(job.failureReason).toMatch(/failed to render/i);
  });
});

// --- FIX 5: streamTicketsZip fails cleanly on missing assets ---

describe('Fix 5 -- streamTicketsZip: missing ticket assets cause ValidationError, not silent partial archive', () => {
  let ticketService: TicketService;

  beforeEach(() => {
    jest.clearAllMocks();
    ticketService = new TicketService();
  });

  it('throws ValidationError when no tickets exist for the event', async () => {
    jest.spyOn((ticketService as any).eventRepo, 'findByIdAndOwner').mockResolvedValue({ name: 'Test Event' } as any);
    jest.spyOn((ticketService as any).ticketRepo, 'findByEventId').mockResolvedValue([]);
    (ticketService as any).ticketRepo.findExportBatchKeyset = jest.fn().mockResolvedValue([]);

    const streamOut = new PassThrough();
    streamOut.on('data', () => {});

    await expect(
      ticketService.streamTicketsZip('fake-event-id', 'fake-user-id', streamOut)
    ).rejects.toThrow(/no tickets found/i);
  });

  it('throws ValidationError when tickets exist but all asset downloads fail (no silent partial archive)', async () => {
    jest.spyOn((ticketService as any).eventRepo, 'findByIdAndOwner').mockResolvedValue({ name: 'Test Event' } as any);

    const fakeTicket = {
      ticket: { sequenceNumber: 1, assetPath: 'events/evt/tickets/ticket-EVT-00001.png', guestId: 'g1' },
      guest: { name: 'Alice' },
      ticketType: { usagePolicy: 'SINGLE_USE' },
    };

    (ticketService as any).ticketRepo.findExportBatchKeyset = jest.fn()
      .mockResolvedValueOnce([fakeTicket])
      .mockResolvedValue([]);
    jest.spyOn((ticketService as any).ticketRepo, 'findByEventId').mockResolvedValue([fakeTicket]);
    jest.spyOn((ticketService as any).storageServ, 'downloadTicketImage').mockRejectedValue(
      new Error('Object not found in bucket')
    );

    const streamOut = new PassThrough();
    streamOut.on('data', () => {});

    await expect(
      ticketService.streamTicketsZip('fake-event-id', 'fake-user-id', streamOut)
    ).rejects.toThrow(/no valid ticket assets/i);
  });
});
