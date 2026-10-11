import { Router } from 'express';
import { eventCredentialTemplateController } from '../controllers/event-credential-template.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const eventCredentialTemplateRouter = Router({ mergeParams: true });
eventCredentialTemplateRouter.use(authMiddleware);

// Template listing & creation
eventCredentialTemplateRouter.get('/', eventCredentialTemplateController.getTemplates);
eventCredentialTemplateRouter.post('/', eventCredentialTemplateController.createTemplate);
eventCredentialTemplateRouter.post('/clone-preset', eventCredentialTemplateController.cloneFromPreset);

// Single template operations
eventCredentialTemplateRouter.get('/:templateId', eventCredentialTemplateController.getTemplateById);
eventCredentialTemplateRouter.put('/:templateId', eventCredentialTemplateController.updateTemplate);
eventCredentialTemplateRouter.put('/:templateId/set-default', eventCredentialTemplateController.setDefaultTemplate);
eventCredentialTemplateRouter.delete('/:templateId', eventCredentialTemplateController.deleteTemplate);

// Live preview rendering with simulated mock data
eventCredentialTemplateRouter.post('/:templateId/preview', eventCredentialTemplateController.generatePreview);

export default eventCredentialTemplateRouter;
