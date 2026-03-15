import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { saveClientConfig, getLatestClientConfig } from '../services/clientConfigService.js';
import { logger } from '../utils/logger.js';
import { canConfigureSettings } from '../utils/rolePermissions.js';

/**
 * Save client inputs & constraints
 * POST /api/client-config
 */
export async function saveConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canConfigureSettings(req.user.role)) {
      sendError(res, 'Only Administrators can change pathway configuration', 403);
      return;
    }

    const { targetYear, ambitionLevel, capexOpexPreference, supportingDocuments } = req.body;

    if (targetYear == null || !ambitionLevel) {
      sendError(res, 'targetYear and ambitionLevel are required', 400);
      return;
    }

    const year = parseInt(String(targetYear), 10);
    if (isNaN(year) || year < 2026 || year > 2100) {
      sendError(res, 'targetYear must be between 2026 and 2100', 400);
      return;
    }

    const config = await saveClientConfig({
      userId: req.user.userId,
      targetYear: year,
      ambitionLevel: String(ambitionLevel),
      capexOpexPreference: capexOpexPreference ?? null,
      supportingDocuments: Array.isArray(supportingDocuments) ? supportingDocuments : [],
    });

    sendSuccess(res, config, 'Configuration saved', 201);
  } catch (error) {
    logger.error('Save client config error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to save configuration', 500);
    }
  }
}

/**
 * Get latest client config
 * GET /api/client-config
 */
export async function getConfig(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const config = await getLatestClientConfig(req.user.userId);
    sendSuccess(res, config);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      sendError(res, error.message, 404);
      return;
    }
    logger.error('Get client config error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get configuration', 500);
    }
  }
}
