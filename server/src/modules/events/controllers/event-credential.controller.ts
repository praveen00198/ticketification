import { Request, Response, NextFunction } from 'express';
import { EventCredentialService, eventCredentialService } from '../services/event-credential.service';
import { auditService } from '../services/audit.service';

export class EventCredentialController {
  constructor(private service: EventCredentialService = eventCredentialService) {}

  getCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const result = await this.service.getEventCredentials(
        eventId,
        callerUserId,
        callerPlatformRole,
        req.query as any
      );

      res.json({
        success: true,
        data: result.credentials,
        total: result.total,
        metrics: result.metrics,
      });
    } catch (err) {
      next(err);
    }
  };

  issueCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const credential = await this.service.issueCredential(
        eventId,
        callerUserId,
        callerPlatformRole,
        req.body
      );

      res.status(201).json({
        success: true,
        data: credential,
        message: 'Credential successfully issued',
      });
    } catch (err) {
      next(err);
    }
  };

  issueWorkerBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const result = await this.service.issueWorkerBatch(
        eventId,
        callerUserId,
        callerPlatformRole,
        req.body
      );

      res.status(201).json({
        success: true,
        data: result.credentials,
        issuedCount: result.issuedCount,
        message: `Successfully issued ${result.issuedCount} worker credentials`,
      });
    } catch (err) {
      next(err);
    }
  };

  getCredentialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, credentialId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const credential = await this.service.getCredentialById(
        eventId,
        credentialId,
        callerUserId,
        callerPlatformRole
      );

      res.json({
        success: true,
        data: credential,
      });
    } catch (err) {
      next(err);
    }
  };

  revokeCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, credentialId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const credential = await this.service.revokeCredential(
        eventId,
        credentialId,
        callerUserId,
        callerPlatformRole,
        req.body.reason
      );

      // Record immutable audit entry
      await auditService.record({
        actorId: callerUserId,
        actorEmail: (req as any).user?.email || 'admin@ticketification.app',
        actorRole: callerPlatformRole || 'HOST',
        eventId,
        action: 'CREDENTIAL_REVOKED',
        targetEntity: 'event_credentials',
        targetId: credentialId,
        metadata: {
          formattedId: credential.formattedId,
          reason: req.body.reason,
          holderName: credential.holder?.name,
        },
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      });

      res.json({
        success: true,
        data: credential,
        message: 'Credential revoked',
      });
    } catch (err) {
      next(err);
    }
  };

  assignCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, credentialId } = req.params;
      const callerUserId = (req as any).user?.id || (req as any).user?.sub;
      const callerPlatformRole = (req as any).user?.platformRole || (req as any).user?.role;

      const credential = await this.service.assignCredential(
        eventId,
        credentialId,
        callerUserId,
        callerPlatformRole,
        req.body
      );

      res.json({
        success: true,
        data: credential,
        message: 'Credential holder assigned successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const result = await this.service.verifyToken(token);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
