import mongoose from 'mongoose';
import {
  mongoEventRegistrationRepository,
  MongoEventRegistrationRepository,
} from '../repositories/mongo-event-registration.repository';
import { mongoEventRepository, MongoEventRepository } from '../repositories/mongo-event.repository';
import { mongoUserRepository, MongoUserRepository } from '../../auth/repositories/mongo-user.repository';
import {
  EventCredentialService,
} from './event-credential.service';
import {
  mongoEventCredentialRepository,
  MongoEventCredentialRepository,
} from '../repositories/mongo-event-credential.repository';
import {
  mongoEventTeamRepository,
  MongoEventTeamRepository,
} from '../repositories/mongo-event-team.repository';
import { auditService, AuditService } from './audit.service';
import { NotFoundError, ValidationError, AuthorizationError } from '../../../middlewares/error.middleware';
import { IEventRegistrationDocument } from '../../../db/mongo/models/event-registration.model';
import { IEventCredentialDocument } from '../../../db/mongo/models/event-credential.model';

export interface RegisterEventDTO {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  designation?: string;
  teamName?: string;
  registrationType?: string;
  responses?: Record<string, any>;
}

export interface AttendeeWalletItem {
  registrationId?: string;
  credentialId: string;
  eventId: string;
  eventName: string;
  eventType: string;
  bannerUrl?: string | null;
  venue: any;
  schedule: any;
  credentialTerminology: string;
  credentialType: string;
  formattedId: string;
  verificationToken: string;
  status: string;
  usagePolicy: string;
  checkInCount: number;
  holder: {
    name: string;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
    designation?: string | null;
    category?: string;
  };
  asset: {
    storagePath?: string | null;
    publicUrl?: string | null;
    mimeType: string;
  };
  registeredAt?: Date;
}

export class EventRegistrationService {
  constructor(
    private registrationRepo: MongoEventRegistrationRepository = mongoEventRegistrationRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private userRepo: MongoUserRepository = mongoUserRepository,
    private credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private teamRepo: MongoEventTeamRepository = mongoEventTeamRepository,
    private credentialService: EventCredentialService = new EventCredentialService(),
    private audit: AuditService = auditService
  ) {}

  /**
   * Register authenticated user for an event and auto-issue active credential.
   * Enforces idempotency: multiple calls return existing registration.
   */
  async register(
    eventId: string,
    userSupabaseId: string,
    dto: RegisterEventDTO
  ): Promise<{ registration: IEventRegistrationDocument; credential: IEventCredentialDocument }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Guard against inactive or closed lifecycle states
    const disallowedStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SUSPENDED', 'CANCELLED', 'ARCHIVED', 'REJECTED'];
    if (disallowedStatuses.includes(event.status)) {
      throw new ValidationError(`Registration is currently unavailable for this event (Status: ${event.status})`);
    }

    const callerUser = await this.userRepo.findBySupabaseId(userSupabaseId);
    if (!callerUser) {
      throw new AuthorizationError('Authenticated user profile not found');
    }

    // Check for existing active registration (Idempotent)
    const existing = await this.registrationRepo.findByEventAndUser(eventId, callerUser._id);
    if (existing && existing.status !== 'CANCELLED') {
      let linkedCred: IEventCredentialDocument | null = null;
      if (existing.credentialId) {
        linkedCred = await this.credentialRepo.findById(existing.credentialId.toString());
      }
      if (!linkedCred) {
        // Fallback search by holder email
        const creds = await this.credentialRepo.findByEmail(callerUser.email.toLowerCase());
        const matching = creds.find((c) => c.eventId.toString() === eventId && c.status === 'ACTIVE');
        if (matching) linkedCred = matching;
      }
      return { registration: existing, credential: linkedCred as IEventCredentialDocument };
    }

    // Capacity check
    if (event.registration?.capacity && event.registration.capacity > 0) {
      const activeCount = await this.registrationRepo.countByEvent(eventId, 'CONFIRMED');
      if (activeCount >= event.registration.capacity) {
        throw new ValidationError(
          `Event capacity limit (${event.registration.capacity}) has been reached. Registration closed.`
        );
      }
    }

    const attendeeName = dto.name?.trim() || callerUser.name || 'Attendee';
    const attendeeEmail = dto.email?.trim().toLowerCase() || callerUser.email.toLowerCase();
    const phone = dto.phone?.trim() || null;
    const organization = dto.organization?.trim() || null;
    const designation = dto.designation?.trim() || null;
    const teamName = dto.teamName?.trim() || null;

    // Optional team linking if teamName specified and exists
    let teamId: mongoose.Types.ObjectId | null = null;
    if (teamName) {
      const existingTeam = await this.teamRepo.findByEventAndName(eventId, teamName);
      if (existingTeam) {
        teamId = existingTeam._id;
      }
    }

    // Auto-issue event credential
    const credential = await this.credentialService.issueRegistrationCredential(
      eventId,
      event.credentialTerminology,
      {
        holder: {
          name: attendeeName,
          email: attendeeEmail,
          phone,
          organization,
          designation,
          teamId: teamId ? teamId.toString() : null,
          category: dto.registrationType || 'ATTENDEE',
          isAssigned: true,
        },
        credentialType: dto.registrationType || 'ATTENDEE',
        usagePolicy: 'SINGLE_USE',
        metadata: {
          registeredVia: 'SELF_SERVICE',
          registeredAt: new Date().toISOString(),
          ...dto.responses,
        },
      },
      callerUser._id
    );

    // Persist registration document
    const registration = await this.registrationRepo.create({
      eventId,
      userId: callerUser._id,
      userSupabaseId,
      credentialId: credential._id,
      status: 'CONFIRMED',
      registrationType: dto.registrationType || 'ATTENDEE',
      attendeeDetails: {
        name: attendeeName,
        email: attendeeEmail,
        phone,
        organization,
        designation,
        teamName,
      },
      responses: dto.responses || {},
      teamId,
      registeredAt: new Date(),
    });

    // Record immutable audit entry
    await this.audit.record({
      eventId,
      actorId: callerUser._id,
      actorEmail: callerUser.email,
      actorRole: 'ATTENDEE',
      action: 'ATTENDEE_REGISTERED',
      targetEntity: 'EVENT_REGISTRATION',
      targetId: registration._id.toString(),
      metadata: {
        registrationId: registration._id.toString(),
        credentialId: credential._id.toString(),
        formattedId: credential.formattedId,
        attendeeEmail,
      },
    });

    return { registration, credential };
  }

  /**
   * Get authenticated attendee's registration for a specific event.
   */
  async getMyRegistration(
    eventId: string,
    userSupabaseId: string
  ): Promise<{ registration: IEventRegistrationDocument | null; credential: IEventCredentialDocument | null }> {
    const callerUser = await this.userRepo.findBySupabaseId(userSupabaseId);
    if (!callerUser) {
      throw new AuthorizationError('User profile not found');
    }

    const registration = await this.registrationRepo.findByEventAndUser(eventId, callerUser._id);
    if (!registration) {
      return { registration: null, credential: null };
    }

    let credential: IEventCredentialDocument | null = null;
    if (registration.credentialId) {
      credential = await this.credentialRepo.findById(registration.credentialId.toString());
    }

    return { registration, credential };
  }

  /**
   * Cancel authenticated attendee's registration and revoke linked credential.
   */
  async cancelRegistration(
    eventId: string,
    userSupabaseId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const callerUser = await this.userRepo.findBySupabaseId(userSupabaseId);
    if (!callerUser) {
      throw new AuthorizationError('User profile not found');
    }

    const registration = await this.registrationRepo.findByEventAndUser(eventId, callerUser._id);
    if (!registration) {
      throw new NotFoundError('No active registration found for this event');
    }

    // Cancel registration
    await this.registrationRepo.updateStatus(
      registration._id.toString(),
      eventId,
      'CANCELLED',
      new Date(),
      reason || 'Cancelled by attendee'
    );

    // Revoke linked credential if active
    if (registration.credentialId) {
      await this.credentialRepo.updateStatus(
        eventId,
        registration.credentialId.toString(),
        'REVOKED',
        reason || 'Registration cancelled by attendee'
      );
    }

    // Record audit entry
    await this.audit.record({
      eventId,
      actorId: callerUser._id,
      actorEmail: callerUser.email,
      actorRole: 'ATTENDEE',
      action: 'ATTENDEE_CANCELLED',
      targetEntity: 'EVENT_REGISTRATION',
      targetId: registration._id.toString(),
      metadata: {
        registrationId: registration._id.toString(),
        reason: reason || 'Self-service attendee cancellation',
      },
    });

    return { success: true, message: 'Registration cancelled and credential revoked successfully' };
  }

  /**
   * Get all credentials owned by the user across events (Attendee Wallet).
   */
  async getMyWallet(userSupabaseId: string): Promise<AttendeeWalletItem[]> {
    const callerUser = await this.userRepo.findBySupabaseId(userSupabaseId);
    if (!callerUser) {
      throw new AuthorizationError('User profile not found');
    }

    const walletItems: AttendeeWalletItem[] = [];
    const seenCredentialIds = new Set<string>();

    // 1. Fetch via registrations
    const registrations = await this.registrationRepo.findByUserSupabaseId(userSupabaseId);
    for (const reg of registrations) {
      if (reg.status === 'CANCELLED') continue;
      const event: any = reg.eventId;
      const cred: any = reg.credentialId;

      if (cred && !seenCredentialIds.has(cred._id.toString())) {
        seenCredentialIds.add(cred._id.toString());
        walletItems.push({
          registrationId: reg._id.toString(),
          credentialId: cred._id.toString(),
          eventId: event?._id ? event._id.toString() : reg.eventId.toString(),
          eventName: event?.name || 'Event Pass',
          eventType: event?.eventType || 'GENERAL',
          bannerUrl: event?.bannerUrl || null,
          venue: event?.venue || {},
          schedule: event?.schedule || {},
          credentialTerminology: cred.terminology || event?.credentialTerminology || 'Ticket',
          credentialType: cred.credentialType || 'ATTENDEE',
          formattedId: cred.formattedId,
          verificationToken: cred.verificationToken,
          status: cred.status,
          usagePolicy: cred.usagePolicy,
          checkInCount: cred.checkInCount || 0,
          holder: {
            name: cred.holder?.name || reg.attendeeDetails.name,
            email: cred.holder?.email || reg.attendeeDetails.email,
            phone: cred.holder?.phone || reg.attendeeDetails.phone,
            organization: cred.holder?.organization || reg.attendeeDetails.organization,
            designation: cred.holder?.designation || reg.attendeeDetails.designation,
            category: cred.holder?.category || 'General',
          },
          asset: {
            storagePath: cred.asset?.storagePath || null,
            publicUrl: cred.asset?.publicUrl || null,
            mimeType: cred.asset?.mimeType || 'image/png',
          },
          registeredAt: reg.registeredAt,
        });
      }
    }

    // 2. Fetch any credentials directly issued to user's email (e.g. from organizer CSV imports)
    if (callerUser.email) {
      const emailCreds = await this.credentialRepo.findByEmail(callerUser.email.toLowerCase());
      for (const cred of emailCreds) {
        if (!seenCredentialIds.has(cred._id.toString())) {
          seenCredentialIds.add(cred._id.toString());
          const event = await this.eventRepo.findById(cred.eventId.toString());
          walletItems.push({
            credentialId: cred._id.toString(),
            eventId: cred.eventId.toString(),
            eventName: event?.name || 'Event Pass',
            eventType: event?.eventType || 'GENERAL',
            bannerUrl: event?.bannerUrl || null,
            venue: event?.venue || {},
            schedule: event?.schedule || {},
            credentialTerminology: cred.terminology || event?.credentialTerminology || 'Ticket',
            credentialType: cred.credentialType || 'ATTENDEE',
            formattedId: cred.formattedId,
            verificationToken: cred.verificationToken,
            status: cred.status,
            usagePolicy: cred.usagePolicy,
            checkInCount: cred.checkInCount || 0,
            holder: {
              name: cred.holder?.name || callerUser.name,
              email: cred.holder?.email || callerUser.email,
              phone: cred.holder?.phone,
              organization: cred.holder?.organization,
              designation: cred.holder?.designation,
              category: cred.holder?.category || 'General',
            },
            asset: {
              storagePath: cred.asset?.storagePath || null,
              publicUrl: cred.asset?.publicUrl || null,
              mimeType: cred.asset?.mimeType || 'image/png',
            },
            registeredAt: cred.createdAt,
          });
        }
      }
    }

    return walletItems;
  }
}

export const eventRegistrationService = new EventRegistrationService();
