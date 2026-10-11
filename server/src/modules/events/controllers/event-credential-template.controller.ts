import { Request, Response, NextFunction } from 'express';
import {
  EventCredentialTemplateService,
  eventCredentialTemplateService,
} from '../services/event-credential-template.service';

export class EventCredentialTemplateController {
  constructor(
    private service: EventCredentialTemplateService = eventCredentialTemplateService
  ) {}

  getTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const result = await this.service.getTemplates(
        eventId,
        callerUserId,
        callerPlatformRole
      );

      res.json({
        success: true,
        data: result.templates,
        defaultTemplate: result.defaultTemplate,
      });
    } catch (err) {
      next(err);
    }
  };

  getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, templateId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const template = await this.service.getTemplateById(
        eventId,
        templateId,
        callerUserId,
        callerPlatformRole
      );

      res.json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  };

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const template = await this.service.createTemplate(
        eventId,
        callerUserId,
        callerPlatformRole,
        req.body
      );

      res.status(201).json({
        success: true,
        data: template,
        message: 'Credential template created successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  cloneFromPreset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const { presetId, name } = req.body;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const template = await this.service.cloneFromPreset(
        eventId,
        callerUserId,
        callerPlatformRole,
        presetId,
        name
      );

      res.status(201).json({
        success: true,
        data: template,
        message: `Template cloned successfully from preset ${presetId}`,
      });
    } catch (err) {
      next(err);
    }
  };

  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, templateId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const template = await this.service.updateTemplate(
        eventId,
        templateId,
        callerUserId,
        callerPlatformRole,
        req.body
      );

      res.json({
        success: true,
        data: template,
        message: 'Credential template updated successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  setDefaultTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, templateId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const template = await this.service.setDefaultTemplate(
        eventId,
        templateId,
        callerUserId,
        callerPlatformRole
      );

      res.json({
        success: true,
        data: template,
        message: 'Template marked as default for event',
      });
    } catch (err) {
      next(err);
    }
  };

  deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, templateId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      await this.service.deleteTemplate(
        eventId,
        templateId,
        callerUserId,
        callerPlatformRole
      );

      res.json({
        success: true,
        message: 'Credential template deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  generatePreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, templateId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const result = await this.service.generatePreview(
        eventId,
        templateId,
        callerUserId,
        callerPlatformRole,
        req.body
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  renderCredentialAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, credentialId } = req.params;
      const { templateId } = req.body || {};
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const credential = await this.service.renderCredentialAsset(
        eventId,
        credentialId,
        callerUserId,
        callerPlatformRole,
        templateId
      );

      res.json({
        success: true,
        data: credential,
        message: 'Credential asset successfully rendered and stored',
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventCredentialTemplateController =
  new EventCredentialTemplateController();
