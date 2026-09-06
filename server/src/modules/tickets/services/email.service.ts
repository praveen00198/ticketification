import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import config from '../../../config/env';

export interface SendTicketEmailPayload {
  toEmail: string;
  guestName: string;
  ticketId: string;
  eventName: string;
  pdfBuffer: Buffer;
}

export class EmailService {
  private resendClient: Resend | null = null;

  constructor() {
    if (config.env.resendApiKey && config.env.resendApiKey.startsWith('re_')) {
      this.resendClient = new Resend(config.env.resendApiKey);
    }
  }

  async sendTicketEmail(payload: SendTicketEmailPayload): Promise<{ success: boolean; messageId?: string }> {
    const subject = `Your Ticket — ${payload.eventName} (${payload.ticketId})`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
        <h2 style="color: #18181b; margin-top: 0;">Hello ${payload.guestName},</h2>
        <p style="color: #3f3f46; line-height: 1.5;">Your ticket for <strong>${payload.eventName}</strong> has been generated successfully.</p>
        <div style="background-color: #faf9f6; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 0; font-size: 14px; color: #71717a;">Ticket Reference:</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; font-family: monospace; color: #dc2626;">${payload.ticketId}</p>
        </div>
        <p style="color: #3f3f46;">Please find your official PDF event ticket attached to this email. Bring this ticket or present the QR code on your mobile device at event entrance.</p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 25px 0;" />
        <p style="color: #71717a; font-size: 12px; margin: 0;">Regards,<br>Event Operations Team</p>
      </div>
    `;

    if (this.resendClient) {
      try {
        const res = await this.resendClient.emails.send({
          from: config.env.emailFrom || 'tickets@example.com',
          to: [payload.toEmail],
          subject,
          html,
          attachments: [
            {
              filename: `Ticket-${payload.ticketId}.pdf`,
              content: payload.pdfBuffer,
            },
          ],
        });

        if (res.error) {
          console.error('[EmailService Error] Resend error:', res.error);
          return { success: false };
        }

        return { success: true, messageId: res.data?.id };
      } catch (err) {
        console.error('[EmailService Exception] Resend exception:', err);
        return { success: false };
      }
    }

    // Mock fallback when RESEND_API_KEY is not set or local dev
    const mockDir = path.resolve(process.cwd(), config.env.uploadDir, 'mock-emails');
    if (!fs.existsSync(mockDir)) {
      fs.mkdirSync(mockDir, { recursive: true });
    }

    const mockFilePath = path.join(mockDir, `email-${payload.ticketId}.html`);
    const mockPdfPath = path.join(mockDir, `Ticket-${payload.ticketId}.pdf`);

    fs.writeFileSync(mockFilePath, html, 'utf-8');
    fs.writeFileSync(mockPdfPath, payload.pdfBuffer);

    console.log(`[EmailService Mock] Transactional email logged for ${payload.toEmail}. HTML: ${mockFilePath}, PDF: ${mockPdfPath}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}

export const emailService = new EmailService();
