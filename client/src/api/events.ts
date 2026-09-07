import { apiClient } from './client';
import { EventItem, TicketType } from '../types';

export interface CreateEventPayload {
  name: string;
  date: string;
  time?: string;
  venue?: string;
  description?: string;
  organizerName?: string;
  logoUrl?: string;
  ticketTemplateUrl?: string;
  status?: string;
}

export interface UpdateEventPayload {
  name?: string;
  date?: string;
  time?: string;
  venue?: string;
  description?: string;
  organizerName?: string;
  logoUrl?: string;
  ticketTemplateUrl?: string;
  status?: string;
}

export interface CreateTicketTypePayload {
  name: string;
  label: string;
  usagePolicy?: 'SINGLE_USE' | 'REUSABLE_WORKER';
}

export const eventsApi = {
  async getEvents(): Promise<EventItem[]> {
    const res: any = await apiClient.get('/events');
    return res.data || [];
  },

  async getEvent(eventId: string): Promise<EventItem> {
    const res: any = await apiClient.get(`/events/${eventId}`);
    return res.data;
  },

  async createEvent(payload: CreateEventPayload): Promise<EventItem> {
    const res: any = await apiClient.post('/events', payload);
    return res.data;
  },

  async updateEvent(eventId: string, payload: UpdateEventPayload): Promise<EventItem> {
    const res: any = await apiClient.put(`/events/${eventId}`, payload);
    return res.data;
  },

  async deleteEvent(eventId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}`);
  },

  async getTicketTypes(eventId: string): Promise<TicketType[]> {
    const res: any = await apiClient.get(`/events/${eventId}/ticket-types`);
    return res.data || [];
  },

  async createTicketType(eventId: string, payload: CreateTicketTypePayload): Promise<TicketType> {
    const res: any = await apiClient.post(`/events/${eventId}/ticket-types`, payload);
    return res.data;
  },
};
