import { apiClient } from './client';

export type VerificationState =
  | 'VALID'
  | 'ALREADY_USED'
  | 'INVALID'
  | 'CANCELLED'
  | 'WRONG_EVENT'
  | 'VALID_WORKER'
  | 'UNASSIGNED_WORKER';

export interface VerifiedTicketData {
  id?: string;
  sequenceNumber?: number;
  name: string;
  category: string;
  usagePolicy: string;
  organization?: string | null;
  designation?: string | null;
  eventName?: string;
  eventDate?: string;
  assetUrl?: string | null;
  lastCheckinTime?: string | null;
}

export interface VerificationResponse {
  status: VerificationState;
  message: string;
  ticket?: VerifiedTicketData;
}

export interface CheckinResponse {
  success: boolean;
  status: string;
  message: string;
  checkinId?: string;
  checkedInAt?: string;
  guestName?: string;
  workerName?: string;
  category?: string;
}

export const verifyApi = {
  async lookupToken(token: string, eventId?: string): Promise<VerificationResponse> {
    const res: any = await apiClient.post('/verify/lookup', { token, eventId });
    return res.data;
  },

  async publicVerify(token: string): Promise<VerificationResponse> {
    const res: any = await apiClient.get(`/verify/${token}`);
    return res.data;
  },

  async checkIn(
    token: string,
    eventId?: string,
    workerName?: string
  ): Promise<CheckinResponse> {
    const res: any = await apiClient.post('/verify/checkin', {
      token,
      eventId,
      workerName,
    });
    return res.data;
  },

  async getRecentCheckins(eventId: string) {
    const res: any = await apiClient.get(`/verify/recent/${eventId}`);
    return res.data || [];
  },
};
