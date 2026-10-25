import crypto from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import {
  mongoEventVerificationRepository,
  MongoEventVerificationRepository,
} from '../repositories/mongo-event-verification.repository';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  supabaseStorageService,
  SupabaseStorageService,
} from '../../tickets/services/supabase-storage.service';
import {
  mongoUserRepository,
  MongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  IEventVerificationDocument,
  InstitutionType,
  VerificationRiskTier,
} from '../../../db/mongo/models/event-verification.model';
import { IEventDocument } from '../../../db/mongo/models/event.model';
import { auditService } from './audit.service';

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
]);

export interface SaveVerificationDraftDTO {
  institutionName: string;
  institutionType?: InstitutionType;
  officialEmail: string;
  department: string;
  designation: string;
  websiteUrl?: string;
}

export interface RiskEvaluationResult {
  score: number;
  tier: VerificationRiskTier;
  factors: string[];
}

export class EventVerificationService {
  constructor(
    private verificationRepo: MongoEventVerificationRepository = mongoEventVerificationRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private storageService: SupabaseStorageService = supabaseStorageService,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Calculate risk score and tier based on PRD Section 5.2 heuristics.
   */
  calculateRisk(
    event: IEventDocument,
    verification: {
      officialEmail?: string;
      otpVerified?: boolean;
      documentUrls?: string[];
    }
  ): RiskEvaluationResult {
    let score = 0;
    const factors: string[] = [];

    // 1. Pricing Model Risk
    const isPaid = event.registration?.pricingModel === 'PAID';
    if (isPaid) {
      score += 40;
      factors.push('PAID_EVENT_FINANCIAL_EXPOSURE');
    }

    // 2. Capacity Risk
    const capacity = event.registration?.capacity || 0;
    if (capacity > 2000) {
      score += 30;
      factors.push('LARGE_SCALE_CAPACITY_OVER_2000');
    } else if (capacity >= 200) {
      score += 15;
      factors.push('MEDIUM_SCALE_CAPACITY_200_TO_2000');
    }

    // 3. Email & Domain Verification
    const email = (verification.officialEmail || '').trim().toLowerCase();
    const domain = email.split('@')[1] || '';
    const isPublicDomain = PUBLIC_EMAIL_DOMAINS.has(domain);

    if (verification.otpVerified) {
      if (domain && !isPublicDomain) {
        score -= 20; // Verified institutional domain discount
      } else {
        score += 20;
        factors.push('PUBLIC_WEBMAIL_DOMAIN_USED');
      }
    } else {
      score += 25;
      factors.push('UNVERIFIED_EMAIL_OTP');
    }

    // 4. Verification Documents
    const docs = verification.documentUrls || [];
    if (docs.length > 0) {
      score -= 15; // Authorization evidence provided
    } else {
      score += 25;
      factors.push('MISSING_AUTHORIZATION_DOCUMENTS');
    }

    // Bound score to [0, 100]
    score = Math.max(0, Math.min(100, score));

    let tier: VerificationRiskTier = 'LOW';
    if (score > 60) {
      tier = 'HIGH';
    } else if (score >= 25) {
      tier = 'MEDIUM';
    } else {
      tier = 'LOW';
    }

    return { score, tier, factors };
  }

  /**
   * Ensure caller owns the event.
   */
  private async getAuthorizedEvent(eventId: string, userId: string): Promise<IEventDocument> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.ownerId.toString() !== userId && event.ownerSupabaseId !== userId) {
      throw new AppError('You are not authorized to manage verification for this event.', 403);
    }

    return event;
  }

  /**
   * Get verification status for an event (Owner or Admin).
   */
  async getVerification(
    eventId: string,
    userId: string,
    isAdmin = false
  ): Promise<{
    verification: IEventVerificationDocument | null;
    event: IEventDocument;
    previewRisk: RiskEvaluationResult;
  }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!isAdmin && event.ownerId.toString() !== userId && event.ownerSupabaseId !== userId) {
      throw new AppError('Unauthorized access to event verification', 403);
    }

    const verification = await this.verificationRepo.findByEventId(eventId);
    const previewRisk = this.calculateRisk(event, {
      officialEmail: verification?.officialEmail,
      otpVerified: verification?.otpVerified,
      documentUrls: verification?.documentUrls,
    });

    return { verification, event, previewRisk };
  }

  /**
   * Save or update draft verification details.
   */
  async saveDraft(
    eventId: string,
    userId: string,
    payload: SaveVerificationDraftDTO
  ): Promise<IEventVerificationDocument> {
    const event = await this.getAuthorizedEvent(eventId, userId);

    if (!payload.institutionName?.trim()) {
      throw new AppError('Institution name is required.', 400);
    }
    if (!payload.officialEmail?.trim() || !payload.officialEmail.includes('@')) {
      throw new AppError('A valid official email is required.', 400);
    }
    if (!payload.department?.trim()) {
      throw new AppError('Department is required.', 400);
    }
    if (!payload.designation?.trim()) {
      throw new AppError('Designation is required.', 400);
    }

    const existingVerification = await this.verificationRepo.findByEventId(eventId);

    // If official email changed, reset OTP verification
    const emailChanged =
      existingVerification &&
      existingVerification.officialEmail.toLowerCase() !== payload.officialEmail.trim().toLowerCase();

    const dataToSave = {
      institutionName: payload.institutionName.trim(),
      institutionType: payload.institutionType || 'COLLEGE_UNIVERSITY',
      officialEmail: payload.officialEmail.trim().toLowerCase(),
      department: payload.department.trim(),
      designation: payload.designation.trim(),
      websiteUrl: payload.websiteUrl?.trim() || undefined,
      ...(emailChanged ? { otpVerified: false } : {}),
    };

    return this.verificationRepo.upsertDraft(event._id, event.ownerId, dataToSave);
  }

  /**
   * Send 6-digit OTP to the official institutional email.
   */
  async sendOtp(
    eventId: string,
    userId: string,
    officialEmail: string
  ): Promise<{ success: boolean; message: string; devOtp?: string }> {
    const event = await this.getAuthorizedEvent(eventId, userId);

    const email = (officialEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.length < 5) {
      throw new AppError('A valid official institutional email is required.', 400);
    }

    // Ensure draft exists
    await this.verificationRepo.upsertDraft(event._id, event.ownerId, {
      institutionName: event.name,
      department: 'General',
      designation: 'Host',
      officialEmail: email,
    });

    // Generate cryptographic 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.verificationRepo.updateOtp(event._id, email, otpHash, otpExpiresAt);

    console.log(`[EventVerificationService] 🔑 OTP for ${email} (Event: ${event._id}): ${rawOtp}`);

    const isDevOrTest = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      message: `Verification code sent to ${email}. Valid for 10 minutes.`,
      ...(isDevOrTest ? { devOtp: rawOtp } : {}),
    };
  }

  /**
   * Verify the 6-digit OTP for institutional email proof.
   */
  async verifyOtp(
    eventId: string,
    userId: string,
    code: string
  ): Promise<{ success: boolean; message: string }> {
    const event = await this.getAuthorizedEvent(eventId, userId);

    if (!code || code.trim().length !== 6) {
      throw new AppError('Please enter a valid 6-digit verification code.', 400);
    }

    const verification = await this.verificationRepo.findByEventIdWithSecrets(event._id);
    if (!verification || !verification.otpHash || !verification.otpExpiresAt) {
      throw new AppError('No verification code has been requested. Please request a new code.', 400);
    }

    if (new Date() > verification.otpExpiresAt) {
      throw new AppError('Verification code has expired. Please request a new code.', 400);
    }

    const incomingHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(incomingHash, 'hex'),
      Buffer.from(verification.otpHash, 'hex')
    );

    if (!isValid) {
      throw new AppError('Invalid verification code. Please check and try again.', 400);
    }

    await this.verificationRepo.markOtpVerified(event._id);

    return {
      success: true,
      message: 'Official institutional email verified successfully.',
    };
  }

  /**
   * Upload an official verification document (authorization letter / approval notice).
   */
  async uploadDocument(
    eventId: string,
    userId: string,
    fileData: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ documentUrl: string; filename: string }> {
    const event = await this.getAuthorizedEvent(eventId, userId);

    const { publicUrl } = await this.storageService.uploadVerificationDocument(
      event._id.toString(),
      fileData,
      filename,
      mimeType
    );

    await this.verificationRepo.upsertDraft(event._id, event.ownerId, {
      institutionName: event.name,
      department: 'General',
      designation: 'Host',
      officialEmail: 'pending@host.com',
    });

    await this.verificationRepo.addDocumentUrl(event._id, publicUrl);

    return {
      documentUrl: publicUrl,
      filename,
    };
  }

  /**
   * Remove a verification document.
   */
  async removeDocument(
    eventId: string,
    userId: string,
    documentUrl: string
  ): Promise<{ success: boolean }> {
    const event = await this.getAuthorizedEvent(eventId, userId);
    await this.verificationRepo.removeDocumentUrl(event._id, documentUrl);
    return { success: true };
  }

  /**
   * Submit event verification for Platform Admin review.
   */
  async submitVerification(
    eventId: string,
    userId: string
  ): Promise<{
    verification: IEventVerificationDocument;
    riskTier: VerificationRiskTier;
    message: string;
  }> {
    const event = await this.getAuthorizedEvent(eventId, userId);

    const verification = await this.verificationRepo.findByEventId(event._id);
    if (!verification) {
      throw new AppError('Please complete the verification form before submitting.', 400);
    }

    if (!verification.institutionName?.trim()) {
      throw new AppError('Institution name is required.', 400);
    }
    if (!verification.department?.trim() || !verification.designation?.trim()) {
      throw new AppError('Department and designation are required.', 400);
    }

    // Require verified OTP
    if (!verification.otpVerified) {
      throw new AppError(
        'Please verify your official institutional email with the 6-digit code before submitting.',
        400
      );
    }

    // Mandatory document rule for Paid or high capacity events
    const isPaid = event.registration?.pricingModel === 'PAID';
    const isHighCapacity = (event.registration?.capacity || 0) > 2000;
    if ((isPaid || isHighCapacity) && (!verification.documentUrls || verification.documentUrls.length === 0)) {
      throw new AppError(
        'Paid events and events with capacity over 2,000 require at least one official authorization document.',
        400
      );
    }

    // Calculate authoritative risk tier
    const risk = this.calculateRisk(event, {
      officialEmail: verification.officialEmail,
      otpVerified: verification.otpVerified,
      documentUrls: verification.documentUrls,
    });

    const updatedVerification = await this.verificationRepo.submitVerification(
      event._id,
      risk.score,
      risk.tier,
      risk.factors
    );

    // Update event verification status to PENDING
    event.verificationStatus = 'PENDING';
    event.status = 'SUBMITTED';
    await event.save();

    return {
      verification: updatedVerification!,
      riskTier: risk.tier,
      message: `Event verification submitted successfully for review (Assigned Tier: ${risk.tier}).`,
    };
  }

  /**
   * Review verification (Platform Admin only).
   */
  async reviewVerification(
    eventId: string,
    adminUserId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNotes?: string
  ): Promise<{
    verification: IEventVerificationDocument;
    event: IEventDocument;
    message: string;
  }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const verification = await this.verificationRepo.findByEventId(event._id);
    if (!verification) {
      throw new AppError('No verification request found for this event.', 404);
    }

    let adminObjectId: mongoose.Types.ObjectId;
    if (mongoose.Types.ObjectId.isValid(adminUserId)) {
      adminObjectId = new mongoose.Types.ObjectId(adminUserId);
    } else {
      const adminUser = await this.userRepo.findBySupabaseId(adminUserId);
      adminObjectId = adminUser?._id
        ? new mongoose.Types.ObjectId(adminUser._id)
        : new mongoose.Types.ObjectId();
    }
    const targetStatus = decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';

    const updatedVerification = await this.verificationRepo.reviewVerification(
      event._id,
      targetStatus,
      adminObjectId,
      reviewNotes
    );

    if (decision === 'APPROVED') {
      event.verificationStatus = 'VERIFIED';
      event.organizationVerificationStatus = 'APPROVED';
      event.verificationLevel = verification.riskTier;

      // Automatic publication check:
      // If the event was SUBMITTED and satisfies publication readiness criteria:
      // (valid name, valid schedule start date, and endAt >= startAt),
      // transition to PUBLISHED. Otherwise, transition to APPROVED so host can publish when ready.
      const hasValidName = !!(event.name && event.name.trim());
      const hasValidSchedule = !!(
        event.schedule?.startAt &&
        (!event.schedule?.endAt || new Date(event.schedule.endAt) >= new Date(event.schedule.startAt))
      );
      const isCompleteAndReady = hasValidName && hasValidSchedule;

      if (event.status === 'SUBMITTED' && isCompleteAndReady) {
        event.status = 'PUBLISHED';
        event.statusHistory = event.statusHistory || [];
        event.statusHistory.push({
          fromStatus: 'SUBMITTED',
          toStatus: 'PUBLISHED',
          changedBy: adminObjectId,
          changedBySupabaseId: adminUserId,
          reason: reviewNotes || 'Auto-published upon organization verification approval',
          timestamp: new Date(),
        });
      } else {
        const prevStatus = event.status;
        event.status = 'APPROVED';
        event.statusHistory = event.statusHistory || [];
        event.statusHistory.push({
          fromStatus: prevStatus,
          toStatus: 'APPROVED',
          changedBy: adminObjectId,
          changedBySupabaseId: adminUserId,
          reason: reviewNotes || 'Verification approved',
          timestamp: new Date(),
        });
      }
    } else {
      const prevStatus = event.status;
      event.verificationStatus = 'REJECTED';
      event.organizationVerificationStatus = 'REJECTED';
      event.status = 'DRAFT';
      event.statusHistory = event.statusHistory || [];
      event.statusHistory.push({
        fromStatus: prevStatus,
        toStatus: 'DRAFT',
        changedBy: adminObjectId,
        changedBySupabaseId: adminUserId,
        reason: reviewNotes || 'Verification rejected',
        timestamp: new Date(),
      });
    }
    await event.save();

    // Immutable audit log
    try {
      await auditService.record({
        actorId: adminObjectId,
        actorEmail: 'admin@ticketification.internal',
        actorRole: 'ADMIN',
        eventId: event._id,
        action: `EVENT_VERIFICATION_${decision}`,
        targetEntity: 'EventVerification',
        targetId: verification?._id?.toString() || String(event._id),
        metadata: {
          decision,
          reviewNotes,
          riskTier: verification?.riskTier || 'UNVERIFIED',
          newStatus: event.status,
          verificationStatus: event.verificationStatus,
        },
      });
    } catch (auditErr) {
      console.warn('[EventVerificationService] Audit log record warning:', auditErr);
    }

    return {
      verification: updatedVerification!,
      event,
      message: `Event verification has been ${decision === 'APPROVED' ? 'approved' : 'rejected'}.`,
    };
  }

  /**
   * List verifications for platform admins.
   */
  async listAdminVerifications(params?: {
    status?: any;
    riskTier?: any;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const { verifications, total } = await this.verificationRepo.listVerifications({
      status: params?.status,
      riskTier: params?.riskTier,
      limit,
      skip,
    });

    return {
      verifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const eventVerificationService = new EventVerificationService();
