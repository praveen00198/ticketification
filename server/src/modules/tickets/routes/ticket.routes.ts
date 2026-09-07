import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// Event-scoped ticket endpoints
router.post('/events/:eventId/generate', (req, res, next) =>
  ticketController.generateTickets(req, res, next)
);

router.post('/events/:eventId/generate-worker', (req, res, next) =>
  ticketController.generateWorkerTickets(req, res, next)
);

router.get('/events/:eventId/export-zip', (req, res, next) =>
  ticketController.exportTicketsZip(req, res, next)
);

router.get('/events/:eventId', (req, res, next) =>
  ticketController.getAllTickets(req, res, next)
);

router.get('/events/:eventId/tickets/:ticketId/download', (req, res, next) =>
  ticketController.downloadTicket(req, res, next)
);

// Fallback direct routes
router.get('/export-zip', (req, res, next) =>
  ticketController.exportTicketsZip(req, res, next)
);

router.post('/generate', (req, res, next) =>
  ticketController.generateTickets(req, res, next)
);

router.post('/generate-worker', (req, res, next) =>
  ticketController.generateWorkerTickets(req, res, next)
);

router.get('/', (req, res, next) =>
  ticketController.getAllTickets(req, res, next)
);

router.get('/:id/download', (req, res, next) =>
  ticketController.downloadTicket(req, res, next)
);

router.get('/:id', (req, res, next) =>
  ticketController.getTicketById(req, res, next)
);

export default router;
