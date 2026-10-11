import { Request, Response, NextFunction } from 'express';
import { eventMemberService, EventMemberService } from '../services/event-member.service';
import { AppError } from '../../../middlewares/error.middleware';
import { EVENT_ROLES, EventRole, EventPermission, ALL_EVENT_PERMISSIONS } from '../../../db/mongo/models/event-member.model';
import { auditService } from '../services/audit.service';

export class EventMemberController {
  constructor(private service: EventMemberService = eventMemberService) {}

  /**
   * Invite a new member to an event.
   * POST /api/events/:eventId/members/invite
   */
  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) {
        throw new AppError('Authentication required.', 401);
      }

      const { email, role, customPermissions } = req.body;

      if (!email || typeof email !== 'string') {
        throw new AppError('A valid email address is required.', 400);
      }

      if (!role || !EVENT_ROLES.includes(role as EventRole)) {
        throw new AppError(
          `Invalid role '${role}'. Allowed roles: ${EVENT_ROLES.join(', ')}`,
          400
        );
      }

      if (customPermissions && !Array.isArray(customPermissions)) {
        throw new AppError('customPermissions must be an array of permissions.', 400);
      }

      if (customPermissions) {
        for (const perm of customPermissions) {
          if (!ALL_EVENT_PERMISSIONS.includes(perm as EventPermission)) {
            throw new AppError(`Invalid permission '${perm}'.`, 400);
          }
        }
      }

      const result = await this.service.inviteMember(eventId, callerId, {
        email,
        role: role as EventRole,
        customPermissions: customPermissions as EventPermission[] | undefined,
      });

      // Record immutable audit entry
      await auditService.record({
        actorId: callerId,
        actorEmail: (req as any).user?.email || 'host@ticketification.app',
        actorRole: (req as any).user?.role || 'HOST',
        eventId,
        action: 'STAFF_INVITED',
        targetEntity: 'event_members',
        targetId: (result as any)?._id?.toString() || email,
        metadata: { invitedEmail: email, role, customPermissions },
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      });

      res.status(201).json({
        success: true,
        message: `Invitation successfully created for ${email}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Accept an invitation using a single-use cryptographic token.
   * POST /api/events/invitations/accept
   */
  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = (req as any).user?.id;
      if (!callerId) {
        throw new AppError('Authentication required to accept invitation.', 401);
      }

      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        throw new AppError('Invitation token is required.', 400);
      }

      const result = await this.service.acceptInvitation(token.trim(), callerId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.member,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update member role and/or custom permissions.
   * PUT /api/events/:eventId/members/:memberId
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, memberId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) {
        throw new AppError('Authentication required.', 401);
      }

      const { role, permissions } = req.body;

      if (role && !EVENT_ROLES.includes(role as EventRole)) {
        throw new AppError(
          `Invalid role '${role}'. Allowed roles: ${EVENT_ROLES.join(', ')}`,
          400
        );
      }

      if (permissions && !Array.isArray(permissions)) {
        throw new AppError('permissions must be an array of permissions.', 400);
      }

      if (permissions) {
        for (const perm of permissions) {
          if (!ALL_EVENT_PERMISSIONS.includes(perm as EventPermission)) {
            throw new AppError(`Invalid permission '${perm}'.`, 400);
          }
        }
      }

      const updated = await this.service.updateMember(eventId, memberId, callerId, {
        role: role as EventRole | undefined,
        permissions: permissions as EventPermission[] | undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Member updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Revoke member access.
   * DELETE /api/events/:eventId/members/:memberId
   */
  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId, memberId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) {
        throw new AppError('Authentication required.', 401);
      }

      const result = await this.service.revokeMember(eventId, memberId, callerId);

      // Record immutable audit entry
      await auditService.record({
        actorId: callerId,
        actorEmail: (req as any).user?.email || 'host@ticketification.app',
        actorRole: (req as any).user?.role || 'HOST',
        eventId,
        action: 'STAFF_REMOVED',
        targetEntity: 'event_members',
        targetId: memberId,
        metadata: { reason: 'Host revoked staff access' },
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      });

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * List members for an event.
   * GET /api/events/:eventId/members
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;
      const callerId = (req as any).user?.id;
      if (!callerId) {
        throw new AppError('Authentication required.', 401);
      }

      const { status } = req.query;

      const members = await this.service.listMembers(
        eventId,
        callerId,
        typeof status === 'string' ? status : undefined
      );

      res.status(200).json({
        success: true,
        data: members,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const eventMemberController = new EventMemberController();
export default eventMemberController;
