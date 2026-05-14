import prisma from '../config/database.js';
import { EmissionScope, EmissionCategory } from '@prisma/client';
import { parsePagination } from '../utils/helpers.js';
import { calculateAndCreateEmission } from './emissionService.js';
import {
  defaultEmissionCategoryForGhgSlug,
  isScope1CategorySlug,
  isScope2CategorySlug,
} from '../constants/ghgRegistry.js';
import type { GhgCategoryFormBody } from '../utils/validators.js';

function assertOrg(organizationId: string | null | undefined): asserts organizationId is string {
  if (!organizationId) {
    throw new Error('Organization is required for GHG activity submissions');
  }
}

export async function submitGhgCategoryFormEntry(params: {
  userId: string;
  organizationId: string | null | undefined;
  scope: EmissionScope;
  categorySlug: string;
  body: GhgCategoryFormBody;
}) {
  const { userId, organizationId, scope, categorySlug, body } = params;
  assertOrg(organizationId);

  if (scope === 'SCOPE_1' && !isScope1CategorySlug(categorySlug)) {
    throw new Error(`Unknown Scope 1 GHG category: ${categorySlug}`);
  }
  if (scope === 'SCOPE_2' && !isScope2CategorySlug(categorySlug)) {
    throw new Error(`Unknown Scope 2 GHG category: ${categorySlug}`);
  }
  if (scope !== 'SCOPE_1' && scope !== 'SCOPE_2') {
    throw new Error('Only Scope 1 and Scope 2 are supported for this endpoint');
  }

  const defaultCat = defaultEmissionCategoryForGhgSlug(scope, categorySlug);
  if (!defaultCat) {
    throw new Error(`No default emission category mapped for ${categorySlug}`);
  }

  const category: EmissionCategory = body.category ?? defaultCat;

  return calculateAndCreateEmission({
    userId,
    organizationId,
    scope,
    category,
    activityType: body.activityType,
    activityAmount: body.activityAmount,
    activityUnit: body.activityUnit,
    region: body.region || 'AE',
    billingPeriodStart: body.billingPeriodStart ? new Date(body.billingPeriodStart) : undefined,
    billingPeriodEnd: body.billingPeriodEnd ? new Date(body.billingPeriodEnd) : undefined,
    notes: body.notes,
    siteId: body.siteId ?? undefined,
    siteName: body.siteName ?? undefined,
    ghgCategorySlug: categorySlug,
    dataEntryChannel: body.dataEntryChannel ?? 'FORM',
  });
}

/**
 * List emissions for one GHG category card, scoped to the organization.
 * Data contributors only see their own rows; dashboard roles see the whole org inventory for that slug.
 */
export async function listGhgCategoryEntries(params: {
  organizationId: string | null | undefined;
  userId: string;
  /** When true, list all org members' rows for this category; when false, only `userId` */
  orgWide: boolean;
  scope: EmissionScope;
  categorySlug: string;
  query: { page?: string; limit?: string; startDate?: string; endDate?: string };
}) {
  const { organizationId, userId, orgWide, scope, categorySlug, query } = params;
  assertOrg(organizationId);

  if (scope === 'SCOPE_1' && !isScope1CategorySlug(categorySlug)) {
    throw new Error(`Unknown Scope 1 GHG category: ${categorySlug}`);
  }
  if (scope === 'SCOPE_2' && !isScope2CategorySlug(categorySlug)) {
    throw new Error(`Unknown Scope 2 GHG category: ${categorySlug}`);
  }

  const { page, limit, skip } = parsePagination(query);

  const where: {
    organizationId: string;
    scope: EmissionScope;
    ghgCategorySlug: string;
    userId?: string;
    OR?: Array<Record<string, unknown>>;
  } = {
    organizationId,
    scope,
    ghgCategorySlug: categorySlug,
  };

  if (!orgWide) {
    where.userId = userId;
  }

  if (query.startDate && query.endDate) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    where.OR = [
      { billingPeriodStart: { gte: start, lte: end } },
      { AND: [{ billingPeriodStart: null }, { calculatedAt: { gte: start, lte: end } }] },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.emission.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ billingPeriodStart: 'desc' }, { calculatedAt: 'desc' }],
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        document: {
          select: { id: true, fileName: true, documentType: true },
        },
      },
    }),
    prisma.emission.count({ where }),
  ]);

  return {
    entries: rows,
    pagination: { page, limit, total },
  };
}

type OnboardingFacilityRow = { name?: string | null };

function parseAssetFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/Asset:\s*([^|]+)/i);
  const s = m?.[1]?.trim();
  return s || null;
}

function parseFacilityFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/Facility:\s*([^|]+)/i);
  const s = m?.[1]?.trim();
  return s || null;
}

/**
 * Suggestions for stationary-combustion manual entry: facilities from onboarding + past rows;
 * assets from "Asset:" segments in stored notes for this category.
 */
export async function getStationaryCombustionLookupOptions(organizationId: string | null | undefined): Promise<{
  facilities: string[];
  assets: string[];
  pastActivityTypes: string[];
}> {
  if (!organizationId) {
    return { facilities: [], assets: [], pastActivityTypes: [] };
  }

  const facilities = new Set<string>();
  const assets = new Set<string>();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { onboardingFacilities: true },
  });

  const rawFacilities = org?.onboardingFacilities;
  if (Array.isArray(rawFacilities)) {
    for (const row of rawFacilities as OnboardingFacilityRow[]) {
      const n = row?.name?.trim();
      if (n) facilities.add(n);
    }
  }

  const [siteGroups, noteRows, activityGroups] = await Promise.all([
    prisma.emission.groupBy({
      by: ['siteName'],
      where: {
        organizationId,
        ghgCategorySlug: 'stationary-combustion',
        siteName: { not: null },
      },
    }),
    prisma.emission.findMany({
      where: {
        organizationId,
        ghgCategorySlug: 'stationary-combustion',
      },
      select: { notes: true },
      take: 800,
      orderBy: { calculatedAt: 'desc' },
    }),
    prisma.emission.groupBy({
      by: ['activityType'],
      where: {
        organizationId,
        ghgCategorySlug: 'stationary-combustion',
      },
    }),
  ]);

  for (const g of siteGroups) {
    const n = g.siteName?.trim();
    if (n) facilities.add(n);
  }

  for (const r of noteRows) {
    const a = parseAssetFromNotes(r.notes);
    if (a) assets.add(a);
    const f = parseFacilityFromNotes(r.notes);
    if (f) facilities.add(f);
  }

  const pastTypes = new Set<string>();
  for (const g of activityGroups) {
    const t = g.activityType?.trim();
    if (t) pastTypes.add(t);
  }

  return {
    facilities: [...facilities].sort((a, b) => a.localeCompare(b)),
    assets: [...assets].sort((a, b) => a.localeCompare(b)),
    pastActivityTypes: [...pastTypes].sort((a, b) => a.localeCompare(b)),
  };
}
