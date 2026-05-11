import { Router } from 'express';
import { saveConfig, getConfig } from '../controllers/clientConfigController.js';
import { authenticate } from '../middleware/auth.js';
import {
  blockPendingPasswordChange,
  blockIncompleteOrganizationOnboarding,
} from '../middleware/accountStatus.js';

const router = Router();

router.use(authenticate);
router.use(blockPendingPasswordChange);
router.use(blockIncompleteOrganizationOnboarding);

router.post('/', saveConfig);
router.get('/', getConfig);

export default router;
