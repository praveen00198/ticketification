import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

// All event routes are protected by Supabase Auth middleware
router.use(authMiddleware);

// Event CRUD
router.get('/', (req, res, next) => eventController.listMyEvents(req, res, next));
router.post('/', (req, res, next) => eventController.createEvent(req, res, next));
router.get('/:eventId', (req, res, next) => eventController.getEvent(req, res, next));
router.put('/:eventId', (req, res, next) => eventController.updateEvent(req, res, next));
router.delete('/:eventId', (req, res, next) => eventController.deleteEvent(req, res, next));

// Ticket Types for Event
router.get('/:eventId/ticket-types', (req, res, next) => eventController.listTicketTypes(req, res, next));
router.post('/:eventId/ticket-types', (req, res, next) => eventController.createTicketType(req, res, next));

export default router;
