import {
  mapFuelUsedToActivityType,
  normalizeTemplateFuelUnit,
  parseDateOfTransaction,
} from './ghgStationaryCombustionTemplate.js';

/** Sheet tab name in the workbook (matches official template). */
export const MOBILE_COMBUSTION_SHEET_NAME = 'Mobile Combustion';

export const MOBILE_COMBUSTION_TEMPLATE_VERSION = '1-workbook';

/** Headers under "Fields Required for Calculation" (case-insensitive match in bulk parser). */
export const MOBILE_COMBUSTION_EXCEL_HEADERS = [
  'Vehicle Type',
  'Fuel Used',
  'Fuel Used Quantity',
  'Fuel Used Unit',
  'Facility',
  'Date of transaction',
] as const;

export type MobileCombustionExcelHeader = (typeof MOBILE_COMBUSTION_EXCEL_HEADERS)[number];

export type MobileTemplateFormInput = {
  vehicleType: string;
  fuelUsed: string;
  fuelUsedQuantity: number;
  fuelUsedUnit: string;
  facility: string;
  dateOfTransaction: string | number;
  notes?: string;
  dataEntryChannel?: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT';
};

/**
 * Map mobile-combustion workbook row → generic GHG body for Climatiq + persistence.
 * Fuel quantity uses the same unit normalisation as stationary; activity type is fuel-based
 * (vehicle type is stored in notes for traceability).
 */
export function mapMobileTemplateToGhgBody(
  input: MobileTemplateFormInput,
  channel: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT'
) {
  const vehicleType = String(input.vehicleType ?? '').trim();
  const facility = String(input.facility ?? '').trim();
  const siteName = facility || vehicleType || 'Not specified';
  const activityType = mapFuelUsedToActivityType(input.fuelUsed);
  const activityUnit = normalizeTemplateFuelUnit(input.fuelUsedUnit);
  const billingPeriodStart = parseDateOfTransaction(input.dateOfTransaction as unknown);
  const parts: string[] = [];
  if (vehicleType) parts.push(`Vehicle: ${vehicleType}`);
  if (facility) parts.push(`Facility: ${facility}`);
  if (input.notes?.trim()) parts.push(input.notes.trim());
  const notes = parts.length ? parts.join(' | ') : undefined;
  return {
    siteName,
    activityType,
    activityAmount: input.fuelUsedQuantity,
    activityUnit,
    region: 'AE',
    billingPeriodStart,
    billingPeriodEnd: undefined,
    notes,
    dataEntryChannel: channel,
  };
}
