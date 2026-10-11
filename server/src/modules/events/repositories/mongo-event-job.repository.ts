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
   * Mark job as COMPLETED and save final result.
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
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Mark job as FAILED with error message.
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
}

export const mongoEventJobRepository = new MongoEventJobRepository();
