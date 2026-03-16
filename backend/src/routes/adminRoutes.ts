import { Router } from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
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
router.post('/users', createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Audit logs
router.get('/audit-logs', getAuditLogsHandler);

// System stats
router.get('/stats', getSystemStats);

// Documents (admin view)
router.get('/documents', getAllDocumentsHandler);

export default router;
