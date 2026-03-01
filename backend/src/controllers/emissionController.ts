import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/helpers.js';
import {
  getUserEmissions,
  getEmissionById,
  calculateAndCreateEmission,
  deleteEmission,
  getEmissionsSummaryByScope,
  getEmissionsSummaryByCategory,
  getEmissionsForExport,
} from '../services/emissionService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
import { emissionCalculationSchema, validate } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { EmissionScope, EmissionCategory } from '@prisma/client';

/**
 * Get user's emissions
 * GET /api/emissions
 */
export async function getEmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const filters = {
      scope: req.query.scope as string,
      category: req.query.category as string,
      region: req.query.region as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const { emissions, pagination } = await getUserEmissions(
      req.user.userId,
      filters,
      req.query as { page?: string; limit?: string }
    );

    sendPaginated(res, emissions, pagination);
  } catch (error) {
    logger.error('Get emissions error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get emissions', 500);
    }
  }
}

/**
 * Get single emission record
 * GET /api/emissions/:id
 */
export async function getEmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Emission ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    
    const emission = await getEmissionById(id, req.user.userId, isAdmin);
    sendSuccess(res, emission);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      if (error.message.includes('access')) {
        sendError(res, error.message, 403);
        return;
      }
      logger.error('Get emission error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get emission', 500);
    }
  }
}

/**
 * Manual emissions calculation
 * POST /api/emissions/calculate
 */
export async function calculateEmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(emissionCalculationSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const data = validation.data!;

    const emission = await calculateAndCreateEmission({
      userId: req.user.userId,
      scope: (data.scope as EmissionScope) || 'SCOPE_2',
      category: (data.category as EmissionCategory) || 'ELECTRICITY',
      activityType: data.activityType,
      activityAmount: data.activityAmount,
      activityUnit: data.activityUnit,
      region: data.region || 'AE',
      billingPeriodStart: data.billingPeriodStart ? new Date(data.billingPeriodStart) : undefined,
      billingPeriodEnd: data.billingPeriodEnd ? new Date(data.billingPeriodEnd) : undefined,
      notes: data.notes,
    });

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      { 
        activityType: data.activityType,
        activityAmount: data.activityAmount,
        co2e: emission.co2e,
      },
      req
    );

    logger.info(`Emission calculated: ${emission.id}, ${emission.co2e} kg CO2e`);
    sendSuccess(res, emission, 'Emission calculated successfully', 201);
  } catch (error) {
    logger.error('Calculate emission error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to calculate emission', 500);
    }
  }
}

/**
 * Delete emission record
 * DELETE /api/emissions/:id
 */
export async function removeEmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Emission ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    
    await deleteEmission(id, req.user.userId, isAdmin);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_DELETED,
      'emission',
      id,
      {},
      req
    );

    sendSuccess(res, null, 'Emission record deleted successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      if (error.message.includes('access')) {
        sendError(res, error.message, 403);
        return;
      }
      logger.error('Delete emission error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to delete emission', 500);
    }
  }
}

/**
 * Get emissions summary
 * GET /api/emissions/summary
 */
export async function getEmissionsSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : undefined;
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : undefined;

    const [byScope, byCategory] = await Promise.all([
      getEmissionsSummaryByScope(req.user.userId, startDate, endDate),
      getEmissionsSummaryByCategory(req.user.userId, startDate, endDate),
    ]);

    // Calculate totals
    const totalKg = Object.values(byScope).reduce((sum, s) => sum + s.total, 0);
    const totalRecords = Object.values(byScope).reduce((sum, s) => sum + s.count, 0);

    sendSuccess(res, {
      total: {
        co2eKg: totalKg,
        co2eTonnes: totalKg / 1000,
        recordCount: totalRecords,
      },
      byScope,
      byCategory,
    });
  } catch (error) {
    logger.error('Get emissions summary error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get emissions summary', 500);
    }
  }
}

/**
 * Export emissions data
 * GET /api/emissions/export
 */
export async function exportEmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const filters = {
      scope: req.query.scope as string,
      category: req.query.category as string,
      region: req.query.region as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const format = (req.query.format as string) || 'json';
    const emissions = await getEmissionsForExport(req.user.userId, filters);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_EXPORTED,
      'emission',
      undefined,
      { format, recordCount: emissions.length },
      req
    );

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'ID',
        'Scope',
        'Category',
        'Activity Type',
        'Activity Amount',
        'Activity Unit',
        'Region',
        'CO2e (kg)',
        'Emission Factor',
        'Data Source',
        'Calculated At',
      ];

      const rows = emissions.map((e) => [
        e.id,
        e.scope,
        e.category,
        e.activityType,
        e.activityAmount,
        e.activityUnit,
        e.region,
        e.co2e,
        e.emissionFactor,
        e.dataSource || '',
        e.calculatedAt.toISOString(),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=emissions.csv');
      res.send(csv);
    } else {
      sendSuccess(res, emissions);
    }
  } catch (error) {
    logger.error('Export emissions error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to export emissions', 500);
    }
  }
}
