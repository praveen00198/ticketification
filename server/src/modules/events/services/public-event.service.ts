import mongoose from 'mongoose';
import {
  MongoEventRepository,
  mongoEventRepository,
  PublicEventQueryOptions,
  PaginatedEventsResult,
} from '../repositories/mongo-event.repository';
import {
  MongoEventReportRepository,
  mongoEventReportRepository,
} from '../repositories/mongo-event-report.repository';
import {
  MongoUserRepository,
  mongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  MongoEventRegistrationRepository,
  mongoEventRegistrationRepository,
} from '../repositories/mongo-event-registration.repository';
import { AuditService } from './audit.service';
import { REPORT_CATEGORIES, ReportCategory } from '../../../db/mongo/models/event-report.model';
import { IEventDocument } from '../../../db/mongo/models/event.model';
import { IUserDocument } from '../../../db/mongo/models/user.model';

export interface SubmitReportDTO {
  reporterEmail: string;
  reporterName?: string;
  reporterUserId?: string;
  category: ReportCategory;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicHostProfile {
  id: string;
  name: string;
  organizationName: string;
  institutionType: string;
  institutionName?: string | null;
  bio?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  hostVerificationStatus: string;
}

export interface SanitizedPublicEvent {
  id: string;
  name: string;
  eventType: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology: string;
  attendanceMode: string;
  venue: any;
  schedule: any;
  registration?: any;
  status: string;
  verificationLevel?: string;
  verificationStatus?: string;
  createdAt?: Date;
}

export class PublicEventService {
  constructor(
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private reportRepo: MongoEventReportRepository = mongoEventReportRepository,
    private userRepo: MongoUserRepository = mongoUserRepository,
    private registrationRepo: MongoEventRegistrationRepository = mongoEventRegistrationRepository,
    private auditService: AuditService = new AuditService()
  ) {}

  /**
   * Helper to format an event document for public consumption.
   */
  private formatPublicEvent(event: IEventDocument): SanitizedPublicEvent {
    const rawId = event._id ? event._id.toString() : (event as any).id ? String((event as any).id) : '';
    return {
      id: rawId,
      name: event.name,
      eventType: event.eventType,
      description: event.description,
      bannerUrl: event.bannerUrl,
      credentialTerminology: event.credentialTerminology,
      attendanceMode: event.attendanceMode,
      venue: event.venue,
      schedule: event.schedule,
      registration: event.registration,
      status: event.status,
      verificationLevel: event.verificationLevel || 'UNVERIFIED',
      verificationStatus: event.verificationStatus || 'UNVERIFIED',
      createdAt: event.createdAt,
    };
  }

  /**
   * Helper to format host profile safely without PII.
   */
  private formatPublicHost(
    user: IUserDocument | null,
    eventOrg?: { name?: string; institutionType?: string; websiteUrl?: string },
    fallbackName = 'Event Host'
  ): PublicHostProfile {
    const orgName = eventOrg?.name || user?.hostProfile?.organizationName || user?.name || fallbackName;
    const instType = eventOrg?.institutionType || user?.hostProfile?.institutionType || 'INDEPENDENT';
    const website = eventOrg?.websiteUrl || user?.hostProfile?.website || null;

    if (!user) {
      return {
        id: 'unknown',
        name: fallbackName,
        organizationName: orgName,
        institutionType: instType,
        institutionName: null,
        bio: null,
        website,
        logoUrl: null,
        hostVerificationStatus: 'UNVERIFIED',
      };
    }

    return {
      id: user._id.toString(),
      name: user.name || 'Event Host',
      organizationName: orgName,
      institutionType: instType,
      institutionName: user.hostProfile?.institutionName || null,
      bio: user.hostProfile?.bio || null,
      website,
      logoUrl: user.hostProfile?.logoUrl || user.avatarUrl || null,
      hostVerificationStatus: user.hostVerificationStatus || 'UNVERIFIED',
    };
  }

  private publicEventsCache = new Map<string, { data: any; expiresAt: number }>();

  /**
   * Search and filter public catalog events with 15s in-memory TTL cache.
   */
  async getPublicEvents(options: PublicEventQueryOptions = {}): Promise<{
    events: SanitizedPublicEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = JSON.stringify(options);
    const cached = this.publicEventsCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const result = await this.eventRepo.findPublicEvents(options);

    const formatted = {
      events: result.events.map((e) => this.formatPublicEvent(e)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };

    // Cache for 15 seconds to withstand traffic spikes
    this.publicEventsCache.set(cacheKey, {
      data: formatted,
      expiresAt: now + 15000,
    });

    // Cleanup old keys if map exceeds 500 entries
    if (this.publicEventsCache.size > 500) {
      for (const [key, entry] of this.publicEventsCache.entries()) {
        if (entry.expiresAt <= now) {
          this.publicEventsCache.delete(key);
        }
      }
    }

    return formatted;
  }

  /**
   * Retrieve a single public event with its host profile and live capacity metrics.
   */
  async getPublicEventById(eventId: string): Promise<{
    event: SanitizedPublicEvent;
    host: PublicHostProfile;
    metrics: {
      confirmedCount: number;
      remainingCapacity: number | null;
      isSoldOut: boolean;
    };
  } | null> {
    const event = await this.eventRepo.findPublicById(eventId);
    if (!event) {
      return null;
    }

    // Resolve host details
    let hostDoc: IUserDocument | null = null;
    if (event.ownerId && mongoose.Types.ObjectId.isValid(event.ownerId.toString())) {
      hostDoc = await this.userRepo.findById(event.ownerId.toString());
    }
    if (!hostDoc && event.ownerSupabaseId) {
      hostDoc = await this.userRepo.findBySupabaseId(event.ownerSupabaseId);
    }

    // Capacity metrics
    const confirmedCount = await this.registrationRepo.countByEvent(
      event._id.toString(),
      ['CONFIRMED', 'ATTENDED']
    );

    const totalCapacity = event.registration?.capacity || null;
    const remainingCapacity = totalCapacity ? Math.max(0, totalCapacity - confirmedCount) : null;
    const isSoldOut = Boolean(totalCapacity && confirmedCount >= totalCapacity);

    return {
      event: this.formatPublicEvent(event),
      host: this.formatPublicHost(hostDoc, event.organization),
      metrics: {
        confirmedCount,
        remainingCapacity,
        isSoldOut,
      },
    };
  }

  /**
   * Retrieve an organizer's public profile and their active public events.
   */
  async getPublicHostProfile(hostIdentifier: string): Promise<{
    host: PublicHostProfile;
    events: SanitizedPublicEvent[];
  } | null> {
    let hostDoc: IUserDocument | null = null;
    if (mongoose.Types.ObjectId.isValid(hostIdentifier)) {
      hostDoc = await this.userRepo.findById(hostIdentifier);
    }
    if (!hostDoc) {
      hostDoc = await this.userRepo.findBySupabaseId(hostIdentifier);
    }

    if (!hostDoc) {
      return null;
    }

    const publicEvents = await this.eventRepo.findPublicByHost(hostIdentifier);

    return {
      host: this.formatPublicHost(hostDoc),
      events: publicEvents.map((e) => this.formatPublicEvent(e)),
    };
  }

  /**
   * Submit a Trust & Safety abuse/scam report against an event.
   */
  async reportEvent(eventId: string, dto: SubmitReportDTO): Promise<{
    success: boolean;
    reportId: string;
    message: string;
  }> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new Error('Invalid event ID format');
    }

    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (!dto.reporterEmail || !dto.reporterEmail.includes('@')) {
      throw new Error('A valid reporter email address is required');
    }

    if (!REPORT_CATEGORIES.includes(dto.category)) {
      throw new Error(`Invalid report category. Must be one of: ${REPORT_CATEGORIES.join(', ')}`);
    }

    const cleanReason = (dto.reason || '').trim();
    if (cleanReason.length < 10) {
      throw new Error('Please provide at least 10 characters explaining your report');
    }
    if (cleanReason.length > 1000) {
      throw new Error('Reason cannot exceed 1000 characters');
    }

    const report = await this.reportRepo.create({
      eventId: event._id,
      reporterEmail: dto.reporterEmail.toLowerCase().trim(),
      reporterName: dto.reporterName?.trim() || null,
      reporterUserId: dto.reporterUserId || null,
      category: dto.category,
      reason: cleanReason,
      status: 'PENDING',
      ipAddress: dto.ipAddress || '127.0.0.1',
      userAgent: dto.userAgent || 'unknown',
    });

    // Record immutable audit entry
    await this.auditService.record({
      actorId: dto.reporterUserId || 'anonymous',
      actorEmail: dto.reporterEmail.toLowerCase().trim(),
      actorRole: 'ANONYMOUS_REPORTER',
      eventId: event._id.toString(),
      action: 'EVENT_REPORTED',
      targetEntity: 'EVENT',
      targetId: event._id.toString(),
      metadata: {
        reportId: report._id.toString(),
        category: dto.category,
        reasonSummary: cleanReason.substring(0, 100),
      },
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

    return {
      success: true,
      reportId: report._id.toString(),
      message: 'Report submitted successfully. Our Trust & Safety team will review this event.',
    };
  }
}

export const publicEventService = new PublicEventService();
export default publicEventService;
