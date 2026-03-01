import { Router } from 'express';
import authRoutes from './authRoutes.js';
import documentRoutes from './documentRoutes.js';
import emissionRoutes from './emissionRoutes.js';
import reportRoutes from './reportRoutes.js';
import adminRoutes from './adminRoutes.js';
import clientConfigRoutes from './clientConfigRoutes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'URIMPACT API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/emissions', emissionRoutes);
router.use('/reports', reportRoutes);
router.use('/client-config', clientConfigRoutes);
router.use('/admin', adminRoutes);

export default router;
