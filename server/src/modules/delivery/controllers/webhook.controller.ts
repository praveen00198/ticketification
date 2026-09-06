import { Request, Response } from 'express';
import config from '../../../config/env';
import { ticketRepository } from '../../tickets/repositories/ticket.repository';

/**
 * Webhook controller for Meta WhatsApp Business Cloud API callbacks.
 * Handles:
 * 1. GET  /api/webhook — Webhook verification (hub.verify_token challenge)
 * 2. POST /api/webhook — Status updates (sent, delivered, read, failed)
 */
export class WebhookController {
  /**
   * Meta sends a GET request to verify the webhook URL during setup.
   * Responds with hub.challenge if the verify token matches.
   */
  async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.env.whatsappWebhookVerifyToken) {
      console.log('[Webhook] Verification successful');
      return res.status(200).send(challenge);
    }

    console.warn('[Webhook] Verification failed — token mismatch');
    return res.status(403).json({ error: 'Verification failed' });
  }

  /**
   * Meta sends POST requests with message status updates.
   * Updates ticket deliveryStatus based on WhatsApp status callbacks.
   */
  async handleStatusUpdate(req: Request, res: Response) {
    try {
      const body = req.body;

      // Always return 200 to Meta to acknowledge receipt
      // Process status updates from the webhook payload
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const statuses = changes?.value?.statuses;

      if (statuses && Array.isArray(statuses)) {
        for (const status of statuses) {
          const waMessageId = status.id;
          const waStatus = status.status; // sent, delivered, read, failed

          if (!waMessageId) continue;

          // Map WhatsApp status to our DeliveryStatus
          let deliveryStatus: 'SENT' | 'FAILED' | undefined;
          if (waStatus === 'sent' || waStatus === 'delivered' || waStatus === 'read') {
            deliveryStatus = 'SENT';
          } else if (waStatus === 'failed') {
            deliveryStatus = 'FAILED';
          }

          if (deliveryStatus) {
            await ticketRepository.updateDeliveryStatusByMessageId(waMessageId, deliveryStatus);
            console.log(`[Webhook] Updated ticket with WAMID ${waMessageId} → ${deliveryStatus}`);
          }
        }
      }

      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('[Webhook] Error processing status update:', err);
      return res.status(200).json({ status: 'ok' }); // Always 200 to Meta
    }
  }
}

export const webhookController = new WebhookController();
