import { Router } from 'express';
import {
  getUsers,
  getUser,
  updateUser,
  getAuditLogsHandler,
  getSystemStats,
  getAllDocumentsHandler,
} from '../controllers/adminController.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// User management
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);

// Audit logs
router.get('/audit-logs', getAuditLogsHandler);

// System stats
router.get('/stats', getSystemStats);

// Documents (admin view)
router.get('/documents', getAllDocumentsHandler);

export default router;
