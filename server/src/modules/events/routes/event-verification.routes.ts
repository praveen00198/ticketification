import { Router } from 'express';
import multer from 'multer';
import { eventVerificationController } from '../controllers/event-verification.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireAdmin } from '../../../middlewares/authorization.middleware';

const router = Router({ mergeParams: true });

// Memory storage for verification document uploads (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/* ==========================================================================
   HOST-FACING EVENT VERIFICATION ROUTES (Scoped to :eventId)
   ========================================================================== */

// 1. Get verification details & live risk preview
router.get(
  '/',
  authMiddleware,
  (req, res, next) => eventVerificationController.getVerification(req, res, next)
);

// 2. Save or update verification draft
router.post(
  '/draft',
  authMiddleware,
  (req, res, next) => eventVerificationController.saveDraft(req, res, next)
);

// 3. Request 6-digit OTP for official institutional email
router.post(
  '/send-otp',
  authMiddleware,
  (req, res, next) => eventVerificationController.sendOtp(req, res, next)
);

// 4. Verify the 6-digit OTP
router.post(
  '/verify-otp',
  authMiddleware,
  (req, res, next) => eventVerificationController.verifyOtp(req, res, next)
);

// 5. Upload authorization document (PDF, PNG, JPEG, WEBP)
router.post(
  '/document',
  authMiddleware,
  upload.single('document'),
  (req, res, next) => eventVerificationController.uploadDocument(req, res, next)
);

// 6. Remove an uploaded document
router.delete(
  '/document',
  authMiddleware,
  (req, res, next) => eventVerificationController.removeDocument(req, res, next)
);

// 7. Submit event verification for Platform Admin review
router.post(
  '/submit',
  authMiddleware,
  (req, res, next) => eventVerificationController.submitVerification(req, res, next)
);

export default router;

/* ==========================================================================
   PLATFORM ADMIN VERIFICATION ROUTES
   ========================================================================== */

export const adminVerificationRouter = Router();

// List pending / all verification submissions
adminVerificationRouter.get(
  '/',
  authMiddleware,
  requireAdmin,
  (req, res, next) => eventVerificationController.adminListVerifications(req, res, next)
);

// Review (Approve or Reject) an event verification request
adminVerificationRouter.post(
  '/:eventId/review',
  authMiddleware,
  requireAdmin,
  (req, res, next) => eventVerificationController.adminReviewVerification(req, res, next)
);
