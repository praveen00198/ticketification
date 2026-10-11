import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware, AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../../../middlewares/authorization.middleware';
import { authRateLimiter } from '../../../middlewares/rate-limit.middleware';

const router = Router();

router.post('/register', authRateLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));
router.post('/change-password', authMiddleware, (req, res, next) => authController.changePassword(req, res, next));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

// Platform Admin authorization endpoints
router.get('/admin/status', authMiddleware, requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    message: 'Platform admin authorization verified.',
    user: req.user,
  });
});

router.get('/admin/super-status', authMiddleware, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    message: 'Super admin authorization verified.',
    user: req.user,
  });
});

export default router;

