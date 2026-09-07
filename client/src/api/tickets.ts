import { apiClient } from './client';

export interface TicketListItem {
  id: string;
  sequenceNumber: number;
  verificationToken: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED';
  usagePolicy: 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER' | string;
  assetUrl?: string | null;
  createdAt: string;
  guest?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
    designation?: string | null;
    category?: string;
  };
  ticketType?: {
    id: string;
    name: string;
    label: string;
    usagePolicy: string;
  };
}

export interface TicketListResponse {
  tickets: TicketListItem[];
  total: number;
  limit: number;
  offset: number;
}

export const ticketsApi = {
  async generateTickets(eventId: string) {
    const res: any = await apiClient.post(`/tickets/events/${eventId}/generate`);
    return res.data;
  },

  async generateWorkerTickets(eventId: string, count: number, ticketTypeName = 'WORKER') {
    const res: any = await apiClient.post(`/tickets/events/${eventId}/generate-worker`, {
      count,
      ticketTypeName,
    });
    return res.data;
  },

  async getTickets(
    eventId: string,
    filters: { status?: string; search?: string; limit?: number; offset?: number } = {}
  ): Promise<TicketListResponse> {
    const res: any = await apiClient.get(`/tickets/events/${eventId}`, {
      params: filters,
    });
    return res.data || { tickets: [], total: 0, limit: 1000, offset: 0 };
  },

  async getTicket(id: string): Promise<TicketListItem> {
    const res: any = await apiClient.get(`/tickets/${id}`);
    return res.data;
  },

  async downloadTicketsZip(eventId: string): Promise<Blob> {
    const res = await apiClient.get(`/tickets/events/${eventId}/export-zip`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
