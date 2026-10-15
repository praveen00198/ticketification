import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  MongoEventJobRepository,
  mongoEventJobRepository,
} from '../repositories/mongo-event-job.repository';
import {
  MongoEventCredentialRepository,
  mongoEventCredentialRepository,
} from '../repositories/mongo-event-credential.repository';
import {
  MongoEventCredentialTemplateRepository,
  mongoEventCredentialTemplateRepository,
} from '../repositories/mongo-event-credential-template.repository';
import {
  EventCredentialRenderingService,
  eventCredentialRenderingService,
} from './event-credential-rendering.service';
import {
  MongoEventRepository,
  mongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  MongoEventMemberRepository,
  mongoEventMemberRepository,
} from '../repositories/mongo-event-member.repository';
import {
  MongoUserRepository,
  mongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  IEventJobDocument,
  IJobResult,
} from '../../../db/mongo/models/event-job.model';
import { eventStorageGovernanceService } from './event-storage-governance.service';
import {
  IEventCredentialDocument,
} from '../../../db/mongo/models/event-credential.model';
import {
  MappedAttendeeRecord,
} from './event-import-parser.service';
import { eventExportService } from './event-export.service';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../../middlewares/error.middleware';

export class EventJobQueueService {
  constructor(
    private jobRepo: MongoEventJobRepository = mongoEventJobRepository,
    private credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private templateRepo: MongoEventCredentialTemplateRepository = mongoEventCredentialTemplateRepository,
    private renderingService: EventCredentialRenderingService = eventCredentialRenderingService,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Verify Host or Coordinator authority via event_members.
   */
  async authorizeHostOrCoordinator(
    eventId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<{ event: any; actorUser: any }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event not found');

    let actorUser = await this.userRepo.findBySupabaseId(callerUserId);
    if (!actorUser && mongoose.Types.ObjectId.isValid(callerUserId)) {
      actorUser = await this.userRepo.findById(callerUserId);
    }
    if (!actorUser) throw new AuthorizationError('User profile not found');

    if (callerPlatformRole === 'SUPER_ADMIN' || callerPlatformRole === 'ADMIN') {
      return { event, actorUser };
    }

    if (
      event.ownerId &&
      (event.ownerId.toString() === actorUser._id.toString() ||
        event.ownerSupabaseId === callerUserId)
    ) {
      return { event, actorUser };
    }

    const member = await this.memberRepo.findByEventAndUser(
      eventId,
      actorUser._id.toString()
    );

    if (!member || member.status !== 'ACTIVE') {
      throw new AuthorizationError('You are not an active member of this event');
    }

    if (member.role !== 'HOST' && member.role !== 'COORDINATOR') {
      throw new AuthorizationError('Only Host or Coordinator can initiate background jobs');
    }

    return { event, actorUser };
  }

  /**
   * Enqueue an attendee spreadsheet import job (HTTP 202 Accepted).
   */
  async enqueueImportJob(
    eventId: string,
    records: MappedAttendeeRecord[],
    callerUserId: string,
    callerPlatformRole?: string,
    options: {
      renderAfterImport?: boolean;
      templateId?: string;
      credentialType?: string;
    } = {}
  ): Promise<IEventJobDocument> {
    const { actorUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    if (!records || records.length === 0) {
      throw new ValidationError('Cannot enqueue import job with 0 records');
    }

    const job = await this.jobRepo.createJob({
      eventId: new mongoose.Types.ObjectId(eventId),
      jobType: 'IMPORT_CREDENTIALS',
      status: 'QUEUED',
      progress: {
        total: records.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      },
      payload: {
        records,
        renderAfterImport: !!options.renderAfterImport,
        templateId: options.templateId,
        credentialType: options.credentialType || 'ATTENDEE_PASS',
      },
      createdBy: actorUser._id,
    });

    // Execute asynchronously on event loop
    setImmediate(() => {
      this.executeJob(job._id.toString()).catch((err) => {
        console.error(`[JobQueue] Unhandled job error for ${job._id}:`, err);
      });
    });

    return job;
  }

  private workerId: string = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

  public getWorkerId(): string {
    return this.workerId;
  }

  public setWorkerId(id: string): void {
    this.workerId = id;
  }

  /**
   * Scan and recover any abandoned jobs left in PROCESSING state across instances.
   */
  async recoverAbandonedJobs(leaseGraceMs: number = 0): Promise<{ recovered: number; failed: number }> {
    return this.jobRepo.recoverAbandonedJobs(leaseGraceMs);
  }

  /**
   * Redact secrets, tokens, credentials, connection strings, emails, and phone numbers.
   */
  public sanitizeErrorMessage(error: any): string {
    if (!error) return 'Unknown error';
    let message = typeof error === 'string' ? error : (error.message || String(error));
    message = message.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
    message = message.replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[REDACTED_JWT]');
    message = message.replace(/(mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^\s]+/gi, '$1://[REDACTED_URI]');
    message = message.replace(/(key|token|secret|password|apikey|authorization)=([^&\s]+)/gi, '$1=[REDACTED]');
    message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
    message = message.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]');
    return message;
  }

  /**
   * Enqueue a bulk Sharp credential rasterization job (HTTP 202 Accepted).
   */
  async enqueueBulkRenderJob(
    eventId: string,
    callerUserId: string,
    callerPlatformRole?: string,
    options: { templateId?: string } = {}
  ): Promise<IEventJobDocument> {
    const { actorUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    // Count unrendered credentials without query cap
    const unrenderedCount = await this.credentialRepo.countUnrenderedByEvent(eventId);

    const job = await this.jobRepo.createJob({
      eventId: new mongoose.Types.ObjectId(eventId),
      jobType: 'BULK_RENDER_ASSETS',
      status: 'QUEUED',
      progress: {
        total: unrenderedCount,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      },
      payload: {
        templateId: options.templateId,
      },
      createdBy: actorUser._id,
    });

    setImmediate(() => {
      this.executeJob(job._id.toString()).catch((err) => {
        console.error(`[JobQueue] Unhandled job error for ${job._id}:`, err);
      });
    });

    return job;
  }

  /**
   * Enqueue an asynchronous bulk export job (HTTP 202 Accepted).
   */
  async enqueueExportJob(
    eventId: string,
    payload: { exportFormat: 'ZIP_PASSES' | 'ROSTER_XLSX' | 'ROSTER_CSV'; filters?: any },
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<IEventJobDocument> {
    const { actorUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    // Verify storage quota allowance before enqueuing multi-megabyte export jobs
    await eventStorageGovernanceService.assertStorageAllowance(eventId, 10 * 1024 * 1024);

    const job = await this.jobRepo.createJob({
      eventId: new mongoose.Types.ObjectId(eventId),
      jobType: 'EXPORT_CREDENTIALS',
      status: 'QUEUED',
      progress: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0,
      },
      payload: {
        exportFormat: payload.exportFormat || 'ZIP_PASSES',
        filters: payload.filters || {},
      },
      createdBy: actorUser._id,
    });

    setImmediate(() => {
      this.executeJob(job._id.toString()).catch((err) => {
        console.error(`[JobQueue] Unhandled export job error for ${job._id}:`, err);
      });
    });

    return job;
  }

  /**
   * Background Execution Engine with atomic claiming, lease management, and bounded retries.
   */
  async executeJob(jobId: string): Promise<void> {
    // Atomically claim job to ensure no two workers process simultaneously
    const claimedJob = await this.jobRepo.claimJob(jobId, this.workerId);
    if (!claimedJob) return;

    try {
      if (claimedJob.jobType === 'IMPORT_CREDENTIALS') {
        await this.processImportJob(claimedJob);
      } else if (claimedJob.jobType === 'BULK_RENDER_ASSETS') {
        await this.processBulkRenderJob(claimedJob);
      } else if (claimedJob.jobType === 'EXPORT_CREDENTIALS') {
        await eventExportService.processExportJob(claimedJob);
      }
    } catch (err: any) {
      const sanitized = this.sanitizeErrorMessage(err.message || 'Job processing failed');
      console.error(`[JobQueue] Job ${jobId} failed:`, sanitized);

      const refreshed = await this.jobRepo.findById(jobId);
      const attempts = refreshed?.attempts || claimedJob.attempts || 1;
      const maxAttempts = refreshed?.maxAttempts || claimedJob.maxAttempts || 3;

      if (attempts < maxAttempts) {
        // Bounded retry with backoff delay
        await this.jobRepo.releaseJobForRetry(jobId, sanitized, 3000 * attempts);
      } else {
        await this.jobRepo.markFailed(jobId, sanitized);
      }
    }
  }

  /**
   * Process Attendee Import Job in bounded batches.
   * Fully idempotent across retries by reusing startingSequence and resuming.
   */
  private async processImportJob(job: IEventJobDocument): Promise<void> {
    const eventId = job.eventId.toString();
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event not found for job');

    const records: MappedAttendeeRecord[] = job.payload.records || [];
    const total = records.length;
    const terminology = event.credentialTerminology || 'Pass';
    const cleanPrefix = this.derivePrefix(terminology);

    // Atomically reserve or reuse contiguous sequence numbers for the entire roster
    let startingSequence: number;
    if (job.payload.startingSequence) {
      startingSequence = job.payload.startingSequence;
    } else {
      startingSequence = await this.credentialRepo.allocateSequenceBlock(eventId, total);
      job.payload.startingSequence = startingSequence;
    }

    const result: IJobResult = {
      importedCount: job.result?.importedCount || 0,
      renderedCount: job.result?.renderedCount || 0,
      errorLog: job.result?.errorLog ? [...job.result.errorLog] : [],
    };

    const insertedCredentials: IEventCredentialDocument[] = [];
    const CHUNK_SIZE = 50;
    const resumeIndex = job.progress?.processed || 0;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      // Check cancellation
      const currentStatus = await this.jobRepo.findById(job._id.toString());
      if (currentStatus?.status === 'CANCELLED') return;

      // Skip already processed chunks if retried
      if (i + CHUNK_SIZE <= resumeIndex && resumeIndex > 0) {
        continue;
      }

      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batchDocs: Partial<IEventCredentialDocument>[] = [];

      for (let j = 0; j < chunk.length; j++) {
        const record = chunk[j];
        const seqNum = startingSequence + i + j;
        const formattedId = `${cleanPrefix}-${String(seqNum).padStart(5, '0')}`;
        const verificationToken = crypto.randomBytes(32).toString('hex');

        batchDocs.push({
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: seqNum,
          formattedId,
          verificationToken,
          credentialType: job.payload.credentialType || 'ATTENDEE_PASS',
          terminology,
          usagePolicy: 'SINGLE_USE',
          status: 'ACTIVE',
          holder: {
            name: record.name,
            email: record.email || null,
            phone: record.phone || null,
            organization: record.organization || null,
            category: record.category || 'PARTICIPANT',
            isAssigned: true,
          },
          asset: {
            mimeType: 'image/png',
          },
          checkInCount: 0,
          createdBy: job.createdBy,
        });
      }

      const created = await this.credentialRepo.createMany(batchDocs);
      insertedCredentials.push(...created);
      result.importedCount += created.length;

      const processed = Math.min(i + CHUNK_SIZE, total);
      const percentage = Math.round((processed / total) * 100);

      await this.jobRepo.updateProgress(
        job._id.toString(),
        {
          total,
          processed,
          succeeded: result.importedCount,
          failed: result.errorLog.length,
          percentage,
        },
        result
      );
    }

    // Optional background Sharp rendering if requested
    if (job.payload.renderAfterImport && insertedCredentials.length > 0) {
      await this.renderCredentialsSequentially(
        eventId,
        event,
        insertedCredentials,
        job,
        result
      );
    }

    await this.jobRepo.markCompleted(job._id.toString(), result);
  }

  /**
   * Process Bulk Render Job using cursor-based batch pagination.
   * Completely eliminates the 500-record query cap and bounds memory to O(1).
   */
  private async processBulkRenderJob(job: IEventJobDocument): Promise<void> {
    const eventId = job.eventId.toString();
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event not found for job');

    const totalUnrendered = await this.credentialRepo.countUnrenderedByEvent(eventId);
    if (totalUnrendered === 0) {
      await this.jobRepo.markCompleted(job._id.toString(), {
        importedCount: 0,
        renderedCount: 0,
        errorLog: [],
      });
      return;
    }

    await eventStorageGovernanceService.assertStorageAllowance(
      eventId,
      totalUnrendered * 400 * 1024
    );

    let template = job.payload.templateId
      ? await this.templateRepo.findById(job.payload.templateId)
      : await this.templateRepo.findDefaultByEventId(eventId);

    if (!template) {
      await this.templateRepo.seedGlobalPresetsIfEmpty();
      template = await this.templateRepo.findDefaultByEventId(eventId);
    }

    if (!template) {
      throw new NotFoundError('No credential template available for rendering');
    }

    const result: IJobResult = {
      importedCount: 0,
      renderedCount: job.result?.renderedCount || 0,
      errorLog: job.result?.errorLog ? [...job.result.errorLog] : [],
    };

    let processedCount = job.progress?.processed || 0;
    const BATCH_SIZE = 50;
    let lastId: any = null;

    while (true) {
      // Check cancellation between batches
      const current = await this.jobRepo.findById(job._id.toString());
      if (current?.status === 'CANCELLED') return;

      const batch = await this.credentialRepo.findUnrenderedBatch(eventId, lastId, BATCH_SIZE);
      if (!batch || batch.length === 0) break;

      for (const cred of batch) {
        // Double check cancellation per credential
        const checkJob = await this.jobRepo.findById(job._id.toString());
        if (checkJob?.status === 'CANCELLED') return;

        // Skip if already rendered in prior attempt
        if (cred.asset?.storagePath) {
          processedCount++;
          continue;
        }

        try {
          const renderData = {
            name: cred.holder?.name || 'Attendee',
            sequence: cred.formattedId,
            verificationToken: cred.verificationToken,
            qrPayload: `https://ticketification.app/verify/${cred.verificationToken}`,
            role: cred.holder?.category || 'PARTICIPANT',
            eventName: event.name,
            date: event.schedule?.startAt
              ? new Date(event.schedule.startAt).toLocaleDateString()
              : '2026-10-10',
            venue: event.venue?.name || 'Main Venue',
          };

          const { storagePath, publicUrl } = await this.renderingService.renderAndUploadAsset(
            eventId,
            cred._id.toString(),
            template,
            renderData
          );

          cred.asset = {
            storagePath,
            publicUrl,
            renderedAt: new Date(),
            mimeType: 'image/png',
          };
          await cred.save();
          result.renderedCount += 1;
        } catch (err: any) {
          result.errorLog.push({
            identifier: cred.formattedId,
            error: this.sanitizeErrorMessage(`Rendering failed: ${err.message}`),
          });
        }

        processedCount++;

        if (processedCount % 5 === 0 || processedCount >= totalUnrendered) {
          const percentage = totalUnrendered > 0 ? Math.min(100, Math.round((processedCount / totalUnrendered) * 100)) : 100;
          await this.jobRepo.updateProgress(
            job._id.toString(),
            {
              total: totalUnrendered,
              processed: processedCount,
              succeeded: result.renderedCount,
              failed: result.errorLog.length,
              percentage,
            },
            result
          );
        }
      }

      lastId = batch[batch.length - 1]._id;
    }

    // Ensure final 100% progress recorded
    await this.jobRepo.updateProgress(
      job._id.toString(),
      {
        total: totalUnrendered,
        processed: processedCount,
        succeeded: result.renderedCount,
        failed: result.errorLog.length,
        percentage: 100,
      },
      result
    );

    await this.jobRepo.markCompleted(job._id.toString(), result);
  }

  /**
   * Sequentially render visual passes in chunks of 2 to honor Render 512MB RAM limits.
   */
  private async renderCredentialsSequentially(
    eventId: string,
    event: any,
    credentials: IEventCredentialDocument[],
    job: IEventJobDocument,
    result: IJobResult
  ): Promise<void> {
    let template = job.payload.templateId
      ? await this.templateRepo.findById(job.payload.templateId)
      : await this.templateRepo.findDefaultByEventId(eventId);

    if (!template) {
      await this.templateRepo.seedGlobalPresetsIfEmpty();
      template = await this.templateRepo.findDefaultByEventId(eventId);
    }

    if (!template) {
      throw new NotFoundError('No credential template available for rendering');
    }

    const total = credentials.length;

    for (let i = 0; i < total; i++) {
      // Check cancellation every pass
      const current = await this.jobRepo.findById(job._id.toString());
      if (current?.status === 'CANCELLED') return;

      const cred = credentials[i];
      try {
        const renderData = {
          name: cred.holder?.name || 'Attendee',
          sequence: cred.formattedId,
          verificationToken: cred.verificationToken,
          qrPayload: `https://ticketification.app/verify/${cred.verificationToken}`,
          role: cred.holder?.category || 'PARTICIPANT',
          eventName: event.name,
          date: event.schedule?.startAt
            ? new Date(event.schedule.startAt).toLocaleDateString()
            : '2026-10-10',
          venue: event.venue?.name || 'Main Venue',
        };

        const { storagePath, publicUrl } = await this.renderingService.renderAndUploadAsset(
          eventId,
          cred._id.toString(),
          template,
          renderData
        );

        cred.asset = {
          storagePath,
          publicUrl,
          renderedAt: new Date(),
          mimeType: 'image/png',
        };
        await cred.save();
        result.renderedCount += 1;
      } catch (err: any) {
        result.errorLog.push({
          identifier: cred.formattedId,
          error: this.sanitizeErrorMessage(`Rendering failed: ${err.message}`),
        });
      }

      if ((i + 1) % 5 === 0 || i === total - 1) {
        const processed = i + 1;
        const percentage = Math.round((processed / total) * 100);
        await this.jobRepo.updateProgress(
          job._id.toString(),
          {
            total,
            processed,
            succeeded: result.renderedCount,
            failed: result.errorLog.length,
            percentage,
          },
          result
        );
      }
    }
  }

  private derivePrefix(terminology: string): string {
    const clean = (terminology || '').toUpperCase().trim();
    if (clean.includes('HACK')) return 'HCK';
    if (clean.includes('BADG')) return 'BDG';
    if (clean.includes('WRIST')) return 'WRS';
    if (clean.includes('INVIT')) return 'INV';
    if (clean.includes('TICK')) return 'TIC';
    if (clean.includes('PASS')) return 'PASS';
    return clean.slice(0, 4) || 'TKT';
  }
}

export const eventJobQueueService = new EventJobQueueService();

