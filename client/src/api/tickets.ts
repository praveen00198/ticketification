import { apiClient, API_BASE_URL, getStoredAuthToken } from './client';

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

  async downloadTicketsZip(eventId: string): Promise<Blob> {
    const token = getStoredAuthToken();
    const url = `${API_BASE_URL}/tickets/events/${eventId}/export-zip`;
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

  async downloadTicket(ticketId: string, eventId?: string): Promise<{ blob: Blob; fileName?: string }> {
    const token = getStoredAuthToken();
    const endpoint = eventId
      ? `${API_BASE_URL}/tickets/events/${eventId}/tickets/${ticketId}/download`
      : `${API_BASE_URL}/tickets/${ticketId}/download`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      let errMsg = 'Failed to download ticket';
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errJson.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const disposition = res.headers.get('Content-Disposition');
    let fileName: string | undefined;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    const blob = await res.blob();
    return { blob, fileName };
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
