import { apiClient } from './client';
import { EventItem, TicketType } from '../types';

export type EventType =
  | 'CONFERENCE'
  | 'HACKATHON'
  | 'CONCERT'
  | 'FESTIVAL'
  | 'WORKSHOP'
  | 'COLLEGE_EVENT'
  | 'SPORTS_EVENT'
  | 'EXHIBITION'
  | 'AWARD_CEREMONY'
  | 'CORPORATE_EVENT'
  | 'CULTURAL_EVENT'
  | 'WEDDING'
  | 'OTHER';

export type AttendanceMode =
  | 'TICKETIFICATION_REGISTRATION'
  | 'EXISTING_ATTENDEE_DATA';

export type VenueType = 'PHYSICAL' | 'ONLINE' | 'HYBRID';

export interface EventVenue {
  type: VenueType;
  name?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  onlineDescription?: string;
}

export interface EventSchedule {
  startAt: string;
  endAt: string;
  timezone: string;
}

export type HostingType = 'INDIVIDUAL' | 'ORGANIZATION';
export type OrganizationVerificationStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface EventOrganizationPayload {
  name: string;
  institutionType?: string;
  institutionName?: string;
  officialEmail?: string;
  department?: string;
  designation?: string;
  websiteUrl?: string;
  documentUrls?: string[];
}

export interface CreateEventWizardPayload {
  eventType: EventType;
  name: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology?: string;
  attendanceMode: AttendanceMode;
  venue: EventVenue;
  schedule: EventSchedule;
  registration?: {
    pricingModel?: 'FREE' | 'PAID';
    registrationRequired?: boolean;
    capacity?: number;
  };
  hostingType?: HostingType;
  organization?: EventOrganizationPayload;
}

export interface UpdateEventDraftPayload {
  eventType?: EventType;
  name?: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology?: string;
  attendanceMode?: AttendanceMode;
  venue?: Partial<EventVenue>;
  schedule?: Partial<EventSchedule>;
  registration?: {
    pricingModel?: 'FREE' | 'PAID';
    registrationRequired?: boolean;
    capacity?: number;
  };
  hostingType?: HostingType;
  organization?: Partial<EventOrganizationPayload>;
}

export interface CanonicalEventItem {
  id: string;
  ownerId: string;
  ownerSupabaseId: string;
  eventType: EventType;
  name: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology: string;
  attendanceMode: AttendanceMode;
  venue: EventVenue;
  schedule: EventSchedule;
  registration?: {
    pricingModel: 'FREE' | 'PAID';
    registrationRequired: boolean;
    capacity?: number;
  };
  status: string;
  hostingType?: HostingType;
  organization?: EventOrganizationPayload;
  organizationVerificationStatus?: OrganizationVerificationStatus;
  verificationLevel?: string;
  verificationStatus?: string;
  displayStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedEventsResponse {
  events: (CanonicalEventItem | EventItem)[];
  pagination: EventPagination;
}

// Legacy Payloads preserved
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
  usagePolicy?: 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER';
}

export const eventsApi = {
  async getEvents(params?: {
    page?: number;
    limit?: number;
    status?: string;
    eventType?: string;
    search?: string;
  }): Promise<EventItem[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.eventType) query.set('eventType', params.eventType);
    if (params?.search) query.set('search', params.search);

    const queryString = query.toString();
    const url = queryString ? `/events?${queryString}` : '/events';

    const res: any = await apiClient.get(url);
    const rawList = Array.isArray(res.data) ? res.data : [];
    return rawList.map((item: any) => ({
      id: item._id || item.id,
      name: item.name,
      date: item.schedule?.startAt || item.date || item.createdAt || new Date().toISOString(),
      time: item.schedule?.startAt
        ? new Date(item.schedule.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (item.time || '09:00'),
      venue: item.venue?.name || item.venue || (item.venue?.type === 'ONLINE' ? 'Online Virtual Event' : 'TBD'),
      description: item.description || null,
      organizerName: item.organizerName || null,
      status: item.status || 'DRAFT',
      eventType: item.eventType,
      credentialTerminology: item.credentialTerminology || item.credentialType,
      attendanceMode: item.attendanceMode,
      bannerUrl: item.bannerUrl,
      venueDetails: item.venue,
      scheduleDetails: item.schedule,
      createdBy: item.ownerId || item.createdBy || '',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      ticketTypes: item.ticketTypes,
    }));
  },

  async getEventsPaginated(params?: {
    page?: number;
    limit?: number;
    status?: string;
    eventType?: string;
    search?: string;
  }): Promise<{ events: EventItem[]; pagination?: EventPagination }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.eventType) query.set('eventType', params.eventType);
    if (params?.search) query.set('search', params.search);

    const queryString = query.toString();
    const url = queryString ? `/events?${queryString}` : '/events';

    const res: any = await apiClient.get(url);
    const rawList = Array.isArray(res.data) ? res.data : [];
    const normalized = rawList.map((item: any) => ({
      id: item._id || item.id,
      name: item.name,
      date: item.schedule?.startAt || item.date || item.createdAt || new Date().toISOString(),
      time: item.schedule?.startAt
        ? new Date(item.schedule.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (item.time || '09:00'),
      venue: typeof item.venue === 'string'
        ? (item.venue.trim() || 'TBD')
        : (item.venue?.name ||
           ([item.venue?.address, item.venue?.city].filter(Boolean).join(', ') || null) ||
           (item.venue?.type === 'ONLINE' ? 'Online Virtual Event' : item.venue?.type === 'HYBRID' ? 'Hybrid Event' : item.venue?.type === 'PHYSICAL' ? 'Physical Venue' : 'TBD')),

      description: item.description || null,
      organizerName: item.organizerName || null,
      status: item.status || 'DRAFT',
      eventType: item.eventType,
      credentialTerminology: item.credentialTerminology || item.credentialType,
      attendanceMode: item.attendanceMode,
      bannerUrl: item.bannerUrl,
      venueDetails: item.venue,
      scheduleDetails: item.schedule,
      createdBy: item.ownerId || item.createdBy || '',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      ticketTypes: item.ticketTypes,
    }));

    return {
      events: normalized,
      pagination: res.pagination,
    };
  },

  async getEvent(eventId: string): Promise<any> {
    const res: any = await apiClient.get(`/events/${eventId}`);
    return res.data;
  },

  async createEvent(payload: CreateEventPayload | CreateEventWizardPayload): Promise<any> {
    const res: any = await apiClient.post('/events', payload);
    return res.data;
  },

  async updateEvent(eventId: string, payload: UpdateEventPayload | UpdateEventDraftPayload): Promise<any> {
    const res: any = await apiClient.put(`/events/${eventId}`, payload);
    return res.data;
  },

  async deleteEvent(eventId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}`);
  },

  async uploadBanner(file: File): Promise<{ bannerUrl: string; storagePath: string }> {
    const formData = new FormData();
    formData.append('banner', file);

    const res: any = await apiClient.post('/events/banner', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async getTicketTypes(eventId: string): Promise<TicketType[]> {
    const res: any = await apiClient.get(`/events/${eventId}/ticket-types`);
    return res.data || [];
  },

  async createTicketType(eventId: string, payload: CreateTicketTypePayload): Promise<TicketType> {
    const res: any = await apiClient.post(`/events/${eventId}/ticket-types`, payload);
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Phase 5: Event Verification & Risk Engine API Endpoints
  // ---------------------------------------------------------------------------
  async getVerification(eventId: string): Promise<EventVerificationData | null> {
    const res: any = await apiClient.get(`/events/${eventId}/verification`);
    return res.data;
  },

  async saveVerificationDraft(
    eventId: string,
    payload: VerificationDraftPayload
  ): Promise<EventVerificationData> {
    const res: any = await apiClient.post(`/events/${eventId}/verification/draft`, payload);
    return res.data;
  },

  async sendVerificationOtp(
    eventId: string,
    officialEmail: string
  ): Promise<{ success: boolean; message: string; devOtp?: string }> {
    const res: any = await apiClient.post(`/events/${eventId}/verification/send-otp`, {
      officialEmail,
    });
    return res;
  },

  async verifyOtp(
    eventId: string,
    code: string
  ): Promise<{ success: boolean; message: string }> {
    const res: any = await apiClient.post(`/events/${eventId}/verification/verify-otp`, {
      code,
    });
    return res;
  },

  async uploadVerificationDocument(
    eventId: string,
    file: File
  ): Promise<{ documentUrl: string; storagePath: string }> {
    const formData = new FormData();
    formData.append('document', file);
    const res: any = await apiClient.post(
      `/events/${eventId}/verification/document`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data;
  },

  async removeVerificationDocument(
    eventId: string,
    documentUrl: string
  ): Promise<void> {
    await apiClient.delete(`/events/${eventId}/verification/document`, {
      data: { documentUrl },
    });
  },

  async submitVerification(
    eventId: string
  ): Promise<{ data: EventVerificationData; message: string }> {
    const res: any = await apiClient.post(`/events/${eventId}/verification/submit`);
    return res;
  },

  // ---------------------------------------------------------------------------
  // Phase 6: Event Lifecycle Engine API Endpoints
  // ---------------------------------------------------------------------------
  async publishEvent(eventId: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/publish`);
    return res.data;
  },

  async openRegistrations(eventId: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/registrations/open`);
    return res.data;
  },

  async closeRegistrations(eventId: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/registrations/close`);
    return res.data;
  },

  async startLiveEvent(eventId: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/live`);
    return res.data;
  },

  async completeEvent(eventId: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/complete`);
    return res.data;
  },

  async archiveEvent(eventId: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/archive`);
    return res.data;
  },

  async cancelEvent(eventId: string, reason: string): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/cancel`, { reason });
    return res.data;
  },

  async transitionLifecycle(
    eventId: string,
    targetStatus: string,
    reason?: string
  ): Promise<any> {
    const res: any = await apiClient.post(`/events/${eventId}/lifecycle/transition`, {
      targetStatus,
      reason,
    });
    return res.data;
  },

  async getLifecycleHistory(
    eventId: string
  ): Promise<{ statusHistory: EventStatusHistoryItem[]; currentStatus: string }> {
    const res: any = await apiClient.get(`/events/${eventId}/lifecycle/history`);
    return res.data;
  },

  // Membership & Staff Management (Phase 7)
  async getMembers(eventId: string, status?: string): Promise<EventMemberItem[]> {
    const params = status ? { status } : undefined;
    const res: any = await apiClient.get(`/events/${eventId}/members`, { params });
    return res.data || [];
  },

  async inviteMember(
    eventId: string,
    payload: InviteMemberPayload
  ): Promise<{ member: EventMemberItem; invitationLink: string; devToken?: string }> {
    const res: any = await apiClient.post(`/events/${eventId}/members/invite`, payload);
    return res.data;
  },

  async updateMember(
    eventId: string,
    memberId: string,
    payload: UpdateMemberPayload
  ): Promise<EventMemberItem> {
    const res: any = await apiClient.put(`/events/${eventId}/members/${memberId}`, payload);
    return res.data;
  },

  async revokeMember(eventId: string, memberId: string): Promise<{ message: string }> {
    const res: any = await apiClient.delete(`/events/${eventId}/members/${memberId}`);
    return res;
  },

  async acceptInvitation(token: string): Promise<{ member: EventMemberItem; message: string }> {
    const res: any = await apiClient.post('/events/invitations/accept', { token });
    return res.data;
  },

  // Volunteer & Coordinator Task Management (Phase 8)
  async getEventTasks(
    eventId: string,
    filters?: { status?: string; station?: string; category?: string }
  ): Promise<EventTaskItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/tasks`, { params: filters });
    return res.data || [];
  },

  async createEventTask(
    eventId: string,
    payload: CreateEventTaskPayload
  ): Promise<EventTaskItem> {
    const res: any = await apiClient.post(`/events/${eventId}/tasks`, payload);
    return res.data;
  },

  async updateEventTask(
    eventId: string,
    taskId: string,
    payload: UpdateEventTaskPayload
  ): Promise<EventTaskItem> {
    const res: any = await apiClient.put(`/events/${eventId}/tasks/${taskId}`, payload);
    return res.data;
  },

  async updateEventTaskStatus(
    eventId: string,
    taskId: string,
    status: string
  ): Promise<EventTaskItem> {
    const res: any = await apiClient.patch(`/events/${eventId}/tasks/${taskId}/status`, { status });
    return res.data;
  },

  async deleteEventTask(eventId: string, taskId: string): Promise<{ message: string }> {
    const res: any = await apiClient.delete(`/events/${eventId}/tasks/${taskId}`);
    return res;
  },

  async getMyTasks(eventId: string): Promise<{ member: EventMemberItem; tasks: EventTaskItem[] }> {
    const res: any = await apiClient.get(`/events/${eventId}/tasks/my-tasks`);
    return res.data;
  },

  async toggleScannerPrivilege(
    eventId: string,
    memberId: string,
    enabled: boolean
  ): Promise<{ member: EventMemberItem; message: string }> {
    const res: any = await apiClient.post(`/events/${eventId}/tasks/members/${memberId}/scanner`, {
      enabled,
    });
    return res.data;
  },

  // Mentor & Evaluator System (Phase 9)
  async getAssignments(
    eventId: string,
    filters?: { role?: string; track?: string; status?: string }
  ): Promise<EventAssignmentItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/assignments`, { params: filters });
    return res.data || [];
  },

  async createAssignment(
    eventId: string,
    payload: CreateAssignmentPayload
  ): Promise<EventAssignmentItem> {
    const res: any = await apiClient.post(`/events/${eventId}/assignments`, payload);
    return res.data;
  },

  async deleteAssignment(eventId: string, assignmentId: string): Promise<{ message: string }> {
    const res: any = await apiClient.delete(`/events/${eventId}/assignments/${assignmentId}`);
    return res;
  },

  async getMyAssignments(
    eventId: string
  ): Promise<{ member: EventMemberItem; assignments: EventAssignmentItem[] }> {
    const res: any = await apiClient.get(`/events/${eventId}/assignments/my-assignments`);
    return res.data;
  },

  async recordMentorshipLog(
    eventId: string,
    assignmentId: string,
    note: string
  ): Promise<EventAssignmentItem> {
    const res: any = await apiClient.post(`/events/${eventId}/assignments/${assignmentId}/logs`, {
      note,
    });
    return res.data;
  },

  // Phase 10: Team Management Workflows
  async getTeams(
    eventId: string,
    params?: { track?: string; status?: string; search?: string }
  ): Promise<EventTeamItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/teams`, { params });
    return res.data;
  },

  async getTeamById(eventId: string, teamId: string): Promise<EventTeamItem> {
    const res: any = await apiClient.get(`/events/${eventId}/teams/${teamId}`);
    return res.data;
  },

  async createTeam(eventId: string, payload: CreateTeamPayload): Promise<EventTeamItem> {
    const res: any = await apiClient.post(`/events/${eventId}/teams`, payload);
    return res.data;
  },

  async updateTeam(
    eventId: string,
    teamId: string,
    payload: UpdateTeamPayload
  ): Promise<EventTeamItem> {
    const res: any = await apiClient.patch(`/events/${eventId}/teams/${teamId}`, payload);
    return res.data;
  },

  async deleteTeam(eventId: string, teamId: string): Promise<{ message: string }> {
    const res: any = await apiClient.delete(`/events/${eventId}/teams/${teamId}`);
    return res;
  },

  async addTeamMember(
    eventId: string,
    teamId: string,
    member: AddTeamMemberPayload
  ): Promise<EventTeamItem> {
    const res: any = await apiClient.post(`/events/${eventId}/teams/${teamId}/members`, member);
    return res.data;
  },

  async removeTeamMember(
    eventId: string,
    teamId: string,
    email: string
  ): Promise<EventTeamItem> {
    const res: any = await apiClient.delete(
      `/events/${eventId}/teams/${teamId}/members/${encodeURIComponent(email)}`
    );
    return res.data;
  },

  // Phase 11: Evaluation & Scoring Engine Workflows
  async getRubrics(eventId: string, track?: string): Promise<EventRubricItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/rubrics`, {
      params: track ? { track } : undefined,
    });
    return res.data;
  },

  async createRubric(eventId: string, payload: CreateRubricPayload): Promise<EventRubricItem> {
    const res: any = await apiClient.post(`/events/${eventId}/rubrics`, payload);
    return res.data;
  },

  async updateRubric(
    eventId: string,
    rubricId: string,
    payload: Partial<CreateRubricPayload>
  ): Promise<EventRubricItem> {
    const res: any = await apiClient.patch(`/events/${eventId}/rubrics/${rubricId}`, payload);
    return res.data;
  },

  async updateScoringStatus(
    eventId: string,
    rubricId: string,
    status: ScoringStatus
  ): Promise<EventRubricItem> {
    const res: any = await apiClient.patch(`/events/${eventId}/rubrics/${rubricId}/status`, {
      status,
    });
    return res.data;
  },

  async deleteRubric(eventId: string, rubricId: string): Promise<{ message: string }> {
    const res: any = await apiClient.delete(`/events/${eventId}/rubrics/${rubricId}`);
    return res;
  },

  async submitEvaluation(
    eventId: string,
    payload: SubmitEvaluationPayload
  ): Promise<EventEvaluationItem> {
    const res: any = await apiClient.post(`/events/${eventId}/evaluations`, payload);
    return res.data;
  },

  async getEvaluations(
    eventId: string,
    params?: { rubricId?: string; teamId?: string }
  ): Promise<EventEvaluationItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/evaluations`, { params });
    return res.data;
  },

  async getMyEvaluation(eventId: string, teamId: string): Promise<EventEvaluationItem | null> {
    const res: any = await apiClient.get(`/events/${eventId}/evaluations/my-scorecard/${teamId}`);
    return res.data;
  },

  async getLeaderboard(eventId: string, track?: string): Promise<LeaderboardEntryItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/evaluations/leaderboard`, {
      params: track ? { track } : undefined,
    });
    return res.data;
  },

  // Phase 12: Credential Architecture
  async getEventCredentials(
    eventId: string,
    params?: {
      status?: string;
      credentialType?: string;
      usagePolicy?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ credentials: EventCredentialItem[]; total: number; metrics: CredentialMetrics }> {
    const res: any = await apiClient.get(`/events/${eventId}/credentials`, { params });
    return {
      credentials: res.data || [],
      total: res.total || 0,
      metrics: res.metrics || { totalIssued: 0, activeCount: 0, checkedInCount: 0, revokedCount: 0 },
    };
  },

  async issueCredential(eventId: string, payload: IssueCredentialPayload): Promise<EventCredentialItem> {
    const res: any = await apiClient.post(`/events/${eventId}/credentials`, payload);
    return res.data;
  },

  async issueWorkerBatch(
    eventId: string,
    payload: IssueWorkerBatchPayload
  ): Promise<{ credentials: EventCredentialItem[]; issuedCount: number }> {
    const res: any = await apiClient.post(`/events/${eventId}/credentials/worker-batch`, payload);
    return {
      credentials: res.data || [],
      issuedCount: res.issuedCount || 0,
    };
  },

  async getCredentialById(eventId: string, credentialId: string): Promise<EventCredentialItem> {
    const res: any = await apiClient.get(`/events/${eventId}/credentials/${credentialId}`);
    return res.data;
  },

  async revokeCredential(eventId: string, credentialId: string, reason?: string): Promise<EventCredentialItem> {
    const res: any = await apiClient.put(`/events/${eventId}/credentials/${credentialId}/revoke`, { reason });
    return res.data;
  },

  async assignCredentialHolder(
    eventId: string,
    credentialId: string,
    payload: AssignHolderPayload
  ): Promise<EventCredentialItem> {
    const res: any = await apiClient.put(`/events/${eventId}/credentials/${credentialId}/assign`, payload);
    return res.data;
  },

  async verifyCredentialToken(token: string): Promise<PublicTokenVerificationResult> {
    const res: any = await apiClient.get(`/credentials/verify-token/${token}`);
    return res.data;
  },

  // Phase 13: Credential Templates & Sharp Rendering Engine
  async getCredentialTemplates(
    eventId: string
  ): Promise<{ templates: EventCredentialTemplate[]; defaultTemplate: EventCredentialTemplate | null }> {
    const res: any = await apiClient.get(`/events/${eventId}/credential-templates`);
    return {
      templates: res.data || [],
      defaultTemplate: res.defaultTemplate || null,
    };
  },

  async getCredentialTemplateById(eventId: string, templateId: string): Promise<EventCredentialTemplate> {
    const res: any = await apiClient.get(`/events/${eventId}/credential-templates/${templateId}`);
    return res.data;
  },

  async createCredentialTemplate(eventId: string, payload: CreateTemplatePayload): Promise<EventCredentialTemplate> {
    const res: any = await apiClient.post(`/events/${eventId}/credential-templates`, payload);
    return res.data;
  },

  async clonePresetTemplate(
    eventId: string,
    presetId: TemplatePresetId,
    name?: string
  ): Promise<EventCredentialTemplate> {
    const res: any = await apiClient.post(`/events/${eventId}/credential-templates/clone-preset`, { presetId, name });
    return res.data;
  },

  async updateCredentialTemplate(
    eventId: string,
    templateId: string,
    payload: UpdateTemplatePayload
  ): Promise<EventCredentialTemplate> {
    const res: any = await apiClient.put(`/events/${eventId}/credential-templates/${templateId}`, payload);
    return res.data;
  },

  async setDefaultCredentialTemplate(eventId: string, templateId: string): Promise<EventCredentialTemplate> {
    const res: any = await apiClient.put(`/events/${eventId}/credential-templates/${templateId}/set-default`);
    return res.data;
  },

  async deleteCredentialTemplate(eventId: string, templateId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/credential-templates/${templateId}`);
  },

  async generateTemplatePreview(
    eventId: string,
    templateId: string,
    mockData?: any
  ): Promise<{ previewUrl: string }> {
    const res: any = await apiClient.post(`/events/${eventId}/credential-templates/${templateId}/preview`, mockData);
    return res.data;
  },

  async renderCredentialAsset(
    eventId: string,
    credentialId: string,
    templateId?: string
  ): Promise<EventCredentialItem> {
    const res: any = await apiClient.post(`/events/${eventId}/credentials/${credentialId}/render`, { templateId });
    return res.data;
  },

  // Phase 14: QR Verification + Atomic Check-in Workflows
  async checkInCredential(
    eventId: string,
    payload: CheckinRequestPayload
  ): Promise<CheckinResponse> {
    const res: any = await apiClient.post(`/events/${eventId}/credentials/checkin`, payload);
    return res.data;
  },

  async getCredentialCheckins(
    eventId: string,
    params?: {
      limit?: number;
      gate?: string;
      scanStatus?: string;
      search?: string;
    }
  ): Promise<CredentialCheckinLog[]> {
    const res: any = await apiClient.get(`/events/${eventId}/credentials/checkins`, { params });
    return res.data || [];
  },

  async getCredentialCheckinStats(
    eventId: string
  ): Promise<CredentialCheckinStats> {
    const res: any = await apiClient.get(`/events/${eventId}/credentials/checkin-stats`);
    return res.data;
  },

  // Phase 15: Import + Bulk Credential Generation Jobs
  async previewImportSpreadsheet(
    eventId: string,
    file: File
  ): Promise<ImportPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res: any = await apiClient.post(`/events/${eventId}/jobs/preview-import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async createImportJob(
    eventId: string,
    payload: CreateImportJobPayload
  ): Promise<{ message: string; jobId: string; job: EventJobItem }> {
    const res: any = await apiClient.post(`/events/${eventId}/jobs/import`, payload);
    return res.data || res;
  },

  async createBulkRenderJob(
    eventId: string,
    payload: { credentialIds?: string[]; templateId?: string }
  ): Promise<{ message: string; jobId: string; job: EventJobItem }> {
    const res: any = await apiClient.post(`/events/${eventId}/jobs/bulk-render`, payload);
    return res.data || res;
  },

  async getEventJobs(
    eventId: string,
    params?: { jobType?: EventJobType; status?: EventJobStatus; limit?: number }
  ): Promise<EventJobItem[]> {
    const res: any = await apiClient.get(`/events/${eventId}/jobs`, { params });
    return res.data || [];
  },

  async getEventJobStatus(
    eventId: string,
    jobId: string
  ): Promise<EventJobItem> {
    const res: any = await apiClient.get(`/events/${eventId}/jobs/${jobId}`);
    return res.data;
  },

  async cancelEventJob(
    eventId: string,
    jobId: string
  ): Promise<EventJobItem> {
    const res: any = await apiClient.post(`/events/${eventId}/jobs/${jobId}/cancel`);
    return res.data;
  },

  // Phase 16: Export Jobs Engine
  async createExportJob(
    eventId: string,
    payload: CreateExportJobPayload
  ): Promise<{ message: string; jobId: string; job: EventJobItem }> {
    const res: any = await apiClient.post(`/events/${eventId}/jobs/export`, payload);
    return res.data || res;
  },

  // Phase 17: Storage & Quota Governance
  async getStorageMetrics(eventId: string): Promise<EventStorageMetrics> {
    const res: any = await apiClient.get(`/events/${eventId}/storage`);
    return res.data;
  },

  async cleanupStaleStorage(
    eventId: string,
    retentionHours = 24
  ): Promise<StorageCleanupResult> {
    const res: any = await apiClient.post(`/events/${eventId}/storage/cleanup`, { retentionHours });
    return res.data;
  },

  // Phase 18: Security + Audit + Reliability
  async getEventAuditLogs(
    eventId: string,
    params?: { action?: string; actorId?: string; targetEntity?: string; page?: number; limit?: number }
  ): Promise<AuditLogResponse> {
    const res: any = await apiClient.get(`/events/${eventId}/audit-logs`, { params });
    return res.data;
  },

  // Phase 19: Context-Aware Host Dashboard Console
  async getEventDashboardSummary(eventId: string): Promise<EventDashboardSummary> {
    const res: any = await apiClient.get(`/events/${eventId}/dashboard-summary`);
    return res.data;
  },
};

export type TaskCategory =
  | 'REGISTRATION'
  | 'SECURITY'
  | 'LOGISTICS'
  | 'HOSPITALITY'
  | 'TECHNICAL'
  | 'GENERAL';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EventTaskItem {
  _id: string;
  eventId: string;
  title: string;
  description?: string;
  category: TaskCategory;
  station: string;
  assignedMemberIds: any[];
  shiftStart?: string;
  shiftEnd?: string;
  status: TaskStatus;
  priority: TaskPriority;
  requiresScanning: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventTaskPayload {
  title: string;
  description?: string;
  category?: TaskCategory;
  station: string;
  assignedMemberIds?: string[];
  shiftStart?: string;
  shiftEnd?: string;
  priority?: TaskPriority;
  requiresScanning?: boolean;
}

export interface UpdateEventTaskPayload {
  title?: string;
  description?: string;
  category?: TaskCategory;
  station?: string;
  assignedMemberIds?: string[];
  shiftStart?: string;
  shiftEnd?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  requiresScanning?: boolean;
}

export type EventStaffRole = 'HOST' | 'COORDINATOR' | 'VOLUNTEER' | 'MENTOR' | 'EVALUATOR' | 'JUDGE';
export type EventStaffStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

export interface EventMemberItem {
  _id: string;
  eventId: string;
  userId?: string;
  userEmail: string;
  role: EventStaffRole;
  permissions: string[];
  status: EventStaffStatus;
  invitedBy?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InviteMemberPayload {
  email: string;
  role: EventStaffRole;
  customPermissions?: string[];
}

export interface UpdateMemberPayload {
  role?: EventStaffRole;
  permissions?: string[];
}

export interface EventStatusHistoryItem {
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  changedBySupabaseId: string;
  reason?: string;
  timestamp: string;
}

export type VerificationRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface EventVerificationData {
  _id?: string;
  eventId: string;
  institutionName?: string;
  institutionType?: string;
  officialEmail?: string;
  department?: string;
  designation?: string;
  websiteUrl?: string;
  otpVerified: boolean;
  documentUrls: string[];
  status: VerificationStatus;
  riskScore: number;
  riskTier: VerificationRiskTier;
  riskFactors: string[];
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface VerificationDraftPayload {
  institutionName: string;
  institutionType?: string;
  officialEmail: string;
  department: string;
  designation: string;
  websiteUrl?: string;
}

export type AssignmentRole = 'MENTOR' | 'EVALUATOR' | 'JUDGE';
export type AssignmentTargetType = 'TRACK' | 'TEAM' | 'GENERAL';

export interface MentorshipLogItem {
  authorEmail: string;
  note: string;
  timestamp: string;
}

export interface EventAssignmentItem {
  _id: string;
  eventId: string;
  memberId: any;
  role: AssignmentRole;
  track?: string;
  assignedTargetType: AssignmentTargetType;
  targetId?: string;
  targetName: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  mentorshipLogs: MentorshipLogItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentPayload {
  memberId: string;
  role: AssignmentRole;
  track?: string;
  assignedTargetType?: AssignmentTargetType;
  targetId?: string;
  targetName: string;
  notes?: string;
}

// Phase 10: Team Management Types
export type TeamStatus = 'REGISTERED' | 'FORMED' | 'SUBMITTED' | 'DISQUALIFIED' | 'WITHDRAWN';

export interface TeamMemberItem {
  name: string;
  email: string;
  role?: string;
  checkedIn?: boolean;
}

export interface EventTeamItem {
  _id: string;
  eventId: string;
  teamName: string;
  track?: string;
  tableNumber?: string;
  leaderName: string;
  leaderEmail: string;
  members: TeamMemberItem[];
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
  status: TeamStatus;
  submittedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamPayload {
  teamName: string;
  track?: string;
  tableNumber?: string;
  leaderName: string;
  leaderEmail: string;
  members?: TeamMemberItem[];
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
}

export interface UpdateTeamPayload {
  teamName?: string;
  track?: string;
  tableNumber?: string;
  leaderName?: string;
  leaderEmail?: string;
  projectTitle?: string;
  projectDescription?: string;
  repoUrl?: string;
  demoUrl?: string;
  status?: TeamStatus;
}

export interface AddTeamMemberPayload {
  name: string;
  email: string;
  role?: string;
  checkedIn?: boolean;
}

// Phase 11: Evaluation & Scoring Engine Types
export type ScoringStatus = 'OPEN' | 'CLOSED' | 'FINALIZED';

export interface RubricCriterionItem {
  key: string;
  label: string;
  maxScore: number;
  weight: number;
  description?: string;
}

export interface EventRubricItem {
  _id: string;
  eventId: string;
  title: string;
  track?: string;
  criteria: RubricCriterionItem[];
  scoringStatus: ScoringStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRubricPayload {
  title: string;
  track?: string;
  criteria?: RubricCriterionItem[];
}

export interface CriterionScoreItem {
  criteriaKey: string;
  score: number;
  feedback?: string;
}

export interface EventEvaluationItem {
  _id: string;
  eventId: string;
  rubricId: any;
  teamId: any;
  evaluatorMemberId: string;
  evaluatorEmail: string;
  evaluatorName: string;
  scores: CriterionScoreItem[];
  weightedTotal: number;
  generalFeedback?: string;
  status: 'DRAFT' | 'SUBMITTED';
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitEvaluationPayload {
  rubricId: string;
  teamId: string;
  scores: CriterionScoreItem[];
  generalFeedback?: string;
}

export interface LeaderboardEntryItem {
  teamId: string;
  teamName: string;
  track?: string;
  tableNumber?: string;
  projectTitle?: string;
  repoUrl?: string;
  demoUrl?: string;
  averageScore: number;
  evaluationCount: number;
}

// Phase 12: Generic Credential Abstraction Types
export type CredentialUsagePolicy = 'SINGLE_USE' | 'REUSABLE' | 'MULTI_DAY' | 'WORKER_UNASSIGNED';
export type CredentialStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'VOIDED';

export interface CredentialHolderInfo {
  name?: string;
  email?: string;
  roleCategory: string;
}

export interface CredentialAssetInfo {
  storagePath?: string;
  publicUrl?: string;
  qrPayload?: string;
  generatedAt?: string;
}

export interface EventCredentialItem {
  _id: string;
  eventId: string;
  credentialType: string;
  sequenceNumber: number;
  sequenceFormatted: string;
  verificationToken: string;
  status: CredentialStatus;
  holder: CredentialHolderInfo;
  usagePolicy: CredentialUsagePolicy;
  asset?: CredentialAssetInfo;
  checkInCount: number;
  lastCheckInAt?: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialMetrics {
  totalIssued: number;
  activeCount: number;
  checkedInCount: number;
  revokedCount: number;
}

export interface IssueCredentialPayload {
  credentialType?: string;
  holder: CredentialHolderInfo;
  usagePolicy?: CredentialUsagePolicy;
  metadata?: Record<string, any>;
}

export interface IssueWorkerBatchPayload {
  quantity: number;
  roleCategory?: string;
  prefix?: string;
}

export interface AssignHolderPayload {
  name: string;
  email?: string;
  roleCategory?: string;
}

export interface PublicTokenVerificationResult {
  credentialId: string;
  eventId: string;
  eventName: string;
  credentialType: string;
  sequenceNumber: number;
  sequenceFormatted: string;
  status: CredentialStatus;
  roleCategory: string;
  holderName: string;
  usagePolicy: CredentialUsagePolicy;
  checkInCount: number;
  lastCheckInAt?: string;
  issuedAt: string;
  expiresAt?: string;
}

// Phase 13: Credential Templates & Visual Rasterization Types
export type TemplatePresetId =
  | 'CONFERENCE_BADGE'
  | 'CONCERT_TICKET'
  | 'HACKATHON_PASS'
  | 'WORKER_PASS'
  | 'CUSTOM';

export type TemplateFieldKey =
  | 'name'
  | 'qr'
  | 'sequence'
  | 'role'
  | 'eventName'
  | 'date'
  | 'venue'
  | 'custom';

export interface EventCredentialTemplateField {
  key: TemplateFieldKey;
  label: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  fontSize?: number | null;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface EventCredentialTemplate {
  _id: string;
  eventId?: string | null;
  name: string;
  description?: string | null;
  isDefault: boolean;
  presetId: TemplatePresetId;
  dimensions: { width: number; height: number };
  backgroundStoragePath?: string | null;
  backgroundPublicUrl?: string | null;
  fields: EventCredentialTemplateField[];
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  presetId?: TemplatePresetId;
  dimensions?: { width: number; height: number };
  backgroundStoragePath?: string;
  backgroundPublicUrl?: string;
  fields?: EventCredentialTemplateField[];
  isDefault?: boolean;
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string;
  dimensions?: { width: number; height: number };
  backgroundStoragePath?: string;
  backgroundPublicUrl?: string;
  fields?: EventCredentialTemplateField[];
}

// Phase 14: QR Verification & Atomic Check-in Types
export interface CheckinRequestPayload {
  token: string;
  gate?: string;
  workerName?: string;
  notes?: string;
}

export interface CheckinResponse {
  success: boolean;
  code:
    | 'CHECKED_IN'
    | 'VALID_REUSABLE'
    | 'ALREADY_CHECKED_IN'
    | 'CREDENTIAL_REVOKED'
    | 'CREDENTIAL_EXPIRED'
    | 'WORKER_NAME_REQUIRED'
    | 'INVALID_TOKEN';
  message: string;
  credential?: EventCredentialItem;
  checkin?: CredentialCheckinLog;
  firstCheckedInAt?: string | null;
  lastCheckedInAt?: string | null;
  checkInCount?: number;
}

export interface CredentialCheckinLog {
  _id: string;
  eventId: string;
  credentialId: string;
  scannedBy: string;
  scannerEmail: string;
  scannerRole: string;
  scannedAt: string;
  scanStatus: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'REVOKED' | 'EXPIRED' | 'UNAUTHORIZED';
  usagePolicy: 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER';
  gate: string;
  holderSnapshot: {
    name: string;
    category: string;
    formattedId: string;
  };
  notes?: string | null;
  createdAt?: string;
}

export interface CredentialCheckinStats {
  totalScans: number;
  successfulCheckins: number;
  duplicateRejections: number;
  revokedRejections: number;
  velocityLast15Mins: number;
}

// Phase 15: Import + Bulk Credential Generation Jobs Types
export type EventJobType = 'IMPORT_CREDENTIALS' | 'BULK_RENDER_ASSETS' | 'EXPORT_CREDENTIALS';
export type EventJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface EventJobProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  percentage: number;
}

export interface EventJobResult {
  importedCount?: number;
  renderedCount?: number;
  exportedCount?: number;
  downloadUrl?: string;
  storagePath?: string;
  fileSizeBytes?: number;
  errorLog?: Array<{
    row?: number;
    identifier?: string;
    error: string;
    timestamp?: string;
  }>;
}

export interface EventJobItem {
  _id: string;
  eventId: string;
  jobType: EventJobType;
  status: EventJobStatus;
  progress: EventJobProgress;
  payload?: any;
  result?: EventJobResult;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  detectedHeaders: Record<string, string>;
  rawHeaders: string[];
  sampleRows: Array<{
    name: string;
    email?: string;
    phone?: string;
    category?: string;
    organization?: string;
    rowNumber: number;
  }>;
  validationErrors: Array<{ row: number; error: string; raw: any }>;
  allValidRecords: Array<{
    name: string;
    email?: string;
    phone?: string;
    category?: string;
    organization?: string;
    rowNumber: number;
  }>;
}

export interface CreateImportJobPayload {
  records: Array<{
    name: string;
    email?: string;
    phone?: string;
    category?: string;
    organization?: string;
    rowNumber?: number;
  }>;
  renderAfterImport?: boolean;
  templateId?: string;
  credentialType?: string;
}

// Phase 16: Export Jobs Types
export type ExportJobFormat = 'ZIP_PASSES' | 'ROSTER_XLSX' | 'ROSTER_CSV';

export interface CreateExportJobPayload {
  exportFormat: ExportJobFormat;
  filters?: {
    status?: CredentialStatus;
    credentialType?: string;
  };
}

// Phase 17: Storage Quota Governance Types
export interface StorageFolderBreakdown {
  count: number;
  bytes: number;
  formatted: string;
}

export interface ExportFileTelemetry {
  name: string;
  storagePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  isStale: boolean;
}

export interface EventStorageMetrics {
  eventId: string;
  totalBytes: number;
  totalBytesFormatted: string;
  quotaBytes: number;
  quotaBytesFormatted: string;
  usedPercentage: number;
  isNearQuota: boolean;
  isQuotaExceeded: boolean;
  breakdown: {
    credentials: StorageFolderBreakdown;
    exports: StorageFolderBreakdown;
    templates: StorageFolderBreakdown;
  };
  recentExports: ExportFileTelemetry[];
}

export interface StorageCleanupResult {
  deletedCount: number;
  reclaimedBytes: number;
  reclaimedFormatted: string;
}

// Phase 18: Security + Audit Types
export interface AuditLogItem {
  _id: string;
  actorId?: {
    _id?: string;
    name?: string;
    email?: string;
  } | string;
  actorEmail: string;
  actorRole: string;
  eventId?: string;
  action: string;
  targetEntity: string;
  targetId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
}

// Phase 19: Context-Aware Host Dashboard Console
export interface EventTypeFeatures {
  hasCompetition: boolean;
  hasMentors: boolean;
  hasRubrics: boolean;
  hasSessions: boolean;
  hasHighThroughputTurnstile: boolean;
  credentialTerm: string;
}

export interface EventDashboardSummary {
  event: {
    id: string;
    name: string;
    eventType: string;
    status: string;
    date: string;
    venue?: string;
    credentialTaxonomy?: string;
    features: EventTypeFeatures;
  };
  credentials: {
    total: number;
    active: number;
    checkedIn: number;
    revoked: number;
    checkInRatePercent: number;
  };
  checkins: {
    totalScans: number;
    successfulCheckins: number;
    duplicateRejections: number;
    revokedRejections: number;
    velocityLast15Mins: number;
  };
  staff: {
    total: number;
    coordinators: number;
    volunteers: number;
    mentors: number;
    evaluators: number;
  };
  teams?: {
    totalTeams: number;
    totalMembers: number;
  };
  storage: {
    totalStorageBytes: number;
    quotaBytes: number;
    usagePercent: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    actorRole: string;
    createdAt: string;
  }>;
}
