import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { eventEvaluationController } from '../controllers/event-evaluation.controller';

const router = Router({ mergeParams: true });

// Protected by Supabase Auth middleware
router.use(authMiddleware);

// Rubric management routes
router.post('/rubrics', eventEvaluationController.createRubric);
router.get('/rubrics', eventEvaluationController.listRubrics);
router.patch('/rubrics/:rubricId', eventEvaluationController.updateRubric);
router.patch('/rubrics/:rubricId/status', eventEvaluationController.updateScoringStatus);
router.delete('/rubrics/:rubricId', eventEvaluationController.deleteRubric);

// Evaluation / Scorecard routes
router.post('/evaluations', eventEvaluationController.submitEvaluation);
router.get('/evaluations', eventEvaluationController.listEvaluations);
router.get('/evaluations/my-scorecard/:teamId', eventEvaluationController.getMyEvaluation);
router.get('/evaluations/leaderboard', eventEvaluationController.getLeaderboard);

export default router;
