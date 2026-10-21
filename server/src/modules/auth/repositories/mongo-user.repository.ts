import mongoose from 'mongoose';
import { UserModel, IUserDocument, IUser, PlatformRole, UserStatus } from '../../../db/mongo/models/user.model';

const resolveUserFilter = (id: string) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [{ _id: id }, { supabaseUserId: id }] };
  }
  return { supabaseUserId: id };
};

export class MongoUserRepository {
  /**
   * Find user document by ID (supports MongoDB _id, custom-auth generatedId, or legacy Supabase Auth UID).
   */
  async findById(id: string): Promise<IUserDocument | null> {
    if (!id) return null;
    return UserModel.findOne(resolveUserFilter(id)).exec();
  }

  /**
   * Alias for backwards compatibility with legacy callers.
   * Resolves by ID without requiring Supabase Auth.
   */
  async findBySupabaseId(id: string): Promise<IUserDocument | null> {
    return this.findById(id);
  }

  /**
   * Find user document by canonical lowercase email.
   */
  async findByEmail(email: string): Promise<IUserDocument | null> {
    if (!email) return null;
    return UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /**
   * Create a new user document.
   */
  async create(userData: Partial<IUser>): Promise<IUserDocument> {
    const user = new UserModel({
      ...userData,
      email: userData.email?.toLowerCase().trim(),
      platformRole: userData.platformRole || 'USER',
      status: userData.status || 'ACTIVE',
    });
    return user.save();
  }

  /**
   * Upsert user document by unique identifier or email.
   * If creating a new user, defaults to 'USER' role unless explicitly specified.
   * If updating an existing user, preserves existing platformRole if omitted.
   */
  async upsert(userData: {
    supabaseUserId: string;
    email: string;
    name?: string;
    platformRole?: PlatformRole;
    phone?: string;
    avatarUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<IUserDocument> {
    const canonicalEmail = userData.email.toLowerCase().trim();

    const existingUser = await UserModel.findOne({
      $or: [{ supabaseUserId: userData.supabaseUserId }, { email: canonicalEmail }],
    }).exec();

    if (existingUser) {
      if (userData.name) existingUser.name = userData.name;
      if (userData.phone !== undefined) existingUser.phone = userData.phone;
      if (userData.avatarUrl !== undefined) existingUser.avatarUrl = userData.avatarUrl;
      if (userData.metadata) existingUser.metadata = { ...existingUser.metadata, ...userData.metadata };
      if (userData.platformRole) existingUser.platformRole = userData.platformRole;
      if (userData.supabaseUserId) existingUser.supabaseUserId = userData.supabaseUserId;
      existingUser.email = canonicalEmail;
      return existingUser.save();
    }

    return this.create({
      supabaseUserId: userData.supabaseUserId,
      email: canonicalEmail,
      name: userData.name || 'User',
      platformRole: userData.platformRole || 'USER',
      status: 'ACTIVE',
      phone: userData.phone,
      avatarUrl: userData.avatarUrl,
      metadata: userData.metadata || {},
    });
  }

  /**
   * Update user platform role.
   */
  async updateRole(userId: string, role: PlatformRole): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      resolveUserFilter(userId),
      { $set: { platformRole: role } },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Update user personal profile attributes (name, phone, avatarUrl, bio, preferences, privacy).
   */
  async updatePersonalProfile(
    userId: string,
    data: {
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      bio?: string | null;
      preferences?: Record<string, any>;
      privacy?: Record<string, any>;
    }
  ): Promise<IUserDocument | null> {
    const update: any = {};
    if (data.name) update.name = data.name.trim();
    if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
    if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) update['metadata.bio'] = data.bio?.trim() || null;
    if (data.preferences !== undefined) update['metadata.preferences'] = data.preferences;
    if (data.privacy !== undefined) update['metadata.privacy'] = data.privacy;

    return UserModel.findOneAndUpdate(
      resolveUserFilter(userId),
      { $set: update },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Update user account status (ACTIVE vs SUSPENDED).
   */
  async updateStatus(userId: string, status: UserStatus): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      resolveUserFilter(userId),
      { $set: { status } },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Update user password hash.
   */
  async updatePasswordHash(userId: string, passwordHash: string): Promise<IUserDocument | null> {
    return UserModel.findOneAndUpdate(
      resolveUserFilter(userId),
      { $set: { passwordHash } },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * List users with explicit ordering and pagination.
   */
  async listUsers(filter: Record<string, any> = {}, limit = 50, skip = 0): Promise<IUserDocument[]> {
    return UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Complete initial host onboarding for user by user ID.
   * Atomically sets hostProfile and initializes workspaceStatus to 'ACTIVE'.
   * Never mutates platformRole.
   */
  async completeOnboarding(
    userId: string,
    profile: {
      organizationName: string;
      institutionType: 'COLLEGE_UNIVERSITY' | 'CORPORATE' | 'COMMUNITY_CLUB' | 'INDEPENDENT';
      institutionName?: string | null;
      website?: string | null;
      phone?: string | null;
      bio?: string | null;
      logoUrl?: string | null;
      onboardedAt?: Date;
    }
  ): Promise<IUserDocument | null> {
    const onboardedAt = profile.onboardedAt || new Date();
    return UserModel.findOneAndUpdate(
      resolveUserFilter(userId),
      {
        $set: {
          hostProfile: {
            organizationName: profile.organizationName.trim(),
            institutionType: profile.institutionType,
            institutionName: profile.institutionName?.trim() || null,
            website: profile.website?.trim() || null,
            phone: profile.phone?.trim() || null,
            bio: profile.bio?.trim() || null,
            logoUrl: profile.logoUrl?.trim() || null,
            onboardedAt,
          },
          workspaceStatus: 'ACTIVE',
          hostVerificationStatus: 'UNVERIFIED',
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Update existing host profile fields atomically without resetting onboardedAt or unrelated fields.
   */
  async updateHostProfile(
    userId: string,
    updates: Partial<{
      organizationName: string;
      institutionType: 'COLLEGE_UNIVERSITY' | 'CORPORATE' | 'COMMUNITY_CLUB' | 'INDEPENDENT';
      institutionName: string | null;
      website: string | null;
      phone: string | null;
      bio: string | null;
      logoUrl: string | null;
    }>
  ): Promise<IUserDocument | null> {
    const setFields: Record<string, any> = {};

    if (updates.organizationName !== undefined) {
      setFields['hostProfile.organizationName'] = updates.organizationName.trim();
    }
    if (updates.institutionType !== undefined) {
      setFields['hostProfile.institutionType'] = updates.institutionType;
    }
    if (updates.institutionName !== undefined) {
      setFields['hostProfile.institutionName'] = updates.institutionName ? updates.institutionName.trim() : null;
    }
    if (updates.website !== undefined) {
      setFields['hostProfile.website'] = updates.website ? updates.website.trim() : null;
    }
    if (updates.phone !== undefined) {
      setFields['hostProfile.phone'] = updates.phone ? updates.phone.trim() : null;
    }
    if (updates.bio !== undefined) {
      setFields['hostProfile.bio'] = updates.bio ? updates.bio.trim() : null;
    }
    if (updates.logoUrl !== undefined) {
      setFields['hostProfile.logoUrl'] = updates.logoUrl ? updates.logoUrl.trim() : null;
    }

    if (Object.keys(setFields).length === 0) {
      return this.findById(userId);
    }

    return UserModel.findOneAndUpdate(
      resolveUserFilter(userId),
      { $set: setFields },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Count user documents matching filter.
   */
  async count(filter: Record<string, any> = {}): Promise<number> {
    return UserModel.countDocuments(filter).exec();
  }
}

export const mongoUserRepository = new MongoUserRepository();
export default mongoUserRepository;
