import { Router } from 'express';
import { EventCredentialController } from '../controllers/event-credential.controller';
import { eventCredentialTemplateController } from '../controllers/event-credential-template.controller';
import { eventCredentialCheckinController } from '../controllers/event-credential-checkin.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

export const eventCredentialController = new EventCredentialController();

// 1. Protected Event-Scoped Credential Management Router
const eventCredentialRouter = Router({ mergeParams: true });
eventCredentialRouter.use(authMiddleware);

// Check-in and Day-of-Event Verification (Phase 14)
eventCredentialRouter.post('/checkin', eventCredentialCheckinController.verifyAndCheckIn);
eventCredentialRouter.get('/checkins', eventCredentialCheckinController.listCheckinLogs);
eventCredentialRouter.get('/checkin-stats', eventCredentialCheckinController.getCheckinStats);

eventCredentialRouter.get('/', eventCredentialController.getCredentials);
eventCredentialRouter.post('/', eventCredentialController.issueCredential);
eventCredentialRouter.post('/worker-batch', eventCredentialController.issueWorkerBatch);
eventCredentialRouter.get('/:credentialId', eventCredentialController.getCredentialById);
eventCredentialRouter.patch('/:credentialId/revoke', eventCredentialController.revokeCredential);
eventCredentialRouter.patch('/:credentialId/assign', eventCredentialController.assignCredential);
eventCredentialRouter.post('/:credentialId/render', eventCredentialTemplateController.renderCredentialAsset);

export default eventCredentialRouter;

// 2. Public Credential Verification Router (No Auth required for verifying public QR token)
export const publicCredentialRouter = Router();
publicCredentialRouter.get('/verify-token/:token', eventCredentialController.verifyToken);
