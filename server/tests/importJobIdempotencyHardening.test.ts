import mongoose from 'mongoose';
import { EventJobQueueService } from '../src/modules/events/services/event-job-queue.service';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { IEventJobDocument, IJobResult } from '../src/db/mongo/models/event-job.model';

describe('FIX 5 — Import Job Idempotency, Sequence Safety & Deduplication Hardening', () => {
  let jobQueueService: EventJobQueueService;
  let jobRepo: MongoEventJobRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let eventRepo: MongoEventRepository;

  const inMemoryJobs = new Map<string, any>();
  const inMemoryCredentials = new Map<string, any>();
  let sequenceCounter = 1;
  let sequenceAllocationCalls = 0;

  const mockEventId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryJobs.clear();
    inMemoryCredentials.clear();
    sequenceCounter = 1;
    sequenceAllocationCalls = 0;

    jobRepo = new MongoEventJobRepository();
    credentialRepo = new MongoEventCredentialRepository();
    eventRepo = new MongoEventRepository();

    // Mock Event Repo
    jest.spyOn(eventRepo, 'findById').mockImplementation(async (id: string) => {
      return {
        _id: new mongoose.Types.ObjectId(id),
        title: 'Tech Summit 2026',
        credentialTerminology: 'Pass',
      } as any;
    });

    // Mock Credential Repo Sequence Allocation
    jest.spyOn(credentialRepo, 'allocateSequenceBlock').mockImplementation(async (_eId: string, count: number) => {
      sequenceAllocationCalls++;
      const start = sequenceCounter;
      sequenceCounter += count;
      return start;
    });

    // Mock Credential Repo findBySequenceRange
    jest.spyOn(credentialRepo, 'findBySequenceRange').mockImplementation(async (eId: string, startSeq: number, endSeq: number) => {
      const found: any[] = [];
      for (const doc of inMemoryCredentials.values()) {
        if (doc.eventId.toString() === eId && doc.sequenceNumber >= startSeq && doc.sequenceNumber <= endSeq) {
          found.push(doc);
        }
      }
      return found.sort((a, b) => a.sequenceNumber - b.sequenceNumber) as any;
    });

    // Mock Credential Repo createMany (with idempotent $setOnInsert semantics)
    jest.spyOn(credentialRepo, 'createMany').mockImplementation(async (items: any[]) => {
      const created: any[] = [];
      for (const item of items) {
        const key = `${item.eventId}_${item.sequenceNumber}`;
        if (!inMemoryCredentials.has(key)) {
          const doc = {
            _id: new mongoose.Types.ObjectId(),
            ...item,
            createdAt: new Date(),
          };
          inMemoryCredentials.set(key, doc);
          created.push(doc);
        } else {
          // Idempotent: record already exists, do not overwrite ($setOnInsert behavior)
          created.push(inMemoryCredentials.get(key));
        }
      }
      return created as any;
    });

    // Mock Job Repo
    jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: any) => {
      return inMemoryJobs.get(id.toString()) || null;
    });

    jest.spyOn(jobRepo, 'updatePayload').mockImplementation(async (id: any, payload: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) job.payload = payload;
      return job;
    });

    jest.spyOn(jobRepo, 'renewLease').mockImplementation(async (_id: any, _workerId: string) => {
      return true;
    });

    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(async (id: any, progress: any, partialResult?: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      job.progress = { ...job.progress, ...progress };
      if (partialResult) {
        job.result = { ...job.result, ...partialResult };
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(async (id: any, result: IJobResult) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      job.status = 'COMPLETED';
      job.result = result;
      job.completedAt = new Date();
      return job as any;
    });

    jest.spyOn(jobRepo, 'markFailed').mockImplementation(async (id: any, reason: string, result?: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (!job) return null;
      job.status = 'FAILED';
      job.failureReason = reason;
      if (result) job.result = result;
      return job as any;
    });

    jobQueueService = new EventJobQueueService(
      jobRepo,
      credentialRepo,
      {} as any,
      {} as any,
      eventRepo,
      {} as any,
      {} as any
    );
    jobQueueService.setWorkerId('test-worker-fix5');
  });

  function createMockJob(records: any[], overrides?: Partial<IEventJobDocument>): IEventJobDocument {
    const jobId = new mongoose.Types.ObjectId();
    const job: any = {
      _id: jobId,
      eventId: new mongoose.Types.ObjectId(mockEventId),
      jobType: 'IMPORT_CREDENTIALS',
      status: 'PROCESSING',
      attempts: 1,
      maxAttempts: 3,
      payload: {
        records,
        renderAfterImport: false,
      },
      progress: { total: records.length, processed: 0, succeeded: 0, failed: 0, skipped: 0, percentage: 0 },
      result: {
        importedCount: 0,
        renderedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errorLog: [],
      },
      createdBy: new mongoose.Types.ObjectId(mockUserId),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    inMemoryJobs.set(jobId.toString(), job);
    return job;
  }

  it('1. Same chunk executed twice produces identical credentials without duplicates', async () => {
    const records = [
      { rowNumber: 1, name: 'Alice Smith', email: 'alice@example.com', category: 'VIP' },
      { rowNumber: 2, name: 'Bob Jones', email: 'bob@example.com', category: 'DELEGATE' },
    ];
    const job = createMockJob(records);

    // Pass 1
    await (jobQueueService as any).processImportJob(job);
    expect(job.status).toBe('COMPLETED');
    expect(job.result.importedCount).toBe(2);
    expect(inMemoryCredentials.size).toBe(2);

    // Pass 2 (simulated chunk replay)
    await (jobQueueService as any).processImportJob(job);
    expect(job.status).toBe('COMPLETED');
    expect(job.result.importedCount).toBe(2);
    expect(inMemoryCredentials.size).toBe(2);
  });

  it('2. Partial database write followed by crash and resume does not duplicate records', async () => {
    const records = [
      { rowNumber: 1, name: 'Charlie Brown', email: 'charlie@peanuts.com' },
      { rowNumber: 2, name: 'Lucy Van Pelt', email: 'lucy@peanuts.com' },
      { rowNumber: 3, name: 'Linus Van Pelt', email: 'linus@peanuts.com' },
    ];
    const job = createMockJob(records);

    // Pre-insert partial record (simulating crash after writing sequence 1)
    const partialDoc = {
      _id: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(mockEventId),
      sequenceNumber: 1,
      formattedId: 'PASS-00001',
      verificationToken: 'token-pre-crash-1',
      status: 'ACTIVE',
      holder: { name: 'Charlie Brown', email: 'charlie@peanuts.com', category: 'PARTICIPANT' },
      createdAt: new Date(),
    };
    inMemoryCredentials.set(`${mockEventId}_1`, partialDoc);

    // Execute job
    await (jobQueueService as any).processImportJob(job);
    expect(job.status).toBe('COMPLETED');
    expect(job.result.importedCount).toBe(3);
    expect(inMemoryCredentials.size).toBe(3);

    // Sequence 1 should still have the original token, not re-generated
    expect(inMemoryCredentials.get(`${mockEventId}_1`).verificationToken).toBe('token-pre-crash-1');
  });

  it('3. Retry after partial success continues and completes all records', async () => {
    const records = [
      { rowNumber: 1, name: 'User 1', email: 'u1@test.com' },
      { rowNumber: 2, name: 'User 2', email: 'u2@test.com' },
      { rowNumber: 3, name: 'User 3', email: 'u3@test.com' },
    ];
    const job = createMockJob(records);

    // Simulate attempt 1 allocating sequence 50..52 and inserting first 2 records then failing
    job.payload.startingSequence = 50;
    job.payload.endSequence = 52;
    job.attempts = 1;

    inMemoryCredentials.set(`${mockEventId}_50`, {
      _id: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(mockEventId),
      sequenceNumber: 50,
      formattedId: 'PASS-00050',
      holder: { name: 'User 1', email: 'u1@test.com' },
    });
    inMemoryCredentials.set(`${mockEventId}_51`, {
      _id: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(mockEventId),
      sequenceNumber: 51,
      formattedId: 'PASS-00051',
      holder: { name: 'User 2', email: 'u2@test.com' },
    });

    // Attempt 2 (retry)
    job.attempts = 2;
    await (jobQueueService as any).processImportJob(job);

    expect(job.status).toBe('COMPLETED');
    expect(job.result.importedCount).toBe(3);
    expect(inMemoryCredentials.size).toBe(3);
    expect(inMemoryCredentials.has(`${mockEventId}_52`)).toBe(true);
  });

  it('4. Sequence allocation is persisted and reused across retries without re-incrementing sequence counter', async () => {
    const records = [
      { rowNumber: 1, name: 'Record A', email: 'a@event.com' },
      { rowNumber: 2, name: 'Record B', email: 'b@event.com' },
    ];
    const job = createMockJob(records);

    // First run allocates sequence block 1..2
    await (jobQueueService as any).processImportJob(job);
    expect(sequenceAllocationCalls).toBe(1);
    expect(job.payload.startingSequence).toBe(1);
    expect(job.payload.endSequence).toBe(2);

    // Simulated retry: startingSequence is in job.payload
    job.status = 'PROCESSING';
    await (jobQueueService as any).processImportJob(job);

    // Sequence block should NOT have been re-allocated
    expect(sequenceAllocationCalls).toBe(1);
    expect(job.payload.startingSequence).toBe(1);
  });

  it('5. Two concurrent imports for the same event receive non-overlapping sequence ranges', async () => {
    const recordsA = [
      { rowNumber: 1, name: 'Batch A1', email: 'a1@test.com' },
      { rowNumber: 2, name: 'Batch A2', email: 'a2@test.com' },
    ];
    const recordsB = [
      { rowNumber: 1, name: 'Batch B1', email: 'b1@test.com' },
      { rowNumber: 2, name: 'Batch B2', email: 'b2@test.com' },
    ];

    const jobA = createMockJob(recordsA);
    const jobB = createMockJob(recordsB);

    // Run both jobs concurrently
    await Promise.all([
      (jobQueueService as any).processImportJob(jobA),
      (jobQueueService as any).processImportJob(jobB),
    ]);

    expect(jobA.status).toBe('COMPLETED');
    expect(jobB.status).toBe('COMPLETED');

    const seqA = [jobA.payload.startingSequence, jobA.payload.endSequence];
    const seqB = [jobB.payload.startingSequence, jobB.payload.endSequence];

    // Ensure ranges are completely disjoint
    const rangesOverlap = Math.max(seqA[0], seqB[0]) <= Math.min(seqA[1], seqB[1]);
    expect(rangesOverlap).toBe(false);

    // Verify all 4 credentials exist with unique sequence numbers
    expect(inMemoryCredentials.size).toBe(4);
    const sequences = Array.from(inMemoryCredentials.values()).map((c) => c.sequenceNumber);
    const uniqueSequences = new Set(sequences);
    expect(uniqueSequences.size).toBe(4);
  });

  it('6. Duplicate rows in the source file are skipped and logged without crashing', async () => {
    const records = [
      { rowNumber: 1, name: 'David Miller', email: 'david@corp.org', category: 'DELEGATE' },
      { rowNumber: 2, name: 'David Miller', email: 'david@corp.org', category: 'DELEGATE' }, // Duplicate email in file
      { rowNumber: 3, name: 'Eva Green', email: 'eva@corp.org', category: 'SPEAKER' },
    ];
    const job = createMockJob(records);

    await (jobQueueService as any).processImportJob(job);

    expect(job.status).toBe('COMPLETED');
    expect(job.result.importedCount).toBe(2);
    expect(job.result.skippedCount).toBe(1);
    expect(job.result.failedCount).toBe(0);
    expect(inMemoryCredentials.size).toBe(2);

    expect(job.result.errorLog.length).toBe(1);
    expect(job.result.errorLog[0].error).toContain('Duplicate email');
    expect(job.result.errorLog[0].error).toContain('(skipped)');
  });

  it('7. Duplicate-key race is handled safely and recovers persisted credentials', async () => {
    const records = [
      { rowNumber: 1, name: 'Grace Hopper', email: 'grace@navy.mil' },
    ];
    const job = createMockJob(records);

    // Spy on createMany to simulate a MongoDB duplicate key error (code 11000)
    let injectedError = true;
    jest.spyOn(credentialRepo, 'createMany').mockImplementation(async (items: any[]) => {
      if (injectedError) {
        injectedError = false;
        // Simulate concurrent insert that won the race
        const item = items[0];
        inMemoryCredentials.set(`${item.eventId}_${item.sequenceNumber}`, {
          _id: new mongoose.Types.ObjectId(),
          ...item,
          createdAt: new Date(),
        });
        const err: any = new Error('E11000 duplicate key error collection: event_credentials index: eventId_1_sequenceNumber_1');
        err.code = 11000;
        throw err;
      }
      return items as any;
    });

    await (jobQueueService as any).processImportJob(job);

    expect(job.status).toBe('COMPLETED');
    expect(job.result.importedCount).toBe(1);
    expect(inMemoryCredentials.size).toBe(1);
  });

  it('8. Defines accurate final counts across multiple attempts without under-counting', async () => {
    const records = [
      { rowNumber: 1, name: 'Hank Pym', email: 'hank@avengers.org' },
      { rowNumber: 2, name: 'Janet Van Dyne', email: 'janet@avengers.org' },
      { rowNumber: 3, name: 'Scott Lang', email: 'scott@avengers.org' },
      { rowNumber: 4, name: 'Scott Lang', email: 'scott@avengers.org' }, // duplicate row
    ];
    const job = createMockJob(records);

    // Attempt 1: pre-populate Hank Pym in DB
    job.payload.startingSequence = 10;
    job.payload.endSequence = 13;
    inMemoryCredentials.set(`${mockEventId}_10`, {
      _id: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(mockEventId),
      sequenceNumber: 10,
      formattedId: 'PASS-00010',
      holder: { name: 'Hank Pym', email: 'hank@avengers.org' },
    });

    // Run Attempt 2
    job.attempts = 2;
    await (jobQueueService as any).processImportJob(job);

    expect(job.status).toBe('COMPLETED');
    // Total in block: 3 (Hank, Janet, Scott). Scott duplicate row was skipped.
    expect(job.result.importedCount).toBe(3);
    expect(job.result.skippedCount).toBe(1);
    expect(job.result.failedCount).toBe(0);
    expect(job.progress.succeeded).toBe(3);
    expect(job.progress.skipped).toBe(1);
  });

  it('9. Repeated progress updates do not duplicate error-log entries', async () => {
    const records = [
      { rowNumber: 1, name: 'Duplicate 1', email: 'dup@test.com' },
      { rowNumber: 2, name: 'Duplicate 2', email: 'dup@test.com' }, // duplicate
    ];
    const job = createMockJob(records);

    // Simulate prior errorLog entry already in job.result
    job.result.errorLog = [
      { row: 2, identifier: 'dup@test.com', error: 'Duplicate email "dup@test.com" in source file (skipped)' },
    ];

    await (jobQueueService as any).processImportJob(job);

    // Error log should remain 1 entry, NOT duplicated
    expect(job.result.errorLog.length).toBe(1);
    expect(job.result.errorLog[0].row).toBe(2);
  });

  it('10. Existing unrelated records are not accidentally overwritten ($setOnInsert safety)', async () => {
    const records = [
      { rowNumber: 1, name: 'New Attendee', email: 'new@attendee.com' },
    ];
    const job = createMockJob(records);

    // An existing credential already occupying sequence 1 with sensitive/distinct tokens
    const preExistingDoc = {
      _id: new mongoose.Types.ObjectId(),
      eventId: new mongoose.Types.ObjectId(mockEventId),
      sequenceNumber: 1,
      formattedId: 'PASS-00001',
      verificationToken: 'PRE_EXISTING_SECURE_TOKEN_DO_NOT_OVERWRITE',
      status: 'ACTIVE',
      holder: { name: 'PreExisting User', email: 'original@user.com' },
      createdAt: new Date('2025-01-01'),
    };
    inMemoryCredentials.set(`${mockEventId}_1`, preExistingDoc);

    await (jobQueueService as any).processImportJob(job);

    const preserved = inMemoryCredentials.get(`${mockEventId}_1`);
    expect(preserved.holder.name).toBe('PreExisting User');
    expect(preserved.holder.email).toBe('original@user.com');
    expect(preserved.verificationToken).toBe('PRE_EXISTING_SECURE_TOKEN_DO_NOT_OVERWRITE');
  });
});
