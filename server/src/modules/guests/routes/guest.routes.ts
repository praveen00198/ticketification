import { Router } from 'express';
import { guestController } from '../controllers/guest.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { uploadExcel } from '../../../middlewares/upload.middleware';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// --- Guest CRUD Endpoints ---
router.post('/events/:eventId', (req, res, next) =>
  guestController.createGuest(req, res, next)
);

router.get('/events/:eventId', (req, res, next) =>
  guestController.listGuests(req, res, next)
);

router.get('/events/:eventId/guests/:guestId', (req, res, next) =>
  guestController.getGuest(req, res, next)
);

router.put('/events/:eventId/guests/:guestId', (req, res, next) =>
  guestController.updateGuest(req, res, next)
);

router.delete('/events/:eventId/guests/:guestId', (req, res, next) =>
  guestController.deleteGuest(req, res, next)
);

// --- Multi-step Smart Excel Import Endpoints ---
router.post('/events/:eventId/upload', uploadExcel.single('file'), (req, res, next) =>
  guestController.upload(req, res, next)
);

router.post('/events/:eventId/validate', (req, res, next) =>
  guestController.validate(req, res, next)
);

router.post('/events/:eventId/confirm', (req, res, next) =>
  guestController.confirm(req, res, next)
);

router.get('/events/:eventId/imports', (req, res, next) =>
  guestController.listImports(req, res, next)
);

// --- Fallback direct routes for backward compatibility ---
router.post('/upload/:eventId', uploadExcel.single('file'), (req, res, next) =>
  guestController.upload(req, res, next)
);

router.post('/validate/:eventId', (req, res, next) =>
  guestController.validate(req, res, next)
);

router.post('/confirm/:eventId', (req, res, next) =>
  guestController.confirm(req, res, next)
);

router.get('/:eventId', (req, res, next) =>
  guestController.listGuests(req, res, next)
);

export default router;
