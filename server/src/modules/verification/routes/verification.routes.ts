import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { scannerRateLimiter } from '../../../middlewares/rate-limit.middleware';

const router = Router({ mergeParams: true });

// Lightweight reachability health check (<5ms, no DB)
// Mounted before rate limiting so frequent background polling never exhausts scanner quota
router.get('/health', (req, res) =>
  verificationController.healthCheck(req, res)
);
router.get('/verify/health', (req, res) =>
  verificationController.healthCheck(req, res)
);

// Apply scanner rate limiter to protect all scan and lookup endpoints
router.use(scannerRateLimiter);

// Public lookup for phone camera scans (no auth needed to view verification page)
router.get('/:token', (req, res, next) =>
  verificationController.verifyToken(req, res, next)
);
router.get('/verify/:token', (req, res, next) =>
  verificationController.verifyToken(req, res, next)
);
router.post('/lookup', (req, res, next) =>
  verificationController.verifyToken(req, res, next)
);
router.post('/verify/lookup', (req, res, next) =>
  verificationController.verifyToken(req, res, next)
);

// Check-in endpoints (protected)
router.post('/checkin', authMiddleware, (req, res, next) =>
  verificationController.checkIn(req, res, next)
);
router.post('/verify/checkin', authMiddleware, (req, res, next) =>
  verificationController.checkIn(req, res, next)
);

// One-action Scan & Auto Check-in endpoint (protected)
router.post('/scan', authMiddleware, (req, res, next) =>
  verificationController.scanAndCheckIn(req, res, next)
);
router.post('/verify/scan', authMiddleware, (req, res, next) =>
  verificationController.scanAndCheckIn(req, res, next)
);

// Offline Queue Batch Sync endpoint (R5) (protected)
router.post('/sync', authMiddleware, (req, res, next) =>
  verificationController.syncBatch(req, res, next)
);
router.post('/verify/sync', authMiddleware, (req, res, next) =>
  verificationController.syncBatch(req, res, next)
);

// Recent check-ins live feed
router.get('/recent/:eventId', authMiddleware, (req, res, next) =>
  verificationController.getRecentCheckins(req, res, next)
);

export default router;
