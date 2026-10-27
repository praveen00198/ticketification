import { eventRepository, EventRepository, CreateEventInput, UpdateEventInput } from '../repositories/event.repository';
import { mongoEventRepository, MongoEventRepository, EventQueryOptions, PaginatedEventsResult } from '../repositories/mongo-event.repository';
import { ticketTypeRepository, TicketTypeRepository, CreateTicketTypeInput } from '../repositories/ticket-type.repository';
import { userRepository, UserRepository } from '../../auth/repositories/user.repository';
import { mongoUserRepository, MongoUserRepository } from '../../auth/repositories/mongo-user.repository';
import { mongoEventVerificationRepository, MongoEventVerificationRepository } from '../repositories/mongo-event-verification.repository';
import { mongoEventMemberRepository, MongoEventMemberRepository } from '../repositories/mongo-event-member.repository';
import { supabaseStorageService, SupabaseStorageService } from '../../tickets/services/supabase-storage.service';
import config from '../../../config/env';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  AppError,
} from '../../../middlewares/error.middleware';
import {
  CreateEventDTO,
  UpdateEventDTO,
  CreateTicketTypeDTO,
  EventResponse,
  CreateEventWizardDTO,
  UpdateEventDraftDTO,
  CanonicalEventResponse,
  HostingType,
  OrganizationVerificationStatus,
  DEFAULT_CREDENTIAL_TERMINOLOGY,
} from '../event.types';
import { IEventDocument } from '../../../db/mongo/models/event.model';

export const DEFAULT_TICKET_TYPES = [
  { name: 'GENERAL', label: 'General Guest', usagePolicy: 'SINGLE_USE' },
  { name: 'VIP', label: 'VIP Guest', usagePolicy: 'SINGLE_USE' },
  { name: 'WORKER', label: 'Event Staff / Worker', usagePolicy: 'REUSABLE' },
  { name: 'SPEAKER', label: 'Speaker / Guest of Honor', usagePolicy: 'SINGLE_USE' },
  { name: 'ORGANIZER', label: 'Event Organizer', usagePolicy: 'SINGLE_USE' },
];

export class EventService {
  constructor(
    private readonly eventRepo: EventRepository = eventRepository,
    private readonly ticketTypeRepo: TicketTypeRepository = ticketTypeRepository,
    private readonly userRepo: UserRepository = userRepository,
    private readonly mongoEventRepo: MongoEventRepository = mongoEventRepository,
    private readonly mongoUserRepo: MongoUserRepository = mongoUserRepository,
    private readonly storageService: SupabaseStorageService = supabaseStorageService,
    private readonly eventVerificationRepo: MongoEventVerificationRepository = mongoEventVerificationRepository,
    private readonly eventMemberRepo: MongoEventMemberRepository = mongoEventMemberRepository
  ) {}

  /**
   * Helper to format a MongoDB event document into CanonicalEventResponse.
   */
  private formatCanonicalEvent(doc: IEventDocument): CanonicalEventResponse {
    let displayStatus: string = doc.status;
    if (doc.organizationVerificationStatus === 'PENDING' || doc.verificationStatus === 'PENDING') {
      displayStatus = 'Draft — Organization Verification Pending';
    } else if (doc.organizationVerificationStatus === 'REJECTED' || doc.verificationStatus === 'REJECTED') {
      displayStatus = 'Draft — Organization Verification Rejected';
    }

    return {
      id: doc._id.toString(),
      ownerId: doc.ownerId.toString(),
      ownerSupabaseId: doc.ownerSupabaseId,
      eventType: doc.eventType,
      name: doc.name,
      description: doc.description,
      bannerUrl: doc.bannerUrl,
      credentialTerminology: doc.credentialTerminology,
      attendanceMode: doc.attendanceMode,
      venue: doc.venue,
      schedule: {
        startAt: doc.schedule.startAt.toISOString(),
        endAt: doc.schedule.endAt.toISOString(),
        timezone: doc.schedule.timezone,
      },
      registration: doc.registration
        ? {
            pricingModel: doc.registration.pricingModel || 'FREE',
            registrationRequired: doc.registration.registrationRequired ?? true,
            capacity: doc.registration.capacity,
          }
        : undefined,
      status: doc.status,
      hostingType: doc.hostingType || 'INDIVIDUAL',
      organization: doc.organization,
      organizationVerificationStatus: doc.organizationVerificationStatus || 'NOT_REQUIRED',
      verificationStatus: doc.verificationStatus || 'UNVERIFIED',
      verificationLevel: doc.verificationLevel || 'UNVERIFIED',
      displayStatus,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * Phase 4: Create a new Event Draft via the Event Creation Wizard.
   * Removes mandatory hostProfile onboarding requirement and links organization verification to the event.
   */
  async createEventWizard(
    supabaseUserId: string,
    data: CreateEventWizardDTO
  ): Promise<CanonicalEventResponse> {
    // 1. Resolve authenticated user identity
    let user = await this.mongoUserRepo.findBySupabaseId(supabaseUserId);
    if (!user) {
      const sqlUser = await this.userRepo.findById(supabaseUserId);
      user = await this.mongoUserRepo.create({
        supabaseUserId,
        email: sqlUser?.email || `${supabaseUserId}@ticketification.internal`,
        name: sqlUser?.name || 'User',
        platformRole: sqlUser?.role === 'ADMIN' ? 'ADMIN' : 'USER',
        status: 'ACTIVE',
      });
    }

    if (user.status === 'SUSPENDED' || user.workspaceStatus === 'SUSPENDED') {
      throw new AuthorizationError(
        'Your account or workspace is suspended. You cannot create events.',
        { code: 'ACCOUNT_SUSPENDED' }
      );
    }

    // 2. Resolve hosting type & organization association
    const hostingType: HostingType = data.hostingType === 'ORGANIZATION' ? 'ORGANIZATION' : 'INDIVIDUAL';
    const isOrg = hostingType === 'ORGANIZATION';
    const orgVerificationStatus: OrganizationVerificationStatus = isOrg ? 'PENDING' : 'NOT_REQUIRED';
    const initialVerificationStatus = isOrg ? 'PENDING' : 'UNVERIFIED';

    // 3. Prepare canonical MongoDB Event document
    const credentialTerminology =
      data.credentialTerminology || DEFAULT_CREDENTIAL_TERMINOLOGY[data.eventType];

    const eventDoc = await this.mongoEventRepo.create({
      ownerId: user._id,
      ownerSupabaseId: supabaseUserId,
      eventType: data.eventType,
      name: data.name,
      description: data.description,
      bannerUrl: data.bannerUrl,
      credentialTerminology,
      attendanceMode: data.attendanceMode,
      venue: data.venue,
      schedule: {
        startAt: new Date(data.schedule.startAt),
        endAt: new Date(data.schedule.endAt),
        timezone: data.schedule.timezone,
      },
      registration: data.registration
        ? {
            pricingModel: data.registration.pricingModel || 'FREE',
            registrationRequired: data.registration.registrationRequired !== false,
            capacity: data.registration.capacity,
          }
        : undefined,
      status: 'DRAFT',
      hostingType,
      organization: isOrg && data.organization ? {
        name: data.organization.name,
        institutionType: data.organization.institutionType,
        institutionName: data.organization.institutionName,
        officialEmail: data.organization.officialEmail,
        department: data.organization.department,
        designation: data.organization.designation,
        websiteUrl: data.organization.websiteUrl,
        documentUrls: data.organization.documentUrls || [],
      } : undefined,
      organizationVerificationStatus: orgVerificationStatus,
      verificationStatus: initialVerificationStatus,
      verificationLevel: 'UNVERIFIED',
    });

    // 4. Create or associate event verification record if organization-hosted
    if (isOrg && data.organization) {
      try {
        await this.eventVerificationRepo.createVerification({
          eventId: eventDoc._id,
          ownerId: user._id,
          institutionName: data.organization.name,
          institutionType: (data.organization.institutionType as any) || 'CORPORATE',
          officialEmail: data.organization.officialEmail || user.email,
          department: data.organization.department || 'General',
          designation: data.organization.designation || 'Event Organizer',
          websiteUrl: data.organization.websiteUrl,
          documentUrls: data.organization.documentUrls || [],
          otpVerified: false,
          riskScore: 30,
          riskTier: 'LOW',
          riskFactors: ['ORGANIZATION_VERIFICATION_PENDING'],
          status: 'PENDING',
        });
      } catch (verifErr) {
        console.error('[EventService] Failed to auto-create verification record for organization event:', verifErr);
        // Safe, recoverable state: preserve event as non-public DRAFT.
        // DO NOT misrepresent infrastructure failure as an administrative rejection ('REJECTED').
        // Keep status as PENDING verification and UNVERIFIED.
        eventDoc.organizationVerificationStatus = 'PENDING';
        eventDoc.verificationStatus = 'UNVERIFIED';
        await eventDoc.save();
      }
    }

    return this.formatCanonicalEvent(eventDoc);
  }

  /**
   * Phase 4: List paginated events owned by the user.
   */
  async getEventsByOwnerPaginated(
    supabaseUserId: string,
    options: EventQueryOptions = {}
  ): Promise<{ events: CanonicalEventResponse[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await this.mongoEventRepo.findByOwner(supabaseUserId, options);

    return {
      events: result.events.map((e) => this.formatCanonicalEvent(e)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Retrieve event by ID with zero-trust ownership and collaborator RBAC enforcement.
   * Supports both canonical MongoDB events and legacy PostgreSQL records.
   */
  async getEventById(eventId: string, userId: string): Promise<any> {
    // Try MongoDB first
    const mongoEvent = await this.mongoEventRepo.findById(eventId);
    if (mongoEvent) {
      const isOwner = mongoEvent.ownerSupabaseId === userId;
      let memberRole: string | undefined = undefined;
      let memberPermissions: string[] | undefined = undefined;

      if (!isOwner) {
        // Check platform admin privileges
        const callerUser = await this.mongoUserRepo.findBySupabaseId(userId);
        const isAdmin = callerUser && (callerUser.platformRole === 'ADMIN' || callerUser.platformRole === 'SUPER_ADMIN');

        if (!isAdmin) {
          // Check event membership for authorized collaborators
          if (!callerUser) {
            throw new AuthorizationError('Access denied. You do not have access to this event.');
          }
          const membership = await this.eventMemberRepo.findByEventAndUser(eventId, callerUser._id);
          if (!membership || membership.status !== 'ACTIVE') {
            throw new AuthorizationError('Access denied. You do not have access to this event.');
          }
          memberRole = membership.role;
          memberPermissions = membership.permissions;
        } else {
          memberRole = 'ADMIN';
        }
      } else {
        memberRole = 'HOST';
      }

      const formatted = this.formatCanonicalEvent(mongoEvent);
      return {
        ...formatted,
        userRole: memberRole,
        userPermissions: memberPermissions,
      };
    }

    // Fallback to legacy PostgreSQL repository
    const legacyEvent = await this.eventRepo.findById(eventId);
    if (!legacyEvent) {
      throw new NotFoundError('Event not found.');
    }

    if (legacyEvent.createdBy !== userId) {
      throw new AuthorizationError('Access denied. You do not own this event.');
    }

    const ticketTypes = await this.ticketTypeRepo.findByEventId(eventId);
    return {
      ...legacyEvent,
      ticketTypes,
    };
  }

  /**
   * Phase 4: Update an existing draft event.
   */
  async updateEventDraft(
    eventId: string,
    userId: string,
    updates: UpdateEventDraftDTO
  ): Promise<CanonicalEventResponse> {
    const existing = await this.mongoEventRepo.findById(eventId);
    if (!existing) {
      throw new NotFoundError('Event not found.');
    }

    if (existing.ownerSupabaseId !== userId) {
      throw new AuthorizationError('Access denied. You do not own this event.');
    }

    if (existing.status !== 'DRAFT') {
      throw new ValidationError('Only draft events can be modified.');
    }

    const updatePayload: any = { ...updates };
    if (updates.schedule) {
      updatePayload.schedule = {
        startAt: updates.schedule.startAt ? new Date(updates.schedule.startAt) : existing.schedule.startAt,
        endAt: updates.schedule.endAt ? new Date(updates.schedule.endAt) : existing.schedule.endAt,
        timezone: updates.schedule.timezone || existing.schedule.timezone,
      };
    }

    const updated = await this.mongoEventRepo.updateDraft(eventId, userId, updatePayload);
    if (!updated) {
      throw new NotFoundError('Event draft not found or could not be updated.');
    }

    return this.formatCanonicalEvent(updated);
  }

  // ==========================================
  // Legacy Methods for Backward Compatibility
  // ==========================================

  /**
   * List all events owned by the user, ordered newest first (Legacy signature).
   */
  async getEventsByOwner(userId: string): Promise<any[]> {
    try {
      const mongoResult = await this.mongoEventRepo.findByOwner(userId, { limit: 100 });
      if (mongoResult.events && mongoResult.events.length > 0) {
        return mongoResult.events.map((e) => this.formatCanonicalEvent(e));
      }
    } catch {
      // Continue to legacy fallback
    }

    if (config.env.databaseUrl) {
      try {
        const events = await this.eventRepo.findByOwner(userId);
        return events as EventResponse[];
      } catch (err: any) {
        console.warn('[EventService] Postgres findByOwner fallback failed:', err.message);
        return [];
      }
    }

    return [];
  }

  /**
   * Legacy create event method (preserves existing tests).
   */
  async createEvent(userId: string, data: CreateEventDTO): Promise<EventResponse> {
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('Event name is required.');
    }
    if (!data.date) {
      throw new ValidationError('Event date is required.');
    }

    try {
      const existingUser = await this.userRepo.findById(userId);
      if (!existingUser) {
        await this.userRepo.upsert({
          id: userId,
          name: data.organizerName?.trim() || 'User',
          email: `${userId}@ticketification.internal`,
          role: 'USER',
        });
      }
    } catch (syncErr) {
      console.warn('[EventService] Pre-event user upsert fallback:', syncErr);
    }

    const createdEvent = await this.eventRepo.create({
      name: data.name.trim(),
      date: data.date,
      time: data.time || null,
      venue: data.venue?.trim() || null,
      description: data.description?.trim() || null,
      organizerName: data.organizerName?.trim() || null,
      logoUrl: data.logoUrl || null,
      ticketTemplateUrl: data.ticketTemplateUrl || null,
      status: data.status || 'UPCOMING',
      createdBy: userId,
    });

    let ticketTypes: any[] = [];
    try {
      const typesToCreate = DEFAULT_TICKET_TYPES.map((t) => ({
        eventId: createdEvent.id,
        name: t.name,
        label: t.label,
        usagePolicy: t.usagePolicy,
      }));
      ticketTypes = await this.ticketTypeRepo.createMany(typesToCreate);
    } catch (ttErr) {
      console.warn('[EventService] Default ticket types creation warning:', ttErr);
    }

    return {
      ...createdEvent,
      ticketTypes,
    } as EventResponse;
  }

  /**
   * Legacy update event.
   */
  async updateEvent(eventId: string, userId: string, data: UpdateEventDTO): Promise<EventResponse> {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw new NotFoundError('Event not found.');
    }

    if (existing.createdBy !== userId) {
      throw new AuthorizationError('Access denied. You do not own this event.');
    }

    const updated = await this.eventRepo.update(eventId, {
      name: data.name?.trim(),
      date: data.date,
      time: data.time,
      venue: data.venue?.trim(),
      description: data.description?.trim(),
      organizerName: data.organizerName?.trim(),
      logoUrl: data.logoUrl,
      ticketTemplateUrl: data.ticketTemplateUrl,
      status: data.status,
    });

    const ticketTypes = await this.ticketTypeRepo.findByEventId(eventId);
    return {
      ...updated!,
      ticketTypes,
    } as EventResponse;
  }

  /**
   * Delete an event.
   */
  async deleteEvent(eventId: string, userId: string): Promise<boolean> {
    const mongoEvent = await this.mongoEventRepo.findById(eventId);
    if (mongoEvent) {
      if (mongoEvent.ownerSupabaseId !== userId) {
        throw new AuthorizationError('Access denied. You do not own this event.');
      }
      return await this.mongoEventRepo.deleteDraft(eventId, userId);
    }

    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw new NotFoundError('Event not found.');
    }

    if (existing.createdBy !== userId) {
      throw new AuthorizationError('Access denied. You do not own this event.');
    }

    await this.eventRepo.delete(eventId);
    return true;
  }

  /**
   * Legacy ticket type creation.
   */
  async addTicketType(eventId: string, userId: string, data: CreateTicketTypeDTO) {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw new NotFoundError('Event not found.');
    }

    if (existing.createdBy !== userId) {
      throw new AuthorizationError('Access denied. You do not own this event.');
    }

    const name = data.name.trim().toUpperCase();
    const existingType = await this.ticketTypeRepo.findByEventAndName(eventId, name);
    if (existingType) {
      throw new ConflictError(`Ticket type "${name}" already exists for this event.`);
    }

    return await this.ticketTypeRepo.create({
      eventId,
      name,
      label: data.label?.trim() || name,
      usagePolicy: data.usagePolicy || 'SINGLE_USE',
    });
  }

  async getTicketTypes(eventId: string, userId: string) {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw new NotFoundError('Event not found.');
    }

    if (existing.createdBy !== userId) {
      throw new AuthorizationError('Access denied. You do not own this event.');
    }

    return await this.ticketTypeRepo.findByEventId(eventId);
  }

  /**
   * Upload an event banner to storage.
   */
  async uploadBanner(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ bannerUrl?: string; storagePath: string }> {
    const result = await this.storageService.uploadEventBanner(userId, fileBuffer, fileName, mimeType);
    return {
      bannerUrl: result.publicUrl,
      storagePath: result.storagePath,
    };
  }
}

export const eventService = new EventService();
export default eventService;
