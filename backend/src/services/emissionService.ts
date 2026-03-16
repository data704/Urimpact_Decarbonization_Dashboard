import prisma from '../config/database.js';
import { EmissionScope, EmissionCategory } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { EmissionFilters, EmissionCalculationResult } from '../types/index.js';
import { parsePagination, kgToTonnes } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { calculateEmissions } from './climatiqService.js';

/** Activity date = receipt/entry date (billingPeriodStart) or fallback to calculatedAt for older data */
function getActivityDate(emission: { billingPeriodStart: Date | null; calculatedAt: Date }): Date {
  return emission.billingPeriodStart ?? emission.calculatedAt;
}

/** Prisma where clause: emissions whose activity date (billingPeriodStart ?? calculatedAt) is in [start, end] */
function activityDateInRangeWhere(
  userId: string,
  startDate: Date,
  endDate: Date
): { userId: string; OR: unknown[] } {
  return {
    userId,
    OR: [
      { billingPeriodStart: { gte: startDate, lte: endDate } },
      { AND: [{ billingPeriodStart: null }, { calculatedAt: { gte: startDate, lte: endDate } }] },
    ],
  };
}

/** Same as activityDateInRangeWhere but scoped by organization (shared company dashboard) */
function activityDateInRangeWhereOrg(
  organizationId: string,
  startDate: Date,
  endDate: Date
): { organizationId: string; OR: unknown[] } {
  return {
    organizationId,
    OR: [
      { billingPeriodStart: { gte: startDate, lte: endDate } },
      { AND: [{ billingPeriodStart: null }, { calculatedAt: { gte: startDate, lte: endDate } }] },
    ],
  };
}

interface CreateEmissionInput {
  userId: string;
  organizationId?: string | null;
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
      organizationId: input.organizationId ?? undefined,
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
 * When startDate/endDate are provided, filters and orders by activity date (billingPeriodStart ?? calculatedAt).
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
    OR?: unknown[];
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

  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    Object.assign(where, activityDateInRangeWhere(userId, start, end));
  } else if (filters.startDate || filters.endDate) {
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
      orderBy: [{ billingPeriodStart: 'desc' }, { calculatedAt: 'desc' }],
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

  // When filtering by activity date, sort by activity date desc (billingPeriodStart nulls are already last)
  const sorted = filters.startDate && filters.endDate
    ? [...emissions].sort((a, b) => {
        const da = getActivityDate(a).getTime();
        const db = getActivityDate(b).getTime();
        return db - da;
      })
    : emissions;

  return {
    emissions: sorted,
    pagination: { page, limit, total },
  };
}

/**
 * Get emissions summary by scope
 * When startDate/endDate are provided, filters by activity date (billingPeriodStart ?? calculatedAt).
 */
export async function getEmissionsSummaryByScope(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  organizationId?: string | null
) {
  const where: {
    userId?: string;
    organizationId?: string;
    calculatedAt?: { gte?: Date; lte?: Date };
    OR?: unknown[];
  } = organizationId ? { organizationId } : { userId };

  if (startDate && endDate) {
    Object.assign(
      where,
      organizationId
        ? activityDateInRangeWhereOrg(organizationId, startDate, endDate)
        : activityDateInRangeWhere(userId, startDate, endDate)
    );
  } else if (startDate || endDate) {
    where.calculatedAt = {};
    if (startDate) where.calculatedAt.gte = startDate;
    if (endDate) where.calculatedAt.lte = endDate;
  }

  const emissions = await prisma.emission.findMany({
    where,
    select: { scope: true, co2e: true },
  });

  const result: Record<string, { total: number; count: number; totalTonnes: number }> = {
    SCOPE_1: { total: 0, count: 0, totalTonnes: 0 },
    SCOPE_2: { total: 0, count: 0, totalTonnes: 0 },
    SCOPE_3: { total: 0, count: 0, totalTonnes: 0 },
  };

  emissions.forEach((e) => {
    result[e.scope].total += e.co2e;
    result[e.scope].count += 1;
  });
  Object.keys(result).forEach((scope) => {
    result[scope].totalTonnes = kgToTonnes(result[scope].total);
  });

  return result;
}

/**
 * Get emissions summary by category
 * When startDate/endDate are provided, filters by activity date (billingPeriodStart ?? calculatedAt).
 */
export async function getEmissionsSummaryByCategory(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  organizationId?: string | null
) {
  const where: {
    userId?: string;
    organizationId?: string;
    calculatedAt?: { gte?: Date; lte?: Date };
    OR?: unknown[];
  } = organizationId ? { organizationId } : { userId };

  if (startDate && endDate) {
    Object.assign(
      where,
      organizationId
        ? activityDateInRangeWhereOrg(organizationId, startDate, endDate)
        : activityDateInRangeWhere(userId, startDate, endDate)
    );
  } else if (startDate || endDate) {
    where.calculatedAt = {};
    if (startDate) where.calculatedAt.gte = startDate;
    if (endDate) where.calculatedAt.lte = endDate;
  }

  const emissions = await prisma.emission.findMany({
    where,
    select: { category: true, co2e: true },
  });

  const grouped = new Map<string, { total: number; count: number }>();
  emissions.forEach((e) => {
    const cur = grouped.get(e.category) ?? { total: 0, count: 0 };
    cur.total += e.co2e;
    cur.count += 1;
    grouped.set(e.category, cur);
  });

  return Array.from(grouped.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    totalTonnes: kgToTonnes(data.total),
    count: data.count,
  }));
}

/**
 * Get monthly emissions trend
 * Groups by activity date (billingPeriodStart ?? calculatedAt) month, not upload/calculation date.
 */
export async function getEmissionsTrend(
  userId: string,
  months = 12,
  organizationId?: string | null
) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const emissions = await prisma.emission.findMany({
    where: organizationId
      ? activityDateInRangeWhereOrg(organizationId, startDate, endDate)
      : activityDateInRangeWhere(userId, startDate, endDate),
    select: {
      co2e: true,
      billingPeriodStart: true,
      calculatedAt: true,
      scope: true,
    },
    orderBy: { calculatedAt: 'asc' },
  });

  const monthlyData: Record<string, { total: number; scope1: number; scope2: number; scope3: number }> = {};

  emissions.forEach((emission) => {
    const activityDate = getActivityDate(emission);
    const monthKey = activityDate.toISOString().slice(0, 7); // YYYY-MM

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
 * Groups by activity date (billingPeriodStart ?? calculatedAt) month.
 */
export async function getEmissionsTrendForRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  organizationId?: string | null
) {
  const emissions = await prisma.emission.findMany({
    where: organizationId
      ? activityDateInRangeWhereOrg(organizationId, startDate, endDate)
      : activityDateInRangeWhere(userId, startDate, endDate),
    select: {
      co2e: true,
      billingPeriodStart: true,
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
    const activityDate = getActivityDate(emission);
    const monthKey = activityDate.toISOString().slice(0, 7);
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
 * When startDate/endDate are provided, filters by activity date (billingPeriodStart ?? calculatedAt).
 */
export async function getTotalEmissions(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  organizationId?: string | null
) {
  if (startDate && endDate) {
    const withBillingWhere = organizationId
      ? { organizationId, billingPeriodStart: { gte: startDate, lte: endDate } }
      : { userId, billingPeriodStart: { gte: startDate, lte: endDate } };
    const withoutBillingWhere = organizationId
      ? {
          organizationId,
          billingPeriodStart: null,
          calculatedAt: { gte: startDate, lte: endDate },
        }
      : {
          userId,
          billingPeriodStart: null,
          calculatedAt: { gte: startDate, lte: endDate },
        };

    const [withBilling, withoutBilling] = await Promise.all([
      prisma.emission.aggregate({
        where: withBillingWhere,
        _sum: { co2e: true, co2: true, ch4: true, n2o: true },
        _count: true,
      }),
      prisma.emission.aggregate({
        where: withoutBillingWhere,
        _sum: { co2e: true, co2: true, ch4: true, n2o: true },
        _count: true,
      }),
    ]);
    const totalCo2e = (withBilling._sum.co2e ?? 0) + (withoutBilling._sum.co2e ?? 0);
    const totalCo2 = (withBilling._sum.co2 ?? 0) + (withoutBilling._sum.co2 ?? 0);
    const totalCh4 = (withBilling._sum.ch4 ?? 0) + (withoutBilling._sum.ch4 ?? 0);
    const totalN2o = (withBilling._sum.n2o ?? 0) + (withoutBilling._sum.n2o ?? 0);
    const recordCount = withBilling._count + withoutBilling._count;
    return {
      totalCo2e,
      totalCo2eTonnes: kgToTonnes(totalCo2e),
      totalCo2,
      totalCh4,
      totalN2o,
      recordCount,
    };
  }

  const where: {
    userId?: string;
    organizationId?: string;
    calculatedAt?: { gte?: Date; lte?: Date };
  } = organizationId ? { organizationId } : { userId };
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
 * Bulk delete emission records.
 * For each ID, enforces the same ownership / org-admin checks as deleteEmission.
 */
export async function deleteEmissionsBulk(
  emissionIds: string[],
  userId: string,
  isAdmin = false
): Promise<{ deletedCount: number }> {
  let deletedCount = 0;

  for (const id of emissionIds) {
    try {
      await deleteEmission(id, userId, isAdmin);
      deletedCount += 1;
    } catch (error) {
      logger.warn(`Skipping emission ${id} during bulk delete: ${(error as Error)?.message ?? String(error)}`);
      continue;
    }
  }

  logger.info(`Bulk delete completed by user ${userId}. Deleted ${deletedCount} emissions out of ${emissionIds.length}.`);
  return { deletedCount };
}

/**
 * Get emissions for export
 * When startDate/endDate are provided, filters and orders by activity date (billingPeriodStart ?? calculatedAt).
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
    OR?: unknown[];
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

  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    Object.assign(where, activityDateInRangeWhere(userId, start, end));
  } else if (filters.startDate || filters.endDate) {
    where.calculatedAt = {};
    if (filters.startDate) {
      where.calculatedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.calculatedAt.lte = new Date(filters.endDate);
    }
  }

  const emissions = await prisma.emission.findMany({
    where,
    orderBy: [{ billingPeriodStart: 'desc' }, { calculatedAt: 'desc' }],
    include: {
      document: {
        select: {
          fileName: true,
          documentType: true,
        },
      },
    },
  });

  const byActivityDate = filters.startDate && filters.endDate
    ? [...emissions].sort((a, b) => getActivityDate(b).getTime() - getActivityDate(a).getTime())
    : emissions;

  return byActivityDate;
}
