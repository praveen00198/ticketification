import config from '../../../config/env';
import { IDeliveryProvider, DeliveryResult } from '../interfaces/delivery-provider.interface';
import { WhatsAppProvider, whatsAppProvider } from '../providers/whatsapp.provider';
import { EmailProvider, emailProvider } from '../providers/email.provider';
import { ITicketDocument } from '../../tickets/models/ticket.model';

/**
 * Delivery Service — Routes ticket delivery to the active provider
 * based on the DELIVERY_PROVIDER environment variable.
 */
export class DeliveryService {
  private provider: IDeliveryProvider;

  constructor() {
    const providerName = config.env.deliveryProvider.toLowerCase();
    if (providerName === 'whatsapp') {
      this.provider = whatsAppProvider;
    } else {
      this.provider = emailProvider;
    }
    console.log(`[DeliveryService] Active delivery provider: ${providerName.toUpperCase()}`);
  }

  getProviderName(): string {
    return config.env.deliveryProvider.toUpperCase();
  }

  async sendTicket(ticket: ITicketDocument, ticketImagePath: string): Promise<DeliveryResult> {
    return this.provider.sendTicket(ticket, ticketImagePath);
  }

  /**
   * Send tickets in controlled batches with delay to prevent rate limiting.
   */
  async sendBatch(
    tickets: Array<{ ticket: ITicketDocument; imagePath: string }>,
    onProgress?: (completed: number, total: number, result: DeliveryResult & { ticketId: string }) => void
  ): Promise<{ sent: number; failed: number; results: Array<DeliveryResult & { ticketId: string }> }> {
    const batchSize = config.env.whatsappBatchSize;
    const delayMs = config.env.whatsappDelayMs;
    const results: Array<DeliveryResult & { ticketId: string }> = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);

      // Process each item in the batch sequentially with delay
      for (const item of batch) {
        const result = await this.sendTicket(item.ticket, item.imagePath);
        const tagged = { ...result, ticketId: item.ticket.ticketId };
        results.push(tagged);

        if (result.success) {
          sent++;
        } else {
          failed++;
        }

        if (onProgress) {
          onProgress(sent + failed, tickets.length, tagged);
        }

        // Throttle between messages
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return { sent, failed, results };
  }
}

export const deliveryService = new DeliveryService();
