import { Router } from 'express';
import {
  getDashboard,
  getTrends,
  getComplianceReport,
  generateCustomReport,
  getReportInsights,
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { heavyOperationLimiter } from '../middleware/rateLimit.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Report routes
router.get('/dashboard', getDashboard);
router.get('/trends', getTrends);
router.get('/insights', heavyOperationLimiter, getReportInsights);
router.get('/compliance', heavyOperationLimiter, getComplianceReport);
router.post('/custom', heavyOperationLimiter, generateCustomReport);

export default router;
