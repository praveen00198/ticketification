import mongoose from 'mongoose';
import {
  EventJobModel,
  IEventJobDocument,
  IJobProgress,
  IJobResult,
  JobStatus,
  JobType,
} from '../../../db/mongo/models/event-job.model';

export class MongoEventJobRepository {
  /**
   * Create and persist a new background job.
   */
  async createJob(data: Partial<IEventJobDocument>): Promise<IEventJobDocument> {
    return EventJobModel.create(data);
  }

  /**
   * Find job by ID.
   */
  async findById(jobId: string): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;
    return EventJobModel.findById(jobId).exec();
  }

  /**
   * Find jobs for a specific event with optional filtering.
   */
  async findByEventId(
    eventId: string,
    options: { jobType?: JobType; status?: JobStatus; limit?: number } = {}
  ): Promise<IEventJobDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };
    if (options.jobType) query.jobType = options.jobType;
    if (options.status) query.status = options.status;

    const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 100);

    return EventJobModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Mark job as PROCESSING and record startedAt.
   */
  async markStarted(jobId: string): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;
    return EventJobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Atomically update progress metrics and partial results.
   * If workerId is provided, validates active lease ownership before writing.
   */
  async updateProgress(
    jobId: string,
    progress: Partial<IJobProgress>,
    partialResult?: Partial<IJobResult>,
    workerId?: string
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (!job) return null;
      if (job.status !== 'PROCESSING') return null;
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) {
        return null;
      }
      if (progress.total !== undefined) job.progress.total = progress.total;
      if (progress.processed !== undefined) job.progress.processed = progress.processed;
      if (progress.succeeded !== undefined) job.progress.succeeded = progress.succeeded;
      if (progress.failed !== undefined) job.progress.failed = progress.failed;
      if (progress.skipped !== undefined) job.progress.skipped = progress.skipped;
      if (progress.percentage !== undefined) job.progress.percentage = progress.percentage;
      if (partialResult) {
        if (partialResult.importedCount !== undefined) job.result.importedCount = partialResult.importedCount;
        if (partialResult.renderedCount !== undefined) job.result.renderedCount = partialResult.renderedCount;
        if (partialResult.exportedCount !== undefined) job.result.exportedCount = partialResult.exportedCount;
        if (partialResult.skippedCount !== undefined) job.result.skippedCount = partialResult.skippedCount;
        if (partialResult.failedCount !== undefined) job.result.failedCount = partialResult.failedCount;
        if (partialResult.errorLog) job.result.errorLog = partialResult.errorLog;
      }
      return job;
    }

    const now = new Date();
    const query: any = {
      _id: new mongoose.Types.ObjectId(jobId),
      status: 'PROCESSING',
    };
    if (workerId) {
      query.lockedBy = workerId;
      query.lockExpiresAt = { $gte: now };
    }

    const update: any = { $set: {} };

    if (progress.total !== undefined) update.$set['progress.total'] = progress.total;
    if (progress.processed !== undefined) update.$set['progress.processed'] = progress.processed;
    if (progress.succeeded !== undefined) update.$set['progress.succeeded'] = progress.succeeded;
    if (progress.failed !== undefined) update.$set['progress.failed'] = progress.failed;
    if (progress.skipped !== undefined) update.$set['progress.skipped'] = progress.skipped;
    if (progress.percentage !== undefined) update.$set['progress.percentage'] = progress.percentage;

    if (partialResult) {
      if (partialResult.importedCount !== undefined) {
        update.$set['result.importedCount'] = partialResult.importedCount;
      }
      if (partialResult.renderedCount !== undefined) {
        update.$set['result.renderedCount'] = partialResult.renderedCount;
      }
      if (partialResult.exportedCount !== undefined) {
        update.$set['result.exportedCount'] = partialResult.exportedCount;
      }
      if (partialResult.skippedCount !== undefined) {
        update.$set['result.skippedCount'] = partialResult.skippedCount;
      }
      if (partialResult.failedCount !== undefined) {
        update.$set['result.failedCount'] = partialResult.failedCount;
      }
      if (partialResult.errorLog !== undefined) {
        update.$set['result.errorLog'] = partialResult.errorLog;
      }
    }

    return EventJobModel.findOneAndUpdate(query, update, { new: true }).exec();
  }

  /**
   * Mark job as COMPLETED and clear worker lease.
   * If workerId is provided, validates that worker still owns an unexpired lease.
   */
  async markCompleted(
    jobId: string,
    finalResult: IJobResult,
    workerId?: string
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (!job) return null;
      if (job.status !== 'PROCESSING') return null;
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) {
        return null;
      }
      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.progress.percentage = 100;
      job.result = finalResult;
      job.lockedBy = null;
      job.lockExpiresAt = null;
      return job;
    }

    const query: any = {
      _id: new mongoose.Types.ObjectId(jobId),
      status: 'PROCESSING',
    };
    if (workerId) {
      query.lockedBy = workerId;
      query.lockExpiresAt = { $gte: new Date() };
    }

    return EventJobModel.findOneAndUpdate(
      query,
      {
        $set: {
          status: 'COMPLETED',
          completedAt: new Date(),
          'progress.percentage': 100,
          result: finalResult,
          lockedBy: null,
          lockExpiresAt: null,
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Mark job as FAILED with error message and clear worker lease.
   */
  async markFailed(
    jobId: string,
    errorMessage: string,
    partialResult?: Partial<IJobResult>,
    workerId?: string
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (!job) return null;
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return null;
      if (workerId && (job.lockedBy !== workerId || (job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date()))) {
        return null;
      }
      job.status = 'FAILED';
      job.failedAt = new Date();
      job.errorMessage = errorMessage;
      job.failureReason = errorMessage;
      job.lockedBy = null;
      job.lockExpiresAt = null;
      if (partialResult?.errorLog) job.result.errorLog = partialResult.errorLog;
      return job;
    }

    const query: any = {
      _id: new mongoose.Types.ObjectId(jobId),
      status: { $in: ['QUEUED', 'PROCESSING'] },
    };
    if (workerId) {
      query.status = 'PROCESSING';
      query.lockedBy = workerId;
      query.lockExpiresAt = { $gte: new Date() };
    }

    const update: any = {
      $set: {
        status: 'FAILED',
        failedAt: new Date(),
        errorMessage,
        failureReason: errorMessage,
        lockedBy: null,
        lockExpiresAt: null,
      },
    };

    if (partialResult) {
      if (partialResult.importedCount !== undefined) {
        update.$set['result.importedCount'] = partialResult.importedCount;
      }
      if (partialResult.renderedCount !== undefined) {
        update.$set['result.renderedCount'] = partialResult.renderedCount;
      }
      if (partialResult.exportedCount !== undefined) {
        update.$set['result.exportedCount'] = partialResult.exportedCount;
      }
      if (partialResult.errorLog !== undefined) {
        update.$set['result.errorLog'] = partialResult.errorLog;
      }
    }

    return EventJobModel.findOneAndUpdate(query, update, { new: true }).exec();
  }

  /**
   * Persist updated job payload (e.g. allocated sequence ranges).
   */
  async updatePayload(
    jobId: string,
    payload: Record<string, any>
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (job) {
        job.payload = payload;
      }
      return job;
    }

    return EventJobModel.findByIdAndUpdate(
      jobId,
      { $set: { payload } },
      { new: true }
    ).exec();
  }

  /**
   * Renew worker lease for an actively running job (heartbeat).
   * Succeeds only if worker still owns the valid, unexpired lease.
   */
  async renewLease(
    jobId: string,
    workerId: string,
    leaseMs: number = 10 * 60 * 1000
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return false;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (job && job.status === 'PROCESSING' && job.lockedBy === workerId) {
        job.lockExpiresAt = new Date(Date.now() + leaseMs);
        return true;
      }
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    const updated = await EventJobModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(jobId),
        status: 'PROCESSING',
        lockedBy: workerId,
        lockExpiresAt: { $gte: now },
      },
      {
        $set: {
          lockExpiresAt: expiresAt,
        },
      },
      { new: true }
    ).exec();

    return !!updated;
  }

  /**
   * Atomically claim a specific job by ID for processing.
   * Succeeds only if status is QUEUED (and nextRunAt is due) or an expired PROCESSING lock,
   * provided maximum retry attempts have not been exceeded.
   */
  async claimJob(
    jobId: string,
    workerId: string,
    leaseMs: number = 10 * 60 * 1000
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (job && (job.status === 'QUEUED' || job.status === 'PROCESSING')) {
        if (job.nextRunAt && job.nextRunAt > now) return null;
        if (job.attempts >= (job.maxAttempts || 3)) return null;
        await this.markStarted(jobId);
        job.status = 'PROCESSING';
        job.lockedBy = workerId;
        job.lockExpiresAt = expiresAt;
        job.attempts = (job.attempts || 0) + 1;
        job.lastAttemptAt = now;
        return job;
      }
      return null;
    }

    return EventJobModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(jobId),
        $and: [
          {
            $or: [
              {
                status: 'QUEUED',
                $or: [
                  { nextRunAt: { $exists: false } },
                  { nextRunAt: null },
                  { nextRunAt: { $lte: now } },
                ],
              },
              {
                status: 'PROCESSING',
                lockExpiresAt: { $lt: now },
              },
            ],
          },
          {
            $expr: {
              $lt: ['$attempts', { $ifNull: ['$maxAttempts', 3] }],
            },
          },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          lockedBy: workerId,
          lockExpiresAt: expiresAt,
          startedAt: now,
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    ).exec();
  }

  /**
   * Atomically claim next available queued or abandoned job across workers.
   * Respects nextRunAt schedules and bounded retry limits.
   */
  async claimNextAvailableJob(
    workerId: string,
    leaseMs: number = 10 * 60 * 1000
  ): Promise<IEventJobDocument | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    return EventJobModel.findOneAndUpdate(
      {
        $and: [
          {
            $or: [
              {
                status: 'QUEUED',
                $or: [
                  { nextRunAt: { $exists: false } },
                  { nextRunAt: null },
                  { nextRunAt: { $lte: now } },
                ],
              },
              {
                status: 'PROCESSING',
                lockExpiresAt: { $lt: now },
              },
            ],
          },
          {
            $expr: {
              $lt: ['$attempts', { $ifNull: ['$maxAttempts', 3] }],
            },
          },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          lockedBy: workerId,
          lockExpiresAt: expiresAt,
          startedAt: now,
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true }
    ).exec();
  }

  /**
   * Release a job back to QUEUED for bounded retry after transient failure.
   * If workerId is provided, validates that the releasing worker still owns the active lease.
   */
  async releaseJobForRetry(
    jobId: string,
    errorMessage: string,
    delayMs: number = 5000,
    workerId?: string
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (job) {
        if (workerId && job.lockedBy && job.lockedBy !== workerId) return null;
        job.status = 'QUEUED';
        job.lockedBy = null;
        job.lockExpiresAt = null;
        job.failureReason = errorMessage;
      }
      return job;
    }

    const now = new Date();
    const nextRun = new Date(now.getTime() + delayMs);

    const query: any = { _id: new mongoose.Types.ObjectId(jobId) };
    if (workerId) {
      query.status = 'PROCESSING';
      query.lockedBy = workerId;
      query.lockExpiresAt = { $gte: now };
    }

    return EventJobModel.findOneAndUpdate(
      query,
      {
        $set: {
          status: 'QUEUED',
          lockedBy: null,
          lockExpiresAt: null,
          failureReason: errorMessage,
          nextRunAt: nextRun,
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Recover abandoned jobs (e.g. after server restart or worker crash).
   * Either resets eligible jobs to QUEUED or marks exhausted jobs FAILED.
   */
  async recoverAbandonedJobs(leaseGraceMs: number = 0): Promise<{ recovered: number; failed: number }> {
    if (mongoose.connection.readyState !== 1) {
      return { recovered: 0, failed: 0 };
    }

    const now = new Date(Date.now() - leaseGraceMs);

    const abandonedJobs = await EventJobModel.find({
      status: 'PROCESSING',
      lockExpiresAt: { $lt: now },
    }).exec();

    let recovered = 0;
    let failed = 0;

    for (const job of abandonedJobs) {
      if (job.attempts >= job.maxAttempts) {
        const failedJob = await EventJobModel.findOneAndUpdate(
          {
            _id: job._id,
            status: 'PROCESSING',
            lockExpiresAt: { $lt: now },
          },
          {
            $set: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: 'Abandoned by worker and exceeded maximum retry attempts',
              failureReason: 'Abandoned by worker and exceeded maximum retry attempts',
              lockedBy: null,
              lockExpiresAt: null,
            },
          },
          { new: true }
        ).exec();
        if (failedJob) failed++;
      } else {
        const recoveredJob = await EventJobModel.findOneAndUpdate(
          {
            _id: job._id,
            status: 'PROCESSING',
            lockExpiresAt: { $lt: now },
          },
          {
            $set: {
              status: 'QUEUED',
              lockedBy: null,
              lockExpiresAt: null,
              failureReason: 'Recovered from abandoned worker process',
              nextRunAt: new Date(),
            },
          },
          { new: true }
        ).exec();
        if (recoveredJob) recovered++;
      }
    }

    return { recovered, failed };
  }

  /**
   * Cancel an in-progress or queued job.
   */
  async markCancelled(jobId: string): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;
    return EventJobModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(jobId),
        status: { $in: ['QUEUED', 'PROCESSING'] },
      },
      {
        $set: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Invalidate expired download URLs in event jobs.
   */
  async clearDownloadUrlsForStoragePaths(eventId: string, storagePaths: string[]): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(eventId) || !storagePaths.length) return;
    await EventJobModel.updateMany(
      {
        eventId: new mongoose.Types.ObjectId(eventId),
        jobType: 'EXPORT_CREDENTIALS',
        'result.storagePath': { $in: storagePaths },
      },
      {
        $set: {
          'result.downloadUrl': null,
        },
      }
    );
  }
}

export const mongoEventJobRepository = new MongoEventJobRepository();
