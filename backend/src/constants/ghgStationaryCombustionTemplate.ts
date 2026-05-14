import path from 'path';

/** Resolved from process cwd (run the API from the `backend` folder). */
export const STATIONARY_COMBUSTION_TEMPLATE_XLSX_PATH = path.join(
  process.cwd(),
  'fixtures',
  'stationary-combustion-template.xlsx'
);

/** Sheet tab name in the workbook. */
export const STATIONARY_COMBUSTION_SHEET_NAME = 'Stationary Combustion';

export const STATIONARY_COMBUSTION_TEMPLATE_VERSION = '2-workbook';

/**
 * Expected calculation columns (row under "Fields Required for Calculation").
 * Headers are matched case-insensitively and extra spaces trimmed.
 */
export const STATIONARY_COMBUSTION_EXCEL_HEADERS = [
  'Asset',
  'Fuel Used',
  'Fuel Used Quantity',
  'Fuel Used Unit',
  'Facility',
  'Date of transaction',
] as const;

/** Canonical JSON / API field names (.strict() bodies use only these keys). */
export const STATIONARY_COMBUSTION_FORM_FIELDS = [
  'asset',
  'fuelUsed',
  'fuelUsedQuantity',
  'fuelUsedUnit',
  'facility',
  'dateOfTransaction',
] as const;

/** For UI / docs — same order as the Excel header row. */
export const STATIONARY_COMBUSTION_COLUMN_LABELS = [...STATIONARY_COMBUSTION_EXCEL_HEADERS];

export function normalizeExcelHeader(cell: string): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Map template unit labels from the workbook to Climatiq normalised units. */
export function normalizeTemplateFuelUnit(raw: string): string {
  const u = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
  if (!u) throw new Error('Fuel Used Unit is required');
  const map: Record<string, string> = {
    l: 'l',
    litre: 'l',
    litres: 'l',
    liter: 'l',
    liters: 'l',
    kg: 'kg',
    'metric ton': 't',
    'metric tons': 't',
    metricton: 't',
    tonnes: 't',
    tonne: 't',
    t: 't',
    ton: 't',
    m3: 'm3',
    'cubic meter': 'm3',
    'cubic metre': 'm3',
    kwh: 'kWh',
    mwh: 'MWh',
  };
  const out = map[u];
  if (!out) {
    throw new Error(
      `Unsupported unit "${raw}". Use Litres, kg, Metric ton (or t), m3, kWh, or MWh as in the template.`
    );
  }
  return out;
}

/**
 * Map free-text "Fuel Used" (possibly composite) to a single activity key for Climatiq / fallback.
 * Picks the first fuel segment that matches a known keyword.
 */
export function mapFuelUsedToActivityType(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s || s.toLowerCase() === 'fuel used') throw new Error('Fuel Used is required');

  const parts = s.includes(',') ? s.split(',').map((p) => p.trim()).filter(Boolean) : [s];
  for (const part of parts) {
    const t = part.toLowerCase();
    if (/\b(hsd|diesel)\b/.test(t) || t.includes('high-speed diesel')) return 'diesel';
    if (/\b(cng|png)\b/.test(t) || (t.includes('natural gas') && !t.includes('petrol'))) return 'natural_gas';
    if (/\blpg\b/.test(t)) return 'lpg';
    if (/\bkerosene\b/.test(t)) return 'kerosene';
    if (/\b(petrol|gasoline|motor gasoline)\b/.test(t)) return 'petrol';
    if (/\b(bituminous|sub-bituminous|anthracite|lignite)\b/.test(t) || (t.includes('coal') && !t.includes('natural')))
      return 'coal';
    if (/\b(furnace oil|fuel oil|f\.o\.|ldo)\b/.test(t)) return 'fuel-oil';
    if (/\bbiogas\b/.test(t)) return 'natural_gas';
    if (/\bbiomass\b/.test(t)) return 'biomass';
  }
  const all = s.toLowerCase();
  if (all.includes('diesel')) return 'diesel';
  if (all.includes('natural gas') || all.includes(' cng') || all.startsWith('cng')) return 'natural_gas';
  if (all.includes('lpg')) return 'lpg';
  if (all.includes('kerosene')) return 'kerosene';
  if (all.includes('coal')) return 'coal';
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

/** Excel serial date (days since 1899-12-30) or string dd/mm/yy. */
export function parseDateOfTransaction(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + value * 86400000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid Excel date');
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }
  const s = String(value ?? '').trim();
  if (!s) throw new Error('Date of transaction is required');
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  throw new Error(`Unrecognised date: ${s}`);
}

export type StationaryTemplateFormInput = {
  asset: string;
  fuelUsed: string;
  fuelUsedQuantity: number;
  fuelUsedUnit: string;
  facility: string;
  dateOfTransaction: string | number;
  notes?: string;
  dataEntryChannel?: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT';
};

export function mapStationaryTemplateToGhgBody(
  input: StationaryTemplateFormInput,
  channel: 'FORM' | 'BULK_UPLOAD' | 'AI_EXTRACT'
) {
  const asset = String(input.asset ?? '').trim();
  const facility = String(input.facility ?? '').trim();
  const siteName = facility || asset || 'Not specified';
  const activityType = mapFuelUsedToActivityType(input.fuelUsed);
  const activityUnit = normalizeTemplateFuelUnit(input.fuelUsedUnit);
  const billingPeriodStart = parseDateOfTransaction(input.dateOfTransaction as unknown);
  const parts: string[] = [];
  if (asset) parts.push(`Asset: ${asset}`);
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
