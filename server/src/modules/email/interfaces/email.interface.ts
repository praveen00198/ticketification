export interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  isMock?: boolean;
}

export interface TicketDeliveryEmailOptions {
  to: string;
  attendeeName: string;
  eventName: string;
  credentialTerminology?: string;
  formattedId: string;
  verificationToken: string;
  verificationUrl?: string;
  passImageBuffer?: Buffer;
  venueName?: string;
  eventDate?: string;
}

export interface RegistrationConfirmationEmailOptions {
  to: string;
  attendeeName: string;
  eventName: string;
  credentialTerminology?: string;
  formattedId: string;
  verificationUrl?: string;
  venueName?: string;
  eventDate?: string;
}

export interface StaffInvitationEmailOptions {
  to: string;
  inviteeName: string;
  eventName: string;
  role: string;
  invitationUrl: string;
  hostName?: string;
  customMessage?: string;
}

export interface EventAnnouncementEmailOptions {
  to: string | string[];
  attendeeName?: string;
  eventName: string;
  announcementTitle: string;
  announcementBody: string;
}
