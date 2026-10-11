import { Router } from 'express';
import multer from 'multer';
import { hostController } from './host.controller';
import { authenticateUser } from '../../middlewares/auth.middleware';

const router = Router();

// Memory storage for direct buffer upload to Supabase Storage (zero ephemeral disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, WEBP, and SVG are allowed.'));
    }
  },
});

// All host routes strictly require verified authentication
router.use(authenticateUser);

/**
 * @route   GET /api/host/profile
 * @desc    Retrieve authenticated user's organizer profile and onboarding state
 */
router.get('/profile', hostController.getProfile);

/**
 * @route   POST /api/host/onboarding
 * @desc    Complete initial organizer onboarding
 */
router.post('/onboarding', hostController.completeOnboarding);

/**
 * @route   PUT /api/host/profile
 * @desc    Update existing organizer profile attributes
 */
router.put('/profile', hostController.updateProfile);

/**
 * @route   POST /api/host/logo
 * @desc    Upload an organization logo to Supabase Storage
 */
router.post('/logo', upload.single('logo'), hostController.uploadLogo);

export default router;
