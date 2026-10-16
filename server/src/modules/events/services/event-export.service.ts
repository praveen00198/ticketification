import fs from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';
import * as xlsx from 'xlsx';
import { IEventJobDocument, IJobResult } from '../../../db/mongo/models/event-job.model';
import {
  mongoEventCredentialRepository,
  MongoEventCredentialRepository,
} from '../repositories/mongo-event-credential.repository';
import {
  mongoEventJobRepository,
  MongoEventJobRepository,
} from '../repositories/mongo-event-job.repository';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  supabaseStorageService,
  SupabaseStorageService,
} from '../../tickets/services/supabase-storage.service';
import {
  eventCredentialRenderingService,
  EventCredentialRenderingService,
} from './event-credential-rendering.service';
import { mongoEventCredentialTemplateRepository } from '../repositories/mongo-event-credential-template.repository';
import { NotFoundError, ValidationError } from '../../../middlewares/error.middleware';

export type ExportFormat = 'ZIP_PASSES' | 'ROSTER_XLSX' | 'ROSTER_CSV';

export const MAX_XLSX_EXPORT_ROWS = 10000;

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export class EventExportService {
  constructor(
    private readonly credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private readonly jobRepo: MongoEventJobRepository = mongoEventJobRepository,
    private readonly eventRepo: MongoEventRepository = mongoEventRepository,
    private readonly storageService: SupabaseStorageService = supabaseStorageService,
    private readonly renderService: EventCredentialRenderingService = eventCredentialRenderingService
  ) {}

  /**
   * Orchestrate export processing based on exportFormat with worker ownership and heartbeat.
   */
  async processExportJob(job: IEventJobDocument, workerId?: string): Promise<void> {
    const eventId = job.eventId.toString();
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found for export job');
    }

    const exportFormat: ExportFormat = job.payload.exportFormat || 'ZIP_PASSES';
    const filters = job.payload.filters || {};

    if (exportFormat === 'ZIP_PASSES') {
      await this.exportCredentialsZip(event, job, filters, workerId);
    } else {
      await this.exportRosterSpreadsheet(event, job, exportFormat, filters, workerId);
    }
  }

  /**
   * Stream & bundle credential PNG passes into a compressed ZIP archive using bounded-memory cursor.
   * Streams output directly to a temporary file on disk without materializing the whole archive in memory.
   */
  private async exportCredentialsZip(
    event: any,
    job: IEventJobDocument,
    filters: any,
    workerId?: string
  ): Promise<void> {
    const eventId = event._id.toString();
    const total = await this.credentialRepo.countForExport(eventId, filters);

    await this.jobRepo.updateProgress(
      job._id.toString(),
      {
        total,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      },
      undefined,
      workerId
    );

    if (total === 0) {
      await this.jobRepo.markCompleted(
        job._id.toString(),
        {
          importedCount: 0,
          renderedCount: 0,
          exportedCount: 0,
          downloadUrl: null,
          storagePath: null,
          fileSizeBytes: 0,
          errorLog: [{ error: 'No credentials found matching export criteria' }],
        },
        workerId
      );
      return;
    }

    const defaultTemplate = await mongoEventCredentialTemplateRepository.findDefaultByEventId(eventId);
    const tempFilePath = path.join(os.tmpdir(), `ticket-export-${job._id.toString()}-${Date.now()}.zip`);
    const writeStream = fs.createWriteStream(tempFilePath);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(writeStream);

    let streamFinished = false;
    const archiveClosedPromise = new Promise<void>((resolve, reject) => {
      writeStream.on('close', () => {
        streamFinished = true;
        resolve();
      });
      writeStream.on('error', (err) => {
        streamFinished = true;
        reject(err);
      });
      archive.on('error', (err) => {
        streamFinished = true;
        reject(err);
      });
    });

    const result: IJobResult = {
      importedCount: 0,
      renderedCount: 0,
      exportedCount: 0,
      errorLog: [],
    };

    let processedCount = 0;
    let succeededCount = 0;
    let cursor: any = null;

    try {
      cursor = this.credentialRepo.findExportCursor(eventId, filters, 50);

      for await (const cred of cursor) {
        processedCount++;

        // Check cancellation every 10 passes or on the first record
        if (processedCount % 10 === 0 || processedCount === 1) {
          const currentJob = await this.jobRepo.findById(job._id.toString());
          if (currentJob?.status === 'CANCELLED') {
            archive.abort();
            if (cursor && typeof cursor.close === 'function') await cursor.close();
            return;
          }
        }

        // Heartbeat lease renewal every 50 passes
        if (workerId && processedCount % 50 === 0) {
          const renewed = await this.jobRepo.renewLease(job._id.toString(), workerId);
          if (!renewed) {
            archive.abort();
            if (cursor && typeof cursor.close === 'function') await cursor.close();
            throw new Error('Worker lease lost or expired during ZIP export');
          }
        }

        try {
          let imageBuffer: Buffer | null = null;

          if (cred.asset?.storagePath) {
            try {
              imageBuffer = await this.storageService.downloadTicketImage(cred.asset.storagePath);
            } catch {
              imageBuffer = null;
            }
          }

          if (!imageBuffer && defaultTemplate) {
            try {
              imageBuffer = await this.renderService.renderCredentialBuffer(
                defaultTemplate,
                {
                  name: cred.holder?.name,
                  sequence: cred.formattedId,
                  verificationToken: cred.verificationToken,
                  role: cred.holder?.category,
                  eventName: event.name,
                }
              );
            } catch (renderErr: any) {
              result.errorLog.push({
                identifier: cred.formattedId,
                error: `Rendering failed: ${renderErr.message}`,
              });
            }
          }

          if (imageBuffer) {
            const safeName = (cred.holder?.name || 'Attendee')
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .replace(/_+/g, '_');
            const filename = `${cred.formattedId}-${safeName}.png`;
            archive.append(imageBuffer, { name: filename });
            succeededCount++;

            // Respect writeStream backpressure
            if (writeStream.writableNeedDrain || (writeStream as any)._writableState?.needDrain) {
              await new Promise<void>((resolve) => writeStream.once('drain', () => resolve()));
            }
          } else {
            result.errorLog.push({
              identifier: cred.formattedId,
              error: 'Asset not rendered and no default template available',
            });
          }
        } catch (err: any) {
          result.errorLog.push({
            identifier: cred.formattedId,
            error: err.message || 'Failed to package pass into archive',
          });
        }

        // Update progress at bounded intervals or on the last record
        const progressInterval = total > 500 ? 50 : 10;
        if (processedCount % progressInterval === 0 || processedCount === total) {
          const percentage = Math.round((processedCount / total) * 100);
          const updated = await this.jobRepo.updateProgress(
            job._id.toString(),
            {
              total,
              processed: processedCount,
              succeeded: succeededCount,
              failed: result.errorLog.length,
              percentage,
            },
            result,
            workerId
          );
          if (workerId && !updated) {
            archive.abort();
            if (cursor && typeof cursor.close === 'function') await cursor.close();
            throw new Error('Worker ownership lost during ZIP export progress update');
          }
        }
      }

      if (succeededCount === 0 && total > 0) {
        throw new Error('Failed to package any valid credential pass into archive');
      }

      // Prevent incomplete archives from being marked COMPLETED (Requirement 10)
      if (result.errorLog.length > 0 || (total > 0 && succeededCount < total)) {
        throw new Error(
          `ZIP export incomplete: packaged ${succeededCount} of ${total} passes (${result.errorLog.length} failures)`
        );
      }

      await archive.finalize();
      await archiveClosedPromise;

      const fileSizeBytes = fs.existsSync(tempFilePath) ? fs.statSync(tempFilePath).size : 0;
      const sanitizedEventName = (event.name || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const zipFilename = `passes-${sanitizedEventName}-${job._id.toString()}-att${job.attempts || 1}-${Date.now()}.zip`;

      const fileData = fs.createReadStream(tempFilePath);
      fileData.on('error', () => {});

      let uploadRes: any;
      try {
        uploadRes = await this.storageService.uploadExportFile(
          eventId,
          fileData,
          zipFilename,
          'application/zip'
        );
      } finally {
        fileData.destroy();
      }

      result.exportedCount = succeededCount;
      result.downloadUrl = uploadRes.signedUrl || uploadRes.publicUrl;
      result.storagePath = uploadRes.storagePath;
      result.fileSizeBytes = fileSizeBytes;

      await this.jobRepo.markCompleted(job._id.toString(), result, workerId);
    } catch (err: any) {
      if (!streamFinished) {
        try {
          archive.abort();
        } catch {}
      }
      if (!writeStream.destroyed) {
        try {
          writeStream.destroy();
        } catch {}
      }
      throw err;
    } finally {
      if (cursor && typeof cursor.close === 'function') {
        try {
          await cursor.close();
        } catch {}
      }
      if (!writeStream.destroyed) {
        try {
          writeStream.destroy();
        } catch {}
      }
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.warn('[EventExportService] Temp file cleanup note:', cleanupErr);
        }
      }
    }
  }

  /**
   * Export Attendee Roster & Check-in telemetry as XLSX or CSV using bounded-memory streaming.
   */
  private async exportRosterSpreadsheet(
    event: any,
    job: IEventJobDocument,
    format: 'ROSTER_XLSX' | 'ROSTER_CSV',
    filters: any,
    workerId?: string
  ): Promise<void> {
    const eventId = event._id.toString();
    const total = await this.credentialRepo.countForExport(eventId, filters);

    await this.jobRepo.updateProgress(
      job._id.toString(),
      {
        total,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      },
      undefined,
      workerId
    );

    if (total === 0) {
      await this.jobRepo.markCompleted(
        job._id.toString(),
        {
          importedCount: 0,
          renderedCount: 0,
          exportedCount: 0,
          downloadUrl: null,
          storagePath: null,
          fileSizeBytes: 0,
          errorLog: [{ error: 'No credentials found matching export criteria' }],
        },
        workerId
      );
      return;
    }

    if (format === 'ROSTER_CSV') {
      await this.exportRosterCsvStreaming(event, job, filters, total, workerId);
    } else {
      await this.exportRosterXlsxBounded(event, job, filters, total, workerId);
    }
  }

  /**
   * Genuinely bounded-memory CSV export streaming records row-by-row directly to disk with UTF-8 BOM.
   */
  private async exportRosterCsvStreaming(
    event: any,
    job: IEventJobDocument,
    filters: any,
    total: number,
    workerId?: string
  ): Promise<void> {
    const eventId = event._id.toString();
    const tempFilePath = path.join(os.tmpdir(), `roster-export-${job._id.toString()}-${Date.now()}.csv`);
    const writeStream = fs.createWriteStream(tempFilePath, { encoding: 'utf8' });

    let cursor: any = null;

    try {
      // Write UTF-8 Byte Order Mark (BOM) so Excel seamlessly parses Unicode / Hindi characters
      writeStream.write('\uFEFF');

      const headers = [
        '#',
        'Pass ID',
        'Full Name',
        'Email Address',
        'Phone Number',
        'Category',
        'Organization',
        'Credential Type',
        'Usage Policy',
        'Status',
        'Check-in Status',
        'Check-in Count',
        'First Checked-in At',
        'Last Checked-in At',
        'Verification Token',
        'Issued At',
      ];
      writeStream.write(headers.map(escapeCsvField).join(',') + '\n');

      cursor = this.credentialRepo.findExportCursor(eventId, filters, 50);
      let idx = 0;

      for await (const cred of cursor) {
        idx++;

        if (workerId && idx % 50 === 0) {
          const renewed = await this.jobRepo.renewLease(job._id.toString(), workerId);
          if (!renewed) {
            throw new Error('Worker lease lost or expired during CSV export');
          }
        }

        const rowValues = [
          idx,
          cred.formattedId,
          cred.holder?.name || 'Unassigned',
          cred.holder?.email || '',
          cred.holder?.phone || '',
          cred.holder?.category || 'PARTICIPANT',
          cred.holder?.organization || '',
          cred.credentialType,
          cred.usagePolicy,
          cred.status,
          (cred.checkInCount || 0) > 0 ? 'CHECKED_IN' : 'PENDING',
          cred.checkInCount || 0,
          cred.firstCheckedInAt ? new Date(cred.firstCheckedInAt).toISOString() : '',
          cred.lastCheckedInAt ? new Date(cred.lastCheckedInAt).toISOString() : '',
          cred.verificationToken,
          cred.createdAt ? new Date(cred.createdAt).toISOString() : '',
        ];

        const line = rowValues.map(escapeCsvField).join(',') + '\n';
        if (!writeStream.write(line)) {
          await new Promise<void>((resolve) => writeStream.once('drain', resolve));
        }

        if (idx % 25 === 0 || idx === total) {
          const percentage = Math.round((idx / total) * 100);
          const updated = await this.jobRepo.updateProgress(
            job._id.toString(),
            {
              total,
              processed: idx,
              succeeded: idx,
              failed: 0,
              percentage,
            },
            undefined,
            workerId
          );
          if (workerId && !updated) {
            throw new Error('Worker ownership lost during CSV export');
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end(resolve);
        writeStream.on('error', reject);
      });

      const fileSizeBytes = fs.existsSync(tempFilePath) ? fs.statSync(tempFilePath).size : 0;
      const sanitizedEventName = (event.name || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const filename = `roster-${sanitizedEventName}-${Date.now()}.csv`;

      const fileStream = fs.createReadStream(tempFilePath);
      fileStream.on('error', () => {});

      let uploadRes: any;
      try {
        uploadRes = await this.storageService.uploadExportFile(
          eventId,
          fileStream,
          filename,
          'text/csv'
        );
      } finally {
        fileStream.destroy();
      }

      const result: IJobResult = {
        importedCount: 0,
        renderedCount: 0,
        exportedCount: idx,
        downloadUrl: uploadRes.signedUrl || uploadRes.publicUrl,
        storagePath: uploadRes.storagePath,
        fileSizeBytes,
        errorLog: [],
      };

      await this.jobRepo.markCompleted(job._id.toString(), result, workerId);
    } finally {
      if (cursor && typeof cursor.close === 'function') {
        try {
          await cursor.close();
        } catch {}
      }
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.warn('[EventExportService] Temp CSV file cleanup note:', cleanupErr);
        }
      }
    }
  }

  /**
   * Bounded-memory XLSX export with validated ceiling.
   * If records exceed MAX_XLSX_EXPORT_ROWS (10,000), fails with clear, user-visible guidance.
   */
  private async exportRosterXlsxBounded(
    event: any,
    job: IEventJobDocument,
    filters: any,
    total: number,
    workerId?: string
  ): Promise<void> {
    if (total > MAX_XLSX_EXPORT_ROWS) {
      throw new ValidationError(
        `ROSTER_XLSX export limit exceeded: ${total} records found. XLSX export format supports up to ${MAX_XLSX_EXPORT_ROWS} records. Please select ROSTER_CSV format for streaming exports of larger rosters.`
      );
    }

    const eventId = event._id.toString();
    const tempFilePath = path.join(os.tmpdir(), `roster-export-${job._id.toString()}-${Date.now()}.xlsx`);
    let cursor: any = null;

    try {
      cursor = this.credentialRepo.findExportCursor(eventId, filters, 50);
      const rows: any[] = [];
      let idx = 0;

      for await (const cred of cursor) {
        idx++;

        if (workerId && idx % 100 === 0) {
          const renewed = await this.jobRepo.renewLease(job._id.toString(), workerId);
          if (!renewed) {
            throw new Error('Worker lease lost or expired during XLSX export');
          }
        }

        rows.push({
          '#': idx,
          'Pass ID': cred.formattedId,
          'Full Name': cred.holder?.name || 'Unassigned',
          'Email Address': cred.holder?.email || '',
          'Phone Number': cred.holder?.phone || '',
          Category: cred.holder?.category || 'PARTICIPANT',
          Organization: cred.holder?.organization || '',
          'Credential Type': cred.credentialType,
          'Usage Policy': cred.usagePolicy,
          Status: cred.status,
          'Check-in Status': (cred.checkInCount || 0) > 0 ? 'CHECKED_IN' : 'PENDING',
          'Check-in Count': cred.checkInCount || 0,
          'First Checked-in At': cred.firstCheckedInAt ? new Date(cred.firstCheckedInAt).toISOString() : '',
          'Last Checked-in At': cred.lastCheckedInAt ? new Date(cred.lastCheckedInAt).toISOString() : '',
          'Verification Token': cred.verificationToken,
          'Issued At': cred.createdAt ? new Date(cred.createdAt).toISOString() : '',
        });

        if (idx % 50 === 0 || idx === total) {
          const percentage = Math.round((idx / total) * 100);
          const updated = await this.jobRepo.updateProgress(
            job._id.toString(),
            {
              total,
              processed: idx,
              succeeded: idx,
              failed: 0,
              percentage,
            },
            undefined,
            workerId
          );
          if (workerId && !updated) {
            throw new Error('Worker ownership lost during XLSX export');
          }
        }
      }

      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendee Roster');

      // Write directly to temporary file on disk rather than holding buffer in Node heap
      xlsx.writeFile(workbook, tempFilePath);

      const fileSizeBytes = fs.existsSync(tempFilePath) ? fs.statSync(tempFilePath).size : 0;
      const sanitizedEventName = (event.name || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const filename = `roster-${sanitizedEventName}-${Date.now()}.xlsx`;

      const fileStream = fs.createReadStream(tempFilePath);
      fileStream.on('error', () => {});

      let uploadRes: any;
      try {
        uploadRes = await this.storageService.uploadExportFile(
          eventId,
          fileStream,
          filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } finally {
        fileStream.destroy();
      }

      const result: IJobResult = {
        importedCount: 0,
        renderedCount: 0,
        exportedCount: rows.length,
        downloadUrl: uploadRes.signedUrl || uploadRes.publicUrl,
        storagePath: uploadRes.storagePath,
        fileSizeBytes,
        errorLog: [],
      };

      await this.jobRepo.markCompleted(job._id.toString(), result, workerId);
    } finally {
      if (cursor && typeof cursor.close === 'function') {
        try {
          await cursor.close();
        } catch {}
      }
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.warn('[EventExportService] Temp XLSX file cleanup note:', cleanupErr);
        }
      }
    }
  }
}

export const eventExportService = new EventExportService();
