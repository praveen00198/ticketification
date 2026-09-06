import { Router } from 'express';
import { guestController } from '../controllers/guest.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { uploadExcel } from '../../../middlewares/upload.middleware';

const router = Router();

router.post('/import', authMiddleware, uploadExcel.single('file'), (req, res, next) =>
  guestController.importExcel(req, res, next)
);

export default router;
