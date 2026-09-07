export interface GenerateWorkerTicketsDTO {
  count: number;
  ticketTypeName?: string;
}

export interface TicketFilterQuery {
  status?: string;
  ticketTypeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TicketGuestInfo {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  designation?: string | null;
  category: string;
}

export interface TicketTypeInfo {
  id: string;
  name: string;
  label: string;
  usagePolicy: string;
}

export interface TicketResponse {
  id: string;
  sequenceNumber: number;
  verificationToken: string;
  status: string;
  usagePolicy: string;
  assetUrl: string;
  createdAt: Date;
  guest: TicketGuestInfo;
  ticketType: TicketTypeInfo;
}

export interface GenerateTicketsResult {
  message: string;
  generatedCount: number;
  totalGuests: number;
}
