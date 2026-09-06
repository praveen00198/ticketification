import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

router.get('/verify/:token', authMiddleware, (req, res, next) =>
  verificationController.verifyToken(req, res, next)
);
router.post('/check-in/:id', authMiddleware, (req, res, next) =>
  verificationController.checkIn(req, res, next)
);

export default router;
