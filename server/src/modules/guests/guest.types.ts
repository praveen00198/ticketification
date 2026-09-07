export interface CreateSingleGuestDTO {
  name: string;
  category: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  designation?: string | null;
  metadata?: Record<string, any>;
}

export interface UpdateGuestDTO {
  name?: string;
  category?: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  designation?: string | null;
  metadata?: Record<string, any>;
}

export interface GuestFilterOptions {
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
}

export interface GuestResponse {
  id: string;
  eventId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  designation: string | null;
  category: string;
  metadata: Record<string, any> | null;
  importId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
