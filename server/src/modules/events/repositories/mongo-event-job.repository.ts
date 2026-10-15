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
   */
  async updateProgress(
    jobId: string,
    progress: Partial<IJobProgress>,
    partialResult?: Partial<IJobResult>
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    const update: any = { $set: {} };

    if (progress.total !== undefined) update.$set['progress.total'] = progress.total;
    if (progress.processed !== undefined) update.$set['progress.processed'] = progress.processed;
    if (progress.succeeded !== undefined) update.$set['progress.succeeded'] = progress.succeeded;
    if (progress.failed !== undefined) update.$set['progress.failed'] = progress.failed;
    if (progress.percentage !== undefined) update.$set['progress.percentage'] = progress.percentage;

    if (partialResult) {
      if (partialResult.importedCount !== undefined) {
        update.$set['result.importedCount'] = partialResult.importedCount;
      }
      if (partialResult.renderedCount !== undefined) {
        update.$set['result.renderedCount'] = partialResult.renderedCount;
      }
      if (partialResult.errorLog && partialResult.errorLog.length > 0) {
        update.$push = { 'result.errorLog': { $each: partialResult.errorLog } };
      }
    }

    return EventJobModel.findByIdAndUpdate(jobId, update, { new: true }).exec();
  }

  /**
   * Mark job as COMPLETED and clear worker lease.
   */
  async markCompleted(
    jobId: string,
    finalResult: IJobResult
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;
    return EventJobModel.findByIdAndUpdate(
      jobId,
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
    partialResult?: Partial<IJobResult>
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

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
      if (partialResult.errorLog && partialResult.errorLog.length > 0) {
        update.$push = { 'result.errorLog': { $each: partialResult.errorLog } };
      }
    }

    return EventJobModel.findByIdAndUpdate(jobId, update, { new: true }).exec();
  }

  /**
   * Atomically claim a specific job by ID for processing.
   * Succeeds only if status is QUEUED or an expired PROCESSING lock.
   */
  async claimJob(
    jobId: string,
    workerId: string,
    leaseMs: number = 10 * 60 * 1000
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (job && (job.status === 'QUEUED' || job.status === 'PROCESSING')) {
        await this.markStarted(jobId);
        job.lockedBy = workerId;
        job.lockExpiresAt = new Date(Date.now() + leaseMs);
        job.attempts = (job.attempts || 0) + 1;
        return job;
      }
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    return EventJobModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(jobId),
        $or: [
          { status: 'QUEUED' },
          { status: 'PROCESSING', lockExpiresAt: { $lt: now } },
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
   */
  async claimNextAvailableJob(
    workerId: string,
    leaseMs: number = 10 * 60 * 1000
  ): Promise<IEventJobDocument | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    return EventJobModel.findOneAndUpdate(
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
   */
  async releaseJobForRetry(
    jobId: string,
    errorMessage: string,
    delayMs: number = 5000
  ): Promise<IEventJobDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    if (mongoose.connection.readyState !== 1) {
      const job = await this.findById(jobId);
      if (job) {
        job.status = 'QUEUED';
        job.failureReason = errorMessage;
      }
      return job;
    }

    const now = new Date();
    const nextRun = new Date(now.getTime() + delayMs);

    return EventJobModel.findByIdAndUpdate(
      jobId,
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
        await this.markFailed(
          job._id.toString(),
          'Abandoned by worker and exceeded maximum retry attempts'
        );
        failed++;
      } else {
        await EventJobModel.findByIdAndUpdate(job._id, {
          $set: {
            status: 'QUEUED',
            lockedBy: null,
            lockExpiresAt: null,
            failureReason: 'Recovered from abandoned worker process',
            nextRunAt: new Date(),
          },
        }).exec();
        recovered++;
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
