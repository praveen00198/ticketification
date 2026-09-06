import { ticketRepository, TicketRepository } from '../../tickets/repositories/ticket.repository';
import { AppError } from '../../../middlewares/error.middleware';

export class VerificationService {
  constructor(private ticketRepo: TicketRepository = ticketRepository) {}

  async verifyToken(token: string) {
    if (!token || token.trim() === '') {
      throw new AppError('Verification token is required.', 400);
    }

    const cleanToken = token.trim();
    let ticket = await this.ticketRepo.findByVerificationToken(cleanToken);

    if (!ticket) {
      ticket = await this.ticketRepo.findByTicketId(cleanToken);
    }

    if (!ticket && cleanToken.match(/^[0-9a-fA-F]{24}$/)) {
      ticket = await this.ticketRepo.findById(cleanToken);
    }

    if (!ticket) {
      return {
        status: 'INVALID',
        message: 'Invalid ticket token. Ticket record not found in system database.',
      };
    }

    const rawDoc: any = typeof (ticket as any).toObject === 'function' ? (ticket as any).toObject() : ticket;
    const resolvedName = rawDoc.name || rawDoc.guestName || (ticket as any).name || (ticket as any).guestName || 'Guest';
    const docId = ticket._id ? ticket._id.toString() : (rawDoc.id || rawDoc._id || '');

    return {
      status: ticket.status,
      ticket: {
        id: docId,
        _id: docId,
        ticketId: ticket.ticketId,
        name: resolvedName,
        guestName: resolvedName,
        email: ticket.email || '',
        phone: ticket.phone || '',
        event: ticket.event || '',
        eventDate: ticket.eventDate,
        ticketType: ticket.ticketType || 'VIP Pass',
        organization: ticket.organization || '',
        designation: ticket.designation || '',
        status: ticket.status,
        usedAt: ticket.usedAt,
        verifiedBy: ticket.verifiedBy,
        ticketImageUrl: ticket.ticketImageUrl,
      },
    };
  }

  async checkInTicket(idOrTicketId: string, verifiedBy: string = 'Admin Scanner') {
    if (!idOrTicketId || idOrTicketId === 'undefined' || idOrTicketId === 'null') {
      throw new AppError('Valid ticket ID or database ID is required for check-in.', 400);
    }

    const ticket = await this.ticketRepo.findByIdOrTicketId(idOrTicketId);

    if (!ticket) {
      throw new AppError('Ticket not found for check-in.', 404);
    }

    if (ticket.status === 'USED') {
      throw new AppError(`Ticket ${ticket.ticketId} has ALREADY been used at ${ticket.usedAt?.toLocaleTimeString() || 'earlier'}.`, 400);
    }

    if (ticket.status !== 'ACTIVE') {
      throw new AppError(`Cannot check in ticket with status '${ticket.status}'.`, 400);
    }

    const updated = await this.ticketRepo.updateStatus(ticket._id.toString(), 'USED', verifiedBy);

    return {
      success: true,
      message: `Ticket ${ticket.ticketId} checked in successfully.`,
      ticket: updated,
    };
  }
}

export const verificationService = new VerificationService();
