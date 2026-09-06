import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

// Meta WhatsApp webhook verification (GET)
router.get('/', (req, res) => webhookController.verifyWebhook(req, res));

// Meta WhatsApp status update callbacks (POST)
router.post('/', (req, res) => webhookController.handleStatusUpdate(req, res));

export default router;
