
import { Router } from 'express';
import {
  register,
  login,
  verifyLogin,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changeUserPassword,
  totpSetupStart,
  totpSetupConfirm,
  totpDisable,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Public routes (with rate limiting)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/login/verify', authLimiter, verifyLogin);
router.post('/refresh', authLimiter, refresh);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changeUserPassword);

router.post('/totp/setup', authenticate, totpSetupStart);
router.post('/totp/confirm', authenticate, totpSetupConfirm);
router.post('/totp/disable', authenticate, totpDisable);

export default router;
