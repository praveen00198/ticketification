import { Router } from 'express';
import { publicEventController } from '../controllers/public-event.controller';

export const publicEventRouter = Router();

// Public event discovery catalog
publicEventRouter.get('/events', publicEventController.getEvents);

// Standalone public event details
publicEventRouter.get('/events/:eventId', publicEventController.getEventById);

// Public organizer profile
publicEventRouter.get('/hosts/:hostId', publicEventController.getHostProfile);

// Trust & Safety report submission
publicEventRouter.post('/events/:eventId/report', publicEventController.reportEvent);

export default publicEventRouter;
