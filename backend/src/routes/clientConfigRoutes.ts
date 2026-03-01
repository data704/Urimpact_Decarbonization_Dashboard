import { Router } from 'express';
import { saveConfig, getConfig } from '../controllers/clientConfigController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', saveConfig);
router.get('/', getConfig);

export default router;
