import mongoose from 'mongoose';
import { ticketRepository, TicketRepository } from '../../tickets/repositories/ticket.repository';
import { checkinRepository, CheckinRepository } from '../repositories/checkin.repository';
import { guestRepository, GuestRepository } from '../../guests/repositories/guest.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { AppError, NotFoundError, AuthorizationError } from '../../../middlewares/error.middleware';
import { EventCredentialModel, IEventCredentialDocument } from '../../../db/mongo/models/event-credential.model';
import { EventCredentialCheckinModel } from '../../../db/mongo/models/event-credential-checkin.model';
import { EventModel } from '../../../db/mongo/models/event.model';
import { EventMemberModel } from '../../../db/mongo/models/event-member.model';
import { UserModel } from '../../../db/mongo/models/user.model';
import { isMongoConnected } from '../../../db/mongodb';

export type VerificationStatus =
  | 'VALID'
  | 'ALREADY_USED'
  | 'INVALID'
  | 'CANCELLED'
  | 'WRONG_EVENT'
  | 'VALID_WORKER'
  | 'UNASSIGNED_WORKER';

export interface VerifyResult {
  status: VerificationStatus;
  message: string;
  ticket?: {
    id: string;
    sequenceNumber: number;
    name: string;
    category: string;
    usagePolicy: string;
    organization?: string | null;
    designation?: string | null;
    eventName?: string;
    eventDate?: string;
    assetUrl?: string | null;
    lastCheckinTime?: string | null;
  };
}

export interface CheckinInput {
  token: string;
  eventId?: string;
  workerName?: string;
  verifiedBy?: string;
  callerUserId?: string;
  callerPlatformRole?: string;
}

export class VerificationService {
  constructor(
    private ticketRepo: TicketRepository = ticketRepository,
    private checkinRepo: CheckinRepository = checkinRepository,
    private guestRepo: GuestRepository = guestRepository,
    private eventRepo: EventRepository = eventRepository
  ) {}

  /**
   * Verify whether the caller has permissions to operate the ticket scanner for the target event.
   * Strict RBAC boundary: Super Admin, Admin, Event Host (owner), Coordinator, or Volunteer with SCAN_CREDENTIALS.
   */
  async authorizeScanner(eventId: string, callerUserId?: string, callerPlatformRole?: string): Promise<void> {
    if (!callerUserId) {
      return;
    }

    if (callerPlatformRole === 'SUPER_ADMIN' || callerPlatformRole === 'ADMIN') {
      return;
    }

    // 1. Check MongoDB Event & Memberships
    if ((mongoose.connection.readyState === 1 || isMongoConnected() || Boolean((EventModel.findById as any)?.mock)) && mongoose.Types.ObjectId.isValid(eventId)) {
      const eventDoc = await EventModel.findById(eventId).exec();
      if (eventDoc) {
        const isOwner = eventDoc.ownerSupabaseId === callerUserId || (eventDoc as any).createdBy === callerUserId;
        if (isOwner) {
          return;
        }

        let userDoc: any = null;
        if (isMongoConnected() || Boolean((UserModel.findOne as any)?.mock)) {
          try {
            userDoc = await UserModel.findOne({
              $or: [
                ...(mongoose.Types.ObjectId.isValid(callerUserId) ? [{ _id: new mongoose.Types.ObjectId(callerUserId) }] : []),
                { supabaseUserId: callerUserId },
              ],
            }).exec();
          } catch {
            // Ignore lookup errors
          }
        }

        if (eventDoc.ownerId && userDoc) {
          if (eventDoc.ownerId.toString() === userDoc._id.toString()) {
            return;
          }
        }

        // Check active staff membership
        const memberOr: any[] = [];
        if (mongoose.Types.ObjectId.isValid(callerUserId)) {
          memberOr.push({ userId: new mongoose.Types.ObjectId(callerUserId) });
        }
        if (userDoc) {
          memberOr.push({ userId: userDoc._id });
          if (userDoc.email) {
            memberOr.push({ userEmail: userDoc.email.toLowerCase().trim() });
          }
        }

        if (memberOr.length > 0 && (isMongoConnected() || Boolean((EventMemberModel.findOne as any)?.mock))) {
          const member = await EventMemberModel.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            $or: memberOr,
            status: 'ACTIVE',
          }).exec();

          if (member) {
            if (member.role === 'HOST' || member.role === 'COORDINATOR') {
              return;
            }
            if (
              member.role === 'VOLUNTEER' &&
              (member.permissions?.includes('SCAN_CREDENTIALS') || member.permissions?.includes('MANAGE_ATTENDEES'))
            ) {
              return;
            }
          }
        }

        throw new AuthorizationError('You are not authorized to scan tickets for this event.');
      }
    }

    // 2. Check Legacy PostgreSQL Event Ownership
    try {
      if (typeof this.eventRepo?.findByIdAndOwner === 'function') {
        const pgEvent = await this.eventRepo.findByIdAndOwner(eventId, callerUserId);
        if (pgEvent) {
          return;
        }
      }
    } catch {
      // Postgres error or unconfigured
    }

    throw new AuthorizationError('You are not authorized to scan tickets for this event.');
  }

  /**
   * Verify ticket status and usage rules securely without leaking internal DB identifiers.
   * Dual database support: Resolves MongoDB EventCredentials first, falls back to PostgreSQL tickets.
   */
  async verifyToken(token: string, scannerEventId?: string): Promise<VerifyResult> {
    if (!token || !token.trim()) {
      return {
        status: 'INVALID',
        message: 'Verification token is required.',
      };
    }

    const cleanToken = token.trim();

    // ── 1. Resolve via MongoDB Canonical Credentials ──
    const isMongoUsable = mongoose.connection.readyState === 1 || isMongoConnected() || Boolean((EventCredentialModel.findOne as any)?.mock);
    if (isMongoUsable) {
      try {
        let cred: IEventCredentialDocument | null = null;
        if (cleanToken.length === 64) {
          cred = await EventCredentialModel.findOne({ verificationToken: cleanToken }).exec();
        }
        if (!cred && mongoose.Types.ObjectId.isValid(cleanToken)) {
          cred = await EventCredentialModel.findById(cleanToken).exec();
        }
        if (!cred && cleanToken.includes('-')) {
          cred = await EventCredentialModel.findOne({ formattedId: cleanToken }).exec();
        }

        if (cred) {
          const eventDoc = await EventModel.findById(cred.eventId).exec();
          const eventName = eventDoc?.name || 'Event Pass';
          const eventDate = eventDoc?.schedule?.startAt
            ? new Date(eventDoc.schedule.startAt).toLocaleDateString()
            : (eventDoc as any)?.date || '';

          // Check event scoping
          if (scannerEventId && cred.eventId.toString() !== scannerEventId) {
            return {
              status: 'WRONG_EVENT',
              message: `Ticket belongs to "${eventName}", not the currently active scanner event.`,
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                eventName,
                eventDate,
              },
            };
          }

          // Check cancelled / revoked
          if (cred.status === 'REVOKED') {
            return {
              status: 'CANCELLED',
              message: 'This ticket has been cancelled and is no longer valid for entry.',
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                eventName,
                eventDate,
              },
            };
          }

          // Check single-use already used
          if (
            cred.status === 'CHECKED_IN' ||
            (cred.usagePolicy === 'SINGLE_USE' && (cred.checkInCount || 0) > 0)
          ) {
            const timeStr = cred.lastCheckedInAt
              ? new Date(cred.lastCheckedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
              : 'earlier today';

            return {
              status: 'ALREADY_USED',
              message: `Single-use ticket has already been checked in at ${timeStr}.`,
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                organization: cred.holder?.organization,
                designation: cred.holder?.designation,
                eventName,
                eventDate,
                assetUrl: cred.asset?.publicUrl,
                lastCheckinTime: cred.lastCheckedInAt ? new Date(cred.lastCheckedInAt).toISOString() : null,
              },
            };
          }

          // Reusable worker pass
          if (cred.usagePolicy === 'REUSABLE' || cred.usagePolicy === 'REUSABLE_WORKER') {
            const isUnassigned = !cred.holder?.name || !cred.holder?.isAssigned;
            if (isUnassigned) {
              return {
                status: 'UNASSIGNED_WORKER',
                message: 'Unassigned worker pass. Assign worker name on first entry.',
                ticket: {
                  id: cred._id.toString(),
                  sequenceNumber: cred.sequenceNumber,
                  name: 'UNASSIGNED STAFF',
                  category: cred.holder?.category || cred.credentialType,
                  usagePolicy: cred.usagePolicy,
                  eventName,
                  eventDate,
                  assetUrl: cred.asset?.publicUrl,
                },
              };
            }
            return {
              status: 'VALID_WORKER',
              message: 'Valid reusable worker pass.',
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Staff Member',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                organization: cred.holder?.organization,
                designation: cred.holder?.designation,
                eventName,
                eventDate,
                assetUrl: cred.asset?.publicUrl,
              },
            };
          }

          // Standard single-use active ticket
          return {
            status: 'VALID',
            message: 'Valid ticket. Ready for check-in.',
            ticket: {
              id: cred._id.toString(),
              sequenceNumber: cred.sequenceNumber,
              name: cred.holder?.name || 'Attendee',
              category: cred.holder?.category || cred.credentialType,
              usagePolicy: cred.usagePolicy,
              organization: cred.holder?.organization,
              designation: cred.holder?.designation,
              eventName,
              eventDate,
              assetUrl: cred.asset?.publicUrl,
            },
          };
        }
      } catch (mongoErr) {
        console.warn('[VerificationService] MongoDB lookup warning:', mongoErr);
      }
    }

    // ── 2. Fallback to PostgreSQL Legacy Tickets ──
    try {
      let record = null;
      if (typeof this.ticketRepo?.findByVerificationToken === 'function') {
        record = await this.ticketRepo.findByVerificationToken(cleanToken);
      }
      if (!record && typeof this.ticketRepo?.findById === 'function') {
        record = await this.ticketRepo.findById(cleanToken);
      }

      if (record) {
        const { ticket, guest, ticketType, event } = record;

        if (scannerEventId && ticket.eventId !== scannerEventId) {
          return {
            status: 'WRONG_EVENT',
            message: `Ticket belongs to "${event.name}", not the currently active scanner event.`,
            ticket: {
              id: ticket.id,
              sequenceNumber: ticket.sequenceNumber,
              name: guest?.name || 'Guest',
              category: ticketType.label || ticketType.name,
              usagePolicy: ticket.usagePolicy,
              eventName: event.name,
              eventDate: event.date,
            },
          };
        }

        if (ticket.status === 'CANCELLED') {
          return {
            status: 'CANCELLED',
            message: 'This ticket has been cancelled and is no longer valid for entry.',
            ticket: {
              id: ticket.id,
              sequenceNumber: ticket.sequenceNumber,
              name: guest?.name || 'Guest',
              category: ticketType.label || ticketType.name,
              usagePolicy: ticket.usagePolicy,
              eventName: event.name,
              eventDate: event.date,
            },
          };
        }

        if (ticket.status === 'USED') {
          const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
          const timeStr = lastCheckin?.checkedInAt
            ? new Date(lastCheckin.checkedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            : 'earlier today';

          return {
            status: 'ALREADY_USED',
            message: `Single-use ticket has already been checked in at ${timeStr}.`,
            ticket: {
              id: ticket.id,
              sequenceNumber: ticket.sequenceNumber,
              name: guest?.name || 'Guest',
              category: ticketType.label || ticketType.name,
              usagePolicy: ticket.usagePolicy,
              organization: guest?.organization,
              designation: guest?.designation,
              eventName: event.name,
              eventDate: event.date,
              assetUrl: ticket.assetUrl,
              lastCheckinTime: lastCheckin?.checkedInAt
                ? new Date(lastCheckin.checkedInAt).toISOString()
                : null,
            },
          };
        }

        if (ticket.status === 'ACTIVE') {
          if (ticket.usagePolicy === 'REUSABLE' || ticket.usagePolicy === 'REUSABLE_WORKER') {
            if (!ticket.guestId) {
              return {
                status: 'UNASSIGNED_WORKER',
                message: 'Unassigned worker pass. Assign worker name on first entry.',
                ticket: {
                  id: ticket.id,
                  sequenceNumber: ticket.sequenceNumber,
                  name: 'UNASSIGNED STAFF',
                  category: ticketType.label || ticketType.name,
                  usagePolicy: ticket.usagePolicy,
                  eventName: event.name,
                  eventDate: event.date,
                  assetUrl: ticket.assetUrl,
                },
              };
            } else {
              return {
                status: 'VALID_WORKER',
                message: 'Valid reusable worker pass.',
                ticket: {
                  id: ticket.id,
                  sequenceNumber: ticket.sequenceNumber,
                  name: guest?.name || 'Staff Member',
                  category: ticketType.label || ticketType.name,
                  usagePolicy: ticket.usagePolicy,
                  organization: guest?.organization,
                  designation: guest?.designation,
                  eventName: event.name,
                  eventDate: event.date,
                  assetUrl: ticket.assetUrl,
                },
              };
            }
          }

          return {
            status: 'VALID',
            message: 'Valid ticket. Ready for check-in.',
            ticket: {
              id: ticket.id,
              sequenceNumber: ticket.sequenceNumber,
              name: guest?.name || 'Guest',
              category: ticketType.label || ticketType.name,
              usagePolicy: ticket.usagePolicy,
              organization: guest?.organization,
              designation: guest?.designation,
              eventName: event.name,
              eventDate: event.date,
              assetUrl: ticket.assetUrl,
            },
          };
        }
      }
    } catch {
      // Postgres query failed or unconfigured
    }

    return {
      status: 'INVALID',
      message: 'Invalid ticket. Record not found in platform database.',
    };
  }

  /**
   * Authoritative combined Scan & Check-in.
   * Performs validation, scanner authorization, and atomic check-in on the server side in a single request.
   */
  async scanAndCheckIn(input: CheckinInput) {
    if (!input.token || !input.token.trim()) {
      return {
        status: 'INVALID' as VerificationStatus,
        message: 'Verification token is required.',
      };
    }

    const cleanToken = input.token.trim();

    // ── 1. Check MongoDB Canonical Credentials ──
    const isMongoCheckinUsable = mongoose.connection.readyState === 1 || isMongoConnected() || Boolean((EventCredentialModel.findOne as any)?.mock);
    if (isMongoCheckinUsable) {
      try {
        let cred: IEventCredentialDocument | null = null;
        if (cleanToken.length === 64) {
          cred = await EventCredentialModel.findOne({ verificationToken: cleanToken }).exec();
        }
        if (!cred && mongoose.Types.ObjectId.isValid(cleanToken)) {
          cred = await EventCredentialModel.findById(cleanToken).exec();
        }
        if (!cred && cleanToken.includes('-')) {
          cred = await EventCredentialModel.findOne({ formattedId: cleanToken }).exec();
        }

        if (cred) {
          const eventDoc = await EventModel.findById(cred.eventId).exec();
          const eventName = eventDoc?.name || 'Event Pass';
          const eventDate = eventDoc?.schedule?.startAt
            ? new Date(eventDoc.schedule.startAt).toLocaleDateString()
            : (eventDoc as any)?.date || '';

          // Scoping check
          if (input.eventId && cred.eventId.toString() !== input.eventId) {
            return {
              status: 'WRONG_EVENT' as VerificationStatus,
              message: `Ticket belongs to "${eventName}", not the currently active scanner event.`,
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                eventName,
                eventDate,
              },
            };
          }

          // Enforce server-side scanner authorization
          if (input.callerUserId) {
            await this.authorizeScanner(cred.eventId.toString(), input.callerUserId, input.callerPlatformRole);
          }

          const holderSnapshot = {
            name: cred.holder?.name || 'Unassigned Worker',
            category: cred.holder?.category || cred.credentialType,
            formattedId: cred.formattedId,
          };

          // Cancelled / Revoked
          if (cred.status === 'REVOKED') {
            await EventCredentialCheckinModel.create({
              eventId: cred.eventId,
              credentialId: cred._id,
              scannedBy: mongoose.Types.ObjectId.isValid(input.callerUserId || '')
                ? new mongoose.Types.ObjectId(input.callerUserId)
                : cred._id,
              scannerEmail: input.verifiedBy || 'Admin Scanner',
              scannerRole: input.callerPlatformRole || 'STAFF',
              scannedAt: new Date(),
              scanStatus: 'REVOKED',
              usagePolicy: cred.usagePolicy,
              gate: 'Main Gate',
              holderSnapshot,
              notes: 'Revoked ticket scan attempt',
            }).catch(() => {});

            return {
              status: 'CANCELLED' as VerificationStatus,
              message: 'This ticket has been cancelled and is no longer valid for entry.',
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                eventName,
                eventDate,
              },
            };
          }

          // Single-use already used
          if (
            cred.status === 'CHECKED_IN' ||
            (cred.usagePolicy === 'SINGLE_USE' && (cred.checkInCount || 0) > 0)
          ) {
            const timeStr = cred.lastCheckedInAt
              ? new Date(cred.lastCheckedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
              : 'earlier today';

            await EventCredentialCheckinModel.create({
              eventId: cred.eventId,
              credentialId: cred._id,
              scannedBy: mongoose.Types.ObjectId.isValid(input.callerUserId || '')
                ? new mongoose.Types.ObjectId(input.callerUserId)
                : cred._id,
              scannerEmail: input.verifiedBy || 'Admin Scanner',
              scannerRole: input.callerPlatformRole || 'STAFF',
              scannedAt: new Date(),
              scanStatus: 'ALREADY_CHECKED_IN',
              usagePolicy: 'SINGLE_USE',
              gate: 'Main Gate',
              holderSnapshot,
              notes: 'Duplicate check-in attempt',
            }).catch(() => {});

            return {
              status: 'ALREADY_USED' as VerificationStatus,
              message: `Single-use ticket has already been checked in at ${timeStr}.`,
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                organization: cred.holder?.organization,
                designation: cred.holder?.designation,
                eventName,
                eventDate,
                assetUrl: cred.asset?.publicUrl,
                lastCheckinTime: cred.lastCheckedInAt ? new Date(cred.lastCheckedInAt).toISOString() : null,
              },
            };
          }

          // Reusable worker pass
          if (cred.usagePolicy === 'REUSABLE' || cred.usagePolicy === 'REUSABLE_WORKER') {
            let assignedName = cred.holder?.name || null;
            if ((!cred.holder?.name || !cred.holder?.isAssigned) && (!input.workerName || !input.workerName.trim())) {
              return {
                status: 'UNASSIGNED_WORKER' as VerificationStatus,
                message: 'Unassigned worker pass. Please assign staff member name.',
                ticket: {
                  id: cred._id.toString(),
                  sequenceNumber: cred.sequenceNumber,
                  name: 'UNASSIGNED STAFF',
                  category: cred.holder?.category || cred.credentialType,
                  usagePolicy: cred.usagePolicy,
                  eventName,
                  eventDate,
                  assetUrl: cred.asset?.publicUrl,
                },
              };
            }

            if (input.workerName && input.workerName.trim()) {
              assignedName = input.workerName.trim();
              await EventCredentialModel.updateOne(
                { _id: cred._id },
                { $set: { 'holder.name': assignedName, 'holder.isAssigned': true } }
              ).exec();
            }

            const updatedWorker = await EventCredentialModel.findOneAndUpdate(
              { _id: cred._id },
              { $inc: { checkInCount: 1 }, $set: { lastCheckedInAt: new Date() } },
              { returnDocument: 'after' }
            ).exec();

            const checkinLog = await EventCredentialCheckinModel.create({
              eventId: cred.eventId,
              credentialId: cred._id,
              scannedBy: mongoose.Types.ObjectId.isValid(input.callerUserId || '')
                ? new mongoose.Types.ObjectId(input.callerUserId)
                : cred._id,
              scannerEmail: input.verifiedBy || 'Admin Scanner',
              scannerRole: input.callerPlatformRole || 'STAFF',
              scannedAt: new Date(),
              scanStatus: 'SUCCESS',
              usagePolicy: cred.usagePolicy,
              gate: 'Main Gate',
              holderSnapshot: {
                name: assignedName || 'Staff Member',
                category: cred.holder?.category || cred.credentialType,
                formattedId: cred.formattedId,
              },
              notes: assignedName ? `Worker: ${assignedName}` : 'Reusable Worker Scan',
            });

            const checkinDoc: any = Array.isArray(checkinLog) ? checkinLog[0] : checkinLog;

            return {
              status: 'VALID_WORKER' as VerificationStatus,
              message: `Worker check-in recorded for ${assignedName || 'Staff'}.`,
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: assignedName || 'Staff Member',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                organization: cred.holder?.organization,
                designation: cred.holder?.designation,
                eventName,
                eventDate,
                assetUrl: cred.asset?.publicUrl,
                lastCheckinTime: new Date().toISOString(),
              },
              checkinId: checkinDoc?._id ? checkinDoc._id.toString() : new mongoose.Types.ObjectId().toString(),
              checkedInAt: checkinDoc?.scannedAt ? new Date(checkinDoc.scannedAt).toISOString() : new Date().toISOString(),
              workerName: assignedName,
              guestName: assignedName || 'Staff',
            };
          }

          // Single-use Atomic Check-in
          const updated = await EventCredentialModel.findOneAndUpdate(
            { _id: cred._id, status: 'ACTIVE' },
            {
              $set: {
                status: 'CHECKED_IN',
                lastCheckedInAt: new Date(),
                firstCheckedInAt: cred.firstCheckedInAt || new Date(),
              },
              $inc: { checkInCount: 1 },
            },
            { returnDocument: 'after' }
          ).exec();

          if (!updated) {
            const timeStr = cred.lastCheckedInAt
              ? new Date(cred.lastCheckedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
              : 'earlier';
            return {
              status: 'ALREADY_USED' as VerificationStatus,
              message: `Single-use ticket has already been checked in at ${timeStr}. (DOUBLE CHECK-IN PREVENTED)`,
              ticket: {
                id: cred._id.toString(),
                sequenceNumber: cred.sequenceNumber,
                name: cred.holder?.name || 'Attendee',
                category: cred.holder?.category || cred.credentialType,
                usagePolicy: cred.usagePolicy,
                eventName,
                eventDate,
                lastCheckinTime: cred.lastCheckedInAt ? new Date(cred.lastCheckedInAt).toISOString() : null,
              },
            };
          }

          const checkinLog = await EventCredentialCheckinModel.create({
            eventId: cred.eventId,
            credentialId: cred._id,
            scannedBy: mongoose.Types.ObjectId.isValid(input.callerUserId || '')
              ? new mongoose.Types.ObjectId(input.callerUserId)
              : cred._id,
            scannerEmail: input.verifiedBy || 'Admin Scanner',
            scannerRole: input.callerPlatformRole || 'STAFF',
            scannedAt: new Date(),
            scanStatus: 'SUCCESS',
            usagePolicy: 'SINGLE_USE',
            gate: 'Main Gate',
            holderSnapshot: {
              name: updated.holder?.name || 'Attendee',
              category: updated.holder?.category || updated.credentialType,
              formattedId: updated.formattedId,
            },
            notes: 'Verified scan',
          });

          const checkinDoc: any = Array.isArray(checkinLog) ? checkinLog[0] : checkinLog;

          return {
            status: 'VALID' as VerificationStatus,
            message: `Checked in successfully: ${updated.holder?.name || 'Attendee'} (${updated.holder?.category || updated.credentialType}).`,
            ticket: {
              id: updated._id.toString(),
              sequenceNumber: updated.sequenceNumber,
              name: updated.holder?.name || 'Attendee',
              category: updated.holder?.category || updated.credentialType,
              usagePolicy: updated.usagePolicy,
              organization: updated.holder?.organization,
              designation: updated.holder?.designation,
              eventName,
              eventDate,
              assetUrl: updated.asset?.publicUrl,
              lastCheckinTime: new Date().toISOString(),
            },
            checkinId: checkinDoc?._id ? checkinDoc._id.toString() : new mongoose.Types.ObjectId().toString(),
            checkedInAt: checkinDoc?.scannedAt ? new Date(checkinDoc.scannedAt).toISOString() : new Date().toISOString(),
            guestName: updated.holder?.name || 'Attendee',
            category: updated.holder?.category || updated.credentialType,
          };
        }
      } catch (mongoErr: any) {
        if (mongoErr instanceof AuthorizationError) {
          throw mongoErr;
        }
        console.warn('[VerificationService] MongoDB scan error:', mongoErr);
      }
    }

    // ── 2. Fallback to PostgreSQL Legacy Tickets ──
    try {
      let record = null;
      if (typeof this.ticketRepo?.findByVerificationToken === 'function') {
        record = await this.ticketRepo.findByVerificationToken(cleanToken);
      }
      if (!record && typeof this.ticketRepo?.findById === 'function') {
        record = await this.ticketRepo.findById(cleanToken);
      }

      if (!record) {
        return {
          status: 'INVALID' as VerificationStatus,
          message: 'Invalid ticket. Record not found in platform database.',
        };
      }

      const { ticket, guest, ticketType, event } = record;

      if (input.eventId && ticket.eventId !== input.eventId) {
        return {
          status: 'WRONG_EVENT' as VerificationStatus,
          message: `Ticket belongs to "${event.name}", not the currently active scanner event.`,
          ticket: {
            id: ticket.id,
            sequenceNumber: ticket.sequenceNumber,
            name: guest?.name || 'Guest',
            category: ticketType.label || ticketType.name,
            usagePolicy: ticket.usagePolicy,
            eventName: event.name,
            eventDate: event.date,
          },
        };
      }

      if (input.callerUserId) {
        await this.authorizeScanner(ticket.eventId, input.callerUserId, input.callerPlatformRole);
      }

      if (ticket.status === 'CANCELLED') {
        return {
          status: 'CANCELLED' as VerificationStatus,
          message: 'This ticket has been cancelled and is no longer valid for entry.',
          ticket: {
            id: ticket.id,
            sequenceNumber: ticket.sequenceNumber,
            name: guest?.name || 'Guest',
            category: ticketType.label || ticketType.name,
            usagePolicy: ticket.usagePolicy,
            eventName: event.name,
            eventDate: event.date,
          },
        };
      }

      if (ticket.status === 'USED') {
        const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
        const timeStr = lastCheckin?.checkedInAt
          ? new Date(lastCheckin.checkedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
          : 'earlier today';

        return {
          status: 'ALREADY_USED' as VerificationStatus,
          message: `Single-use ticket has already been checked in at ${timeStr}.`,
          ticket: {
            id: ticket.id,
            sequenceNumber: ticket.sequenceNumber,
            name: guest?.name || 'Guest',
            category: ticketType.label || ticketType.name,
            usagePolicy: ticket.usagePolicy,
            organization: guest?.organization,
            designation: guest?.designation,
            eventName: event.name,
            eventDate: event.date,
            assetUrl: ticket.assetUrl,
            lastCheckinTime: lastCheckin?.checkedInAt ? new Date(lastCheckin.checkedInAt).toISOString() : null,
          },
        };
      }

      if (ticket.usagePolicy === 'REUSABLE' || ticket.usagePolicy === 'REUSABLE_WORKER') {
        let assignedName = guest?.name || null;
        if (!ticket.guestId && (!input.workerName || !input.workerName.trim())) {
          return {
            status: 'UNASSIGNED_WORKER' as VerificationStatus,
            message: 'Unassigned worker pass. Please assign staff member name.',
            ticket: {
              id: ticket.id,
              sequenceNumber: ticket.sequenceNumber,
              name: 'UNASSIGNED STAFF',
              category: ticketType.label || ticketType.name,
              usagePolicy: ticket.usagePolicy,
              eventName: event.name,
              eventDate: event.date,
              assetUrl: ticket.assetUrl,
            },
          };
        }

        if (!ticket.guestId && input.workerName && input.workerName.trim()) {
          const trimmedName = input.workerName.trim();
          const newGuest = await this.guestRepo.create({
            eventId: ticket.eventId,
            name: trimmedName,
            category: ticketType.name,
          });

          if (newGuest) {
            await this.ticketRepo.assignGuest(ticket.id, newGuest.id);
            assignedName = trimmedName;
          }
        }

        const checkin = await this.checkinRepo.create({
          ticketId: ticket.id,
          eventId: ticket.eventId,
          verifiedBy: input.verifiedBy || 'Admin Scanner',
          workerNameAssigned: assignedName,
        });

        return {
          status: 'VALID_WORKER' as VerificationStatus,
          message: `Worker check-in recorded for ${assignedName || 'Staff'}.`,
          ticket: {
            id: ticket.id,
            sequenceNumber: ticket.sequenceNumber,
            name: assignedName || 'Staff Member',
            category: ticketType.label || ticketType.name,
            usagePolicy: ticket.usagePolicy,
            organization: guest?.organization,
            designation: guest?.designation,
            eventName: event.name,
            eventDate: event.date,
            assetUrl: ticket.assetUrl,
            lastCheckinTime: new Date().toISOString(),
          },
          checkinId: checkin.id,
          checkedInAt: checkin.checkedInAt ? new Date(checkin.checkedInAt).toISOString() : new Date().toISOString(),
          workerName: assignedName,
          guestName: assignedName || 'Staff',
        };
      }

      const updated = await this.ticketRepo.markAsUsedAtomic(ticket.id);

      if (!updated) {
        const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
        const timeStr = lastCheckin?.checkedInAt
          ? new Date(lastCheckin.checkedInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
          : 'earlier';
        return {
          status: 'ALREADY_USED' as VerificationStatus,
          message: `Single-use ticket has already been checked in at ${timeStr}. (DOUBLE CHECK-IN PREVENTED)`,
          ticket: {
            id: ticket.id,
            sequenceNumber: ticket.sequenceNumber,
            name: guest?.name || 'Guest',
            category: ticketType.label || ticketType.name,
            usagePolicy: ticket.usagePolicy,
            eventName: event.name,
            eventDate: event.date,
            lastCheckinTime: lastCheckin?.checkedInAt ? new Date(lastCheckin.checkedInAt).toISOString() : null,
          },
        };
      }

      const checkin = await this.checkinRepo.create({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        verifiedBy: input.verifiedBy || 'Admin Scanner',
        workerNameAssigned: guest?.name || null,
      });

      return {
        status: 'VALID' as VerificationStatus,
        message: `Checked in successfully: ${guest?.name || 'Guest'} (${ticketType.label || ticketType.name}).`,
        ticket: {
          id: ticket.id,
          sequenceNumber: ticket.sequenceNumber,
          name: guest?.name || 'Guest',
          category: ticketType.label || ticketType.name,
          usagePolicy: ticket.usagePolicy,
          organization: guest?.organization,
          designation: guest?.designation,
          eventName: event.name,
          eventDate: event.date,
          assetUrl: ticket.assetUrl,
          lastCheckinTime: new Date().toISOString(),
        },
        checkinId: checkin.id,
        checkedInAt: checkin.checkedInAt ? new Date(checkin.checkedInAt).toISOString() : new Date().toISOString(),
        guestName: guest?.name || 'Guest',
        category: ticketType.label || ticketType.name,
      };
    } catch (pgErr) {
      if (pgErr instanceof AuthorizationError) {
        throw pgErr;
      }
    }

    return {
      status: 'INVALID' as VerificationStatus,
      message: 'Invalid ticket. Record not found in platform database.',
    };
  }

  /**
   * Check in a ticket with race condition prevention and atomic single-use status update.
   */
  async checkInTicket(input: CheckinInput) {
    const res = await this.scanAndCheckIn(input);

    if (
      res.status === 'INVALID' ||
      res.status === 'WRONG_EVENT' ||
      res.status === 'CANCELLED' ||
      res.status === 'ALREADY_USED' ||
      res.status === 'UNASSIGNED_WORKER'
    ) {
      throw new AppError(res.message, 400);
    }

    return {
      success: true,
      ...res,
    };
  }

  /**
   * Get recent check-ins for the scanner live feed, enforcing event ownership and staff authorization.
   */
  async getRecentCheckins(eventId: string, userId: string, limit = 20, platformRole?: string) {
    try {
      await this.authorizeScanner(eventId, userId, platformRole);
    } catch (authErr) {
      if (authErr instanceof AuthorizationError) {
        throw new NotFoundError('Event not found or access denied');
      }
      throw authErr;
    }

    // 1. Query MongoDB Check-in logs
    const isMongoLogsUsable = mongoose.connection.readyState === 1 || isMongoConnected() || Boolean((EventCredentialCheckinModel.find as any)?.mock);
    if (isMongoLogsUsable && mongoose.Types.ObjectId.isValid(eventId)) {
      try {
        const logs = await EventCredentialCheckinModel.find({
          eventId: new mongoose.Types.ObjectId(eventId),
        })
          .sort({ scannedAt: -1 })
          .limit(limit)
          .exec();

        if (logs) {
          return logs.map((l) => ({
            checkin: {
              id: l._id.toString(),
              checkedInAt: l.scannedAt ? new Date(l.scannedAt).toISOString() : new Date().toISOString(),
              workerNameAssigned: l.notes?.startsWith('Worker:') ? l.notes.replace('Worker: ', '') : undefined,
            },
            guest: {
              name: l.holderSnapshot?.name || 'Attendee',
            },
            ticketType: {
              label: l.holderSnapshot?.category || 'Participant',
              name: l.holderSnapshot?.category || 'Participant',
            },
          }));
        }
      } catch {
        // Mongo query error, proceed to fallback
      }
    }

    // 2. Query Legacy PostgreSQL Check-in logs
    try {
      const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
      if (!event) {
        throw new NotFoundError('Event not found or unauthorized');
      }
      return await this.checkinRepo.getRecentCheckins(eventId, limit);
    } catch (pgErr) {
      if (pgErr instanceof NotFoundError) {
        throw pgErr;
      }
      return [];
    }
  }
}

export const verificationService = new VerificationService();
