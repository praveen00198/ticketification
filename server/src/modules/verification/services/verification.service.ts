import { ticketRepository, TicketRepository } from '../../tickets/repositories/ticket.repository';
import { checkinRepository, CheckinRepository } from '../repositories/checkin.repository';
import { guestRepository, GuestRepository } from '../../guests/repositories/guest.repository';
import { AppError } from '../../../middlewares/error.middleware';

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
}

export class VerificationService {
  constructor(
    private ticketRepo: TicketRepository = ticketRepository,
    private checkinRepo: CheckinRepository = checkinRepository,
    private guestRepo: GuestRepository = guestRepository
  ) {}

  /**
   * Verify ticket status and usage rules securely without leaking internal DB identifiers.
   */
  async verifyToken(token: string, scannerEventId?: string): Promise<VerifyResult> {
    if (!token || !token.trim()) {
      return {
        status: 'INVALID',
        message: 'Verification token is required.',
      };
    }

    const cleanToken = token.trim();
    let record = await this.ticketRepo.findByVerificationToken(cleanToken);

    if (!record) {
      record = await this.ticketRepo.findById(cleanToken);
    }

    if (!record) {
      return {
        status: 'INVALID',
        message: 'Invalid ticket. Record not found in platform database.',
      };
    }

    const { ticket, guest, ticketType, event } = record;

    // Check event scoping
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

    // Check cancelled status
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

    // Check single-use already used status
    if (ticket.status === 'USED') {
      const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
      const timeStr = lastCheckin?.checkedInAt
        ? new Date(lastCheckin.checkedInAt).toLocaleTimeString()
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

    // Check active status
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

      // Standard single-use active ticket
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

    return {
      status: 'INVALID',
      message: `Unknown ticket status: ${ticket.status}`,
    };
  }

  /**
   * Check in a ticket with race condition prevention and atomic single-use status update.
   */
  async checkInTicket(input: CheckinInput) {
    const cleanToken = input.token.trim();
    let record = await this.ticketRepo.findByVerificationToken(cleanToken);

    if (!record) {
      record = await this.ticketRepo.findById(cleanToken);
    }

    if (!record) {
      throw new AppError('Ticket not found for check-in.', 404);
    }

    const { ticket, guest, ticketType, event } = record;

    // Scoping check
    if (input.eventId && ticket.eventId !== input.eventId) {
      throw new AppError(
        `Ticket belongs to "${event.name}", not the active scanner event.`,
        400
      );
    }

    if (ticket.status === 'CANCELLED') {
      throw new AppError('Cannot check in a cancelled ticket.', 400);
    }

    // Handle Reusable Worker Ticket Check-in
    if (ticket.usagePolicy === 'REUSABLE' || ticket.usagePolicy === 'REUSABLE_WORKER') {
      let assignedName = guest?.name || null;

      // If unassigned worker, assign name now
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

      // Record check-in audit log
      const checkin = await this.checkinRepo.create({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        verifiedBy: input.verifiedBy || 'Admin Scanner',
        workerNameAssigned: assignedName,
      });

      return {
        success: true,
        status: 'VALID_WORKER',
        message: `Worker check-in recorded successfully for ${assignedName || 'Staff'}.`,
        checkinId: checkin.id,
        checkedInAt: checkin.checkedInAt,
        workerName: assignedName,
        guestName: assignedName || 'Staff',
        category: ticketType.label || ticketType.name,
      };
    }

    // Handle Single-Use Ticket Atomic Check-in (Race condition proof)
    const updated = await this.ticketRepo.markAsUsedAtomic(ticket.id);

    if (!updated) {
      const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
      const timeStr = lastCheckin?.checkedInAt
        ? new Date(lastCheckin.checkedInAt).toLocaleTimeString()
        : 'earlier';
      throw new AppError(
        `DOUBLE CHECK-IN PREVENTED: Ticket was already used at ${timeStr}.`,
        409
      );
    }

    // Insert Checkin record
    const checkin = await this.checkinRepo.create({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      verifiedBy: input.verifiedBy || 'Admin Scanner',
    });

    return {
      success: true,
      status: 'VALID',
      message: `Checked in successfully: ${guest?.name || 'Guest'} (${ticketType.label || ticketType.name}).`,
      checkinId: checkin.id,
      checkedInAt: checkin.checkedInAt,
      guestName: guest?.name || 'Guest',
      category: ticketType.label || ticketType.name,
    };
  }

  /**
   * Authoritative combined Scan & Check-in.
   * Performs validation and atomic check-in on the server side in a single request:
   * - Scans token and checks event scoping
   * - Single-use active tickets are atomically marked USED and checked in
   * - Reusable worker tickets are checked in (creating audit row)
   * - Unassigned worker passes prompt for name assignment without double check-in
   * - Already-used tickets return ALREADY_USED with the previous check-in time
   * - Invalid / Cancelled / Wrong Event tickets are rejected without check-in
   */
  async scanAndCheckIn(input: CheckinInput) {
    if (!input.token || !input.token.trim()) {
      return {
        status: 'INVALID' as VerificationStatus,
        message: 'Verification token is required.',
      };
    }

    const cleanToken = input.token.trim();
    let record = await this.ticketRepo.findByVerificationToken(cleanToken);

    if (!record) {
      record = await this.ticketRepo.findById(cleanToken);
    }

    if (!record) {
      return {
        status: 'INVALID' as VerificationStatus,
        message: 'Invalid ticket. Record not found in platform database.',
      };
    }

    const { ticket, guest, ticketType, event } = record;

    // Scoping check
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

    // Cancelled check
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

    // Single-use already used check
    if (ticket.status === 'USED') {
      const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
      const timeStr = lastCheckin?.checkedInAt
        ? new Date(lastCheckin.checkedInAt).toLocaleTimeString()
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
          lastCheckinTime: lastCheckin?.checkedInAt
            ? new Date(lastCheckin.checkedInAt).toISOString()
            : null,
        },
      };
    }

    // Handle Reusable Worker Pass
    if (ticket.usagePolicy === 'REUSABLE' || ticket.usagePolicy === 'REUSABLE_WORKER') {
      let assignedName = guest?.name || null;

      // If unassigned worker and no name provided yet, request worker name from admin
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

      // If unassigned worker and name was provided, assign name
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

      // Record check-in audit log
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

    // Handle Active Single-Use Ticket: ATOMIC Check-in (Race Condition Proof)
    const updated = await this.ticketRepo.markAsUsedAtomic(ticket.id);

    if (!updated) {
      const lastCheckin = await this.checkinRepo.getLastCheckinForTicket(ticket.id);
      const timeStr = lastCheckin?.checkedInAt
        ? new Date(lastCheckin.checkedInAt).toLocaleTimeString()
        : 'earlier';
      return {
        status: 'ALREADY_USED' as VerificationStatus,
        message: `Single-use ticket has already been checked in at ${timeStr}.`,
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

    // Insert Checkin record
    const checkin = await this.checkinRepo.create({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      verifiedBy: input.verifiedBy || 'Admin Scanner',
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
  }

  /**
   * Get recent check-ins for the scanner live feed.
   */
  async getRecentCheckins(eventId: string, limit = 20) {
    return await this.checkinRepo.getRecentCheckins(eventId, limit);
  }
}

export const verificationService = new VerificationService();
