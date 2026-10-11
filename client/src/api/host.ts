import { apiClient } from './client';

export type InstitutionType =
  | 'COLLEGE_UNIVERSITY'
  | 'CORPORATE'
  | 'COMMUNITY_CLUB'
  | 'INDEPENDENT';

export type WorkspaceStatus = 'ACTIVE' | 'SUSPENDED';
export type HostVerificationStatus = 'UNVERIFIED' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface HostProfile {
  organizationName: string;
  institutionType: InstitutionType;
  institutionName?: string | null;
  website?: string | null;
  phone?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
  onboardedAt?: string;
}

export interface HostProfileData {
  isOnboarded: boolean;
  hostProfile: HostProfile | null;
  workspaceStatus: WorkspaceStatus;
  verificationStatus: HostVerificationStatus;
}

export interface OnboardingPayload {
  organizationName: string;
  institutionType: InstitutionType;
  institutionName?: string | null;
  website?: string | null;
  phone?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
}

export interface UpdateHostProfilePayload {
  organizationName?: string;
  institutionType?: InstitutionType;
  institutionName?: string | null;
  website?: string | null;
  phone?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
}

export const hostApi = {
  /**
   * Retrieve the current user's organizer profile and onboarding state.
   */
  async getProfile(): Promise<HostProfileData> {
    const res: any = await apiClient.get('/host/profile');
    return res.data;
  },

  /**
   * Submit initial organizer onboarding.
   */
  async completeOnboarding(payload: OnboardingPayload): Promise<HostProfileData> {
    const res: any = await apiClient.post('/host/onboarding', payload);
    return res.data;
  },

  /**
   * Update existing organizer profile details.
   */
  async updateProfile(payload: UpdateHostProfilePayload): Promise<HostProfileData> {
    const res: any = await apiClient.put('/host/profile', payload);
    return res.data;
  },

  /**
   * Upload an organization logo to Supabase Storage.
   */
  async uploadLogo(file: File): Promise<{ logoUrl: string; storagePath: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const res: any = await apiClient.post('/host/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};
