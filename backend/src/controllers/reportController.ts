import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import {
  getTotalEmissions,
  getEmissionsSummaryByScope,
  getEmissionsSummaryByCategory,
  getEmissionsTrend,
  getEmissionsTrendForRange,
} from '../services/emissionService.js';
import { getDocumentStats, getRecentDocuments } from '../services/documentService.js';
import { getLatestClientConfigOrNull } from '../services/clientConfigService.js';
import {
  generateReportCalculations,
  generateSectionNarratives,
  ReportCalculationInput,
  SectionNarrativeInput,
} from '../services/anthropicService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

/**
 * Get dashboard data
 * GET /api/reports/dashboard
 * Query: startDate (ISO), endDate (ISO) - optional; when provided, emissions data is filtered to this range
 */
export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Fetch all dashboard data in parallel (with optional date filter for emissions)
    const [
      totalEmissions,
      emissionsByScope,
      emissionsByCategory,
      documentStats,
      recentDocuments,
      trend,
    ] = await Promise.all([
      getTotalEmissions(req.user.userId, startDate, endDate),
      getEmissionsSummaryByScope(req.user.userId, startDate, endDate),
      getEmissionsSummaryByCategory(req.user.userId, startDate, endDate),
      getDocumentStats(req.user.userId),
      getRecentDocuments(req.user.userId, 5),
      startDate && endDate
        ? getEmissionsTrendForRange(req.user.userId, startDate, endDate)
        : getEmissionsTrend(req.user.userId, 12),
    ]);

    const dashboard = {
      emissions: {
        total: totalEmissions,
        byScope: emissionsByScope,
        byCategory: emissionsByCategory,
        trend,
      },
      documents: {
        stats: documentStats,
        recent: recentDocuments,
        total: Object.values(documentStats).reduce((sum, count) => sum + count, 0),
      },
      // Compliance indicators (can be expanded based on requirements)
      compliance: {
        reportingPeriod: getCurrentReportingPeriod(),
        dataCompleteness: calculateDataCompleteness(documentStats),
        lastUpdated: new Date().toISOString(),
      },
    };

    sendSuccess(res, dashboard);
  } catch (error) {
    logger.error('Get dashboard error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get dashboard data', 500);
    }
  }
}

/**
 * Get emissions trends
 * GET /api/reports/trends
 */
export async function getTrends(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const months = parseInt(req.query.months as string) || 12;
    const trend = await getEmissionsTrend(req.user.userId, months);

    sendSuccess(res, {
      period: `Last ${months} months`,
      data: trend,
    });
  } catch (error) {
    logger.error('Get trends error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get trends', 500);
    }
  }
}

/**
 * Generate compliance report
 * GET /api/reports/compliance
 */
export async function getComplianceReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const [totalEmissions, byScope, byCategory] = await Promise.all([
      getTotalEmissions(req.user.userId),
      getEmissionsSummaryByScope(req.user.userId, startDate, endDate),
      getEmissionsSummaryByCategory(req.user.userId, startDate, endDate),
    ]);

    const report = {
      reportType: 'Annual Compliance Report',
      reportingYear: year,
      generatedAt: new Date().toISOString(),
      organization: {
        // This would come from user/company profile
        name: 'Organization Name',
      },
      summary: {
        totalEmissions: totalEmissions.totalCo2eTonnes,
        unit: 'tonnes CO2e',
        recordCount: totalEmissions.recordCount,
      },
      emissionsByScope: {
        scope1: {
          description: 'Direct emissions from owned or controlled sources',
          total: byScope.SCOPE_1?.totalTonnes ?? 0,
          unit: 'tonnes CO2e',
          percentage: calculatePercentage(byScope.SCOPE_1?.total ?? 0, totalEmissions.totalCo2e),
        },
        scope2: {
          description: 'Indirect emissions from purchased electricity, steam, heating, and cooling',
          total: byScope.SCOPE_2?.totalTonnes ?? 0,
          unit: 'tonnes CO2e',
          percentage: calculatePercentage(byScope.SCOPE_2?.total ?? 0, totalEmissions.totalCo2e),
        },
        scope3: {
          description: 'Other indirect emissions in the value chain',
          total: byScope.SCOPE_3?.totalTonnes ?? 0,
          unit: 'tonnes CO2e',
          percentage: calculatePercentage(byScope.SCOPE_3?.total ?? 0, totalEmissions.totalCo2e),
        },
      },
      emissionsByCategory: byCategory.map((cat) => ({
        category: cat.category,
        total: cat.totalTonnes,
        unit: 'tonnes CO2e',
        percentage: calculatePercentage(cat.total, totalEmissions.totalCo2e),
      })),
      methodology: {
        standard: 'GHG Protocol Corporate Standard',
        emissionFactorSources: ['IEA', 'EPA', 'DEFRA'],
        calculationApproach: 'Activity-based',
      },
      disclaimer: 'This report is generated based on the data provided and should be reviewed for accuracy before submission to regulatory authorities.',
    };

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.REPORT_GENERATED,
      'report',
      undefined,
      { reportType: 'compliance', year },
      req
    );

    sendSuccess(res, report);
  } catch (error) {
    logger.error('Get compliance report error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to generate compliance report', 500);
    }
  }
}

/**
 * Get report calculations (client config + emissions → insights for frontend Reports)
 * GET /api/reports/insights
 */
export async function getReportInsights(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const userId = req.user.userId;

    const [clientConfig, totalEmissions, byScope, byCategory, trend] = await Promise.all([
      getLatestClientConfigOrNull(userId),
      getTotalEmissions(userId),
      getEmissionsSummaryByScope(userId),
      getEmissionsSummaryByCategory(userId),
      getEmissionsTrend(userId, 12),
    ]);

    const emissionsSummary = {
      totalCo2eTonnes: totalEmissions.totalCo2eTonnes,
      totalCo2eKg: totalEmissions.totalCo2e,
      recordCount: totalEmissions.recordCount,
      byScope: {
        SCOPE_1: byScope.SCOPE_1 ?? { total: 0, totalTonnes: 0, count: 0 },
        SCOPE_2: byScope.SCOPE_2 ?? { total: 0, totalTonnes: 0, count: 0 },
        SCOPE_3: byScope.SCOPE_3 ?? { total: 0, totalTonnes: 0, count: 0 },
      },
      byCategory,
      trend,
    };

    const clientConfigPayload = clientConfig
      ? {
          target_year: clientConfig.targetYear,
          ambition_level: clientConfig.ambitionLevel,
          capex_opex_preference: clientConfig.capexOpexPreference,
          supporting_documents: (clientConfig.supportingDocuments as string[]) || [],
        }
      : {
          target_year: new Date().getFullYear() + 5,
          ambition_level: 'PARTIAL_REDUCTION',
          capex_opex_preference: null,
          supporting_documents: [] as string[],
        };

    const input: ReportCalculationInput = {
      clientConfig: clientConfigPayload,
      emissionsSummary,
    };

    const result = await generateReportCalculations(input);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('Get report insights error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to generate report insights', 500);
    }
  }
}

/**
 * Generate custom report
 * POST /api/reports/custom
 */
export async function generateCustomReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { startDate, endDate, scopes, categories, groupBy } = req.body;

    if (!startDate || !endDate) {
      sendError(res, 'Start date and end date are required', 400);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [byScope, byCategory, trend] = await Promise.all([
      getEmissionsSummaryByScope(req.user.userId, start, end),
      getEmissionsSummaryByCategory(req.user.userId, start, end),
      getEmissionsTrend(req.user.userId, 12),
    ]);

    // Filter by requested scopes if specified
    let filteredByScope = byScope;
    if (scopes && scopes.length > 0) {
      filteredByScope = Object.fromEntries(
        Object.entries(byScope).filter(([key]) => scopes.includes(key))
      ) as typeof byScope;
    }

    // Filter by requested categories if specified
    let filteredByCategory = byCategory;
    if (categories && categories.length > 0) {
      filteredByCategory = byCategory.filter((cat) => 
        categories.includes(cat.category)
      );
    }

    // Filter trend data by date range
    const filteredTrend = trend.filter((t) => {
      const date = new Date(t.month + '-01');
      return date >= start && date <= end;
    });

    const report = {
      reportType: 'Custom Report',
      period: {
        start: startDate,
        end: endDate,
      },
      generatedAt: new Date().toISOString(),
      filters: {
        scopes: scopes || 'All',
        categories: categories || 'All',
        groupBy: groupBy || 'month',
      },
      summary: {
        totalCo2eKg: Object.values(filteredByScope).reduce((sum, s) => sum + s.total, 0),
        totalCo2eTonnes: Object.values(filteredByScope).reduce((sum, s) => sum + s.totalTonnes, 0),
      },
      byScope: filteredByScope,
      byCategory: filteredByCategory,
      trend: filteredTrend,
    };

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.REPORT_GENERATED,
      'report',
      undefined,
      { reportType: 'custom', startDate, endDate },
      req
    );

    sendSuccess(res, report);
  } catch (error) {
    logger.error('Generate custom report error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to generate custom report', 500);
    }
  }
}

// Helper functions
function getCurrentReportingPeriod(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

function calculateDataCompleteness(documentStats: Record<string, number>): number {
  const completed = documentStats.COMPLETED || 0;
  const total = Object.values(documentStats).reduce((sum, count) => sum + count, 0);
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function calculatePercentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100 * 10) / 10 : 0;
}

/**
 * Generate per-section AI narratives for the V2 report.
 * POST /api/reports/narrative
 * Body: { sections: Array<{ section_id, slot_id, bindings }> }
 */
export async function generateReportNarratives(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { sections } = req.body as { sections: SectionNarrativeInput[] };

    if (!Array.isArray(sections) || sections.length === 0) {
      sendError(res, 'sections array is required', 400);
      return;
    }

    const narratives = await generateSectionNarratives(sections);

    await logUserAction(
      req.user.userId,
      AuditActions.REPORT_GENERATED,
      'report',
      undefined,
      { reportType: 'v2_narrative', sectionCount: sections.length },
      req
    );

    sendSuccess(res, { narratives });
  } catch (error) {
    logger.error('Generate report narratives error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to generate report narratives', 500);
    }
  }
}
