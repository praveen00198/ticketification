import mongoose from 'mongoose';
import {
  EventVerificationModel,
  IEventVerificationDocument,
  IEventVerification,
  VerificationRiskTier,
  VerificationStatus,
} from '../../../db/mongo/models/event-verification.model';

export class MongoEventVerificationRepository {
  /**
   * Create or update verification record.
   */
  async createVerification(data: Partial<IEventVerification>): Promise<IEventVerificationDocument> {
    if (data.eventId) {
      const existing = await EventVerificationModel.findOne({ eventId: data.eventId });
      if (existing) {
        Object.assign(existing, data);
        return existing.save();
      }
    }
    return EventVerificationModel.create(data);
  }
  /**
   * Find verification by eventId.
   */
  async findByEventId(
    eventId: string | mongoose.Types.ObjectId
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOne({ eventId: objectId });
  }

  /**
   * Find verification by eventId including otpHash and otpExpiresAt (for verification checks).
   */
  async findByEventIdWithSecrets(
    eventId: string | mongoose.Types.ObjectId
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOne({ eventId: objectId }).select('+otpHash +otpExpiresAt');
  }

  /**
   * Find verification scoped to owner (IDOR protection).
   */
  async findByEventIdAndOwner(
    eventId: string | mongoose.Types.ObjectId,
    ownerId: string | mongoose.Types.ObjectId
  ): Promise<IEventVerificationDocument | null> {
    const eventObjId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    const ownerObjId = typeof ownerId === 'string' ? new mongoose.Types.ObjectId(ownerId) : ownerId;
    return EventVerificationModel.findOne({ eventId: eventObjId, ownerId: ownerObjId });
  }

  /**
   * Upsert draft verification record.
   */
  async upsertDraft(
    eventId: string | mongoose.Types.ObjectId,
    ownerId: string | mongoose.Types.ObjectId,
    data: Partial<IEventVerification>
  ): Promise<IEventVerificationDocument> {
    const eventObjId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    const ownerObjId = typeof ownerId === 'string' ? new mongoose.Types.ObjectId(ownerId) : ownerId;

    const existing = await EventVerificationModel.findOne({ eventId: eventObjId });
    if (existing) {
      Object.assign(existing, data);
      return existing.save();
    }

    return EventVerificationModel.create({
      ...data,
      eventId: eventObjId,
      ownerId: ownerObjId,
      status: 'DRAFT',
    });
  }

  /**
   * Update OTP details.
   */
  async updateOtp(
    eventId: string | mongoose.Types.ObjectId,
    officialEmail: string,
    otpHash: string,
    otpExpiresAt: Date
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOneAndUpdate(
      { eventId: objectId },
      {
        $set: {
          officialEmail: officialEmail.toLowerCase().trim(),
          otpHash,
          otpExpiresAt,
          otpVerified: false,
        },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Mark OTP as verified.
   */
  async markOtpVerified(
    eventId: string | mongoose.Types.ObjectId
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOneAndUpdate(
      { eventId: objectId },
      {
        $set: {
          otpVerified: true,
        },
        $unset: {
          otpHash: 1,
          otpExpiresAt: 1,
        },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Add a document URL to the verification record.
   */
  async addDocumentUrl(
    eventId: string | mongoose.Types.ObjectId,
    documentUrl: string
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOneAndUpdate(
      { eventId: objectId },
      {
        $addToSet: { documentUrls: documentUrl },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Remove a document URL from the verification record.
   */
  async removeDocumentUrl(
    eventId: string | mongoose.Types.ObjectId,
    documentUrl: string
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOneAndUpdate(
      { eventId: objectId },
      {
        $pull: { documentUrls: documentUrl },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Submit verification for admin review.
   */
  async submitVerification(
    eventId: string | mongoose.Types.ObjectId,
    riskScore: number,
    riskTier: VerificationRiskTier,
    riskFactors: string[]
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOneAndUpdate(
      { eventId: objectId },
      {
        $set: {
          status: 'PENDING',
          riskScore,
          riskTier,
          riskFactors,
          submittedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Review verification (Admin action).
   */
  async reviewVerification(
    eventId: string | mongoose.Types.ObjectId,
    status: 'VERIFIED' | 'REJECTED',
    reviewedBy: mongoose.Types.ObjectId,
    reviewNotes?: string
  ): Promise<IEventVerificationDocument | null> {
    const objectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    return EventVerificationModel.findOneAndUpdate(
      { eventId: objectId },
      {
        $set: {
          status,
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || undefined,
        },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Query verifications for platform admins.
   */
  async listVerifications(params?: {
    status?: VerificationStatus;
    riskTier?: VerificationRiskTier;
    limit?: number;
    skip?: number;
  }): Promise<{ verifications: IEventVerificationDocument[]; total: number }> {
    const filter: Record<string, any> = {};
    if (params?.status) filter.status = params.status;
    if (params?.riskTier) filter.riskTier = params.riskTier;

    const limit = params?.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
    const skip = params?.skip && params.skip >= 0 ? params.skip : 0;

    const [verifications, total] = await Promise.all([
      EventVerificationModel.find(filter)
        .populate('ownerId', 'name email')
        .populate('eventId', 'name eventType schedule status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EventVerificationModel.countDocuments(filter),
    ]);

    return { verifications, total };
  }
}

export const mongoEventVerificationRepository = new MongoEventVerificationRepository();
