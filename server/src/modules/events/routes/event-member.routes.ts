import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { eventMemberController } from '../controllers/event-member.controller';

const router = Router({ mergeParams: true });

// All member routes require authenticated caller
router.use(authMiddleware);

// Invite a member to the event
router.post('/invite', eventMemberController.invite);

// List all members of the event
router.get('/', eventMemberController.list);

// Update a member's role or permissions
router.put('/:memberId', eventMemberController.update);

// Revoke a member's access
router.delete('/:memberId', eventMemberController.revoke);

export default router;
