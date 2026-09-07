import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { AuthenticationError } from '../../../middlewares/error.middleware';
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

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Unauthorized. Please authenticate first.');
      }
      const result = await authService.getMe(req.user.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
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
}

export const authController = new AuthController();
