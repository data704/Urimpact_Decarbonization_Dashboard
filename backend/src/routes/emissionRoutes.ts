import { Router } from 'express';
import {
  getEmissions,
  getEmission,
  calculateEmission,
  removeEmission,
  getEmissionsSummary,
  exportEmissions,
  bulkRemoveEmissions,
} from '../controllers/emissionController.js';
import { authenticate } from '../middleware/auth.js';
import {
  blockPendingPasswordChange,
  blockIncompleteOrganizationOnboarding,
} from '../middleware/accountStatus.js';
import { heavyOperationLimiter } from '../middleware/rateLimit.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(blockPendingPasswordChange);
router.use(blockIncompleteOrganizationOnboarding);

// Emission routes
router.get('/', getEmissions);
router.get('/summary', getEmissionsSummary);
router.get('/export', heavyOperationLimiter, exportEmissions);
router.get('/:id', getEmission);
router.post('/calculate', calculateEmission);
router.post('/bulk-delete', bulkRemoveEmissions);
router.delete('/:id', removeEmission);

export default router;
