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

    return {
      status: ticket.status,
      ticket: {
        id: ticket._id,
        ticketId: ticket.ticketId,
        guestName: ticket.name,
        email: ticket.email,
        event: ticket.event,
        eventDate: ticket.eventDate,
        ticketType: ticket.ticketType,
        status: ticket.status,
        usedAt: ticket.usedAt,
        verifiedBy: ticket.verifiedBy,
      },
    };
  }

  async checkInTicket(ticketId: string, verifiedBy: string = 'Admin Scanner') {
    const ticket = await this.ticketRepo.findById(ticketId);

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
