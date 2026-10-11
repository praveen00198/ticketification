import { Response, NextFunction } from 'express';
import { hostService, HostService } from './host.service';
import { AuthenticationError } from '../../middlewares/error.middleware';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export class HostController {
  constructor(private service: HostService = hostService) {}

  /**
   * GET /api/host/profile
   * Retrieve caller's organizer profile and onboarding state.
   */
  getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('Authentication required to access organizer profile.');
      }

      const result = await this.service.getHostProfile(req.user.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/host/onboarding
   * Complete initial host onboarding.
   */
  completeOnboarding = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('Authentication required to complete onboarding.');
      }

      const result = await this.service.completeOnboarding(req.user.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Organizer profile initialized successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/host/profile
   * Update existing organizer profile.
   */
  updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('Authentication required to update organizer profile.');
      }

      const result = await this.service.updateHostProfile(req.user.id, req.body);
      res.json({
        success: true,
        message: 'Organizer profile updated successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/host/logo
   * Upload organizer logo asset to Supabase Storage.
   */
  uploadLogo = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        throw new AuthenticationError('Authentication required to upload organizer assets.');
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded. Please attach a logo image (PNG, JPEG, WEBP, or SVG).',
        });
        return;
      }

      const result = await this.service.uploadLogo(
        req.user.id,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      res.json({
        success: true,
        message: 'Logo uploaded successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const hostController = new HostController();
export default hostController;
