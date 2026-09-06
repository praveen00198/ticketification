import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

router.post('/generate', authMiddleware, (req, res, next) => ticketController.generateTickets(req, res, next));
router.get('/', authMiddleware, (req, res, next) => ticketController.getAllTickets(req, res, next));
router.get('/download-zip', authMiddleware, (req, res, next) => ticketController.downloadAllZip(req, res, next));
router.get('/:id/download', authMiddleware, (req, res, next) => ticketController.downloadSingleTicket(req, res, next));
router.get('/:id', authMiddleware, (req, res, next) => ticketController.getTicketById(req, res, next));
router.post('/:id/resend', authMiddleware, (req, res, next) => ticketController.resendTicket(req, res, next));

export default router;

