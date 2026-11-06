import { apiClient, API_BASE_URL, getStoredAuthToken } from './client';

export interface TicketListItem {
  id: string;
  sequenceNumber: number;
  verificationToken: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'REVOKED' | string;
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
  async generateTickets(eventId: string, templateId?: string) {
    const res: any = await apiClient.post(`/tickets/events/${eventId}/generate`, {
      templateId,
    });
    return res.data;
  },

  async generateWorkerTickets(
    eventId: string,
    count: number,
    ticketTypeName = 'WORKER',
    templateId?: string
  ) {
    const res: any = await apiClient.post(`/tickets/events/${eventId}/generate-worker`, {
      count,
      ticketTypeName,
      templateId,
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

  async downloadTicketsZip(eventId: string, ticketIds?: string[]): Promise<Blob> {
    const token = getStoredAuthToken();
    const query = ticketIds && ticketIds.length > 0 ? `?ticketIds=${encodeURIComponent(ticketIds.join(','))}` : '';
    const url = `${API_BASE_URL}/tickets/events/${eventId}/export-zip${query}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      let errMsg = 'Failed to download ZIP archive';
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    return await res.blob();
  },

  async downloadTicketsExcel(eventId: string, ticketIds?: string[]): Promise<{ blob: Blob; fileName?: string }> {
    const query = ticketIds && ticketIds.length > 0 ? `?ticketIds=${encodeURIComponent(ticketIds.join(','))}` : '';
    const res = await apiClient.get<Blob>(`/tickets/events/${eventId}/export-excel${query}`, {
      responseType: 'blob',
    });

    const disposition = res.headers
      ? res.headers['content-disposition'] || (res.headers as any)['Content-Disposition']
      : undefined;
    let fileName: string | undefined;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    return { blob: res.data, fileName };
  },

  async downloadTicket(ticketId: string, eventId?: string): Promise<{ blob: Blob; fileName?: string }> {
    const endpoint = eventId
      ? `/tickets/events/${eventId}/tickets/${ticketId}/download`
      : `/tickets/${ticketId}/download`;

    const res = await apiClient.get<Blob>(endpoint, {
      responseType: 'blob',
    });

    const disposition = res.headers
      ? res.headers['content-disposition'] || (res.headers as any)['Content-Disposition']
      : undefined;
    let fileName: string | undefined;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    return { blob: res.data, fileName };
  },

  async revokeTicket(ticketId: string, eventId: string, reason?: string): Promise<{ id: string; status: string; message: string }> {
    const res: any = await apiClient.delete(`/tickets/events/${eventId}/tickets/${ticketId}`, {
      data: { reason: reason || 'Revoked by host' },
    });
    return res.data?.data || res.data;
  },
};

export function triggerBlobDownload(blob: Blob, fallbackFileName: string): void {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fallbackFileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(blobUrl);
  document.body.removeChild(a);
}
