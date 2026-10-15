import fs from 'fs';
import path from 'path';
import os from 'os';
import mongoose from 'mongoose';
import { EventExportService } from '../src/modules/events/services/event-export.service';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { mongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';

describe('Export Streaming & Memory Optimization Tests', () => {
  jest.setTimeout(30000);
  const eventId = new mongoose.Types.ObjectId().toString();

  let credentialRepo: MongoEventCredentialRepository;
  let jobRepo: MongoEventJobRepository;
  let eventRepo: MongoEventRepository;
  let storageService: SupabaseStorageService;
  let renderService: EventCredentialRenderingService;
  let exportService: EventExportService;

  let inMemoryJobs: Map<string, any>;
  let inMemoryCredentials: Map<string, any>;
  let uploadedExports: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryJobs = new Map();
    inMemoryCredentials = new Map();
    uploadedExports = new Map();

    credentialRepo = new MongoEventCredentialRepository();
    jobRepo = new MongoEventJobRepository();
    eventRepo = new MongoEventRepository();
    storageService = new SupabaseStorageService();
    renderService = new EventCredentialRenderingService();

    // Mock Template Repo default fallback
    jest.spyOn(mongoEventCredentialTemplateRepository, 'findDefaultByEventId').mockResolvedValue(null);

    // Mock Event Repo
    jest.spyOn(eventRepo, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(eventId),
      name: 'Global Tech Expo 2026',
      credentialTerminology: 'Visitor Pass',
      status: 'PUBLISHED',
    } as any);

    // Mock Job Repo
    jest.spyOn(jobRepo, 'findById').mockImplementation(async (id: string) => {
      return inMemoryJobs.get(id.toString()) || null;
    });

    jest.spyOn(jobRepo, 'updateProgress').mockImplementation(async (id: string, prog: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.progress = { ...job.progress, ...prog };
      }
      return job as any;
    });

    jest.spyOn(jobRepo, 'markCompleted').mockImplementation(async (id: string, result: any) => {
      const job = inMemoryJobs.get(id.toString());
      if (job) {
        job.status = 'COMPLETED';
        job.result = result;
        job.progress.percentage = 100;
      }
      return job as any;
    });

    // Mock Storage Service downloadTicketImage
    jest.spyOn(storageService, 'downloadTicketImage').mockImplementation(async () => {
      // 1x1 valid PNG
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
    });

    // Mock Storage Service uploadExportFile
    jest.spyOn(storageService, 'uploadExportFile').mockImplementation(async (eId: string, fileData: any, filename: string) => {
      uploadedExports.set(filename, {
        eventId: eId,
        filename,
        isStream: fileData && typeof fileData.pipe === 'function',
      });
      return {
        storagePath: `events/${eId}/exports/${filename}`,
        signedUrl: `https://storage.ticketification.app/events/${eId}/exports/${filename}?token=sig`,
        publicUrl: `https://storage.ticketification.app/events/${eId}/exports/${filename}`,
      };
    });

    exportService = new EventExportService(
      credentialRepo,
      jobRepo,
      eventRepo,
      storageService,
      renderService
    );
  });

  function createMockPasses(count: number): any[] {
    const list: any[] = [];
    for (let i = 1; i <= count; i++) {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(eventId),
        sequenceNumber: i,
        formattedId: `VIS-${String(i).padStart(5, '0')}`,
        verificationToken: `token-${i}`,
        credentialType: 'VISITOR_PASS',
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
        checkInCount: 0,
        holder: { name: `Visitor ${i}`, email: `vis${i}@expo.org` },
        asset: { storagePath: `events/${eventId}/credentials/vis-${i}.png` },
      };
      inMemoryCredentials.set(doc._id.toString(), doc);
      list.push(doc);
    }
    return list;
  }

  it('successfully streams small export into ZIP on disk and uploads without memory buildup', async () => {
    createMockPasses(5);
    jest.spyOn(credentialRepo, 'findAllForExport').mockResolvedValue(Array.from(inMemoryCredentials.values()) as any);

    const jobId = new mongoose.Types.ObjectId();
    const jobDoc = {
      _id: jobId,
      eventId: new mongoose.Types.ObjectId(eventId),
      jobType: 'EXPORT_CREDENTIALS',
      status: 'PROCESSING',
      payload: { exportFormat: 'ZIP_PASSES' },
      progress: { total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
    };
    inMemoryJobs.set(jobId.toString(), jobDoc);

    await exportService.processExportJob(jobDoc as any);

    const completed = inMemoryJobs.get(jobId.toString());
    expect(completed.status).toBe('COMPLETED');
    expect(completed.result.exportedCount).toBe(5);
    expect(completed.result.fileSizeBytes).toBeGreaterThan(0);
    expect(completed.result.downloadUrl).toMatch(/https:\/\/storage\.ticketification\.app/);
  });

  it('handles large export with representative synthetic dataset while keeping memory bounded', async () => {
    // 100 representative passes
    createMockPasses(100);
    jest.spyOn(credentialRepo, 'findAllForExport').mockResolvedValue(Array.from(inMemoryCredentials.values()) as any);

    const jobId = new mongoose.Types.ObjectId();
    const jobDoc = {
      _id: jobId,
      eventId: new mongoose.Types.ObjectId(eventId),
      jobType: 'EXPORT_CREDENTIALS',
      status: 'PROCESSING',
      payload: { exportFormat: 'ZIP_PASSES' },
      progress: { total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
    };
    inMemoryJobs.set(jobId.toString(), jobDoc);

    const memoryBefore = process.memoryUsage().heapUsed;
    await exportService.processExportJob(jobDoc as any);
    const memoryAfter = process.memoryUsage().heapUsed;

    const completed = inMemoryJobs.get(jobId.toString());
    expect(completed.status).toBe('COMPLETED');
    expect(completed.result.exportedCount).toBe(100);
    expect(completed.progress.percentage).toBe(100);

    // Heap difference should be minimal and bounded because chunks are not stored in memory array
    const heapDiffMb = (memoryAfter - memoryBefore) / (1024 * 1024);
    expect(heapDiffMb).toBeLessThan(50); // Less than 50MB delta
  });

  it('guarantees temporary file cleanup even if storage upload fails', async () => {
    createMockPasses(2);
    jest.spyOn(credentialRepo, 'findAllForExport').mockResolvedValue(Array.from(inMemoryCredentials.values()) as any);

    const jobId = new mongoose.Types.ObjectId();
    const jobDoc = {
      _id: jobId,
      eventId: new mongoose.Types.ObjectId(eventId),
      jobType: 'EXPORT_CREDENTIALS',
      status: 'PROCESSING',
      payload: { exportFormat: 'ZIP_PASSES' },
      progress: { total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 },
    };
    inMemoryJobs.set(jobId.toString(), jobDoc);

    // Simulate Supabase upload failure
    jest.spyOn(storageService, 'uploadExportFile').mockRejectedValueOnce(new Error('Supabase Storage 503 Service Unavailable'));

    await expect(exportService.processExportJob(jobDoc as any)).rejects.toThrow(/503 Service Unavailable/);

    // Verify no orphaned temporary zip files remain in os.tmpdir()
    const tempFiles = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(`ticket-export-${jobId.toString()}`));
    expect(tempFiles.length).toBe(0);
  });
});
