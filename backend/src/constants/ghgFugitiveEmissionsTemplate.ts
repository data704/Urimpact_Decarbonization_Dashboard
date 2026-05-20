/**
 * Fugitive Emissions — Scope 1 form mapping & helpers.
 * Fields: Equipment Type, Refrigerant Used, Fire Suppressant Used, Net Inventory (kg), Facility, Date of Transaction
 */

import { parseDateOfTransaction } from './ghgStationaryCombustionTemplate.js';

/** Map refrigerant / suppressant to Climatiq-compatible activity type key. */
const REFRIGERANT_ACTIVITY_MAP: Record<string, string> = {
  'hfc-134a': 'refrigerant-r134a',
  'r-134a': 'refrigerant-r134a',
  'hfc-32': 'refrigerant-r32',
  'r-32': 'refrigerant-r32',
  'r-32a': 'refrigerant-r32',
  'hfc-125': 'refrigerant-r125',
  'r-125': 'refrigerant-r125',
  'r-410a': 'refrigerant-r410a',
  'hfc-410a': 'refrigerant-r410a',
  'r-404a': 'refrigerant-r404a',
  'hfc-404a': 'refrigerant-r404a',
  'r-407c': 'refrigerant-r407c',
  'hfc-407c': 'refrigerant-r407c',
  'r-507a': 'refrigerant-r507a',
  'r-22': 'refrigerant-r22',
  'hcfc-22': 'refrigerant-r22',
  'sf6': 'suppressant-sf6',
  'co2': 'suppressant-co2',
  'hfc-227ea': 'suppressant-hfc227ea',
  'fm-200': 'suppressant-hfc227ea',
  'novec-1230': 'suppressant-novec1230',
};

export function mapFugitiveSubstanceToActivityType(
  refrigerant: string,
  fireSuppressant: string
): string {
  const substance = (refrigerant || fireSuppressant || '').trim();
  const key = substance.toLowerCase().replace(/\s+/g, '-');
  return REFRIGERANT_ACTIVITY_MAP[key] ?? key;
}

export type FugitiveEmissionsFormInput = {
  equipmentType: string;
  refrigerantUsed: string;
  fireSuppressantUsed: string;
  netInventoryKg: number;
  facility: string;
  dateOfTransaction: string | number;
  notes?: string;
  dataEntryChannel?: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT';
};

export function mapFugitiveEmissionsToGhgBody(
  input: FugitiveEmissionsFormInput,
  channel: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT'
) {
  const equipment = String(input.equipmentType ?? '').trim();
  const refrigerant = String(input.refrigerantUsed ?? '').trim();
  const suppressant = String(input.fireSuppressantUsed ?? '').trim();
  const facility = String(input.facility ?? '').trim();
  const activityType = mapFugitiveSubstanceToActivityType(refrigerant, suppressant);
  const billingPeriodStart = parseDateOfTransaction(input.dateOfTransaction as unknown);

  const parts: string[] = [];
  if (equipment) parts.push(`Equipment: ${equipment}`);
  if (facility) parts.push(`Facility: ${facility}`);
  if (refrigerant) parts.push(`Refrigerant: ${refrigerant}`);
  if (suppressant) parts.push(`Suppressant: ${suppressant}`);
  if (input.notes?.trim()) parts.push(input.notes.trim());
  const notes = parts.length ? parts.join(' | ') : undefined;

  return {
    siteName: facility || equipment || 'Not specified',
    activityType,
    activityAmount: input.netInventoryKg,
    activityUnit: 'kg',
    region: 'SA',
    billingPeriodStart,
    billingPeriodEnd: undefined,
    notes,
    dataEntryChannel: channel,
  };
}
