import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

// Public verification endpoint (phone camera scans and in-app verification)
router.get('/verify/:token', (req, res, next) =>
  verificationController.verifyToken(req, res, next)
);

// Admin-only check-in endpoint (marks ticket as USED)
router.post('/check-in/:id', authMiddleware, (req, res, next) =>
  verificationController.checkIn(req, res, next)
);

export default router;
