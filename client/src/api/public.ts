import { apiClient } from './client';

export interface PublicEventSummary {
  id: string;
  name: string;
  eventType: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology: string;
  attendanceMode: string;
  venue: {
    type: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
    name?: string;
    address?: string;
    city?: string;
    region?: string;
    country?: string;
    onlineDescription?: string;
  };
  schedule: {
    startAt: string;
    endAt: string;
    timezone: string;
  };
  registration?: {
    pricingModel?: 'FREE' | 'PAID';
    registrationRequired?: boolean;
    capacity?: number;
  };
  status: string;
  verificationLevel?: string;
  verificationStatus?: string;
  createdAt?: string;
}

export interface PublicHostProfile {
  id: string;
  name: string;
  organizationName: string;
  institutionType: string;
  institutionName?: string | null;
  bio?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  hostVerificationStatus: string;
}

export interface PublicEventDetailResponse {
  event: PublicEventSummary;
  host: PublicHostProfile;
  metrics: {
    confirmedCount: number;
    remainingCapacity: number | null;
    isSoldOut: boolean;
  };
}

export interface PublicCatalogResponse {
  events: PublicEventSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PublicCatalogFilters {
  page?: number;
  limit?: number;
  eventType?: string;
  venueType?: string;
  pricingModel?: string;
  city?: string;
  search?: string;
}

export interface SubmitReportPayload {
  reporterEmail: string;
  reporterName?: string;
  category: string;
  reason: string;
}

export const publicApi = {
  /**
   * Search and filter publicly available events.
   */
  async getPublicEvents(filters: PublicCatalogFilters = {}): Promise<PublicCatalogResponse> {
    const res: any = await apiClient.get('/public/events', { params: filters });
    return res.data;
  },

  /**
   * Fetch complete event landing details, host credentials, and capacity stats.
   */
  async getPublicEventById(eventId: string): Promise<PublicEventDetailResponse> {
    const res: any = await apiClient.get(`/public/events/${eventId}`);
    return res.data;
  },

  /**
   * Fetch public organizer profile and their active events.
   */
  async getPublicHostProfile(hostId: string): Promise<{
    host: PublicHostProfile;
    events: PublicEventSummary[];
  }> {
    const res: any = await apiClient.get(`/public/hosts/${hostId}`);
    return res.data;
  },

  /**
   * Submit an abuse or scam report.
   */
  async reportEvent(eventId: string, payload: SubmitReportPayload): Promise<{
    success: boolean;
    reportId: string;
    message: string;
  }> {
    const res: any = await apiClient.post(`/public/events/${eventId}/report`, payload);
    return res.data;
  },
};

export default publicApi;
