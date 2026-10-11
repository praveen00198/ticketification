import { mongoUserRepository, MongoUserRepository } from '../auth/repositories/mongo-user.repository';
import { supabaseStorageService, SupabaseStorageService } from '../tickets/services/supabase-storage.service';
import { NotFoundError, ValidationError, AppError } from '../../middlewares/error.middleware';
import {
  OnboardingInput,
  UpdateHostProfileInput,
  HostProfileResponse,
} from './host.types';
import { validateOnboardingInput, validateUpdateHostProfileInput } from './host.validation';

export class HostService {
  constructor(
    private userRepo: MongoUserRepository = mongoUserRepository,
    private storageService: SupabaseStorageService = supabaseStorageService
  ) {}

  /**
   * Retrieve host profile and onboarding state for the authenticated user.
   */
  async getHostProfile(supabaseUserId: string): Promise<HostProfileResponse> {
    const user = await this.userRepo.findBySupabaseId(supabaseUserId);

    if (!user || !user.hostProfile || !user.hostProfile.organizationName) {
      return {
        isOnboarded: false,
        hostProfile: null,
        workspaceStatus: (user?.workspaceStatus as any) || 'ACTIVE',
        verificationStatus: (user?.hostVerificationStatus as any) || 'UNVERIFIED',
      };
    }

    return {
      isOnboarded: true,
      hostProfile: user.hostProfile,
      workspaceStatus: user.workspaceStatus || 'ACTIVE',
      verificationStatus: user.hostVerificationStatus || 'UNVERIFIED',
    };
  }

  /**
   * Complete host onboarding.
   * Idempotent: safe against network retries and duplicate form submissions.
   */
  async completeOnboarding(
    supabaseUserId: string,
    rawBody: any
  ): Promise<HostProfileResponse> {
    const validatedInput = validateOnboardingInput(rawBody);

    // Verify application user exists in MongoDB
    let user = await this.userRepo.findBySupabaseId(supabaseUserId);
    if (!user) {
      // Create user record if missing during initial profile sync
      user = await this.userRepo.upsert({
        supabaseUserId,
        email: `${supabaseUserId}@ticketification.internal`,
        name: 'User',
      });
    }

    // If user is already onboarded, update fields without resetting onboardedAt
    let updatedUser;
    if (user.hostProfile && user.hostProfile.organizationName) {
      updatedUser = await this.userRepo.updateHostProfile(supabaseUserId, validatedInput);
    } else {
      updatedUser = await this.userRepo.completeOnboarding(supabaseUserId, {
        ...validatedInput,
        onboardedAt: new Date(),
      });
    }

    if (!updatedUser) {
      throw new AppError('Failed to persist organizer onboarding profile.', 500);
    }

    return {
      isOnboarded: true,
      hostProfile: updatedUser.hostProfile || null,
      workspaceStatus: updatedUser.workspaceStatus || 'ACTIVE',
      verificationStatus: updatedUser.hostVerificationStatus || 'UNVERIFIED',
    };
  }

  /**
   * Update existing organizer profile attributes.
   */
  async updateHostProfile(
    supabaseUserId: string,
    rawBody: any
  ): Promise<HostProfileResponse> {
    const validatedUpdates = validateUpdateHostProfileInput(rawBody);

    const user = await this.userRepo.findBySupabaseId(supabaseUserId);
    if (!user || !user.hostProfile || !user.hostProfile.organizationName) {
      throw new ValidationError(
        'Organizer profile has not been initialized. Please complete onboarding first.'
      );
    }

    const updatedUser = await this.userRepo.updateHostProfile(supabaseUserId, validatedUpdates);
    if (!updatedUser) {
      throw new NotFoundError('User profile not found.');
    }

    return {
      isOnboarded: true,
      hostProfile: updatedUser.hostProfile || null,
      workspaceStatus: updatedUser.workspaceStatus || 'ACTIVE',
      verificationStatus: updatedUser.hostVerificationStatus || 'UNVERIFIED',
    };
  }

  /**
   * Upload an organization logo or profile asset.
   */
  async uploadLogo(
    supabaseUserId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<{ logoUrl: string; storagePath: string }> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new ValidationError('No file content provided for upload.');
    }

    const uploadResult = await this.storageService.uploadHostAsset(
      supabaseUserId,
      fileBuffer,
      originalName,
      mimeType
    );

    // If the user already has an active hostProfile, update logoUrl in database
    const user = await this.userRepo.findBySupabaseId(supabaseUserId);
    if (user && user.hostProfile && user.hostProfile.organizationName) {
      // Remove old logo if different
      if (user.hostProfile.logoUrl && user.hostProfile.logoUrl !== uploadResult.publicUrl) {
        // Obsolete asset cleanup can be done asynchronously
      }
      await this.userRepo.updateHostProfile(supabaseUserId, {
        logoUrl: uploadResult.publicUrl,
      });
    }

    return {
      logoUrl: uploadResult.publicUrl,
      storagePath: uploadResult.storagePath,
    };
  }
}

export const hostService = new HostService();
export default hostService;
