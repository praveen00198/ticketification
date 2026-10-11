import archiver from 'archiver';
import * as xlsx from 'xlsx';
import { PassThrough } from 'stream';
import { IEventJobDocument, IJobResult } from '../../../db/mongo/models/event-job.model';
import { mongoEventCredentialRepository, MongoEventCredentialRepository } from '../repositories/mongo-event-credential.repository';
import { mongoEventJobRepository, MongoEventJobRepository } from '../repositories/mongo-event-job.repository';
import { mongoEventRepository, MongoEventRepository } from '../repositories/mongo-event.repository';
import { supabaseStorageService, SupabaseStorageService } from '../../tickets/services/supabase-storage.service';
import { eventCredentialRenderingService, EventCredentialRenderingService } from './event-credential-rendering.service';
import { mongoEventCredentialTemplateRepository } from '../repositories/mongo-event-credential-template.repository';
import { NotFoundError } from '../../../middlewares/error.middleware';

export type ExportFormat = 'ZIP_PASSES' | 'ROSTER_XLSX' | 'ROSTER_CSV';

export class EventExportService {
  constructor(
    private readonly credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private readonly jobRepo: MongoEventJobRepository = mongoEventJobRepository,
    private readonly eventRepo: MongoEventRepository = mongoEventRepository,
    private readonly storageService: SupabaseStorageService = supabaseStorageService,
    private readonly renderService: EventCredentialRenderingService = eventCredentialRenderingService
  ) {}

  /**
   * Orchestrate export processing based on exportFormat.
   */
  async processExportJob(job: IEventJobDocument): Promise<void> {
    const eventId = job.eventId.toString();
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found for export job');
    }

    const exportFormat: ExportFormat = job.payload.exportFormat || 'ZIP_PASSES';
    const filters = job.payload.filters || {};

    if (exportFormat === 'ZIP_PASSES') {
      await this.exportCredentialsZip(event, job, filters);
    } else {
      await this.exportRosterSpreadsheet(event, job, exportFormat, filters);
    }
  }

  /**
   * Stream & bundle all credential PNG passes into a compressed ZIP archive.
   */
  private async exportCredentialsZip(
    event: any,
    job: IEventJobDocument,
    filters: any
  ): Promise<void> {
    const eventId = event._id.toString();
    const credentials = await this.credentialRepo.findAllForExport(eventId, filters);
    const total = credentials.length;

    await this.jobRepo.updateProgress(job._id.toString(), {
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      percentage: 0,
    });

    if (total === 0) {
      await this.jobRepo.markCompleted(job._id.toString(), {
        importedCount: 0,
        renderedCount: 0,
        exportedCount: 0,
        downloadUrl: null,
        storagePath: null,
        fileSizeBytes: 0,
        errorLog: [{ error: 'No credentials found matching export criteria' }],
      });
      return;
    }

    // Default template fallback for unrendered passes
    const defaultTemplate = await mongoEventCredentialTemplateRepository.findDefaultByEventId(eventId);

    // Setup streaming zip archive
    const archive = archiver('zip', { zlib: { level: 6 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];

    passthrough.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);
      archive.on('error', reject);
    });

    archive.pipe(passthrough);

    const result: IJobResult = {
      importedCount: 0,
      renderedCount: 0,
      exportedCount: 0,
      errorLog: [],
    };

    let processedCount = 0;
    let succeededCount = 0;

    for (const cred of credentials) {
      // Check cancellation between items
      const currentJob = await this.jobRepo.findById(job._id.toString());
      if (currentJob?.status === 'CANCELLED') {
        archive.abort();
        return;
      }

      processedCount++;

      try {
        let imageBuffer: Buffer | null = null;

        // Try downloading existing rendered asset
        if (cred.asset?.storagePath) {
          try {
            imageBuffer = await this.storageService.downloadTicketImage(cred.asset.storagePath);
          } catch (downloadErr) {
            imageBuffer = null;
          }
        }

        // If not available, render on the fly if template is available
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

      // Update progress every 10 records or on the last record
      if (processedCount % 10 === 0 || processedCount === total) {
        const percentage = Math.round((processedCount / total) * 100);
        await this.jobRepo.updateProgress(job._id.toString(), {
          total,
          processed: processedCount,
          succeeded: succeededCount,
          failed: result.errorLog.length,
          percentage,
        });
      }
    }

    await archive.finalize();
    const zipBuffer = await archivePromise;

    // Upload finalized ZIP archive to Supabase Storage
    const sanitizedEventName = (event.name || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const zipFilename = `passes-${sanitizedEventName}-${Date.now()}.zip`;

    const uploadRes = await this.storageService.uploadExportFile(
      eventId,
      zipBuffer,
      zipFilename,
      'application/zip'
    );

    result.exportedCount = succeededCount;
    result.downloadUrl = uploadRes.signedUrl || uploadRes.publicUrl;
    result.storagePath = uploadRes.storagePath;
    result.fileSizeBytes = zipBuffer.length;

    await this.jobRepo.markCompleted(job._id.toString(), result);
  }

  /**
   * Export Attendee Roster & Check-in telemetry as XLSX or CSV.
   */
  private async exportRosterSpreadsheet(
    event: any,
    job: IEventJobDocument,
    format: 'ROSTER_XLSX' | 'ROSTER_CSV',
    filters: any
  ): Promise<void> {
    const eventId = event._id.toString();
    const credentials = await this.credentialRepo.findAllForExport(eventId, filters);
    const total = credentials.length;

    await this.jobRepo.updateProgress(job._id.toString(), {
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      percentage: 0,
    });

    const rows = credentials.map((cred, idx) => ({
      '#': idx + 1,
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
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendee Roster');

    const bookType = format === 'ROSTER_CSV' ? 'csv' : 'xlsx';
    const mimeType = format === 'ROSTER_CSV' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = format === 'ROSTER_CSV' ? 'csv' : 'xlsx';

    const fileBuffer = xlsx.write(workbook, { type: 'buffer', bookType });

    const sanitizedEventName = (event.name || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const filename = `roster-${sanitizedEventName}-${Date.now()}.${ext}`;

    const uploadRes = await this.storageService.uploadExportFile(
      eventId,
      fileBuffer,
      filename,
      mimeType
    );

    const result: IJobResult = {
      importedCount: 0,
      renderedCount: 0,
      exportedCount: rows.length,
      downloadUrl: uploadRes.signedUrl || uploadRes.publicUrl,
      storagePath: uploadRes.storagePath,
      fileSizeBytes: fileBuffer.length,
      errorLog: [],
    };

    await this.jobRepo.updateProgress(job._id.toString(), {
      total,
      processed: total,
      succeeded: total,
      failed: 0,
      percentage: 100,
    });

    await this.jobRepo.markCompleted(job._id.toString(), result);
  }
}

export const eventExportService = new EventExportService();
