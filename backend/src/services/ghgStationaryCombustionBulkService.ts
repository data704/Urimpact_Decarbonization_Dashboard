import * as XLSX from 'xlsx';
import {
  STATIONARY_COMBUSTION_EXCEL_HEADERS,
  STATIONARY_COMBUSTION_SHEET_NAME,
  mapStationaryTemplateToGhgBody,
  normalizeExcelHeader,
} from '../constants/ghgStationaryCombustionTemplate.js';
import { validate, stationaryCombustionTemplateFormSchema } from '../utils/validators.js';

type ExcelHeader = (typeof STATIONARY_COMBUSTION_EXCEL_HEADERS)[number];

export type StationaryTemplateRowInput = {
  asset: string;
  fuelUsed: string;
  fuelUsedQuantity: number;
  fuelUsedUnit: string;
  facility: string;
  dateOfTransaction: string | number;
  notes?: string;
};

function parsePositiveNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Fuel Used Quantity must be a positive number');
  return n;
}

function findHeaderRow(aoa: unknown[][]): { headerRow: number; colIdx: Record<ExcelHeader, number> } {
  const needed = STATIONARY_COMBUSTION_EXCEL_HEADERS.map((h) => normalizeExcelHeader(h));
  const maxScan = Math.min(aoa.length, 250);
  for (let r = 0; r < maxScan; r++) {
    const row = (aoa[r] ?? []) as unknown[];
    const colIdx: Partial<Record<ExcelHeader, number>> = {};
    let ok = true;
    for (let hi = 0; hi < STATIONARY_COMBUSTION_EXCEL_HEADERS.length; hi++) {
      const want = needed[hi];
      const j = row.findIndex((c) => normalizeExcelHeader(String(c ?? '')) === want);
      if (j === -1) {
        ok = false;
        break;
      }
      colIdx[STATIONARY_COMBUSTION_EXCEL_HEADERS[hi]] = j;
    }
    if (ok && colIdx['Asset'] !== undefined) {
      return { headerRow: r, colIdx: colIdx as Record<ExcelHeader, number> };
    }
  }
  throw new Error(
    `Could not find the data header row (columns: ${STATIONARY_COMBUSTION_EXCEL_HEADERS.join(', ')}). Use the "Stationary Combustion" sheet from the official template.`
  );
}

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
}

function readWorkbookMatrix(buffer: Buffer, originalName: string): unknown[][] {
  const lower = originalName.toLowerCase();
  let wb: XLSX.WorkBook;
  if (lower.endsWith('.csv')) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    wb = XLSX.read(text, { type: 'string', raw: true });
  } else {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  }

  let sheet: XLSX.WorkSheet | undefined;
  if (lower.endsWith('.csv')) {
    sheet = wb.Sheets[wb.SheetNames[0]];
  } else {
    sheet = wb.Sheets[STATIONARY_COMBUSTION_SHEET_NAME];
    if (!sheet) {
      throw new Error(
        `Workbook has no sheet named "${STATIONARY_COMBUSTION_SHEET_NAME}". Use the official template file.`
      );
    }
  }

  if (!sheet) throw new Error('Could not read any sheet from the file.');
  return sheetToMatrix(sheet);
}

/** Convert Excel serial date (days since 1899-12-30) to YYYY-MM-DD string for display & downstream parsing. */
function normalizeExcelDateValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    try {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + value * 86400000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10); // "2025-01-01"
      }
    } catch { /* keep raw */ }
  }
  return value as string | number;
}

export function matrixRowToTemplateInput(
  row: unknown[],
  colIdx: Record<ExcelHeader, number>
): StationaryTemplateRowInput {
  const cell = (h: ExcelHeader) => row[colIdx[h]];
  return {
    asset: String(cell('Asset') ?? '').trim(),
    fuelUsed: String(cell('Fuel Used') ?? '').trim(),
    fuelUsedQuantity: parsePositiveNumber(cell('Fuel Used Quantity')),
    fuelUsedUnit: String(cell('Fuel Used Unit') ?? '').trim(),
    facility: String(cell('Facility') ?? '').trim(),
    dateOfTransaction: normalizeExcelDateValue(cell('Date of transaction')),
  };
}

function isProbablyDataRow(input: StationaryTemplateRowInput): boolean {
  if (!input.fuelUsed || input.fuelUsed.toLowerCase() === 'fuel used') return false;
  if (!input.asset && !input.facility) return false;
  return true;
}

export type ParsedStationaryBulkRow = { excelRow: number; input: StationaryTemplateRowInput };

/** One row result for preview (no DB / no Climatiq). */
export type StationaryBulkPreviewRow = {
  excelRow: number;
  status: 'valid' | 'invalid';
  errors: string[];
  input: StationaryTemplateRowInput;
  mappedPreview?: {
    siteName: string;
    activityType: string;
    activityAmount: number;
    activityUnit: string;
    billingPeriodStart: string;
    notes?: string;
  };
};

export function evaluateStationaryBulkRow(
  excelRow: number,
  input: StationaryTemplateRowInput
): StationaryBulkPreviewRow {
  const v = validate(stationaryCombustionTemplateFormSchema, {
    ...input,
    dataEntryChannel: 'BULK_UPLOAD',
  });
  if (!v.success) {
    return { excelRow, input, status: 'invalid', errors: v.errors ?? ['Invalid row'] };
  }
  try {
    const mapped = mapStationaryTemplateToGhgBody(
      {
        asset: v.data!.asset ?? '',
        fuelUsed: v.data!.fuelUsed ?? '',
        fuelUsedQuantity: v.data!.fuelUsedQuantity!,
        fuelUsedUnit: v.data!.fuelUsedUnit ?? '',
        facility: v.data!.facility ?? '',
        dateOfTransaction: v.data!.dateOfTransaction,
        notes: v.data!.notes,
      },
      'BULK_UPLOAD'
    );
    return {
      excelRow,
      input,
      status: 'valid',
      errors: [],
      mappedPreview: {
        siteName: mapped.siteName,
        activityType: mapped.activityType,
        activityAmount: mapped.activityAmount,
        activityUnit: mapped.activityUnit,
        billingPeriodStart: mapped.billingPeriodStart ?? '',
        notes: mapped.notes,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { excelRow, input, status: 'invalid', errors: [msg] };
  }
}

export function buildStationaryBulkPreview(parsed: ParsedStationaryBulkRow[]): StationaryBulkPreviewRow[] {
  return parsed.map(({ excelRow, input }) => evaluateStationaryBulkRow(excelRow, input));
}

/**
 * Parse the "Stationary Combustion" sheet (or CSV with the same header row) into template rows with 1-based Excel row numbers.
 */
export function parseStationaryCombustionBulkFile(buffer: Buffer, originalName: string): ParsedStationaryBulkRow[] {
  const aoa = readWorkbookMatrix(buffer, originalName);
  const { headerRow, colIdx } = findHeaderRow(aoa);
  const out: ParsedStationaryBulkRow[] = [];

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = (aoa[r] ?? []) as unknown[];
    if (!row.some((c) => String(c ?? '').trim())) continue;
    const excelRow = r + 1;
    let input: StationaryTemplateRowInput;
    try {
      input = matrixRowToTemplateInput(row, colIdx);
    } catch {
      continue;
    }
    if (!isProbablyDataRow(input)) continue;
    out.push({ excelRow, input });
  }

  if (!out.length) {
    throw new Error(
      'No data rows found under the header. Check quantities, dates, and that you used the correct sheet.'
    );
  }
  return out;
}
