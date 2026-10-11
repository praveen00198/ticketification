import mongoose from 'mongoose';
import {
  MongoEventCredentialRepository,
  mongoEventCredentialRepository,
} from '../repositories/mongo-event-credential.repository';
import {
  MongoEventCredentialCheckinRepository,
  mongoEventCredentialCheckinRepository,
  CheckinQueryOptions,
  CheckinAggregatedStats,
} from '../repositories/mongo-event-credential-checkin.repository';
import {
  MongoEventRepository,
  mongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  MongoEventMemberRepository,
  mongoEventMemberRepository,
} from '../repositories/mongo-event-member.repository';
import {
  MongoUserRepository,
  mongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  IEventCredentialDocument,
} from '../../../db/mongo/models/event-credential.model';
import {
  IEventCredentialCheckinDocument,
} from '../../../db/mongo/models/event-credential-checkin.model';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../../middlewares/error.middleware';

export interface CheckinInputOptions {
  token: string;
  gate?: string;
  workerName?: string;
  notes?: string;
}

export interface CheckinResult {
  success: boolean;
  code:
    | 'CHECKED_IN'
    | 'VALID_REUSABLE'
    | 'ALREADY_CHECKED_IN'
    | 'CREDENTIAL_REVOKED'
    | 'CREDENTIAL_EXPIRED'
    | 'WORKER_NAME_REQUIRED'
    | 'INVALID_TOKEN';
  message: string;
  credential?: any;
  checkin?: any;
  firstCheckedInAt?: Date | null;
  lastCheckedInAt?: Date | null;
  checkInCount?: number;
}

export class EventCredentialCheckinService {
  constructor(
    private credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private checkinRepo: MongoEventCredentialCheckinRepository = mongoEventCredentialCheckinRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Evaluate scanner identity and verify RBAC permissions.
   */
  async authorizeScanner(
    eventId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<{
    event: any;
    scannerUser: any;
    scannerRole: string;
  }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Resolve Mongo User
    let scannerUser = await this.userRepo.findBySupabaseId(callerUserId);
    if (!scannerUser && mongoose.Types.ObjectId.isValid(callerUserId)) {
      scannerUser = await this.userRepo.findById(callerUserId);
    }
    if (!scannerUser) {
      throw new AuthorizationError('Scanner user profile not found');
    }

    // Platform Super Admin / Admin override
    if (callerPlatformRole === 'SUPER_ADMIN' || callerPlatformRole === 'ADMIN') {
      return { event, scannerUser, scannerRole: callerPlatformRole };
    }

    // Event Owner is always authorized
    if (
      event.ownerId &&
      (event.ownerId.toString() === scannerUser._id.toString() ||
        event.ownerSupabaseId === callerUserId)
    ) {
      return { event, scannerUser, scannerRole: 'HOST' };
    }

    // Query event membership
    const member = await this.memberRepo.findByEventAndUser(
      eventId,
      scannerUser._id.toString()
    );

    if (!member || member.status !== 'ACTIVE') {
      throw new AuthorizationError('You are not an active staff member of this event');
    }

    if (member.role === 'HOST' || member.role === 'COORDINATOR') {
      return { event, scannerUser, scannerRole: member.role };
    }

    // Volunteers require scanning permissions
    if (member.role === 'VOLUNTEER') {
      const perms = member.permissions || [];
      const hasScanPermission =
        perms.includes('SCAN_CREDENTIALS') ||
        perms.includes('MANAGE_ATTENDEES');

      if (hasScanPermission) {
        return { event, scannerUser, scannerRole: 'VOLUNTEER' };
      }
      throw new AuthorizationError('Volunteer does not possess scanning permissions for this event');
    }

    throw new AuthorizationError('User role is not authorized to scan event credentials');
  }

  /**
   * Verify and atomically check in a credential.
   * Handles single-use race conditions, reusable worker multi-entry, and audit logs.
   */
  async verifyAndCheckIn(
    eventId: string,
    input: CheckinInputOptions,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<CheckinResult> {
    const { scannerUser, scannerRole } = await this.authorizeScanner(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    const token = (input.token || '').trim();
    if (!token) {
      throw new ValidationError('Credential verification token is required');
    }

    const gate = (input.gate || 'Main Gate').trim();

    // 1. Resolve credential by 64-char token or mongo ID
    let credential: IEventCredentialDocument | null = null;
    if (token.length === 64) {
      credential = await this.credentialRepo.findByVerificationToken(token);
    } else if (mongoose.Types.ObjectId.isValid(token)) {
      credential = await this.credentialRepo.findById(eventId, token);
    }

    if (!credential || credential.eventId.toString() !== eventId) {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid credential token or pass belongs to another event',
      };
    }

    const holderSnapshot = {
      name: credential.holder?.name || 'Unassigned Worker',
      category: credential.holder?.category || 'PARTICIPANT',
      formattedId: credential.formattedId,
    };

    // 2. Check REVOKED
    if (credential.status === 'REVOKED') {
      await this.checkinRepo.createCheckinLog({
        eventId: new mongoose.Types.ObjectId(eventId),
        credentialId: credential._id,
        scannedBy: scannerUser._id,
        scannerEmail: scannerUser.email,
        scannerRole,
        scannedAt: new Date(),
        scanStatus: 'REVOKED',
        usagePolicy: credential.usagePolicy,
        gate,
        holderSnapshot,
        notes: `Revocation Reason: ${credential.revokedReason || 'Not specified'}`,
      });

      return {
        success: false,
        code: 'CREDENTIAL_REVOKED',
        message: `Credential was revoked: ${credential.revokedReason || 'Revoked by organizer'}`,
        credential: this.sanitizeCredential(credential),
      };
    }

    // 3. Check EXPIRED
    if (credential.status === 'EXPIRED') {
      await this.checkinRepo.createCheckinLog({
        eventId: new mongoose.Types.ObjectId(eventId),
        credentialId: credential._id,
        scannedBy: scannerUser._id,
        scannerEmail: scannerUser.email,
        scannerRole,
        scannedAt: new Date(),
        scanStatus: 'EXPIRED',
        usagePolicy: credential.usagePolicy,
        gate,
        holderSnapshot,
        notes: 'Pass has expired',
      });

      return {
        success: false,
        code: 'CREDENTIAL_EXPIRED',
        message: 'Credential has expired and is no longer valid for admission',
        credential: this.sanitizeCredential(credential),
      };
    }

    // 4. Handle SINGLE_USE Policy
    if (credential.usagePolicy === 'SINGLE_USE') {
      // If already marked CHECKED_IN
      if (credential.status === 'CHECKED_IN') {
        const timeStr = credential.lastCheckedInAt
          ? new Date(credential.lastCheckedInAt).toLocaleTimeString()
          : 'earlier';

        await this.checkinRepo.createCheckinLog({
          eventId: new mongoose.Types.ObjectId(eventId),
          credentialId: credential._id,
          scannedBy: scannerUser._id,
          scannerEmail: scannerUser.email,
          scannerRole,
          scannedAt: new Date(),
          scanStatus: 'ALREADY_CHECKED_IN',
          usagePolicy: 'SINGLE_USE',
          gate,
          holderSnapshot,
          notes: `Attempted re-entry at ${gate}`,
        });

        return {
          success: false,
          code: 'ALREADY_CHECKED_IN',
          message: `Single-use pass already checked in at ${timeStr}`,
          credential: this.sanitizeCredential(credential),
          firstCheckedInAt: credential.firstCheckedInAt,
          lastCheckedInAt: credential.lastCheckedInAt,
          checkInCount: credential.checkInCount,
        };
      }

      // Execute conditional atomic update to guarantee race-condition defense
      const updated = await this.credentialRepo.atomicCheckInSingleUse(
        eventId,
        credential._id.toString()
      );

      if (!updated) {
        // Race condition: another concurrent scanner updated it first!
        const refreshed = await this.credentialRepo.findById(eventId, credential._id.toString());
        await this.checkinRepo.createCheckinLog({
          eventId: new mongoose.Types.ObjectId(eventId),
          credentialId: credential._id,
          scannedBy: scannerUser._id,
          scannerEmail: scannerUser.email,
          scannerRole,
          scannedAt: new Date(),
          scanStatus: 'ALREADY_CHECKED_IN',
          usagePolicy: 'SINGLE_USE',
          gate,
          holderSnapshot,
          notes: 'Concurrent scan collision detected',
        });

        return {
          success: false,
          code: 'ALREADY_CHECKED_IN',
          message: 'Single-use pass was just checked in by another gate scanner',
          credential: this.sanitizeCredential(refreshed || credential),
          firstCheckedInAt: refreshed?.firstCheckedInAt,
          lastCheckedInAt: refreshed?.lastCheckedInAt,
          checkInCount: refreshed?.checkInCount,
        };
      }

      // Successful Single-Use Check-in
      const log = await this.checkinRepo.createCheckinLog({
        eventId: new mongoose.Types.ObjectId(eventId),
        credentialId: updated._id,
        scannedBy: scannerUser._id,
        scannerEmail: scannerUser.email,
        scannerRole,
        scannedAt: new Date(),
        scanStatus: 'SUCCESS',
        usagePolicy: 'SINGLE_USE',
        gate,
        holderSnapshot,
        notes: input.notes || null,
      });

      return {
        success: true,
        code: 'CHECKED_IN',
        message: 'Check-in successful. Welcome!',
        credential: this.sanitizeCredential(updated),
        checkin: log,
        firstCheckedInAt: updated.firstCheckedInAt,
        lastCheckedInAt: updated.lastCheckedInAt,
        checkInCount: updated.checkInCount,
      };
    }

    // 5. Handle REUSABLE or REUSABLE_WORKER Policy
    if (
      credential.usagePolicy === 'REUSABLE' ||
      credential.usagePolicy === 'REUSABLE_WORKER'
    ) {
      // Check if unassigned worker pass requiring on-site assignment
      const isUnassigned = !credential.holder?.isAssigned || !credential.holder?.name;
      if (isUnassigned && (!input.workerName || !input.workerName.trim())) {
        return {
          success: false,
          code: 'WORKER_NAME_REQUIRED',
          message: 'Unassigned worker pass requires crew member name assignment before admission',
          credential: this.sanitizeCredential(credential),
        };
      }

      // Execute atomic reusable increment & optional worker name assignment
      const updated = await this.credentialRepo.atomicCheckInReusable(
        eventId,
        credential._id.toString(),
        input.workerName
      );

      if (!updated) {
        throw new ValidationError('Failed to update reusable credential status');
      }

      const updatedSnapshot = {
        name: updated.holder?.name || holderSnapshot.name,
        category: updated.holder?.category || holderSnapshot.category,
        formattedId: updated.formattedId,
      };

      const log = await this.checkinRepo.createCheckinLog({
        eventId: new mongoose.Types.ObjectId(eventId),
        credentialId: updated._id,
        scannedBy: scannerUser._id,
        scannerEmail: scannerUser.email,
        scannerRole,
        scannedAt: new Date(),
        scanStatus: 'SUCCESS',
        usagePolicy: updated.usagePolicy,
        gate,
        holderSnapshot: updatedSnapshot,
        notes: input.notes || `Reusable entry #${updated.checkInCount}`,
      });

      return {
        success: true,
        code: 'VALID_REUSABLE',
        message: `Reusable entry #${updated.checkInCount} approved`,
        credential: this.sanitizeCredential(updated),
        checkin: log,
        firstCheckedInAt: updated.firstCheckedInAt,
        lastCheckedInAt: updated.lastCheckedInAt,
        checkInCount: updated.checkInCount,
      };
    }

    throw new ValidationError(`Unsupported usage policy: ${credential.usagePolicy}`);
  }

  /**
   * Query recent check-in logs with RBAC check.
   */
  async listCheckinLogs(
    eventId: string,
    callerUserId: string,
    callerPlatformRole?: string,
    options?: CheckinQueryOptions
  ): Promise<IEventCredentialCheckinDocument[]> {
    await this.authorizeScanner(eventId, callerUserId, callerPlatformRole);
    return this.checkinRepo.findRecentByEvent(eventId, options);
  }

  /**
   * Retrieve live aggregated check-in statistics and entry velocity.
   */
  async getCheckinStats(
    eventId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<CheckinAggregatedStats> {
    await this.authorizeScanner(eventId, callerUserId, callerPlatformRole);
    return this.checkinRepo.getCheckinStats(eventId);
  }

  /**
   * Sanitize credential document to prevent private leaks.
   */
  private sanitizeCredential(cred: IEventCredentialDocument): any {
    return {
      id: cred._id,
      sequenceNumber: cred.sequenceNumber,
      formattedId: cred.formattedId,
      credentialType: cred.credentialType,
      terminology: cred.terminology,
      usagePolicy: cred.usagePolicy,
      status: cred.status,
      holder: {
        name: cred.holder?.name,
        category: cred.holder?.category,
        organization: cred.holder?.organization,
        isAssigned: cred.holder?.isAssigned,
      },
      checkInCount: cred.checkInCount,
      firstCheckedInAt: cred.firstCheckedInAt,
      lastCheckedInAt: cred.lastCheckedInAt,
    };
  }
}

export const eventCredentialCheckinService = new EventCredentialCheckinService();
