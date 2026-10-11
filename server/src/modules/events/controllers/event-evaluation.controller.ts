import { Request, Response, NextFunction } from 'express';
import { eventEvaluationService, EventEvaluationService } from '../services/event-evaluation.service';
import { AppError } from '../../../middlewares/error.middleware';
import { ScoringStatus } from '../../../db/mongo/models/event-rubric.model';

export class EventEvaluationController {
  constructor(private service: EventEvaluationService = eventEvaluationService) {}

  // --- Rubric Endpoints ---

  createRubric = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const rubric = await this.service.createRubric(eventId, callerId, req.body);
      res.status(201).json({
        success: true,
        message: 'Judging rubric successfully created.',
        data: rubric,
      });
    } catch (err) {
      next(err);
    }
  };

  listRubrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { track } = req.query;
      const rubrics = await this.service.getRubrics(
        eventId,
        callerId,
        typeof track === 'string' ? track : undefined
      );

      res.status(200).json({
        success: true,
        data: rubrics,
      });
    } catch (err) {
      next(err);
    }
  };

  updateRubric = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, rubricId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const updated = await this.service.updateRubric(eventId, rubricId, callerId, req.body);
      res.status(200).json({
        success: true,
        message: 'Rubric successfully updated.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  updateScoringStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, rubricId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { status } = req.body;
      const updated = await this.service.updateScoringStatus(
        eventId,
        rubricId,
        callerId,
        status as ScoringStatus
      );

      res.status(200).json({
        success: true,
        message: `Scoring phase set to ${status}.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteRubric = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, rubricId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      await this.service.deleteRubric(eventId, rubricId, callerId);
      res.status(200).json({
        success: true,
        message: 'Rubric successfully deleted.',
      });
    } catch (err) {
      next(err);
    }
  };

  // --- Scorecard / Evaluation Endpoints ---

  submitEvaluation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const evaluation = await this.service.submitEvaluation(eventId, callerId, req.body);
      res.status(201).json({
        success: true,
        message: 'Scorecard successfully submitted.',
        data: evaluation,
      });
    } catch (err) {
      next(err);
    }
  };

  listEvaluations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { rubricId, teamId, evaluatorMemberId } = req.query;
      const evaluations = await this.service.getAllEvaluations(eventId, callerId, {
        rubricId: typeof rubricId === 'string' ? rubricId : undefined,
        teamId: typeof teamId === 'string' ? teamId : undefined,
        evaluatorMemberId: typeof evaluatorMemberId === 'string' ? evaluatorMemberId : undefined,
      });

      res.status(200).json({
        success: true,
        data: evaluations,
      });
    } catch (err) {
      next(err);
    }
  };

  getMyEvaluation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, teamId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const evaluation = await this.service.getMyEvaluationForTeam(eventId, teamId, callerId);
      res.status(200).json({
        success: true,
        data: evaluation,
      });
    } catch (err) {
      next(err);
    }
  };

  getLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) throw new AppError('Authentication required.', 401);

      const { track } = req.query;
      const leaderboard = await this.service.getLeaderboard(
        eventId,
        callerId,
        typeof track === 'string' ? track : undefined
      );

      res.status(200).json({
        success: true,
        data: leaderboard,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventEvaluationController = new EventEvaluationController();
