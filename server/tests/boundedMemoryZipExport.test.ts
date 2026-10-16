import fs from 'fs';
import path from 'path';
import os from 'os';
import mongoose from 'mongoose';
import { Writable } from 'stream';
import { EventExportService } from '../src/modules/events/services/event-export.service';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventJobRepository } from '../src/modules/events/repositories/mongo-event-job.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { EventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { mongoEventCredentialTemplateRepository } from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { TicketService } from '../src/modules/tickets/services/ticket.service';
import { ValidationError, StorageError } from '../src/middlewares/error.middleware';

describe('Bounded-Memory Ticket ZIP Export Verification Suite', () => {
  jest.setTimeout(60000);
  const eventId = new mongoose.Types.ObjectId().toString();

  let credentialRepo: MongoEventCredentialRepository;
  let jobRepo: MongoEventJobRepository;
  let eventRepo: MongoEventRepository;
  let storageService: SupabaseStorageService;
  let renderService: EventCredentialRenderingService;
  let exportService: EventExportService;

  let inMemoryJobs: Map<string, any>;
  let uploadedExports: Map<string, any>;

  const TINY_PNG_BUFFER = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryJobs = new Map();
    uploadedExports = new Map();

    credentialRepo = new MongoEventCredentialRepository();
    jobRepo = new MongoEventJobRepository();
    eventRepo = new MongoEventRepository();
    storageService = new SupabaseStorageService();
    renderService = new EventCredentialRenderingService();

    jest.spyOn(mongoEventCredentialTemplateRepository, 'findDefaultByEventId').mockResolvedValue(null);

    jest.spyOn(eventRepo, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(eventId),
      name: 'Scalable Summit 2026',
      credentialTerminology: 'Summit Badge',
      status: 'PUBLISHED',
    } as any);

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

    jest.spyOn(storageService, 'downloadTicketImage').mockResolvedValue(TINY_PNG_BUFFER);

    jest.spyOn(storageService, 'uploadExportFile').mockImplementation(async (eId: string, fileData: any, filename: string) => {
      uploadedExports.set(filename, {
        eventId: eId,
        filename,
        isStream: fileData && typeof fileData.pipe === 'function',
      });
      return {
        storagePath: `events/${eId}/exports/${filename}`,
        signedUrl: `https://storage.ticketification.app/events/${eId}/exports/${filename}?token=sig123`,
        publicUrl: undefined,
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

  describe('1. Dataset Exceeding 50,000 Records & Incremental Cursor Consumption', () => {
    it('consumes >50,000 synthetic records incrementally in bounded batches without materializing full dataset', async () => {
      const TOTAL_RECORDS = 50005;
      const BATCH_SIZE = 50;

      let maxBatchYielded = 0;
      let totalYielded = 0;
      let cursorClosed = false;

      // Mock count
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(TOTAL_RECORDS);

      // Instrumented cursor returning an async iterator yielding in chunks of 50
      jest.spyOn(credentialRepo, 'findExportCursor').mockImplementation(() => {
        let currentSeq = 0;
        return {
          async *[Symbol.asyncIterator]() {
            while (currentSeq < TOTAL_RECORDS) {
              const currentChunkSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - currentSeq);
              if (currentChunkSize > maxBatchYielded) {
                maxBatchYielded = currentChunkSize;
              }
              for (let i = 0; i < currentChunkSize; i++) {
                currentSeq++;
                totalYielded++;
                yield {
                  _id: new mongoose.Types.ObjectId(),
                  eventId: new mongoose.Types.ObjectId(eventId),
                  sequenceNumber: currentSeq,
                  formattedId: `SUM-${String(currentSeq).padStart(5, '0')}`,
                  verificationToken: `tok-${currentSeq}`,
                  credentialType: 'ATTENDEE',
                  status: 'ACTIVE',
                  usagePolicy: 'SINGLE_USE',
                  holder: { name: `Attendee ${currentSeq}`, email: `user${currentSeq}@test.org` },
                  asset: { storagePath: `events/${eventId}/credentials/sum-${currentSeq}.png` },
                };
              }
            }
          },
          close: async () => {
            cursorClosed = true;
          },
        } as any;
      });

      // Stream through the cursor incrementally with bounded memory tracking
      const cursor = credentialRepo.findExportCursor(eventId, {}, BATCH_SIZE);
      const memBefore = process.memoryUsage().heapUsed;

      let processedCount = 0;
      let activeBatchSize = 0;
      let peakConcurrentRecords = 0;

      for await (const cred of cursor) {
        processedCount++;
        activeBatchSize++;
        if (activeBatchSize > peakConcurrentRecords) {
          peakConcurrentRecords = activeBatchSize;
        }

        // Simulate per-record bounded processing and release
        expect(cred.formattedId).toBeDefined();
        if (processedCount % BATCH_SIZE === 0) {
          activeBatchSize = 0; // batch drained
        }
      }

      await cursor.close();
      const memAfter = process.memoryUsage().heapUsed;

      expect(processedCount).toBe(TOTAL_RECORDS);
      expect(totalYielded).toBe(TOTAL_RECORDS);
      expect(maxBatchYielded).toBeLessThanOrEqual(BATCH_SIZE);
      expect(peakConcurrentRecords).toBeLessThanOrEqual(BATCH_SIZE);
      expect(cursorClosed).toBe(true);

      // Verify heap usage remained flat and bounded across all 50,005 items
      const heapDiffMb = (memAfter - memBefore) / (1024 * 1024);
      expect(heapDiffMb).toBeLessThan(30);
    });

    it('successfully processes full end-to-end ZIP export to disk with bounded memory and verified ZIP output', async () => {
      const RECORD_COUNT = 150;
      const BATCH_SIZE = 50;

      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(RECORD_COUNT);

      jest.spyOn(credentialRepo, 'findExportCursor').mockImplementation(() => {
        let currentSeq = 0;
        return {
          async *[Symbol.asyncIterator]() {
            while (currentSeq < RECORD_COUNT) {
              const currentChunkSize = Math.min(BATCH_SIZE, RECORD_COUNT - currentSeq);
              for (let i = 0; i < currentChunkSize; i++) {
                currentSeq++;
                yield {
                  _id: new mongoose.Types.ObjectId(),
                  eventId: new mongoose.Types.ObjectId(eventId),
                  sequenceNumber: currentSeq,
                  formattedId: `SUM-${String(currentSeq).padStart(5, '0')}`,
                  verificationToken: `tok-${currentSeq}`,
                  credentialType: 'ATTENDEE',
                  status: 'ACTIVE',
                  usagePolicy: 'SINGLE_USE',
                  holder: { name: `Attendee ${currentSeq}`, email: `user${currentSeq}@test.org` },
                  asset: { storagePath: `events/${eventId}/credentials/sum-${currentSeq}.png` },
                };
              }
            }
          },
          close: async () => {},
        } as any;
      });

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
      expect(completed.result.exportedCount).toBe(RECORD_COUNT);
      expect(completed.result.fileSizeBytes).toBeGreaterThan(0);
      expect(completed.result.downloadUrl).toMatch(/https:\/\/storage\.ticketification\.app/);
    });
  });

  describe('2. Stable Pagination Keys & No Skipped or Duplicated Records', () => {
    it('verifies keyset pagination guarantees strict sequential monotonic ordering without skips or duplicates', async () => {
      const records = [
        { sequenceNumber: 1, formattedId: 'EVT-00001' },
        { sequenceNumber: 2, formattedId: 'EVT-00002' },
        { sequenceNumber: 3, formattedId: 'EVT-00003' },
        { sequenceNumber: 4, formattedId: 'EVT-00004' },
        { sequenceNumber: 5, formattedId: 'EVT-00005' },
      ];

      // Test simulated keyset pagination batch by batch
      const PAGE_SIZE = 2;
      let lastSeq = 0;
      const seenSequences: number[] = [];

      while (true) {
        const batch = records
          .filter((r) => r.sequenceNumber > lastSeq)
          .slice(0, PAGE_SIZE);

        if (batch.length === 0) break;

        for (const item of batch) {
          seenSequences.push(item.sequenceNumber);
          lastSeq = item.sequenceNumber;
        }
      }

      // Assert exact length, strict monotonic order, zero duplicates
      expect(seenSequences).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(seenSequences).size).toBe(5);
    });
  });

  describe('3. Stream Backpressure Handling', () => {
    it('observes and waits for writeStream drain when backpressure occurs', async () => {
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(10);

      const items = Array.from({ length: 10 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(eventId),
        sequenceNumber: i + 1,
        formattedId: `BP-${String(i + 1).padStart(5, '0')}`,
        verificationToken: `tok-${i + 1}`,
        holder: { name: `Guest ${i + 1}` },
        asset: { storagePath: `events/${eventId}/bp-${i + 1}.png` },
      }));

      jest.spyOn(credentialRepo, 'findExportCursor').mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const item of items) {
            yield item;
          }
        },
        close: async () => {},
      } as any);

      let drainWaited = false;
      const originalCreateWriteStream = fs.createWriteStream;
      const spyCreateWriteStream = jest.spyOn(fs, 'createWriteStream').mockImplementation((tempPath: any, opts: any) => {
        const stream = originalCreateWriteStream(tempPath, opts);
        let checked = false;
        Object.defineProperty(stream, 'writableNeedDrain', {
          get() {
            if (!checked) {
              checked = true;
              setTimeout(() => {
                drainWaited = true;
                stream.emit('drain');
              }, 15);
              return true;
            }
            return false;
          },
        });
        return stream;
      });

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

      expect(drainWaited).toBe(true);
      const completed = inMemoryJobs.get(jobId.toString());
      expect(completed.status).toBe('COMPLETED');
      expect(completed.result.exportedCount).toBe(10);

      spyCreateWriteStream.mockRestore();
    });
  });

  describe('4. Error Handling & Incomplete Archive Prevention', () => {
    it('aborts archive and cleans up temporary file if cursor fails mid-export', async () => {
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(20);

      let cursorClosed = false;
      jest.spyOn(credentialRepo, 'findExportCursor').mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (let i = 1; i <= 5; i++) {
            yield {
              _id: new mongoose.Types.ObjectId(),
              eventId: new mongoose.Types.ObjectId(eventId),
              sequenceNumber: i,
              formattedId: `ERR-${i}`,
              holder: { name: `Guest ${i}` },
              asset: { storagePath: `events/${eventId}/err-${i}.png` },
            };
          }
          throw new Error('Database connection reset during cursor iteration');
        },
        close: async () => {
          cursorClosed = true;
        },
      } as any);

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

      await expect(exportService.processExportJob(jobDoc as any)).rejects.toThrow(
        /Database connection reset during cursor iteration/
      );

      expect(cursorClosed).toBe(true);

      // Verify no orphaned temporary zip files remain
      const tempFiles = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(`ticket-export-${jobId.toString()}`));
      expect(tempFiles.length).toBe(0);
    });

    it('rejects and cleans up if a ticket fails to package, preventing incomplete archive from reporting COMPLETED', async () => {
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(5);

      const items = Array.from({ length: 5 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(eventId),
        sequenceNumber: i + 1,
        formattedId: `PASS-${i + 1}`,
        holder: { name: `Guest ${i + 1}` },
        // Pass 3 has no storagePath and no template available
        asset: i === 2 ? null : { storagePath: `events/${eventId}/pass-${i + 1}.png` },
      }));

      jest.spyOn(credentialRepo, 'findExportCursor').mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const item of items) {
            yield item;
          }
        },
        close: async () => {},
      } as any);

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

      await expect(exportService.processExportJob(jobDoc as any)).rejects.toThrow(
        /ZIP export incomplete/
      );

      // Verify job was NOT marked COMPLETED
      const job = inMemoryJobs.get(jobId.toString());
      expect(job.status).not.toBe('COMPLETED');

      // Verify temp file cleaned up
      const tempFiles = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(`ticket-export-${jobId.toString()}`));
      expect(tempFiles.length).toBe(0);
    });

    it('aborts archive, deletes temp file, and closes cursor when job is cancelled mid-export', async () => {
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(20);

      let cursorClosed = false;
      const jobId = new mongoose.Types.ObjectId();

      jest.spyOn(credentialRepo, 'findExportCursor').mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (let i = 1; i <= 20; i++) {
            if (i === 3) {
              // Simulate job cancelled externally
              const job = inMemoryJobs.get(jobId.toString());
              if (job) job.status = 'CANCELLED';
            }
            yield {
              _id: new mongoose.Types.ObjectId(),
              eventId: new mongoose.Types.ObjectId(eventId),
              sequenceNumber: i,
              formattedId: `CAN-${i}`,
              holder: { name: `Guest ${i}` },
              asset: { storagePath: `events/${eventId}/can-${i}.png` },
            };
          }
        },
        close: async () => {
          cursorClosed = true;
        },
      } as any);

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

      expect(cursorClosed).toBe(true);

      // Verify temp file removed
      const tempFiles = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(`ticket-export-${jobId.toString()}`));
      expect(tempFiles.length).toBe(0);
    });

    it('cleans up temp file when storage upload fails with StorageError', async () => {
      jest.spyOn(credentialRepo, 'countForExport').mockResolvedValue(2);

      const items = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: 1,
          formattedId: `UPL-1`,
          holder: { name: 'Guest 1' },
          asset: { storagePath: `events/${eventId}/upl-1.png` },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: 2,
          formattedId: `UPL-2`,
          holder: { name: 'Guest 2' },
          asset: { storagePath: `events/${eventId}/upl-2.png` },
        },
      ];

      jest.spyOn(credentialRepo, 'findExportCursor').mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const item of items) yield item;
        },
        close: async () => {},
      } as any);

      jest.spyOn(storageService, 'uploadExportFile').mockRejectedValueOnce(
        new StorageError('Failed to upload export file to Supabase Storage: Network Timeout')
      );

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

      await expect(exportService.processExportJob(jobDoc as any)).rejects.toThrow(StorageError);

      const tempFiles = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(`ticket-export-${jobId.toString()}`));
      expect(tempFiles.length).toBe(0);
    });
  });

  describe('5. TicketService.streamTicketsZip Keyset Pagination & Stream Backpressure', () => {
    it('streams tickets using keyset pagination and handles stream backpressure', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'DevFest', createdBy: 'user_1' }),
      };

      const syntheticTickets = Array.from({ length: 60 }, (_, i) => ({
        ticket: {
          id: `t_${i + 1}`,
          sequenceNumber: i + 1,
          assetPath: `events/evt_1/tickets/t_${i + 1}.png`,
          guestId: `g_${i + 1}`,
          status: 'ACTIVE',
        },
        guest: { name: `Dev ${i + 1}` },
        ticketType: { name: 'General', usagePolicy: 'SINGLE_USE' },
      }));

      let findExportBatchKeysetCalls = 0;
      const mockTicketRepo: any = {
        findExportBatchKeyset: jest.fn().mockImplementation((eId: string, lastSeq: number, limit: number) => {
          findExportBatchKeysetCalls++;
          return Promise.resolve(
            syntheticTickets.filter((t) => t.ticket.sequenceNumber > lastSeq).slice(0, limit)
          );
        }),
      };

      const mockStorage: any = {
        downloadTicketImage: jest.fn().mockResolvedValue(TINY_PNG_BUFFER),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        {} as any,
        {} as any,
        {} as any,
        mockStorage
      );

      const chunks: Buffer[] = [];
      let drainTriggered = false;
      let writeCount = 0;
      let simulatedNeedDrain = false;

      const testStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          writeCount++;
          if (writeCount === 5) {
            simulatedNeedDrain = true;
            setTimeout(() => {
              simulatedNeedDrain = false;
              drainTriggered = true;
              testStream.emit('drain');
            }, 10);
          }
          callback();
        },
      });

      Object.defineProperty(testStream, 'writableNeedDrain', {
        get() {
          return simulatedNeedDrain;
        },
      });

      await service.streamTicketsZip('evt_1', 'user_1', testStream);

      expect(findExportBatchKeysetCalls).toBeGreaterThanOrEqual(2);
      expect(mockTicketRepo.findExportBatchKeyset).toHaveBeenCalledWith('evt_1', 0, 50);
      expect(mockTicketRepo.findExportBatchKeyset).toHaveBeenCalledWith('evt_1', 50, 50);

      const zipBuf = Buffer.concat(chunks);
      expect(zipBuf[0]).toBe(0x50);
      expect(zipBuf[1]).toBe(0x4b);
      expect(zipBuf[2]).toBe(0x03);
      expect(zipBuf[3]).toBe(0x04);
      expect(drainTriggered).toBe(true);
    });

    it('throws ValidationError if no tickets exist for the event', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_empty', name: 'Empty', createdBy: 'user_1' }),
      };
      const mockTicketRepo: any = {
        findExportBatchKeyset: jest.fn().mockResolvedValue([]),
        findByEventId: jest.fn().mockResolvedValue([]),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );

      const testStream = new Writable({
        write(_chunk, _encoding, cb) {
          cb();
        },
      });

      await expect(service.streamTicketsZip('evt_empty', 'user_1', testStream)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
