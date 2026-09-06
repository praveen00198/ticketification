export interface User {
  id: string;
  name: string;
  email: string;
  eventName?: string;
  role: 'ADMIN';
}

export type DeliveryProvider = 'WHATSAPP' | 'EMAIL';
export type DeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';

export interface Ticket {
  _id: string;
  ticketId: string;
  verificationToken: string;
  name: string;
  email?: string;
  phone?: string;
  event: string;
  eventDate: string;
  ticketType: string;
  organization?: string;
  designation?: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED';
  emailStatus: 'PENDING' | 'SENT' | 'FAILED';
  deliveryProvider?: DeliveryProvider;
  deliveryStatus?: DeliveryStatus;
  providerMessageId?: string;
  ticketImageUrl?: string;
  imageBase64?: string;
  pdfPath?: string;
  usedAt?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface ValidationErrorDetail {
  rowNumber: number;
  field: string;
  problem: string;
  suggestedCorrection?: string;
}

export interface ValidatedGuestRow {
  rowNumber: number;
  data: {
    name: string;
    email?: string;
    phone?: string;
    event: string;
    eventDate: string;
    ticketType: string;
    organization?: string;
    designation?: string;
  };
}

export interface ImportValidationSummary {
  totalRecords: number;
  validRecordsCount: number;
  invalidRecordsCount: number;
  validRows: ValidatedGuestRow[];
  errors: ValidationErrorDetail[];
}

export interface DashboardStats {
  totalGuests: number;
  ticketsGenerated: number;
  ticketsActive?: number;
  deliverySent?: number;
  deliveryFailed?: number;
  deliveryPending?: number;
  deliverySending?: number;
  emailsSent: number;
  emailsFailed: number;
  emailsPending: number;
  ticketsUsed: number;
  ticketsRemaining: number;
}
