import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { eventTeamController } from '../controllers/event-team.controller';

const router = Router({ mergeParams: true });

// All team routes require authenticated caller
router.use(authMiddleware);

// Team CRUD and Roster Management
router.post('/', eventTeamController.create);
router.get('/', eventTeamController.list);
router.get('/:teamId', eventTeamController.getById);
router.patch('/:teamId', eventTeamController.update);
router.delete('/:teamId', eventTeamController.delete);

// Team Roster sub-resources
router.post('/:teamId/members', eventTeamController.addMember);
router.delete('/:teamId/members/:email', eventTeamController.removeMember);

export default router;
