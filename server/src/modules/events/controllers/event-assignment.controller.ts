import { Request, Response, NextFunction } from 'express';
import { eventAssignmentService, EventAssignmentService } from '../services/event-assignment.service';
import { AppError } from '../../../middlewares/error.middleware';
import { AssignmentRole, AssignmentStatus } from '../../../db/mongo/models/event-assignment.model';

export class EventAssignmentController {
  constructor(private service: EventAssignmentService = eventAssignmentService) {}

  /**
   * Assign a Mentor or Evaluator to a track or team.
   * POST /api/events/:eventId/assignments
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const assignment = await this.service.createAssignment(eventId, callerId, req.body);
      res.status(201).json({
        success: true,
        message: 'Assignment successfully created.',
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * List assignments for an event.
   * GET /api/events/:eventId/assignments
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { role, track, status, memberId } = req.query;

      const assignments = await this.service.listAssignments(eventId, callerId, {
        role: role as AssignmentRole | undefined,
        track: typeof track === 'string' ? track : undefined,
        status: status as AssignmentStatus | undefined,
        memberId: typeof memberId === 'string' ? memberId : undefined,
      });

      res.status(200).json({
        success: true,
        data: assignments,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get assignments specific to the current authenticated caller.
   * GET /api/events/:eventId/assignments/my-assignments
   */
  myAssignments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const data = await this.service.getMyAssignments(eventId, callerId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Record a mentorship advice log.
   * POST /api/events/:eventId/assignments/:assignmentId/logs
   */
  recordLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, assignmentId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { note } = req.body;
      const updated = await this.service.recordMentorshipLog(eventId, assignmentId, callerId, note);

      res.status(200).json({
        success: true,
        message: 'Mentorship note successfully recorded.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Remove an assignment.
   * DELETE /api/events/:eventId/assignments/:assignmentId
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, assignmentId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const result = await this.service.deleteAssignment(eventId, assignmentId, callerId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventAssignmentController = new EventAssignmentController();
export default eventAssignmentController;
