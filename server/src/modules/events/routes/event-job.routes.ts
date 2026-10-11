import { Router } from 'express';
import multer from 'multer';
import { eventJobController } from '../controllers/event-job.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max spreadsheet
});

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// Synchronous preview before submitting import
router.post('/preview-import', upload.single('file'), eventJobController.previewImport);

// Enqueue jobs (Returns HTTP 202 Accepted)
router.post('/import', eventJobController.createImportJob);
router.post('/bulk-render', eventJobController.createBulkRenderJob);
router.post('/export', eventJobController.createExportJob);

// Query jobs & progress
router.get('/', eventJobController.listJobs);
router.get('/:jobId', eventJobController.getJobStatus);
router.post('/:jobId/cancel', eventJobController.cancelJob);

export default router;
