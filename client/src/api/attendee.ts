import { apiClient } from './client';

export interface AttendeeWalletItem {
  registrationId?: string;
  credentialId: string;
  eventId: string;
  eventName: string;
  eventType: string;
  bannerUrl?: string | null;
  venue: {
    type?: string;
    name?: string;
    address?: string;
    city?: string;
  };
  schedule: {
    startAt?: string;
    endAt?: string;
    timezone?: string;
  };
  credentialTerminology: string;
  credentialType: string;
  formattedId: string;
  verificationToken: string;
  status: 'ACTIVE' | 'CHECKED_IN' | 'REVOKED' | 'EXPIRED';
  usagePolicy: string;
  checkInCount: number;
  holder: {
    name: string;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
    designation?: string | null;
    category?: string;
  };
  asset: {
    storagePath?: string | null;
    publicUrl?: string | null;
    mimeType: string;
  };
  registeredAt?: string;
}

export interface RegisterEventDTO {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  designation?: string;
  teamName?: string;
  registrationType?: string;
  responses?: Record<string, any>;
}

export interface AttendeeTeamData {
  _id: string;
  eventId: string;
  teamName: string;
  track?: string;
  tableNumber?: string;
  leaderName: string;
  leaderEmail: string;
  members: Array<{
    name: string;
    email: string;
    role?: string;
    checkedIn?: boolean;
  }>;
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
  status: 'REGISTERED' | 'FORMED' | 'SUBMITTED' | 'DISQUALIFIED' | 'WITHDRAWN';
}

export const attendeeApi = {
  getWallet: async (): Promise<{ success: boolean; count: number; data: AttendeeWalletItem[] }> => {
    return apiClient.get('/attendee/wallet');
  },

  registerForEvent: async (
    eventId: string,
    data: RegisterEventDTO
  ): Promise<{ success: boolean; message: string; data: { registration: any; credential: any } }> => {
    return apiClient.post(`/events/${eventId}/register`, data);
  },

  getMyRegistration: async (
    eventId: string
  ): Promise<{ success: boolean; data: { registration: any; credential: any } }> => {
    return apiClient.get(`/events/${eventId}/my-registration`);
  },

  cancelRegistration: async (
    eventId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/events/${eventId}/my-registration`, { data: { reason } });
  },

  getMyTeam: async (eventId: string): Promise<{ success: boolean; data: AttendeeTeamData | null }> => {
    return apiClient.get(`/events/${eventId}/my-team`);
  },

  createTeam: async (
    eventId: string,
    data: { teamName: string; track?: string }
  ): Promise<{ success: boolean; message: string; data: AttendeeTeamData }> => {
    return apiClient.post(`/events/${eventId}/my-team`, data);
  },

  joinTeam: async (
    eventId: string,
    data: { teamId?: string; teamName?: string }
  ): Promise<{ success: boolean; message: string; data: AttendeeTeamData }> => {
    return apiClient.post(`/events/${eventId}/my-team/join`, data);
  },

  submitProject: async (
    eventId: string,
    data: { projectTitle?: string; projectDescription?: string; repoUrl?: string; demoUrl?: string }
  ): Promise<{ success: boolean; message: string; data: AttendeeTeamData }> => {
    return apiClient.put(`/events/${eventId}/my-team/submit`, data);
  },
};
