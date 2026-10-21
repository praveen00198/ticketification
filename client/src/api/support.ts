import { apiClient } from './client';

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface SupportReportPayload {
  eventId?: string;
  category: 'BUG' | 'HARASSMENT' | 'SCAM' | 'INAPPROPRIATE_CONTENT' | 'SAFETY_VIOLATION' | 'TECHNICAL_ISSUE' | 'ACCESS_ISSUE' | 'OTHER';
  description: string;
  evidenceUrls?: string[];
}

export interface SupportReportItem {
  _id: string;
  eventId?: {
    _id: string;
    name: string;
    eventType?: string;
  } | string;
  category: string;
  description: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  moderationNotes?: string;
  evidenceUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export const supportApi = {
  getFaqs: async (): Promise<{ success: boolean; data: FAQItem[] }> => {
    return apiClient.get('/support/faqs');
  },

  submitReport: async (payload: SupportReportPayload): Promise<{ success: boolean; message: string; data: any }> => {
    return apiClient.post('/support/report', payload);
  },

  getMyReports: async (): Promise<{ success: boolean; count: number; data: SupportReportItem[] }> => {
    return apiClient.get('/support/my-reports');
  },
};
