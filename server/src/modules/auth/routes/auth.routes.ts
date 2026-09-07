import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { authRateLimiter } from '../../../middlewares/rate-limit.middleware';

const router = Router();

router.post('/register', authRateLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));
router.post('/change-password', authMiddleware, (req, res, next) => authController.changePassword(req, res, next));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

export default router;

