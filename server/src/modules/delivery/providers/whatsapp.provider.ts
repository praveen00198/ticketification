import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import config from '../../../config/env';
import { IDeliveryProvider, DeliveryResult } from '../interfaces/delivery-provider.interface';
import { ITicketDocument } from '../../tickets/models/ticket.model';

/**
 * WhatsApp Business Cloud API Provider
 * Uses Meta Graph API to:
 * 1. Upload ticket image as media
 * 2. Send template message with image header to guest's WhatsApp number
 */
export class WhatsAppProvider implements IDeliveryProvider {
  private baseUrl: string;
  private accessToken: string;
  private phoneNumberId: string;
  private templateName: string;
  private templateLanguage: string;

  constructor() {
    const { whatsappApiVersion, whatsappAccessToken, whatsappPhoneNumberId, whatsappTicketTemplateName, whatsappTicketTemplateLanguage } = config.env;
    this.baseUrl = `https://graph.facebook.com/${whatsappApiVersion}`;
    this.accessToken = whatsappAccessToken;
    this.phoneNumberId = whatsappPhoneNumberId;
    this.templateName = whatsappTicketTemplateName;
    this.templateLanguage = whatsappTicketTemplateLanguage;
  }

  /**
   * Upload media (ticket image) to WhatsApp servers and get a media ID.
   */
  private async uploadMedia(imagePath: string): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    form.append('file', fs.createReadStream(imagePath));

    const response = await axios.post(
      `${this.baseUrl}/${this.phoneNumberId}/media`,
      form,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...form.getHeaders(),
        },
      }
    );

    return response.data.id;
  }

  /**
   * Send a template message with a header image to a WhatsApp number.
   */
  private async sendTemplateMessage(
    recipientPhone: string,
    mediaId: string,
    ticket: ITicketDocument
  ): Promise<{ messageId: string }> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'template',
      template: {
        name: this.templateName,
        language: { code: this.templateLanguage },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { id: mediaId },
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: ticket.name },
              { type: 'text', text: ticket.event },
              { type: 'text', text: ticket.eventDate.toDateString() },
              { type: 'text', text: ticket.ticketId },
            ],
          },
        ],
      },
    };

    const response = await axios.post(
      `${this.baseUrl}/${this.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const messageId = response.data?.messages?.[0]?.id || '';
    return { messageId };
  }

  async sendTicket(ticket: ITicketDocument, ticketImagePath: string): Promise<DeliveryResult> {
    // Mock mode: log delivery without calling Meta API
    if (config.env.whatsappMock || !config.env.whatsappEnabled) {
      console.log(`[WhatsAppProvider Mock] Would send ticket ${ticket.ticketId} to ${ticket.phone}`);
      console.log(`[WhatsAppProvider Mock] Image: ${ticketImagePath}`);
      return { success: true, providerMessageId: `mock-wa-${Date.now()}` };
    }

    if (!ticket.phone) {
      return { success: false, error: 'Guest phone number is missing.' };
    }

    try {
      // 1. Upload the ticket image to Meta media API
      const mediaId = await this.uploadMedia(ticketImagePath);

      // 2. Send template message with image header
      const result = await this.sendTemplateMessage(ticket.phone, mediaId, ticket);

      return { success: true, providerMessageId: result.messageId };
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Unknown WhatsApp API error';
      console.error(`[WhatsAppProvider Error] Failed to send ticket ${ticket.ticketId}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
