import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { eventTaskController } from '../controllers/event-task.controller';

const router = Router({ mergeParams: true });

// All task routes require authenticated caller
router.use(authMiddleware);

// Tasks assigned to current authenticated user
router.get('/my-tasks', eventTaskController.myTasks);

// Toggle scanner privilege for a member
router.post('/members/:memberId/scanner', eventTaskController.toggleScanner);

// Task CRUD
router.post('/', eventTaskController.create);
router.get('/', eventTaskController.list);
router.get('/:taskId', eventTaskController.get);
router.put('/:taskId', eventTaskController.update);
router.patch('/:taskId/status', eventTaskController.updateStatus);
router.delete('/:taskId', eventTaskController.delete);

export default router;
