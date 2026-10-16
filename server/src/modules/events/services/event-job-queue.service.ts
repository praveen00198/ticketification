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
  IJobErrorEntry,
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
  private workerId: string = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private isShuttingDown: boolean = false;
  private activeJobPromise: Promise<void> | null = null;

  constructor(
    private jobRepo: MongoEventJobRepository = mongoEventJobRepository,
    private credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private templateRepo: MongoEventCredentialTemplateRepository = mongoEventCredentialTemplateRepository,
    private renderingService: EventCredentialRenderingService = eventCredentialRenderingService,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  public getWorkerId(): string {
    return this.workerId;
  }

  public setWorkerId(id: string): void {
    this.workerId = id;
  }

  /**
   * Start controlled background polling loop.
   */
  public startWorker(pollIntervalMs: number = 2000): void {
    if (this.pollTimer) return;
    this.isShuttingDown = false;

    const tick = async () => {
      if (this.isShuttingDown || this.isPolling) return;
      this.isPolling = true;

      try {
        const nextJob = await this.jobRepo.claimNextAvailableJob(this.workerId);
        if (nextJob) {
          this.activeJobPromise = this.executeClaimedJob(nextJob);
          await this.activeJobPromise;
          this.activeJobPromise = null;

          // Check immediately for more pending jobs without waiting for next poll tick
          if (!this.isShuttingDown) {
            setImmediate(tick);
            return;
          }
        }
      } catch (err: any) {
        console.error(`[JobQueueWorker] Worker tick error: ${this.sanitizeErrorMessage(err.message)}`);
      } finally {
        this.isPolling = false;
      }
    };

    this.pollTimer = setInterval(tick, pollIntervalMs);
    setImmediate(tick);
  }

  /**
   * Stop background worker and wait for currently active job to finish up to timeoutMs.
   */
  public async stopWorker(timeoutMs: number = 5000): Promise<void> {
    this.isShuttingDown = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.activeJobPromise) {
      await Promise.race([
        this.activeJobPromise,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }
  }

  /**
   * Wake up worker immediately to process new jobs without blocking API callers.
   */
  public wakeWorker(): void {
    if (this.pollTimer && !this.isPolling && !this.isShuttingDown) {
      setImmediate(async () => {
        if (this.isPolling || this.isShuttingDown) return;
        this.isPolling = true;
        try {
          const nextJob = await this.jobRepo.claimNextAvailableJob(this.workerId);
          if (nextJob) {
            this.activeJobPromise = this.executeClaimedJob(nextJob);
            await this.activeJobPromise;
            this.activeJobPromise = null;
          }
        } catch (err: any) {
          console.error(`[JobQueueWorker] Wake tick error: ${this.sanitizeErrorMessage(err.message)}`);
        } finally {
          this.isPolling = false;
        }
      });
    }
  }

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
    if (this.isShuttingDown) {
      throw new ValidationError('Server is shutting down. Cannot accept new jobs.');
    }

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

    this.wakeWorker();
    return job;
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
    if (this.isShuttingDown) {
      throw new ValidationError('Server is shutting down. Cannot accept new jobs.');
    }

    const { actorUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

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

    this.wakeWorker();
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
    if (this.isShuttingDown) {
      throw new ValidationError('Server is shutting down. Cannot accept new jobs.');
    }

    const { actorUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

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

    this.wakeWorker();
    return job;
  }

  /**
   * Direct execution entry point by ID (atomically claims job with this.workerId).
   */
  async executeJob(jobId: string): Promise<void> {
    const claimedJob = await this.jobRepo.claimJob(jobId, this.workerId);
    if (!claimedJob) return;
    await this.executeClaimedJob(claimedJob);
  }

  /**
   * Safe date resolver: uses schedule.startAt or event.date, falls back to Date TBA.
   * Never fabricates 2026-10-10.
   */
  public resolveEventDate(event: any): string {
    if (!event) return 'Date TBA';
    if (event.schedule?.startAt) {
      const d = new Date(event.schedule.startAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString();
      }
    }
    if (event.date && typeof event.date === 'string' && event.date.trim() && event.date !== '2026-10-10') {
      return event.date.trim();
    }
    return 'Date TBA';
  }

  /**
   * Background Execution Engine for a claimed job with atomic ownership and bounded retry backoff.
   */
  private async executeClaimedJob(claimedJob: IEventJobDocument): Promise<void> {
    const jobId = claimedJob._id.toString();

    try {
      if (claimedJob.jobType === 'IMPORT_CREDENTIALS') {
        await this.processImportJob(claimedJob);
      } else if (claimedJob.jobType === 'BULK_RENDER_ASSETS') {
        await this.processBulkRenderJob(claimedJob);
      } else if (claimedJob.jobType === 'EXPORT_CREDENTIALS') {
        await eventExportService.processExportJob(claimedJob, this.workerId);
      }
    } catch (err: any) {
      const sanitized = this.sanitizeErrorMessage(err.message || 'Job processing failed');
      console.error(`[JobQueue] Job ${jobId} failed:`, sanitized);

      const refreshed = await this.jobRepo.findById(jobId);
      const attempts = refreshed?.attempts || claimedJob.attempts || 1;
      const maxAttempts = refreshed?.maxAttempts || claimedJob.maxAttempts || 3;

      if (attempts < maxAttempts) {
        // Exponential backoff: 2s, 4s, 8s... capped at 30s
        const backoffDelay = Math.min(30000, 1000 * Math.pow(2, attempts));
        await this.jobRepo.releaseJobForRetry(jobId, sanitized, backoffDelay, this.workerId);
      } else {
        await this.jobRepo.markFailed(jobId, sanitized, refreshed?.result || claimedJob.result, this.workerId);
      }
    }
  }

  /**
   * Process Attendee Import Job in bounded batches.
   * Fully idempotent across retries by persisting sequence range and reusing it.
   */
  private async processImportJob(job: IEventJobDocument): Promise<void> {
    const eventId = job.eventId.toString();
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event not found for job');

    const records: MappedAttendeeRecord[] = job.payload?.records || [];
    const total = records.length;
    const terminology = event.credentialTerminology || 'Pass';
    const cleanPrefix = this.derivePrefix(terminology);

    // Persist allocated sequence range and allocation metadata before processing chunks so retries reuse the identical block
    let startingSequence: number;
    let endSequence: number;
    if (job.payload?.startingSequence) {
      startingSequence = job.payload.startingSequence;
      endSequence = job.payload.endSequence || (startingSequence + total - 1);
    } else {
      startingSequence = await this.credentialRepo.allocateSequenceBlock(eventId, total);
      endSequence = startingSequence + total - 1;
      job.payload = {
        ...(job.payload || {}),
        startingSequence,
        endSequence,
        allocatedCount: total,
        allocatedAt: new Date(),
      };
      await this.jobRepo.updatePayload(job._id.toString(), job.payload);
    }

    // Deduplicate error log entries across retries and repeated progress updates
    const errorLogMap = new Map<string, IJobErrorEntry>();
    if (job.result?.errorLog && Array.isArray(job.result.errorLog)) {
      for (const entry of job.result.errorLog) {
        const key = `${entry.row ?? ''}:${entry.identifier ?? ''}:${entry.error}`;
        errorLogMap.set(key, entry);
      }
    }

    // Deduplicate records in source file (e.g. duplicate email, phone, or attendee identity)
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const seenIdentities = new Set<string>();
    const duplicateRowIndices = new Set<number>();

    for (let idx = 0; idx < records.length; idx++) {
      const rec = records[idx];
      const rowNum = rec.rowNumber ?? (idx + 1);
      const normEmail = rec.email ? rec.email.trim().toLowerCase() : null;
      const normPhone = rec.phone ? rec.phone.trim() : null;
      const normName = rec.name ? rec.name.trim().toLowerCase() : '';

      let isDuplicate = false;
      let duplicateReason = '';

      if (normEmail) {
        if (seenEmails.has(normEmail)) {
          isDuplicate = true;
          duplicateReason = `Duplicate email "${rec.email}" in source file`;
        } else {
          seenEmails.add(normEmail);
        }
      }

      if (!isDuplicate && normPhone) {
        if (seenPhones.has(normPhone)) {
          isDuplicate = true;
          duplicateReason = `Duplicate phone "${rec.phone}" in source file`;
        } else {
          seenPhones.add(normPhone);
        }
      }

      if (!isDuplicate && normName && !normEmail && !normPhone) {
        const identityKey = `${normName}|${rec.organization?.trim().toLowerCase() || ''}`;
        if (seenIdentities.has(identityKey)) {
          isDuplicate = true;
          duplicateReason = `Duplicate attendee "${rec.name}" in source file`;
        } else {
          seenIdentities.add(identityKey);
        }
      }

      if (isDuplicate) {
        duplicateRowIndices.add(idx);
        const errorEntry: IJobErrorEntry = {
          row: rowNum,
          identifier: rec.email || rec.phone || rec.name,
          error: `${duplicateReason} (skipped)`,
        };
        const errorKey = `${errorEntry.row ?? ''}:${errorEntry.identifier ?? ''}:${errorEntry.error}`;
        errorLogMap.set(errorKey, errorEntry);
      }
    }

    const result: IJobResult = {
      importedCount: job.result?.importedCount || 0,
      renderedCount: job.result?.renderedCount || 0,
      skippedCount: duplicateRowIndices.size,
      failedCount: Array.from(errorLogMap.values()).filter((e) => !e.error.includes('(skipped)')).length,
      errorLog: Array.from(errorLogMap.values()),
    };

    const insertedCredentials: IEventCredentialDocument[] = [];
    const CHUNK_SIZE = 50;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      // Cancellation check
      const currentStatus = await this.jobRepo.findById(job._id.toString());
      if (currentStatus?.status === 'CANCELLED') return;

      // Heartbeat lease renewal
      const renewed = await this.jobRepo.renewLease(job._id.toString(), this.workerId);
      if (!renewed) {
        throw new Error('Worker lease lost or expired during import chunk processing');
      }

      const chunk = records.slice(i, i + CHUNK_SIZE);
      const startSeq = startingSequence + i;
      const endSeq = startingSequence + i + chunk.length - 1;

      // Idempotency check: load credentials already created in prior partial run of this chunk
      const existingInChunk = await this.credentialRepo.findBySequenceRange(eventId, startSeq, endSeq);
      const existingSeqMap = new Map<number, IEventCredentialDocument>();
      for (const existingDoc of existingInChunk) {
        existingSeqMap.set(existingDoc.sequenceNumber, existingDoc);
      }

      const batchDocs: Partial<IEventCredentialDocument>[] = [];

      for (let j = 0; j < chunk.length; j++) {
        const globalIndex = i + j;
        const record = chunk[j];
        const seqNum = startSeq + j;
        const rowNum = record.rowNumber ?? (globalIndex + 1);

        // Skip rows detected as duplicate in source file
        if (duplicateRowIndices.has(globalIndex)) {
          continue;
        }

        if (existingSeqMap.has(seqNum)) {
          const existingDoc = existingSeqMap.get(seqNum)!;
          if (!insertedCredentials.some((c) => c._id.toString() === existingDoc._id.toString())) {
            insertedCredentials.push(existingDoc);
          }
          continue;
        }

        const formattedId = `${cleanPrefix}-${String(seqNum).padStart(5, '0')}`;
        const verificationToken = crypto.randomBytes(32).toString('hex');

        batchDocs.push({
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: seqNum,
          formattedId,
          verificationToken,
          credentialType: job.payload?.credentialType || 'ATTENDEE_PASS',
          terminology,
          usagePolicy: 'SINGLE_USE',
          status: 'ACTIVE',
          holder: {
            name: record.name,
            email: record.email ? record.email.trim().toLowerCase() : null,
            phone: record.phone ? record.phone.trim() : null,
            organization: record.organization ? record.organization.trim() : null,
            category: record.category || 'PARTICIPANT',
            isAssigned: true,
          },
          asset: {
            mimeType: 'image/png',
          },
          metadata: {
            ...(record.customFields || {}),
            importJobId: job._id.toString(),
            importRow: rowNum,
            importKey: `${job._id.toString()}:${rowNum}`,
          },
          checkInCount: 0,
          createdBy: job.createdBy,
        });
      }

      if (batchDocs.length > 0) {
        try {
          const created = await this.credentialRepo.createMany(batchDocs);
          insertedCredentials.push(...created);
        } catch (err: any) {
          if (err.code === 11000 || err.message?.includes('duplicate key') || err.message?.includes('E11000')) {
            // Safe recovery from duplicate-key race: reload existing records
            const reFetched = await this.credentialRepo.findBySequenceRange(eventId, startSeq, endSeq);
            for (const doc of reFetched) {
              if (!insertedCredentials.some((c) => c._id.toString() === doc._id.toString())) {
                insertedCredentials.push(doc);
              }
            }
          } else {
            const sanitized = this.sanitizeErrorMessage(err.message || 'Batch insertion failed');
            const errorEntry: IJobErrorEntry = {
              row: chunk[0]?.rowNumber,
              identifier: `CHUNK-${Math.floor(i / CHUNK_SIZE) + 1}`,
              error: sanitized,
            };
            const errorKey = `${errorEntry.row ?? ''}:${errorEntry.identifier ?? ''}:${errorEntry.error}`;
            errorLogMap.set(errorKey, errorEntry);
            throw err;
          }
        }
      }

      // Read true persisted credentials from database for accurate cross-attempt counts
      const blockCredentials = await this.credentialRepo.findBySequenceRange(
        eventId,
        startingSequence,
        endSeq
      );
      const currentImported = blockCredentials.length > 0 ? blockCredentials.length : insertedCredentials.length;
      const currentErrors = Array.from(errorLogMap.values());
      const currentFailed = currentErrors.filter((e) => !e.error.includes('(skipped)')).length;
      const currentSkipped = duplicateRowIndices.size;

      result.importedCount = currentImported;
      result.skippedCount = currentSkipped;
      result.failedCount = currentFailed;
      result.errorLog = currentErrors;

      const processed = Math.min(i + CHUNK_SIZE, total);
      const percentage = Math.round((processed / total) * 100);

      const progressUpdated = await this.jobRepo.updateProgress(
        job._id.toString(),
        {
          total,
          processed,
          succeeded: currentImported,
          failed: currentFailed,
          skipped: currentSkipped,
          percentage,
        },
        result,
        this.workerId
      );

      if (!progressUpdated) {
        throw new Error('Worker lease lost during progress update');
      }
    }

    // Load all credentials across the allocated block for rendering and final count verification
    const finalCredentials = await this.credentialRepo.findBySequenceRange(
      eventId,
      startingSequence,
      endSequence
    );
    const credentialsToRender = finalCredentials.length > 0 ? finalCredentials : insertedCredentials;

    // Optional background Sharp rendering if requested
    if (job.payload?.renderAfterImport && credentialsToRender.length > 0) {
      await this.renderCredentialsSequentially(
        eventId,
        event,
        credentialsToRender,
        job,
        result
      );
      if (result.renderedCount === 0 && credentialsToRender.length > 0 && result.errorLog.length > 0) {
        await this.jobRepo.markFailed(
          job._id.toString(),
          'Rendering credentials after import failed completely',
          result,
          this.workerId
        );
        return;
      }
    }

    const finalErrors = Array.from(errorLogMap.values());
    result.importedCount = credentialsToRender.length;
    result.skippedCount = duplicateRowIndices.size;
    result.failedCount = finalErrors.filter((e) => !e.error.includes('(skipped)')).length;
    result.errorLog = finalErrors;

    await this.jobRepo.markCompleted(job._id.toString(), result, this.workerId);
  }

  /**
   * Process Bulk Render Job using cursor-based batch pagination.
   * Completely eliminates 500-record query cap and bounds memory to O(1).
   */
  private async processBulkRenderJob(job: IEventJobDocument): Promise<void> {
    const eventId = job.eventId.toString();
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event not found for job');

    const initialUnrendered = await this.credentialRepo.countUnrenderedByEvent(eventId);
    const totalTarget = (job.progress?.total && job.progress.total > 0)
      ? job.progress.total
      : initialUnrendered;

    // Baseline count of credentials already rendered before this run
    const succeededBaseline = Math.max(0, totalTarget - initialUnrendered);

    if (initialUnrendered === 0) {
      await this.jobRepo.markCompleted(
        job._id.toString(),
        {
          importedCount: 0,
          renderedCount: totalTarget,
          errorLog: job.result?.errorLog || [],
        },
        this.workerId
      );
      return;
    }

    await eventStorageGovernanceService.assertStorageAllowance(
      eventId,
      initialUnrendered * 400 * 1024
    );

    let template = job.payload?.templateId
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
      renderedCount: succeededBaseline,
      errorLog: [],
    };

    let processedCount = succeededBaseline;
    let newlyRendered = 0;
    const BATCH_SIZE = 50;
    let lastId: any = null;

    while (true) {
      const current = await this.jobRepo.findById(job._id.toString());
      if (current?.status === 'CANCELLED') return;

      // Heartbeat lease renewal before each batch
      const renewed = await this.jobRepo.renewLease(job._id.toString(), this.workerId);
      if (!renewed) {
        throw new Error('Worker lease lost or expired during bulk rendering');
      }

      const batch = await this.credentialRepo.findUnrenderedBatch(eventId, lastId, BATCH_SIZE);
      if (!batch || batch.length === 0) break;

      for (const cred of batch) {
        const checkJob = await this.jobRepo.findById(job._id.toString());
        if (checkJob?.status === 'CANCELLED') return;

        // Skip if already rendered (e.g. from prior partial attempt)
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
            eventName: event.name || 'Event',
            date: this.resolveEventDate(event),
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
          newlyRendered += 1;
          result.renderedCount = succeededBaseline + newlyRendered;
        } catch (err: any) {
          result.errorLog.push({
            identifier: cred.formattedId,
            error: this.sanitizeErrorMessage(`Rendering failed: ${err.message}`),
          });
        }

        processedCount++;

        if (processedCount % 5 === 0 || processedCount >= totalTarget) {
          const percentage = totalTarget > 0
            ? Math.min(100, Math.round((processedCount / totalTarget) * 100))
            : 100;
          const updated = await this.jobRepo.updateProgress(
            job._id.toString(),
            {
              total: totalTarget,
              processed: processedCount,
              succeeded: succeededBaseline + newlyRendered,
              failed: result.errorLog.length,
              percentage,
            },
            result,
            this.workerId
          );
          if (!updated) {
            throw new Error('Worker ownership lost during bulk render progress update');
          }
        }
      }

      if (processedCount >= totalTarget || batch.length < BATCH_SIZE) {
        break;
      }
      lastId = batch[batch.length - 1]._id;
    }

    const finalRemaining = await this.credentialRepo.countUnrenderedByEvent(eventId);
    const hasFailures = result.errorLog.length > 0 || finalRemaining > 0;

    await this.jobRepo.updateProgress(
      job._id.toString(),
      {
        total: totalTarget,
        processed: totalTarget - finalRemaining,
        succeeded: succeededBaseline + newlyRendered,
        failed: result.errorLog.length,
        percentage: 100,
      },
      result,
      this.workerId
    );

    if (hasFailures) {
      const detailedError = result.errorLog[0]?.error ? `: ${result.errorLog[0].error}` : '';
      const errorMsg = (succeededBaseline + newlyRendered === 0)
        ? `All credentials failed to render${detailedError}`
        : `Bulk rendering incomplete: ${result.errorLog.length} failed, ${finalRemaining} remaining unrendered, ${succeededBaseline + newlyRendered} succeeded${detailedError}`;

      const refreshed = await this.jobRepo.findById(job._id.toString());
      const attempts = refreshed?.attempts || job.attempts || 1;
      const maxAttempts = refreshed?.maxAttempts || job.maxAttempts || 3;

      if (attempts >= maxAttempts) {
        await this.jobRepo.markFailed(
          job._id.toString(),
          errorMsg,
          result,
          this.workerId
        );
      } else {
        throw new Error(errorMsg);
      }
      return;
    }

    const completed = await this.jobRepo.markCompleted(job._id.toString(), result, this.workerId);
    if (!completed) {
      throw new Error('Worker ownership lost during bulk render completion');
    }
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
    let template = job.payload?.templateId
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
          eventName: event.name || 'Event',
          date: this.resolveEventDate(event),
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
          result,
          this.workerId
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
