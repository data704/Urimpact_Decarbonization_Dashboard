import { EmissionCategory, EmissionScope } from '@prisma/client';

/** Scope 1 — GHG landing card slugs (aligned with frontend `ghgCategories.js`) */
export const GHG_SCOPE1_CATEGORY_SLUGS = [
  'stationary-combustion',
  'mobile-combustion',
  'process-emissions',
  'fugitive-emissions',
  'industrial-processes',
  'agriculture',
  'land-use-change',
  'waste-on-site',
] as const;

/** Scope 2 — purchased energy categories */
export const GHG_SCOPE2_CATEGORY_SLUGS = [
  'purchased-electricity',
  'purchased-steam',
  'purchased-heating',
  'purchased-cooling',
] as const;

export type GhgScope1CategorySlug = (typeof GHG_SCOPE1_CATEGORY_SLUGS)[number];
export type GhgScope2CategorySlug = (typeof GHG_SCOPE2_CATEGORY_SLUGS)[number];

const SCOPE1_DEFAULT_CATEGORY: Record<string, EmissionCategory> = {
  'stationary-combustion': 'FUEL_COMBUSTION',
  'mobile-combustion': 'TRANSPORTATION',
  'process-emissions': 'OTHER',
  'fugitive-emissions': 'REFRIGERANTS',
  'industrial-processes': 'OTHER',
  agriculture: 'OTHER',
  'land-use-change': 'OTHER',
  'waste-on-site': 'WASTE',
};

const SCOPE2_DEFAULT_CATEGORY: Record<string, EmissionCategory> = {
  'purchased-electricity': 'ELECTRICITY',
  'purchased-steam': 'ELECTRICITY',
  'purchased-heating': 'NATURAL_GAS',
  'purchased-cooling': 'ELECTRICITY',
};

export function isScope1CategorySlug(slug: string): slug is GhgScope1CategorySlug {
  return (GHG_SCOPE1_CATEGORY_SLUGS as readonly string[]).includes(slug);
}

export function isScope2CategorySlug(slug: string): slug is GhgScope2CategorySlug {
  return (GHG_SCOPE2_CATEGORY_SLUGS as readonly string[]).includes(slug);
}

export function defaultEmissionCategoryForGhgSlug(
  scope: EmissionScope,
  slug: string
): EmissionCategory | null {
  if (scope === 'SCOPE_1') return SCOPE1_DEFAULT_CATEGORY[slug] ?? null;
  if (scope === 'SCOPE_2') return SCOPE2_DEFAULT_CATEGORY[slug] ?? null;
  return null;
}
