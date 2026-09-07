import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../../../middlewares/auth.middleware';
import { supabaseAdmin } from '../../../config/supabase';
import { AppError } from '../../../middlewares/error.middleware';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;
      const result = await authService.register(name, email, password);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const result = await authService.getMe(req.user.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response) {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        throw new AppError('Password must be at least 6 characters', 400);
      }

      if (supabaseAdmin) {
        await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
          password: newPassword,
        });
      }

      res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
