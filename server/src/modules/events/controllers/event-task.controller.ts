import { Request, Response, NextFunction } from 'express';
import { eventTaskService, EventTaskService } from '../services/event-task.service';
import { AppError } from '../../../middlewares/error.middleware';
import { TaskStatus, TaskCategory, TaskPriority } from '../../../db/mongo/models/event-task.model';

export class EventTaskController {
  constructor(private service: EventTaskService = eventTaskService) {}

  /**
   * Create an event task / volunteer station shift.
   * POST /api/events/:eventId/tasks
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const task = await this.service.createTask(eventId, callerId, req.body);
      res.status(201).json({
        success: true,
        message: 'Task created successfully.',
        data: task,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * List tasks for an event.
   * GET /api/events/:eventId/tasks
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { status, station, category, assignedMemberId } = req.query;

      const tasks = await this.service.listTasks(eventId, callerId, {
        status: status as TaskStatus | undefined,
        station: typeof station === 'string' ? station : undefined,
        category: category as TaskCategory | undefined,
        assignedMemberId: typeof assignedMemberId === 'string' ? assignedMemberId : undefined,
      });

      res.status(200).json({
        success: true,
        data: tasks,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get single task.
   * GET /api/events/:eventId/tasks/:taskId
   */
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, taskId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const task = await this.service.getTask(eventId, taskId, callerId);
      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update task details.
   * PUT /api/events/:eventId/tasks/:taskId
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, taskId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const updated = await this.service.updateTask(eventId, taskId, callerId, req.body);
      res.status(200).json({
        success: true,
        message: 'Task updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update task status (for assigned volunteers or coordinators).
   * PATCH /api/events/:eventId/tasks/:taskId/status
   */
  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, taskId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { status } = req.body;
      if (!status) throw new AppError('Status is required.', 400);

      const updated = await this.service.updateTaskStatus(
        eventId,
        taskId,
        callerId,
        status as TaskStatus
      );

      res.status(200).json({
        success: true,
        message: `Task status updated to ${status}.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete task.
   * DELETE /api/events/:eventId/tasks/:taskId
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, taskId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const result = await this.service.deleteTask(eventId, taskId, callerId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get tasks assigned to current authenticated user.
   * GET /api/events/:eventId/tasks/my-tasks
   */
  myTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const data = await this.service.getMyTasks(eventId, callerId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Toggle scanning permissions for a team member.
   * POST /api/events/:eventId/tasks/members/:memberId/scanner
   */
  toggleScanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, memberId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { enabled } = req.body;
      const result = await this.service.toggleScannerPrivilege(
        eventId,
        memberId,
        callerId,
        Boolean(enabled)
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.member,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventTaskController = new EventTaskController();
export default eventTaskController;
