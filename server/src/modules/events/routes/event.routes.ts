import { Router } from 'express';
import multer from 'multer';
import { eventController } from '../controllers/event.controller';
import eventVerificationRoutes from './event-verification.routes';
import eventLifecycleRoutes from './event-lifecycle.routes';
import eventMemberRoutes from './event-member.routes';
import { eventMemberController } from '../controllers/event-member.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

// Memory storage for banner uploads (5MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid banner file type. Only PNG, JPEG, and WEBP images are allowed.'));
    }
  },
});

// All event routes are protected by Supabase Auth middleware
router.use(authMiddleware);

// Global invitation acceptance endpoint
router.post('/invitations/accept', eventMemberController.accept);

// Event Banner Upload
router.post('/banner', upload.single('banner'), eventController.uploadBanner);

// Event CRUD
router.get('/', eventController.listMyEvents);
router.post('/', eventController.createEvent);
router.get('/:eventId', eventController.getEvent);
router.put('/:eventId', eventController.updateEvent);
router.delete('/:eventId', eventController.deleteEvent);

// Ticket Types for Event (Legacy & Credential taxonomy support)
router.get('/:eventId/ticket-types', eventController.listTicketTypes);
router.post('/:eventId/ticket-types', eventController.createTicketType);

// Verification workflows for Event (Phase 5)
router.use('/:eventId/verification', eventVerificationRoutes);

// Lifecycle workflows for Event (Phase 6)
router.use('/:eventId', eventLifecycleRoutes);

// Membership and RBAC workflows for Event (Phase 7)
router.use('/:eventId/members', eventMemberRoutes);

// Staff Tasks and Volunteer Operations (Phase 8)
import eventTaskRoutes from './event-task.routes';
router.use('/:eventId/tasks', eventTaskRoutes);

// Mentor & Evaluator System Workflows (Phase 9)
import eventAssignmentRoutes from './event-assignment.routes';
router.use('/:eventId/assignments', eventAssignmentRoutes);

// Team Management Workflows (Phase 10)
import eventTeamRoutes from './event-team.routes';
router.use('/:eventId/teams', eventTeamRoutes);

// Evaluation & Scoring Engine Workflows (Phase 11)
import eventEvaluationRoutes from './event-evaluation.routes';
router.use('/:eventId', eventEvaluationRoutes);

// Credential Architecture Workflows (Phase 12)
import eventCredentialRoutes from './event-credential.routes';
router.use('/:eventId/credentials', eventCredentialRoutes);

// Credential Templates & Sharp Rendering Engine Workflows (Phase 13)
import eventCredentialTemplateRoutes from './event-credential-template.routes';
router.use('/:eventId/credential-templates', eventCredentialTemplateRoutes);

// Import + Bulk Credential Generation Jobs (Phase 15) & Export Jobs (Phase 16)
import eventJobRoutes from './event-job.routes';
router.use('/:eventId/jobs', eventJobRoutes);

// Storage & Performance Quota Governance Workflows (Phase 17)
import eventStorageRoutes from './event-storage.routes';
router.use('/:eventId/storage', eventStorageRoutes);

// Security + Audit + Reliability Workflows (Phase 18)
import eventAuditRoutes from './event-audit.routes';
router.use('/:eventId/audit-logs', eventAuditRoutes);

// Context-Aware Host Dashboard Console (Phase 19)
import { eventDashboardController } from '../controllers/event-dashboard.controller';
router.get('/:eventId/dashboard-summary', eventDashboardController.getDashboardSummary);

// Attendee Self-Service Platform Workflows (Phase 20)
import eventRegistrationRoutes from './event-registration.routes';
router.use('/:eventId', eventRegistrationRoutes);

export default router;
