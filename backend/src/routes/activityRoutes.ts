import { Router } from 'express';
import { getRecentActivityHandler } from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/recent', authenticate, getRecentActivityHandler);

export default router;
