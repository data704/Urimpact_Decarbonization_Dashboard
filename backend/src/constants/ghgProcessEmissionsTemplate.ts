/**
 * Process-Based Emissions — Scope 1 form mapping & helpers.
 * Fields: Facility, Process Sector, Process Type, Material/Product, Activity Data, Unit, Date of Transaction
 */

import { parseDateOfTransaction, normalizeTemplateFuelUnit } from './ghgStationaryCombustionTemplate.js';

/** Map process type value to Climatiq-compatible activity type key. */
const PROCESS_TYPE_ACTIVITY_MAP: Record<string, string> = {
  clinker_production: 'cement-clinker',
  cement_other: 'cement-other',
  steel_bf_bof: 'steel-bf-bof',
  steel_eaf: 'steel-eaf',
  metals_other: 'metals-other',
  ammonia: 'ammonia-production',
  nitric_acid: 'nitric-acid-production',
  chemicals_other: 'chemicals-other',
  refining: 'oil-gas-refining',
  flaring: 'oil-gas-flaring',
  venting: 'oil-gas-venting',
  oil_gas_other: 'oil-gas-other',
  glass_melting: 'glass-melting',
  glass_other: 'glass-other',
  other_specify: 'process-other',
};

export function mapProcessTypeToActivityType(processType: string): string {
  const key = processType.toLowerCase().replace(/\s+/g, '_');
  return PROCESS_TYPE_ACTIVITY_MAP[key] ?? key;
}

export type ProcessEmissionsFormInput = {
  facility: string;
  processSector: string;
  processType: string;
  materialProduct: string;
  activityValue: number;
  unit: string;
  dateOfTransaction: string | number;
  notes?: string;
  dataEntryChannel?: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT';
};

export function mapProcessEmissionsToGhgBody(
  input: ProcessEmissionsFormInput,
  channel: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT'
) {
  const facility = String(input.facility ?? '').trim();
  const sector = String(input.processSector ?? '').trim();
  const processType = String(input.processType ?? '').trim();
  const material = String(input.materialProduct ?? '').trim();
  const activityType = mapProcessTypeToActivityType(processType);
  const activityUnit = normalizeTemplateFuelUnit(input.unit);
  const billingPeriodStart = parseDateOfTransaction(input.dateOfTransaction as unknown);

  const parts: string[] = [];
  if (facility) parts.push(`Facility: ${facility}`);
  if (sector) parts.push(`Sector: ${sector}`);
  if (material) parts.push(`Material: ${material}`);
  if (input.notes?.trim()) parts.push(input.notes.trim());
  const notes = parts.length ? parts.join(' | ') : undefined;

  return {
    siteName: facility || 'Not specified',
    activityType,
    activityAmount: input.activityValue,
    activityUnit,
    region: 'SA',
    billingPeriodStart,
    billingPeriodEnd: undefined,
    notes,
    dataEntryChannel: channel,
  };
}
