import { Request, Response } from 'express';
import { publicEventService } from '../services/public-event.service';

export class PublicEventController {
  constructor(private service = publicEventService) {}

  /**
   * GET /api/public/events
   * Search and filter public events.
   */
  getEvents = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;
      const eventType = req.query.eventType as string | undefined;
      const venueType = req.query.venueType as string | undefined;
      const pricingModel = req.query.pricingModel as string | undefined;
      const city = req.query.city as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await this.service.getPublicEvents({
        page,
        limit,
        eventType,
        venueType,
        pricingModel,
        city,
        search,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to fetch public events',
      });
    }
  };

  /**
   * GET /api/public/events/:eventId
   * Fetch single public event with host profile and capacity metrics.
   */
  getEventById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventId } = req.params;
      const result = await this.service.getPublicEventById(eventId);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Public event not found or is not currently active',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to fetch event details',
      });
    }
  };

  /**
   * GET /api/public/hosts/:hostId
   * Fetch public organizer profile and active events.
   */
  getHostProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { hostId } = req.params;
      const result = await this.service.getPublicHostProfile(hostId);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Organizer not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to fetch organizer profile',
      });
    }
  };

  /**
   * POST /api/public/events/:eventId/report
   * Report an event for scams, abuse, or misleading information.
   */
  reportEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { eventId } = req.params;
      const { reporterEmail, reporterName, category, reason } = req.body;

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // If optional user context exists on request (e.g., logged-in user submitting report)
      const reporterUserId = (req as any).user?.id || (req as any).user?.supabaseUserId;

      const result = await this.service.reportEvent(eventId, {
        reporterEmail,
        reporterName,
        reporterUserId,
        category,
        reason,
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      const statusCode =
        err.message.includes('not found') ? 404 :
        err.message.includes('required') || err.message.includes('Invalid') || err.message.includes('characters') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: err?.message || 'Failed to submit report',
      });
    }
  };
}

export const publicEventController = new PublicEventController();
export default publicEventController;
