import { Router } from 'express';
import { eventRegistrationController } from '../controllers/event-registration.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// All attendee routes require authenticated user session
router.use(authMiddleware);

// Event Registration Endpoints
router.post('/register', eventRegistrationController.register);
router.get('/my-registration', eventRegistrationController.getMyRegistration);
router.delete('/my-registration', eventRegistrationController.cancelMyRegistration);

// Attendee Team Self-Service Endpoints (Hackathons & Competitions)
router.get('/my-team', eventRegistrationController.getMyTeam);
router.post('/my-team', eventRegistrationController.createAttendeeTeam);
router.post('/my-team/join', eventRegistrationController.joinAttendeeTeam);
router.put('/my-team/submit', eventRegistrationController.submitAttendeeProject);

export default router;
