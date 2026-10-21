import { Router } from 'express';
import { eventRegistrationController } from '../controllers/event-registration.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

// Protect all attendee endpoints with auth middleware
router.use(authMiddleware);

// Cross-event Attendee Wallet, Registrations, and Verified Attendance History
router.get('/wallet', eventRegistrationController.getMyWallet);
router.get('/registrations', eventRegistrationController.getMyRegistrations);
router.get('/history', eventRegistrationController.getMyAttendanceHistory);

export default router;
