import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { AuthenticationError, ValidationError } from '../../../middlewares/error.middleware';
import {
  validateRegisterInput,
  validateLoginInput,
  validateChangePasswordInput,
} from '../auth.validation';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = validateRegisterInput(req.body);
      const result = await authService.register(validatedInput);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = validateLoginInput(req.body);
      const result = await authService.login(validatedInput);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        req.body?.refreshToken ||
        (req.headers['x-refresh-token'] as string) ||
        (req as any).cookies?.refreshToken;

      if (!refreshToken) {
        throw new ValidationError('Refresh token is required.');
      }

      const result = await authService.refreshSession(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Unauthorized. Please authenticate first.');
      }
      const result = await authService.getMe(req.user.id, req.user.email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken =
        req.body?.refreshToken ||
        (req.headers['x-refresh-token'] as string) ||
        (req as any).cookies?.refreshToken;
      const userId = (req as any).user?.id;

      await authService.logout(refreshToken, userId);
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch {
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Unauthorized. Please authenticate first.');
      }
      const { newPassword } = validateChangePasswordInput(req.body);
      await authService.changePassword(req.user.id, newPassword);
      res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Unauthorized. Please authenticate first.');
      }
      const { name, phone, avatarUrl, bio, preferences, privacy } = req.body;
      const { mongoUserRepository } = await import('../repositories/mongo-user.repository');
      const updatedUser = await mongoUserRepository.updatePersonalProfile(req.user.id, {
        name,
        phone,
        avatarUrl,
        bio,
        preferences,
        privacy,
      });
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedUser ? String(updatedUser.supabaseUserId || updatedUser._id) : req.user.id,
          name: updatedUser?.name,
          email: updatedUser?.email,
          role: updatedUser?.platformRole,
          phone: updatedUser?.phone,
          avatarUrl: updatedUser?.avatarUrl,
          bio: updatedUser?.metadata?.bio,
          preferences: updatedUser?.metadata?.preferences,
          privacy: updatedUser?.metadata?.privacy,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;
