import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

router.get('/stats', authMiddleware, (req, res, next) =>
  dashboardController.getStats(req, res, next)
);

export default router;
