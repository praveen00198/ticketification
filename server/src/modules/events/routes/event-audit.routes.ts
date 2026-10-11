import { Router } from 'express';
import { eventAuditController } from '../controllers/event-audit.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { auditLogRateLimiter } from '../../../middlewares/rate-limit.middleware';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// Get paginated audit logs for event
router.get('/', auditLogRateLimiter, eventAuditController.getEventAuditLogs);

export default router;
