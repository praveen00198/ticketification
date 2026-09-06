import { Ticket, ITicketDocument, TicketStatus, EmailStatus, DeliveryStatus } from '../models/ticket.model';

export class TicketRepository {
  async findByTicketId(ticketId: string, userId?: string): Promise<ITicketDocument | null> {
    const filter: any = { ticketId };
    if (userId) filter.createdBy = userId;
    return Ticket.findOne(filter).exec();
  }

  async findByVerificationToken(verificationToken: string): Promise<ITicketDocument | null> {
    return Ticket.findOne({ verificationToken }).exec();
  }

  async findById(id: string, userId?: string): Promise<ITicketDocument | null> {
    const filter: any = { _id: id };
    if (userId) filter.createdBy = userId;
    return Ticket.findOne(filter).exec();
  }

  async findByIdOrTicketId(idOrTicketId: string, userId?: string): Promise<ITicketDocument | null> {
    const filter: any = {
      $or: [{ ticketId: idOrTicketId }],
    };
    // Check if it's a valid MongoDB ObjectId
    if (idOrTicketId.match(/^[0-9a-fA-F]{24}$/)) {
      filter.$or.push({ _id: idOrTicketId });
    }
    if (userId) filter.createdBy = userId;
    return Ticket.findOne(filter).exec();
  }

  async findAll(filter: any = {}): Promise<ITicketDocument[]> {
    return Ticket.find(filter).sort({ createdAt: -1 }).exec();
  }

  async create(data: Partial<ITicketDocument>): Promise<ITicketDocument> {
    const ticket = new Ticket(data);
    return ticket.save();
  }

  async updateStatus(
    id: string,
    status: TicketStatus,
    verifiedBy?: string
  ): Promise<ITicketDocument | null> {
    const update: any = { status };
    if (status === 'USED') {
      update.usedAt = new Date();
      if (verifiedBy) update.verifiedBy = verifiedBy;
    }
    return Ticket.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updateEmailStatus(id: string, emailStatus: EmailStatus): Promise<ITicketDocument | null> {
    return Ticket.findByIdAndUpdate(id, { emailStatus }, { new: true }).exec();
  }

  /**
   * Update delivery status and optional provider message ID for a ticket.
   */
  async updateDeliveryStatus(
    id: string,
    deliveryStatus: DeliveryStatus,
    providerMessageId?: string
  ): Promise<ITicketDocument | null> {
    const update: any = { deliveryStatus };
    if (providerMessageId) {
      update.providerMessageId = providerMessageId;
    }
    // Sync the legacy emailStatus field for backward compatibility
    if (deliveryStatus === 'SENT') {
      update.emailStatus = 'SENT';
    } else if (deliveryStatus === 'FAILED') {
      update.emailStatus = 'FAILED';
    }
    return Ticket.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  /**
   * Update delivery status by provider message ID (used by webhook callbacks).
   */
  async updateDeliveryStatusByMessageId(
    providerMessageId: string,
    deliveryStatus: DeliveryStatus
  ): Promise<ITicketDocument | null> {
    const update: any = { deliveryStatus };
    if (deliveryStatus === 'SENT') {
      update.emailStatus = 'SENT';
    } else if (deliveryStatus === 'FAILED') {
      update.emailStatus = 'FAILED';
    }
    return Ticket.findOneAndUpdate({ providerMessageId }, update, { new: true }).exec();
  }

  /**
   * Update ticket image URL after generation.
   */
  async updateTicketImageUrl(id: string, ticketImageUrl: string): Promise<ITicketDocument | null> {
    return Ticket.findByIdAndUpdate(id, { ticketImageUrl }, { new: true }).exec();
  }

  async countStats(userId?: string) {
    const baseFilter: any = {};
    if (userId) {
      baseFilter.createdBy = userId;
    }

    const total = await Ticket.countDocuments(baseFilter);
    const active = await Ticket.countDocuments({ ...baseFilter, status: 'ACTIVE' });
    const used = await Ticket.countDocuments({ ...baseFilter, status: 'USED' });

    // Delivery status counts
    const deliverySent = await Ticket.countDocuments({ ...baseFilter, deliveryStatus: 'SENT' });
    const deliveryFailed = await Ticket.countDocuments({ ...baseFilter, deliveryStatus: 'FAILED' });
    const deliveryPending = await Ticket.countDocuments({ ...baseFilter, deliveryStatus: 'PENDING' });
    const deliverySending = await Ticket.countDocuments({ ...baseFilter, deliveryStatus: 'SENDING' });

    // Legacy email status counts (backward compatibility)
    const emailSent = await Ticket.countDocuments({ ...baseFilter, emailStatus: 'SENT' });
    const emailFailed = await Ticket.countDocuments({ ...baseFilter, emailStatus: 'FAILED' });
    const emailPending = await Ticket.countDocuments({ ...baseFilter, emailStatus: 'PENDING' });

    return {
      totalGuests: total,
      ticketsGenerated: total,
      // New delivery metrics
      deliverySent,
      deliveryFailed,
      deliveryPending,
      deliverySending,
      // Legacy email metrics (backward compatibility)
      emailsSent: emailSent,
      emailsFailed: emailFailed,
      emailsPending: emailPending,
      ticketsUsed: used,
      ticketsRemaining: active,
    };
  }
}

export const ticketRepository = new TicketRepository();
