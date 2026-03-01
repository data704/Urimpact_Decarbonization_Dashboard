import { Router } from 'express';
import {
  uploadDocument,
  uploadDocumentsMultiple,
  getDocuments,
  getDocument,
  removeDocument,
  processDocument,
  submitDocument,
  submitDocumentBatch,
} from '../controllers/documentController.js';
import { authenticate } from '../middleware/auth.js';
import { upload, uploadMultiple } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Document routes
router.post('/upload', uploadLimiter, upload.single('file'), uploadDocument);
router.post('/upload-multiple', uploadLimiter, uploadMultiple.array('file', 20), uploadDocumentsMultiple);
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.delete('/:id', removeDocument);
router.post('/:id/process', processDocument);
router.post('/:id/submit', submitDocument);
router.post('/:id/submit-batch', submitDocumentBatch);

export default router;
