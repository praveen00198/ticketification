import { Request, Response, NextFunction } from 'express';
import {
  eventRegistrationService,
  EventRegistrationService,
} from '../services/event-registration.service';
import { eventTeamService, EventTeamService } from '../services/event-team.service';

export class EventRegistrationController {
  constructor(
    private registrationService: EventRegistrationService = eventRegistrationService,
    private teamService: EventTeamService = eventTeamService
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const result = await this.registrationService.register(
        eventId,
        callerSupabaseId,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Registration confirmed and credential issued successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getMyRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const data = await this.registrationService.getMyRegistration(eventId, callerSupabaseId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  cancelMyRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;
      const { reason } = req.body;

      const result = await this.registrationService.cancelRegistration(
        eventId,
        callerSupabaseId,
        reason
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  getMyWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const items = await this.registrationService.getMyWallet(callerSupabaseId);

      res.status(200).json({
        success: true,
        count: items.length,
        data: items,
      });
    } catch (err) {
      next(err);
    }
  };

  getMyRegistrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const items = await this.registrationService.getMyRegistrations(callerSupabaseId);

      res.status(200).json({
        success: true,
        count: items.length,
        data: items,
      });
    } catch (err) {
      next(err);
    }
  };

  getMyAttendanceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const items = await this.registrationService.getMyAttendanceHistory(callerSupabaseId);

      res.status(200).json({
        success: true,
        count: items.length,
        data: items,
      });
    } catch (err) {
      next(err);
    }
  };

  getMyTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const team = await this.teamService.getMyTeam(eventId, callerSupabaseId);

      res.status(200).json({
        success: true,
        data: team,
      });
    } catch (err) {
      next(err);
    }
  };

  createAttendeeTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;
      const { teamName, track } = req.body;

      const team = await this.teamService.createAttendeeTeam(
        eventId,
        callerSupabaseId,
        teamName,
        track
      );

      res.status(201).json({
        success: true,
        message: 'Team created successfully',
        data: team,
      });
    } catch (err) {
      next(err);
    }
  };

  joinAttendeeTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;
      const { teamId, teamName } = req.body;

      const team = await this.teamService.joinAttendeeTeam(
        eventId,
        callerSupabaseId,
        teamId || teamName
      );

      res.status(200).json({
        success: true,
        message: 'Successfully joined team',
        data: team,
      });
    } catch (err) {
      next(err);
    }
  };

  submitAttendeeProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const user = (req as any).user;
      const callerSupabaseId = user?.sub || user?.id;

      const team = await this.teamService.submitAttendeeProject(
        eventId,
        callerSupabaseId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Project submission updated successfully',
        data: team,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventRegistrationController = new EventRegistrationController();
