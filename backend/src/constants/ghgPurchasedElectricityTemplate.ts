import path from 'path';

/** Sheet tab name in the workbook. */
export const PURCHASED_ELECTRICITY_SHEET_NAME = 'Purchased Electricity';

export const PURCHASED_ELECTRICITY_TEMPLATE_VERSION = '1-workbook';

/**
 * Expected calculation columns (row under "Fields Required for Calculation").
 * Headers are matched case-insensitively and extra spaces trimmed.
 */
export const PURCHASED_ELECTRICITY_EXCEL_HEADERS = [
  'Activity Type',
  'Source Type',
  'Consumption',
  'Consumption Unit',
  'Site ID',
  'Start Date',
  'End Date',
] as const;

/** Canonical JSON / API field names. */
export const PURCHASED_ELECTRICITY_FORM_FIELDS = [
  'activityType',
  'sourceType',
  'consumption',
  'consumptionUnit',
  'siteId',
  'startDate',
  'endDate',
] as const;

/** For UI / docs — same order as the Excel header row. */
export const PURCHASED_ELECTRICITY_COLUMN_LABELS = [...PURCHASED_ELECTRICITY_EXCEL_HEADERS];

export function normalizeExcelHeader(cell: string): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Map template unit labels to Climatiq normalised units. */
export function normalizeConsumptionUnit(raw: string): string {
  const u = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
  if (!u) throw new Error('Consumption Unit is required');
  const map: Record<string, string> = {
    kwh: 'kWh',
    mwh: 'MWh',
    gj: 'GJ',
    gigajoule: 'GJ',
    gigajoules: 'GJ',
    wh: 'Wh',
  };
  const out = map[u];
  if (!out) {
    throw new Error(
      `Unsupported unit "${raw}". Use kWh, MWh, or GJ as in the template.`
    );
  }
  return out;
}

/**
 * Map "Activity Type" field to the Climatiq activity key.
 * For purchased electricity, activity type is always "electricity" — the field
 * exists for extensibility and categorization (e.g. "Activity based").
 */
export function mapActivityTypeToClimatiqKey(_raw: string): string {
  return 'electricity';
}

/** Parse dates in dd/mm/yy or dd/mm/yyyy or Excel serial format. */
export function parseDateField(value: unknown, fieldName: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + value * 86400000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid Excel date for ${fieldName}`);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }
  const s = String(value ?? '').trim();
  if (!s) throw new Error(`${fieldName} is required`);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  throw new Error(`Unrecognised date for ${fieldName}: ${s}`);
}

export type PurchasedElectricityTemplateFormInput = {
  activityType: string;
  sourceType: string;
  consumption: number;
  consumptionUnit: string;
  siteId: string;
  startDate: string | number;
  endDate: string | number;
  notes?: string;
  dataEntryChannel?: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT';
};

export function mapPurchasedElectricityToGhgBody(
  input: PurchasedElectricityTemplateFormInput,
  channel: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT'
) {
  const siteId = String(input.siteId ?? '').trim();
  const sourceType = String(input.sourceType ?? '').trim();
  const siteName = siteId || 'Not specified';
  const activityType = mapActivityTypeToClimatiqKey(input.activityType);
  const activityUnit = normalizeConsumptionUnit(input.consumptionUnit);
  const billingPeriodStart = parseDateField(input.startDate, 'Start Date');
  const billingPeriodEnd = parseDateField(input.endDate, 'End Date');
  const parts: string[] = [];
  if (siteId) parts.push(`Site: ${siteId}`);
  if (sourceType) parts.push(`Source: ${sourceType}`);
  if (input.notes?.trim()) parts.push(input.notes.trim());
  const notes = parts.length ? parts.join(' | ') : undefined;
  return {
    siteName,
    activityType,
    activityAmount: input.consumption,
    activityUnit,
    region: 'AE',
    billingPeriodStart,
    billingPeriodEnd,
    notes,
    dataEntryChannel: channel,
  };
}
