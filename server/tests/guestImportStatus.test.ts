import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { GuestImportService } from '../src/modules/guests/services/guest-import.service';
import { EventModel } from '../src/db/mongo/models/event.model';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { eventJobQueueService } from '../src/modules/events/services/event-job-queue.service';

describe('R2: Guest Roster Import UI Status & Credential Ingestion Resilience', () => {
  const tempDir = new GuestImportService().getUploadDir();
  const tempUploadFile = path.resolve(tempDir, 'temp_roster_status_test.xlsx');

  const mockOwnerId = new mongoose.Types.ObjectId().toString();
  const mockEventId = new mongoose.Types.ObjectId().toString();

  const mockMongoEvent = {
    _id: new mongoose.Types.ObjectId(mockEventId),
    name: 'Hackathon 2026',
    ownerId: mockOwnerId,
    credentialTerminology: 'Badge',
    attendanceMode: 'EXTERNAL_ROSTER',
  };

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempUploadFile)) {
      try {
        fs.unlinkSync(tempUploadFile);
      } catch {}
    }
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (file.startsWith('staging-')) {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch {}
        }
      }
    } catch {}
  });

  function createTestSpreadsheet(rows: Record<string, any>[], filePath: string) {
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Roster');
    xlsx.writeFile(workbook, filePath);
  }

  it('1. should isolate per-row credential creation errors in MongoDB mode without failing the import', async () => {
    const rows = [
      { 'Full Name': 'Alice Smith', 'Email': 'alice@example.com', 'Role': 'VIP' },
      { 'Full Name': 'Corrupt Row', 'Email': 'corrupt@example.com', 'Role': 'GENERAL' },
      { 'Full Name': 'Charlie Brown', 'Email': 'charlie@example.com', 'Role': 'SPEAKER' },
    ];
    createTestSpreadsheet(rows, tempUploadFile);

    // Mock MongoDB event authorization
    jest.spyOn(EventModel, 'findById').mockImplementation((() => {
      const query: any = Promise.resolve(mockMongoEvent);
      query.exec = jest.fn().mockResolvedValue(mockMongoEvent);
      return query;
    }) as any);

    // Mock sequence generation
    let seqCounter = 100;
    jest.spyOn(mongoEventCredentialRepository, 'getNextSequenceNumber').mockImplementation(async () => {
      return ++seqCounter;
    });

    // Mock bulk render job enqueue
    const enqueueSpy = jest.spyOn(eventJobQueueService, 'enqueueBulkRenderJob').mockResolvedValue({
      id: 'job-123',
    } as any);

    // Mock EventCredentialModel.create: row 2 throws duplicate key error, rows 1 and 3 succeed
    const createdDocs: any[] = [];
    jest.spyOn(EventCredentialModel, 'create').mockImplementation((async (payload: any) => {
      if (payload.holder?.name === 'Corrupt Row') {
        throw new Error('E11000 duplicate key error collection: event_credentials index: verificationToken_1');
      }
      createdDocs.push(payload);
      return payload;
    }) as any);

    const service = new GuestImportService();

    // 1. Upload & Analyze
    const analysis = await service.uploadAndAnalyze(mockEventId, mockOwnerId, tempUploadFile, 'roster.xlsx');
    expect(analysis.importId).toBeDefined();

    // 2. Validate
    await service.validateImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
      columnMapping: {
        'Full Name': 'name',
        'Email': 'email',
        'Role': 'category',
      },
    });

    // 3. Confirm Import
    const result = await service.confirmImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
    });

    // Verification: Partial error did not crash the import or return false failure
    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0]).toContain('Corrupt Row');
    expect(createdDocs).toHaveLength(2);
    expect(createdDocs[0].holder.name).toBe('Alice Smith');
    expect(createdDocs[1].holder.name).toBe('Charlie Brown');

    // Bulk render job was still enqueued for the 2 successful credentials
    expect(enqueueSpy).toHaveBeenCalledWith(mockEventId, mockOwnerId, undefined);
  });

  it('2. should return clean success with 0 errors and skippedCount 0 when all rows succeed', async () => {
    const rows = [
      { 'Full Name': 'Devendra Singh', 'Email': 'dev@example.com' },
      { 'Full Name': 'Pooja Hegde', 'Email': 'pooja@example.com' },
    ];
    createTestSpreadsheet(rows, tempUploadFile);

    jest.spyOn(EventModel, 'findById').mockImplementation((() => {
      const query: any = Promise.resolve(mockMongoEvent);
      query.exec = jest.fn().mockResolvedValue(mockMongoEvent);
      return query;
    }) as any);

    let seqCounter = 50;
    jest.spyOn(mongoEventCredentialRepository, 'getNextSequenceNumber').mockImplementation(async () => {
      return ++seqCounter;
    });

    const enqueueSpy = jest.spyOn(eventJobQueueService, 'enqueueBulkRenderJob').mockResolvedValue({
      id: 'job-456',
    } as any);

    jest.spyOn(EventCredentialModel, 'create').mockImplementation((async (payload: any) => {
      return payload;
    }) as any);

    const service = new GuestImportService();

    const analysis = await service.uploadAndAnalyze(mockEventId, mockOwnerId, tempUploadFile, 'guests.xlsx');

    await service.validateImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
      columnMapping: { 'Full Name': 'name', 'Email': 'email' },
    });

    const result = await service.confirmImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
    });

    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toBeUndefined();
    expect(enqueueSpy).toHaveBeenCalledWith(mockEventId, mockOwnerId, undefined);
  });

  it('3. should gracefully handle total row creation failure without uncaught exceptions', async () => {
    const rows = [
      { 'Full Name': 'Guest Alpha' },
      { 'Full Name': 'Guest Beta' },
    ];
    createTestSpreadsheet(rows, tempUploadFile);

    jest.spyOn(EventModel, 'findById').mockImplementation((() => {
      const query: any = Promise.resolve(mockMongoEvent);
      query.exec = jest.fn().mockResolvedValue(mockMongoEvent);
      return query;
    }) as any);

    jest.spyOn(mongoEventCredentialRepository, 'getNextSequenceNumber').mockImplementation(async () => 1);

    const enqueueSpy = jest.spyOn(eventJobQueueService, 'enqueueBulkRenderJob').mockResolvedValue({} as any);

    // All rows fail in DB
    jest.spyOn(EventCredentialModel, 'create').mockImplementation((async () => {
      throw new Error('Database connection timed out');
    }) as any);

    const service = new GuestImportService();

    const analysis = await service.uploadAndAnalyze(mockEventId, mockOwnerId, tempUploadFile, 'all_fail.xlsx');

    await service.validateImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
      columnMapping: { 'Full Name': 'name' },
    });

    const result = await service.confirmImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
    });

    // Does not throw 500 error; reports 0 imported and 2 skipped
    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(2);
    expect(result.errors).toHaveLength(2);
    // Background render job is NOT enqueued when 0 credentials inserted
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('4. should persist staging metadata to disk and restore columnMapping even after in-memory cache is wiped', async () => {
    const rows = [
      { 'Attendee Full Name': 'Restored Guest', 'Guest Phone': '9998887777', 'Badge Category': 'VIP' },
    ];
    createTestSpreadsheet(rows, tempUploadFile);

    jest.spyOn(EventModel, 'findById').mockImplementation((() => {
      const query: any = Promise.resolve(mockMongoEvent);
      query.exec = jest.fn().mockResolvedValue(mockMongoEvent);
      return query;
    }) as any);

    let seqCounter = 200;
    jest.spyOn(mongoEventCredentialRepository, 'getNextSequenceNumber').mockImplementation(async () => ++seqCounter);
    jest.spyOn(eventJobQueueService, 'enqueueBulkRenderJob').mockResolvedValue({} as any);

    let createdPayload: any = null;
    jest.spyOn(EventCredentialModel, 'create').mockImplementation((async (payload: any) => {
      createdPayload = payload;
      return payload;
    }) as any);

    const service = new GuestImportService();

    const analysis = await service.uploadAndAnalyze(mockEventId, mockOwnerId, tempUploadFile, 'recover.xlsx');

    // Validate with custom mappings
    await service.validateImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
      columnMapping: {
        'Attendee Full Name': 'name',
        'Guest Phone': 'phone',
        'Badge Category': 'category',
      },
      categoryMapping: {
        'VIP': 'ALL_ACCESS_VIP',
      },
    });

    // Verify sidecar metadata file was written to disk
    const metaPath = path.join(tempDir, `staging-${analysis.importId}.meta.json`);
    expect(fs.existsSync(metaPath)).toBe(true);

    // Simulate worker process reload / cache eviction
    (service as any).activeUploads.clear();
    expect((service as any).activeUploads.size).toBe(0);

    // Confirm import without in-memory cache: should read disk staging & metadata!
    const result = await service.confirmImport(mockEventId, mockOwnerId, {
      importId: analysis.importId,
    });

    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(1);
    expect(createdPayload).toBeDefined();
    expect(createdPayload.holder.name).toBe('Restored Guest');
    expect(createdPayload.holder.phone).toBe('9998887777');
    expect(createdPayload.credentialType).toBe('ALL_ACCESS_VIP');

    // Both staging file and metadata file should be cleaned up after confirmation
    expect(fs.existsSync(metaPath)).toBe(false);
  });

  it('5. should defensively unwrap API responses whether nested under res.data or direct', () => {
    // Contract test mirroring client/src/api/guests.ts unwrapping logic:
    // return res?.data ?? res
    const defensiveUnwrap = (res: any) => res?.data ?? res;

    // Case A: Standard Axios response where data is nested
    const nestedRes = {
      success: true,
      data: {
        success: true,
        importedCount: 15,
        skippedCount: 2,
        importId: 'imp-xyz',
      },
    };
    expect(defensiveUnwrap(nestedRes)).toEqual({
      success: true,
      importedCount: 15,
      skippedCount: 2,
      importId: 'imp-xyz',
    });

    // Case B: Direct response (e.g. mock or transformed interceptor)
    const directRes = {
      success: true,
      importedCount: 15,
      skippedCount: 2,
      importId: 'imp-xyz',
    };
    expect(defensiveUnwrap(directRes)).toEqual({
      success: true,
      importedCount: 15,
      skippedCount: 2,
      importId: 'imp-xyz',
    });

    // Case C: Nullish safety
    expect(defensiveUnwrap(null)).toBeNull();
    expect(defensiveUnwrap(undefined)).toBeUndefined();
  });
});
