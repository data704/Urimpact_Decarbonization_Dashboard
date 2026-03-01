import prisma from '../config/database.js';
import { EmissionScope, EmissionCategory } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { EmissionFilters, EmissionCalculationResult } from '../types/index.js';
import { parsePagination, kgToTonnes } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { calculateEmissions } from './climatiqService.js';

interface CreateEmissionInput {
  userId: string;
  documentId?: string;
  scope: EmissionScope;
  category: EmissionCategory;
  activityType: string;
  activityAmount: number;
  activityUnit: string;
  region?: string;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  notes?: string;
}

/**
 * Create emission record from calculation result
 */
export async function createEmission(
  input: CreateEmissionInput,
  calculationResult: EmissionCalculationResult
) {
  const emission = await prisma.emission.create({
    data: {
      userId: input.userId,
      documentId: input.documentId,
      scope: input.scope,
      category: input.category,
      activityType: input.activityType,
      activityAmount: input.activityAmount,
      activityUnit: input.activityUnit,
      region: input.region || 'AE',
      co2e: calculationResult.co2e,
      co2: calculationResult.co2,
      ch4: calculationResult.ch4,
      n2o: calculationResult.n2o,
      emissionFactor: calculationResult.emissionFactor,
      emissionFactorUnit: calculationResult.emissionFactorUnit,
      dataSource: calculationResult.dataSource,
      dataYear: calculationResult.dataYear,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      notes: input.notes,
    },
  });

  logger.info(`Emission record created: ${emission.id} for user ${input.userId}`);
  return emission;
}

/**
 * Calculate and create emission from activity data
 */
export async function calculateAndCreateEmission(input: CreateEmissionInput) {
  // Calculate emissions using Climatiq
  const calculationResult = await calculateEmissions({
    activityType: input.activityType,
    activityAmount: input.activityAmount,
    activityUnit: input.activityUnit,
    region: input.region,
  });

  // Create emission record
  return createEmission(input, calculationResult);
}

/**
 * Get emission by ID with ownership check
 */
export async function getEmissionById(emissionId: string, userId: string, isAdmin = false) {
  const emission = await prisma.emission.findUnique({
    where: { id: emissionId },
    include: {
      document: {
        select: {
          id: true,
          fileName: true,
          documentType: true,
        },
      },
    },
  });

  if (!emission) {
    throw new NotFoundError('Emission record');
  }

  if (!isAdmin && emission.userId !== userId) {
    throw new ForbiddenError('You do not have access to this record');
  }

  return emission;
}

/**
 * Get user's emissions with pagination and filters
 */
export async function getUserEmissions(
  userId: string,
  filters: EmissionFilters,
  query: { page?: string; limit?: string }
) {
  const { page, limit, skip } = parsePagination(query);

  const where: {
    userId: string;
    scope?: EmissionScope;
    category?: EmissionCategory;
    region?: string;
    calculatedAt?: { gte?: Date; lte?: Date };
  } = { userId };

  // Apply filters
  if (filters.scope) {
    where.scope = filters.scope as EmissionScope;
  }

  if (filters.category) {
    where.category = filters.category as EmissionCategory;
  }

  if (filters.region) {
    where.region = filters.region;
  }

  if (filters.startDate || filters.endDate) {
    where.calculatedAt = {};
    if (filters.startDate) {
      where.calculatedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.calculatedAt.lte = new Date(filters.endDate);
    }
  }

  const [emissions, total] = await Promise.all([
    prisma.emission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { calculatedAt: 'desc' },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
          },
        },
      },
    }),
    prisma.emission.count({ where }),
  ]);

  return {
    emissions,
    pagination: { page, limit, total },
  };
}

/**
 * Get emissions summary by scope
 */
export async function getEmissionsSummaryByScope(
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: {
    userId: string;
    calculatedAt?: { gte?: Date; lte?: Date };
  } = { userId };

  if (startDate || endDate) {
    where.calculatedAt = {};
    if (startDate) where.calculatedAt.gte = startDate;
    if (endDate) where.calculatedAt.lte = endDate;
  }

  const summary = await prisma.emission.groupBy({
    by: ['scope'],
    where,
    _sum: {
      co2e: true,
    },
    _count: true,
  });

  const result: Record<string, { total: number; count: number; totalTonnes: number }> = {
    SCOPE_1: { total: 0, count: 0, totalTonnes: 0 },
    SCOPE_2: { total: 0, count: 0, totalTonnes: 0 },
    SCOPE_3: { total: 0, count: 0, totalTonnes: 0 },
  };

  summary.forEach((item) => {
    result[item.scope] = {
      total: item._sum.co2e || 0,
      count: item._count,
      totalTonnes: kgToTonnes(item._sum.co2e || 0),
    };
  });

  return result;
}

/**
 * Get emissions summary by category
 */
export async function getEmissionsSummaryByCategory(
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: {
    userId: string;
    calculatedAt?: { gte?: Date; lte?: Date };
  } = { userId };

  if (startDate || endDate) {
    where.calculatedAt = {};
    if (startDate) where.calculatedAt.gte = startDate;
    if (endDate) where.calculatedAt.lte = endDate;
  }

  const summary = await prisma.emission.groupBy({
    by: ['category'],
    where,
    _sum: {
      co2e: true,
    },
    _count: true,
  });

  return summary.map((item) => ({
    category: item.category,
    total: item._sum.co2e || 0,
    totalTonnes: kgToTonnes(item._sum.co2e || 0),
    count: item._count,
  }));
}

/**
 * Get monthly emissions trend
 */
export async function getEmissionsTrend(
  userId: string,
  months = 12
) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const emissions = await prisma.emission.findMany({
    where: {
      userId,
      calculatedAt: { gte: startDate },
    },
    select: {
      co2e: true,
      calculatedAt: true,
      scope: true,
    },
    orderBy: { calculatedAt: 'asc' },
  });

  // Group by month
  const monthlyData: Record<string, { total: number; scope1: number; scope2: number; scope3: number }> = {};

  emissions.forEach((emission) => {
    const monthKey = emission.calculatedAt.toISOString().slice(0, 7); // YYYY-MM
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { total: 0, scope1: 0, scope2: 0, scope3: 0 };
    }

    monthlyData[monthKey].total += emission.co2e;
    
    if (emission.scope === 'SCOPE_1') monthlyData[monthKey].scope1 += emission.co2e;
    else if (emission.scope === 'SCOPE_2') monthlyData[monthKey].scope2 += emission.co2e;
    else if (emission.scope === 'SCOPE_3') monthlyData[monthKey].scope3 += emission.co2e;
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data,
    totalTonnes: kgToTonnes(data.total),
  }));
}

/**
 * Get monthly emissions trend for a date range (e.g. a specific year)
 */
export async function getEmissionsTrendForRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const emissions = await prisma.emission.findMany({
    where: {
      userId,
      calculatedAt: { gte: startDate, lte: endDate },
    },
    select: {
      co2e: true,
      calculatedAt: true,
      scope: true,
    },
    orderBy: { calculatedAt: 'asc' },
  });

  const monthlyData: Record<string, { total: number; scope1: number; scope2: number; scope3: number }> = {};
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = { total: 0, scope1: 0, scope2: 0, scope3: 0 };
  }

  emissions.forEach((emission) => {
    const monthKey = emission.calculatedAt.toISOString().slice(0, 7);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { total: 0, scope1: 0, scope2: 0, scope3: 0 };
    }
    monthlyData[monthKey].total += emission.co2e;
    if (emission.scope === 'SCOPE_1') monthlyData[monthKey].scope1 += emission.co2e;
    else if (emission.scope === 'SCOPE_2') monthlyData[monthKey].scope2 += emission.co2e;
    else if (emission.scope === 'SCOPE_3') monthlyData[monthKey].scope3 += emission.co2e;
  });

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      ...data,
      totalTonnes: kgToTonnes(data.total),
    }));
}

/**
 * Get total emissions for user, optionally filtered by date range
 */
export async function getTotalEmissions(
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: { userId: string; calculatedAt?: { gte?: Date; lte?: Date } } = { userId };
  if (startDate || endDate) {
    where.calculatedAt = {};
    if (startDate) where.calculatedAt.gte = startDate;
    if (endDate) where.calculatedAt.lte = endDate;
  }
  const result = await prisma.emission.aggregate({
    where,
    _sum: {
      co2e: true,
      co2: true,
      ch4: true,
      n2o: true,
    },
    _count: true,
  });

  return {
    totalCo2e: result._sum.co2e || 0,
    totalCo2eTonnes: kgToTonnes(result._sum.co2e || 0),
    totalCo2: result._sum.co2 || 0,
    totalCh4: result._sum.ch4 || 0,
    totalN2o: result._sum.n2o || 0,
    recordCount: result._count,
  };
}

/**
 * Delete emission record
 */
export async function deleteEmission(emissionId: string, userId: string, isAdmin = false) {
  // Get emission first
  await getEmissionById(emissionId, userId, isAdmin);

  await prisma.emission.delete({
    where: { id: emissionId },
  });

  logger.info(`Emission ${emissionId} deleted by user ${userId}`);
  return { success: true };
}

/**
 * Get emissions for export
 */
export async function getEmissionsForExport(
  userId: string,
  filters: EmissionFilters
) {
  const where: {
    userId: string;
    scope?: EmissionScope;
    category?: EmissionCategory;
    region?: string;
    calculatedAt?: { gte?: Date; lte?: Date };
  } = { userId };

  if (filters.scope) {
    where.scope = filters.scope as EmissionScope;
  }

  if (filters.category) {
    where.category = filters.category as EmissionCategory;
  }

  if (filters.region) {
    where.region = filters.region;
  }

  if (filters.startDate || filters.endDate) {
    where.calculatedAt = {};
    if (filters.startDate) {
      where.calculatedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.calculatedAt.lte = new Date(filters.endDate);
    }
  }

  return prisma.emission.findMany({
    where,
    orderBy: { calculatedAt: 'desc' },
    include: {
      document: {
        select: {
          fileName: true,
          documentType: true,
        },
      },
    },
  });
}
