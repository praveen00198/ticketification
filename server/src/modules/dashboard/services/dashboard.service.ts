import { ticketRepository, TicketRepository } from '../../tickets/repositories/ticket.repository';

export class DashboardService {
  constructor(private ticketRepo: TicketRepository = ticketRepository) {}

  async getDashboardStats(userId?: string) {
    const stats = await this.ticketRepo.countStats(userId);
    const filter: any = {};
    if (userId) {
      filter.createdBy = userId;
    }
    const recentTickets = await this.ticketRepo.findAll(filter);

    return {
      stats,
      recentActivity: recentTickets.slice(0, 5).map((t) => ({
        id: t._id,
        ticketId: t.ticketId,
        name: t.name,
        email: t.email,
        phone: t.phone,
        status: t.status,
        emailStatus: t.emailStatus,
        deliveryStatus: t.deliveryStatus,
        deliveryProvider: t.deliveryProvider,
        createdAt: t.createdAt,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
