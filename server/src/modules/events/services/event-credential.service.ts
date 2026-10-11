import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  mongoEventCredentialRepository,
  MongoEventCredentialRepository,
  CredentialQueryFilters,
} from '../repositories/mongo-event-credential.repository';
import { mongoEventRepository, MongoEventRepository } from '../repositories/mongo-event.repository';
import { mongoEventMemberRepository, MongoEventMemberRepository } from '../repositories/mongo-event-member.repository';
import { mongoUserRepository, MongoUserRepository } from '../../auth/repositories/mongo-user.repository';
import {
  CredentialUsagePolicy,
  IEventCredentialDocument,
} from '../../../db/mongo/models/event-credential.model';
import { NotFoundError, AuthorizationError, ValidationError } from '../../../middlewares/error.middleware';

export interface IssueCredentialInput {
  holder: {
    name: string;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
    designation?: string | null;
    teamId?: string | null;
    category?: string;
    isAssigned?: boolean;
  };
  credentialType?: string;
  usagePolicy?: CredentialUsagePolicy;
  metadata?: Record<string, any>;
}

export interface IssueWorkerBatchInput {
  count: number;
  credentialType?: string;
  category?: string;
}

export class EventCredentialService {
  constructor(
    private credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Helper: Generate a cryptographically secure 64-character hex token without PII.
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Helper: Derive a 3-4 letter prefix for formatted sequence IDs.
   */
  private derivePrefix(terminology: string): string {
    const clean = terminology.toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.includes('TICK')) return 'TIC';
    if (clean.includes('BADG')) return 'BDG';
    if (clean.includes('PASS')) return 'PASS';
    if (clean.includes('INVIT')) return 'INV';
    if (clean.length >= 3) return clean.slice(0, 4);
    return 'CRD';
  }

  /**
   * Helper: Format sequence number as human-readable string (e.g. TIC-00001).
   */
  private formatSequenceId(prefix: string, seq: number): string {
    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }

  /**
   * Authorize caller as Host or Coordinator for the event.
   */
  private async authorizeHostOrCoordinator(
    eventId: string,
    callerSupabaseId: string,
    callerPlatformRole?: string
  ): Promise<{ event: any; callerUser: any }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AuthorizationError('Caller user profile not found');
    }

    if (callerPlatformRole === 'SUPER_ADMIN' || callerUser.platformRole === 'SUPER_ADMIN') {
      return { event, callerUser };
    }

    const isOwner =
      event.ownerSupabaseId === callerSupabaseId ||
      (event.ownerId && event.ownerId.toString() === callerUser._id.toString());

    if (isOwner) {
      return { event, callerUser };
    }

    const member = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (!member || !['HOST', 'COORDINATOR'].includes(member.role)) {
      throw new AuthorizationError('Only event Hosts and Coordinators can manage credentials');
    }

    return { event, callerUser };
  }

  /**
   * Issue a single credential for an attendee.
   */
  async issueCredential(
    eventId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    input: IssueCredentialInput
  ): Promise<IEventCredentialDocument> {
    const { event, callerUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    if (!input.holder || !input.holder.name || !input.holder.name.trim()) {
      throw new ValidationError('Attendee name is required for credential issuance');
    }

    const terminology = event.credentialTerminology || 'Ticket';
    const prefix = this.derivePrefix(terminology);

    const sequenceNumber = await this.credentialRepo.getNextSequenceNumber(eventId);
    const formattedId = this.formatSequenceId(prefix, sequenceNumber);
    const verificationToken = this.generateVerificationToken();

    const holderName = input.holder.name.trim();
    const sanitizedSlug = holderName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const storagePath = `events/${eventId}/credentials/${sanitizedSlug}-${formattedId}.png`;

    const credential = await this.credentialRepo.create({
      eventId: new mongoose.Types.ObjectId(eventId),
      sequenceNumber,
      formattedId,
      verificationToken,
      credentialType: input.credentialType || 'ATTENDEE',
      terminology,
      usagePolicy: input.usagePolicy || 'SINGLE_USE',
      status: 'ACTIVE',
      holder: {
        name: holderName,
        email: input.holder.email?.trim().toLowerCase() || null,
        phone: input.holder.phone?.trim() || null,
        organization: input.holder.organization?.trim() || null,
        designation: input.holder.designation?.trim() || null,
        teamId: input.holder.teamId ? new mongoose.Types.ObjectId(input.holder.teamId) : null,
        category: input.holder.category || 'General',
        isAssigned: input.holder.isAssigned !== false,
      },
      asset: {
        storagePath,
        publicUrl: null,
        renderedAt: null,
        mimeType: 'image/png',
      },
      metadata: input.metadata || {},
      createdBy: callerUser._id,
    });

    return credential;
  }

  /**
   * Internal/Service helper: Issue a credential directly as part of verified attendee self-registration.
   */
  async issueRegistrationCredential(
    eventId: string,
    eventTerminology: string,
    input: IssueCredentialInput,
    createdByUserId: mongoose.Types.ObjectId
  ): Promise<IEventCredentialDocument> {
    if (!input.holder || !input.holder.name || !input.holder.name.trim()) {
      throw new ValidationError('Attendee name is required for credential issuance');
    }

    const terminology = eventTerminology || 'Ticket';
    const prefix = this.derivePrefix(terminology);

    const sequenceNumber = await this.credentialRepo.getNextSequenceNumber(eventId);
    const formattedId = this.formatSequenceId(prefix, sequenceNumber);
    const verificationToken = this.generateVerificationToken();

    const holderName = input.holder.name.trim();
    const sanitizedSlug = holderName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const storagePath = `events/${eventId}/credentials/${sanitizedSlug}-${formattedId}.png`;

    return await this.credentialRepo.create({
      eventId: new mongoose.Types.ObjectId(eventId),
      sequenceNumber,
      formattedId,
      verificationToken,
      credentialType: input.credentialType || 'ATTENDEE',
      terminology,
      usagePolicy: input.usagePolicy || 'SINGLE_USE',
      status: 'ACTIVE',
      holder: {
        name: holderName,
        email: input.holder.email?.trim().toLowerCase() || null,
        phone: input.holder.phone?.trim() || null,
        organization: input.holder.organization?.trim() || null,
        designation: input.holder.designation?.trim() || null,
        teamId: input.holder.teamId ? new mongoose.Types.ObjectId(input.holder.teamId) : null,
        category: input.holder.category || 'General',
        isAssigned: input.holder.isAssigned !== false,
      },
      asset: {
        storagePath,
        publicUrl: null,
        renderedAt: null,
        mimeType: 'image/png',
      },
      metadata: input.metadata || {},
      createdBy: createdByUserId,
    });
  }

  /**
   * Issue a batch of unassigned worker/staff passes.
   */
  async issueWorkerBatch(
    eventId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    input: IssueWorkerBatchInput
  ): Promise<{ issuedCount: number; credentials: IEventCredentialDocument[] }> {
    const { event, callerUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    const count = Math.min(Math.max(Number(input.count) || 1, 1), 500);
    const terminology = event.credentialTerminology || 'Pass';
    const prefix = 'WRK';

    const startSeq = await this.credentialRepo.allocateSequenceBlock(eventId, count);

    const items: Partial<IEventCredentialDocument>[] = [];
    for (let i = 0; i < count; i++) {
      const seq = startSeq + i;
      const formattedId = `${prefix}-${String(seq).padStart(5, '0')}`;
      const verificationToken = this.generateVerificationToken();
      const storagePath = `events/${eventId}/credentials/worker-${formattedId}.png`;

      items.push({
        eventId: new mongoose.Types.ObjectId(eventId),
        sequenceNumber: seq,
        formattedId,
        verificationToken,
        credentialType: input.credentialType || 'WORKER',
        terminology: 'Worker Pass',
        usagePolicy: 'REUSABLE_WORKER',
        status: 'ACTIVE',
        holder: {
          name: `Unassigned Worker #${seq}`,
          email: null,
          phone: null,
          organization: null,
          designation: null,
          teamId: null,
          category: input.category || 'Staff / Crew',
          isAssigned: false,
        },
        asset: {
          storagePath,
          publicUrl: null,
          renderedAt: null,
          mimeType: 'image/png',
        },
        createdBy: callerUser._id,
      });
    }

    const created = await this.credentialRepo.createMany(items);
    return { issuedCount: created.length, credentials: created };
  }

  /**
   * List credentials for an event with metrics.
   */
  async getEventCredentials(
    eventId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    filters: CredentialQueryFilters = {}
  ): Promise<{
    credentials: IEventCredentialDocument[];
    total: number;
    metrics: { total: number; active: number; checkedIn: number; revoked: number };
  }> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const [result, metrics] = await Promise.all([
      this.credentialRepo.findByEvent(eventId, filters),
      this.credentialRepo.getMetrics(eventId),
    ]);

    return {
      credentials: result.credentials,
      total: result.total,
      metrics,
    };
  }

  /**
   * Get single credential by ID.
   */
  async getCredentialById(
    eventId: string,
    credentialId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined
  ): Promise<IEventCredentialDocument> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const credential = await this.credentialRepo.findById(eventId, credentialId);
    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    return credential;
  }

  /**
   * Revoke a credential.
   */
  async revokeCredential(
    eventId: string,
    credentialId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    reason?: string
  ): Promise<IEventCredentialDocument> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const existing = await this.credentialRepo.findById(eventId, credentialId);
    if (!existing) {
      throw new NotFoundError('Credential not found');
    }

    if (existing.status === 'REVOKED') {
      return existing;
    }

    const updated = await this.credentialRepo.updateStatus(
      eventId,
      credentialId,
      'REVOKED',
      reason || 'Revoked by organizer'
    );

    if (!updated) {
      throw new NotFoundError('Credential not found');
    }

    return updated;
  }

  /**
   * Assign an unassigned credential to an individual.
   */
  async assignCredential(
    eventId: string,
    credentialId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    holderData: { name: string; email?: string | null; phone?: string | null; category?: string }
  ): Promise<IEventCredentialDocument> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    if (!holderData.name || !holderData.name.trim()) {
      throw new ValidationError('Name is required to assign credential');
    }

    const updated = await this.credentialRepo.assignHolder(eventId, credentialId, holderData);
    if (!updated) {
      throw new NotFoundError('Credential not found');
    }

    return updated;
  }

  /**
   * Public: Verify credential by 64-character verification token without PII leakage.
   */
  async verifyToken(token: string): Promise<{
    valid: boolean;
    status: string;
    formattedId: string;
    credentialType: string;
    terminology: string;
    holderName: string;
    holderCategory: string;
    usagePolicy: string;
    checkInCount: number;
    eventName: string;
    eventStatus: string;
    venue: string;
    date: Date | null;
  }> {
    if (!token || token.length !== 64) {
      throw new ValidationError('Invalid verification token format. Must be a 64-character token.');
    }

    const credential = await this.credentialRepo.findByVerificationToken(token);
    if (!credential) {
      throw new NotFoundError('Credential not found or invalid token');
    }

    const event = credential.eventId as any;

    return {
      valid: credential.status === 'ACTIVE' || credential.status === 'CHECKED_IN',
      status: credential.status,
      formattedId: credential.formattedId,
      credentialType: credential.credentialType,
      terminology: credential.terminology,
      holderName: credential.holder.name,
      holderCategory: credential.holder.category,
      usagePolicy: credential.usagePolicy,
      checkInCount: credential.checkInCount,
      eventName: event?.name || 'Ticketification Event',
      eventStatus: event?.status || 'UNKNOWN',
      venue: event?.venue?.name || event?.venue || 'TBD',
      date: event?.schedule?.startAt || null,
    };
  }
}

export const eventCredentialService = new EventCredentialService();

