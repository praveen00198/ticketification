import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import {
  EventJobQueueService,
  eventJobQueueService,
} from '../services/event-job-queue.service';
import {
  EventImportParserService,
  eventImportParserService,
} from '../services/event-import-parser.service';
import {
  MongoEventJobRepository,
  mongoEventJobRepository,
} from '../repositories/mongo-event-job.repository';
import { NotFoundError, ValidationError } from '../../../middlewares/error.middleware';

export class EventJobController {
  constructor(
    private jobService: EventJobQueueService = eventJobQueueService,
    private parserService: EventImportParserService = eventImportParserService,
    private jobRepo: MongoEventJobRepository = mongoEventJobRepository
  ) {}

  /**
   * Fast synchronous preview of spreadsheet buffer before queueing.
   * POST /api/events/:eventId/jobs/preview-import
   */
  previewImport = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      await this.jobService.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      let buffer: Buffer | null = null;
      if (req.file) {
        buffer = req.file.buffer;
      } else if (req.body?.fileBase64) {
        buffer = Buffer.from(req.body.fileBase64, 'base64');
      }

      if (!buffer) {
        throw new ValidationError('No file uploaded or fileBase64 provided');
      }

      const preview = this.parserService.parseSpreadsheetBuffer(buffer);

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Enqueue an attendee import job.
   * POST /api/events/:eventId/jobs/import
   * Returns HTTP 202 Accepted.
   */
  createImportJob = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { records, renderAfterImport, templateId, credentialType } = req.body;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      const job = await this.jobService.enqueueImportJob(
        eventId,
        records,
        callerUserId,
        callerPlatformRole,
        { renderAfterImport, templateId, credentialType }
      );

      res.status(202).json({
        success: true,
        message: 'Import job accepted and queued for asynchronous processing',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Enqueue a bulk Sharp credential rendering job.
   * POST /api/events/:eventId/jobs/bulk-render
   * Returns HTTP 202 Accepted.
   */
  createBulkRenderJob = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { templateId } = req.body;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      const job = await this.jobService.enqueueBulkRenderJob(
        eventId,
        callerUserId,
        callerPlatformRole,
        { templateId }
      );

      res.status(202).json({
        success: true,
        message: 'Bulk rendering job accepted and queued for processing',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Enqueue a bulk export job (ZIP of passes, or XLSX/CSV roster).
   * POST /api/events/:eventId/jobs/export
   * Returns HTTP 202 Accepted.
   */
  createExportJob = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { exportFormat, filters } = req.body;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      const job = await this.jobService.enqueueExportJob(
        eventId,
        { exportFormat: exportFormat || 'ZIP_PASSES', filters },
        callerUserId,
        callerPlatformRole
      );

      res.status(202).json({
        success: true,
        message: 'Export job accepted and queued for asynchronous processing',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * List jobs for an event.
   * GET /api/events/:eventId/jobs
   */
  listJobs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { jobType, status, limit } = req.query;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      await this.jobService.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      const jobs = await this.jobRepo.findByEventId(eventId, {
        jobType: jobType as any,
        status: status as any,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json({
        success: true,
        data: jobs,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get job status and real-time progress.
   * GET /api/events/:eventId/jobs/:jobId
   */
  getJobStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId, jobId } = req.params;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      await this.jobService.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      const job = await this.jobRepo.findById(jobId);
      if (!job || job.eventId.toString() !== eventId) {
        throw new NotFoundError('Job not found');
      }

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Cancel an in-progress or queued job.
   * POST /api/events/:eventId/jobs/:jobId/cancel
   */
  cancelJob = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { eventId, jobId } = req.params;
      const callerUserId = req.user?.id || (req.user as any)?._id?.toString();
      const callerPlatformRole = req.user?.role;

      await this.jobService.authorizeHostOrCoordinator(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      const job = await this.jobRepo.findById(jobId);
      if (!job || job.eventId.toString() !== eventId) {
        throw new NotFoundError('Job not found');
      }

      const cancelled = await this.jobRepo.markCancelled(jobId);

      res.status(200).json({
        success: true,
        message: 'Job cancelled successfully',
        data: cancelled,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventJobController = new EventJobController();
