import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireAdmin } from '../../../middlewares/authorization.middleware';
import { eventLifecycleController } from '../controllers/event-lifecycle.controller';

const router = Router({ mergeParams: true });

// All host lifecycle routes require authenticated caller
router.use(authMiddleware);

// Generic lifecycle transition endpoint
router.post('/lifecycle/transition', (req, res, next) =>
  eventLifecycleController.transition(req, res, next)
);

// Specific transition shortcuts
router.post('/publish', (req, res, next) =>
  eventLifecycleController.publish(req, res, next)
);

router.post('/registrations/open', (req, res, next) =>
  eventLifecycleController.openRegistration(req, res, next)
);

router.post('/registrations/close', (req, res, next) =>
  eventLifecycleController.closeRegistration(req, res, next)
);

router.post('/live', (req, res, next) =>
  eventLifecycleController.startLive(req, res, next)
);

router.post('/complete', requireAdmin, (req, res, next) =>
  eventLifecycleController.complete(req, res, next)
);

router.post('/archive', requireAdmin, (req, res, next) =>
  eventLifecycleController.archive(req, res, next)
);

router.post('/cancel', (req, res, next) =>
  eventLifecycleController.cancel(req, res, next)
);

// Status transition audit history
router.get('/lifecycle/history', (req, res, next) =>
  eventLifecycleController.getHistory(req, res, next)
);

export default router;

/**
 * Platform Administrator Event Lifecycle Router
 * Mounted at /api/admin/events
 */
export const adminLifecycleRouter = Router();

adminLifecycleRouter.use(authMiddleware);
adminLifecycleRouter.use(requireAdmin);

adminLifecycleRouter.post('/:eventId/suspend', (req, res, next) =>
  eventLifecycleController.adminSuspend(req, res, next)
);

adminLifecycleRouter.post('/:eventId/reinstate', (req, res, next) =>
  eventLifecycleController.adminReinstate(req, res, next)
);

adminLifecycleRouter.post('/:eventId/complete', (req, res, next) =>
  eventLifecycleController.complete(req, res, next)
);

adminLifecycleRouter.post('/:eventId/archive', (req, res, next) =>
  eventLifecycleController.archive(req, res, next)
);
