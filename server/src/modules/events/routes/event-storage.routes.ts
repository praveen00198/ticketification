import { Router } from 'express';
import { eventStorageController } from '../controllers/event-storage.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// Storage metrics & quota status
router.get('/', eventStorageController.getStorageMetrics);

// Trigger on-demand cleanup of stale export archives
router.post('/cleanup', eventStorageController.cleanupStaleStorage);

export default router;
