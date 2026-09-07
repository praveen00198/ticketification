import { Router } from 'express';
import { guestController } from '../controllers/guest.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { uploadExcel } from '../../../middlewares/upload.middleware';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// Multi-step Smart Import Endpoints
router.post('/events/:eventId/upload', uploadExcel.single('file'), (req, res, next) =>
  guestController.upload(req, res, next)
);

router.post('/events/:eventId/validate', (req, res, next) =>
  guestController.validate(req, res, next)
);

router.post('/events/:eventId/confirm', (req, res, next) =>
  guestController.confirm(req, res, next)
);

router.get('/events/:eventId', (req, res, next) =>
  guestController.listGuests(req, res, next)
);

router.get('/events/:eventId/imports', (req, res, next) =>
  guestController.listImports(req, res, next)
);

// Fallback direct routes for /api/guests/:eventId
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
