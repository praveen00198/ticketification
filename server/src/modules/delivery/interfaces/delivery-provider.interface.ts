import { ITicketDocument } from '../../tickets/models/ticket.model';

export interface DeliveryResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Common interface for all ticket delivery providers (WhatsApp, Email, etc.)
 */
export interface IDeliveryProvider {
  /**
   * Send a ticket to the guest via the provider's channel.
   * @param ticket - Ticket document with guest info and metadata.
   * @param ticketImagePath - Absolute local file path or public URL of the rendered ticket image.
   * @returns Promise resolving to delivery result.
   */
  sendTicket(ticket: ITicketDocument, ticketImagePath: string): Promise<DeliveryResult>;
}
