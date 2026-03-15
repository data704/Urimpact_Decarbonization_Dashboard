import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { getRecentActivity } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

/**
 * Recent activity feed for dashboard — who did what (audit logs with user info).
 * GET /api/activity/recent — any authenticated user
 */
export async function getRecentActivityHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const organizationId = req.user.organizationId ?? undefined;
    const logs = await getRecentActivity(limit, organizationId);
    sendSuccess(res, { activities: logs });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to load activity', 500);
    }
  }
}
