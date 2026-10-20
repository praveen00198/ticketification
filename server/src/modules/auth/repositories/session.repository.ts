import { SessionModel, ISessionDocument } from '../../../db/mongo/models/session.model';
import mongoose from 'mongoose';
import crypto from 'crypto';

export class SessionRepository {
  /**
   * Hashes a raw refresh token using SHA-256 for secure database storage.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Creates a new session record in MongoDB.
   */
  async createSession(data: {
    userId: string;
    refreshToken: string;
    familyId?: string;
    expiresInDays?: number;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<ISessionDocument> {
    const tokenHash = this.hashToken(data.refreshToken);
    const familyId = data.familyId || crypto.randomUUID();
    const expiresInDays = data.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const session = new SessionModel({
      userId: data.userId,
      tokenHash,
      familyId,
      expiresAt,
      userAgent: data.userAgent || null,
      ipAddress: data.ipAddress || null,
    });

    if (mongoose.connection.readyState !== 1) {
      return session;
    }

    return session.save();
  }

  /**
   * Finds an active session by raw refresh token.
   */
  async findByToken(refreshToken: string): Promise<ISessionDocument | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }
    const tokenHash = this.hashToken(refreshToken);
    return SessionModel.findOne({ tokenHash }).exec();
  }

  /**
   * Revokes a single session by raw refresh token or token hash.
   */
  async revokeSession(tokenOrHash: string, replacedBy?: string): Promise<ISessionDocument | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }
    const tokenHash = tokenOrHash.length === 64 ? tokenOrHash : this.hashToken(tokenOrHash);
    return SessionModel.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date(), replacedBy: replacedBy || null } },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Revokes all sessions in a token family (used for refresh token reuse detection).
   */
  async revokeFamily(familyId: string): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    await SessionModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    ).exec();
  }

  /**
   * Revokes all active sessions for a user (e.g. on password change or full logout).
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    await SessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    ).exec();
  }
}

export const sessionRepository = new SessionRepository();
export default sessionRepository;
