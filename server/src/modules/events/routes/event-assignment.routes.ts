import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { eventAssignmentController } from '../controllers/event-assignment.controller';

const router = Router({ mergeParams: true });

// All assignment routes require authenticated caller
router.use(authMiddleware);

// Assignments specific to caller
router.get('/my-assignments', eventAssignmentController.myAssignments);

// Assignment CRUD
router.post('/', eventAssignmentController.create);
router.get('/', eventAssignmentController.list);
router.post('/:assignmentId/logs', eventAssignmentController.recordLog);
router.delete('/:assignmentId', eventAssignmentController.delete);

export default router;
