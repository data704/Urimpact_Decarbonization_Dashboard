import { Router } from 'express';
import { getRecentActivityHandler } from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';
import {
  blockPendingPasswordChange,
  blockIncompleteOrganizationOnboarding,
} from '../middleware/accountStatus.js';

const router = Router();

router.get(
  '/recent',
  authenticate,
  blockPendingPasswordChange,
  blockIncompleteOrganizationOnboarding,
  getRecentActivityHandler
);

export default router;
