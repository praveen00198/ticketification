import { Resend } from 'resend';
import crypto from 'crypto';
import config from '../../../config/env';
import {
  SendEmailOptions,
  SendEmailResult,
  TicketDeliveryEmailOptions,
  RegistrationConfirmationEmailOptions,
  StaffInvitationEmailOptions,
  EventAnnouncementEmailOptions,
} from '../interfaces/email.interface';
import {
  buildTicketDeliveryTemplate,
  buildRegistrationConfirmationTemplate,
  buildStaffInvitationTemplate,
  buildEventAnnouncementTemplate,
} from '../templates/email-templates';

export class ResendEmailService {
  private resendClient: Resend | null = null;
  private apiKey: string = '';
  private defaultFromEmail: string = '';

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = (apiKey !== undefined ? apiKey : (config.env.resendApiKey || '')).trim();
    this.defaultFromEmail = (defaultFrom !== undefined ? defaultFrom : (config.env.resendFromEmail || 'Ticketification <onboarding@resend.dev>')).trim();

    if (this.apiKey.length > 0) {
      this.resendClient = new Resend(this.apiKey);
      console.log('✅ [ResendEmailService] Initialized Resend email client.');
    } else {
      console.log('ℹ️ [ResendEmailService] Running in standby / mock mode (RESEND_API_KEY not configured).');
    }
  }

  /**
   * Dynamically configure or update the Resend API key at runtime.
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
    if (this.apiKey) {
      this.resendClient = new Resend(this.apiKey);
      console.log('✅ [ResendEmailService] Resend API key updated successfully.');
    } else {
      this.resendClient = null;
      console.log('ℹ️ [ResendEmailService] Resend API key cleared. Operating in standby mode.');
    }
  }

  /**
   * Set default sender email address (e.g. "Ticketification <tickets@yourdomain.com>").
   */
  public setDefaultFromEmail(fromEmail: string): void {
    this.defaultFromEmail = fromEmail.trim();
  }

  /**
   * Check if Resend email client has an active API key configured.
   */
  public isConfigured(): boolean {
    return !!this.resendClient && !!this.apiKey;
  }

  /**
   * Core email delivery method with zero-leak error sanitization and standby mock support.
   */
  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const recipients = (Array.isArray(options.to) ? options.to : [options.to])
      .map((r) => (typeof r === 'string' ? r.trim() : ''))
      .filter((r) => r.length > 0);
    const fromAddress = options.from || this.defaultFromEmail;

    if (!recipients || recipients.length === 0) {
      return { success: false, error: 'Recipient address (to) is required.' };
    }

    if (!options.subject || !options.subject.trim()) {
      return { success: false, error: 'Email subject is required.' };
    }

    // Standby Mode: when no API key is provided, safely simulate delivery
    if (!this.resendClient) {
      const mockId = `mock-email-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      console.log(
        `[ResendEmailService:Standby] Simulated email to [${recipients.join(', ')}] with subject "${options.subject}" (id: ${mockId})`
      );
      return {
        success: true,
        id: mockId,
        isMock: true,
      };
    }

    try {
      const payload: any = {
        from: fromAddress,
        to: recipients,
        subject: options.subject,
      };

      if (options.html) payload.html = options.html;
      if (options.text) payload.text = options.text;
      if (options.replyTo) payload.reply_to = options.replyTo;
      if (options.cc) payload.cc = options.cc;
      if (options.bcc) payload.bcc = options.bcc;
      if (options.tags) payload.tags = options.tags;

      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = options.attachments.map((att) => {
          const item: any = { filename: att.filename };
          if (att.content !== undefined) item.content = att.content;
          if (att.path !== undefined) item.path = att.path;
          if (att.contentType !== undefined) item.contentType = att.contentType;
          return item;
        });
      }

      const response = await this.resendClient.emails.send(payload);

      if (response.error) {
        console.error('[ResendEmailService] Resend API rejected email delivery:', response.error.message);
        return {
          success: false,
          error: response.error.message || 'Delivery failed',
        };
      }

      return {
        success: true,
        id: response.data?.id,
      };
    } catch (err: any) {
      const sanitized = this.sanitizeErrorMessage(err.message || 'Email delivery failed');
      console.error('[ResendEmailService] Delivery exception:', sanitized);
      return {
        success: false,
        error: sanitized,
      };
    }
  }

  /**
   * High-Level Helper: Deliver visual ticket/badge pass directly to attendee inbox.
   * Automatically attaches pass image PNG if buffer is provided.
   */
  public async sendTicketPassEmail(options: TicketDeliveryEmailOptions): Promise<SendEmailResult> {
    const { html, text } = buildTicketDeliveryTemplate(options);
    const terminology = options.credentialTerminology || 'Pass';
    const attachments = [];

    if (options.passImageBuffer) {
      attachments.push({
        filename: `${options.formattedId}-${terminology.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.png`,
        content: options.passImageBuffer,
        contentType: 'image/png',
      });
    }

    return this.sendEmail({
      to: options.to,
      subject: `Your ${terminology} for ${options.eventName} [${options.formattedId}]`,
      html,
      text,
      attachments,
    });
  }

  /**
   * High-Level Helper: Send registration confirmation receipt.
   */
  public async sendRegistrationConfirmationEmail(
    options: RegistrationConfirmationEmailOptions
  ): Promise<SendEmailResult> {
    const { html, text } = buildRegistrationConfirmationTemplate(options);
    return this.sendEmail({
      to: options.to,
      subject: `Registration Confirmed: ${options.eventName}`,
      html,
      text,
    });
  }

  /**
   * High-Level Helper: Send event staff / coordinator invitation with 1-click acceptance link.
   */
  public async sendStaffInvitationEmail(options: StaffInvitationEmailOptions): Promise<SendEmailResult> {
    const { html, text } = buildStaffInvitationTemplate(options);
    return this.sendEmail({
      to: options.to,
      subject: `Invitation to join ${options.eventName} as ${options.role}`,
      html,
      text,
    });
  }

  /**
   * High-Level Helper: Broadcast announcement to event attendee.
   */
  public async sendEventAnnouncementEmail(options: EventAnnouncementEmailOptions): Promise<SendEmailResult> {
    const { html, text } = buildEventAnnouncementTemplate(options);
    return this.sendEmail({
      to: options.to,
      subject: `[${options.eventName}] ${options.announcementTitle}`,
      html,
      text,
    });
  }

  /**
   * Redact secrets, keys, and tokens from error messages.
   */
  private sanitizeErrorMessage(error: string): string {
    let msg = error || '';
    msg = msg.replace(/re_[A-Za-z0-9_-]+/g, '[REDACTED_RESEND_KEY]');
    msg = msg.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
    msg = msg.replace(/(key|token|secret)=([^&\s]+)/gi, '$1=[REDACTED]');
    return msg;
  }
}

export const resendEmailService = new ResendEmailService();
export default resendEmailService;
