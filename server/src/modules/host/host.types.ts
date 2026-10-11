import { InstitutionType, WorkspaceStatus, HostVerificationStatus, IHostProfile } from '../../db/mongo/models/user.model';

export { InstitutionType, WorkspaceStatus, HostVerificationStatus, IHostProfile };

export interface OnboardingInput {
  organizationName: string;
  institutionType: InstitutionType;
  institutionName?: string | null;
  website?: string | null;
  phone?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
}

export interface UpdateHostProfileInput {
  organizationName?: string;
  institutionType?: InstitutionType;
  institutionName?: string | null;
  website?: string | null;
  phone?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
}

export interface HostProfileResponse {
  isOnboarded: boolean;
  hostProfile: IHostProfile | null;
  workspaceStatus: WorkspaceStatus;
  verificationStatus: HostVerificationStatus;
}
