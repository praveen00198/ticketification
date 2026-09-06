import { IDeliveryProvider, DeliveryResult } from '../interfaces/delivery-provider.interface';
import { ITicketDocument } from '../../tickets/models/ticket.model';
import { emailService } from '../../tickets/services/email.service';
import { pdfService } from '../../tickets/services/pdf.service';
import { qrService } from '../../tickets/services/qr.service';

/**
 * Email Delivery Provider
 * Wraps the existing EmailService/PdfService to conform to the IDeliveryProvider interface.
 * Generates PDF, sends via Resend.
 */
export class EmailProvider implements IDeliveryProvider {
  async sendTicket(ticket: ITicketDocument, _ticketImagePath: string): Promise<DeliveryResult> {
    if (!ticket.email) {
      return { success: false, error: 'Guest email address is missing.' };
    }

    try {
      // Re-generate QR and PDF for email attachment
      const qrDataUrl = await qrService.generateQrDataUrl(ticket.verificationToken);
      const pdfBuffer = await pdfService.generateTicketPdf({
        ticketId: ticket.ticketId,
        guestName: ticket.name,
        guestEmail: ticket.email,
        eventName: ticket.event,
        eventDate: ticket.eventDate.toDateString(),
        ticketType: ticket.ticketType,
        qrCodeDataUrl: qrDataUrl,
        organization: ticket.organization,
      });

      const result = await emailService.sendTicketEmail({
        toEmail: ticket.email,
        guestName: ticket.name,
        ticketId: ticket.ticketId,
        eventName: ticket.event,
        pdfBuffer,
      });

      return {
        success: result.success,
        providerMessageId: result.messageId,
        error: result.success ? undefined : 'Email delivery failed',
      };
    } catch (err: any) {
      console.error(`[EmailProvider Error] Failed to send ticket ${ticket.ticketId}:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

export const emailProvider = new EmailProvider();
