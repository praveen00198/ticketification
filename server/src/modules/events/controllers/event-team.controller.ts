import { Request, Response, NextFunction } from 'express';
import { eventTeamService, EventTeamService } from '../services/event-team.service';
import { AppError } from '../../../middlewares/error.middleware';
import { TeamStatus } from '../../../db/mongo/models/event-team.model';

export class EventTeamController {
  constructor(private service: EventTeamService = eventTeamService) {}

  /**
   * Register a new team in the event.
   * POST /api/events/:eventId/teams
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const team = await this.service.createTeam(eventId, callerId, req.body);
      res.status(201).json({
        success: true,
        message: 'Team successfully registered.',
        data: team,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * List teams for an event.
   * GET /api/events/:eventId/teams
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { track, status, search, leaderEmail } = req.query;

      const teams = await this.service.getTeams(eventId, callerId, {
        track: typeof track === 'string' ? track : undefined,
        status: status as TeamStatus | undefined,
        search: typeof search === 'string' ? search : undefined,
        leaderEmail: typeof leaderEmail === 'string' ? leaderEmail : undefined,
      });

      res.status(200).json({
        success: true,
        data: teams,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get single team details.
   * GET /api/events/:eventId/teams/:teamId
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, teamId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const team = await this.service.getTeamById(eventId, teamId, callerId);
      res.status(200).json({
        success: true,
        data: team,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update team info, metadata, project details, or status.
   * PATCH /api/events/:eventId/teams/:teamId
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, teamId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const updated = await this.service.updateTeam(eventId, teamId, callerId, req.body);
      res.status(200).json({
        success: true,
        message: 'Team successfully updated.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Add a member to the team roster.
   * POST /api/events/:eventId/teams/:teamId/members
   */
  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, teamId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const updated = await this.service.addMember(eventId, teamId, callerId, req.body);
      res.status(200).json({
        success: true,
        message: 'Member successfully added to team.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Remove a member from the team roster.
   * DELETE /api/events/:eventId/teams/:teamId/members/:email
   */
  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, teamId, email } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const updated = await this.service.removeMember(eventId, teamId, callerId, email);
      res.status(200).json({
        success: true,
        message: 'Member successfully removed from team.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a team.
   * DELETE /api/events/:eventId/teams/:teamId
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, teamId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      await this.service.deleteTeam(eventId, teamId, callerId);
      res.status(200).json({
        success: true,
        message: 'Team successfully deleted.',
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventTeamController = new EventTeamController();
