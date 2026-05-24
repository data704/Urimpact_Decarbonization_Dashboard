import * as XLSX from 'xlsx';
import {
  PURCHASED_COOLING_EXCEL_HEADERS,
  PURCHASED_COOLING_SHEET_NAME,
  mapPurchasedCoolingToGhgBody,
  normalizeExcelHeader,
} from '../constants/ghgPurchasedCoolingTemplate.js';
import { validate, purchasedCoolingFormSchema } from '../utils/validators.js';

type ExcelHeader = (typeof PURCHASED_COOLING_EXCEL_HEADERS)[number];

export type PurchasedCoolingRowInput = {
  activityType: string;
  sourceType: string;
  consumption: number;
  consumptionUnit: string;
  siteId: string;
  startDate: string | number;
  endDate: string | number;
  notes?: string;
};

function parsePositiveNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Consumption must be a positive number');
  return n;
}

function findHeaderRow(aoa: unknown[][]): { headerRow: number; colIdx: Record<ExcelHeader, number> } {
  const needed = PURCHASED_COOLING_EXCEL_HEADERS.map((h) => normalizeExcelHeader(h));
  const maxScan = Math.min(aoa.length, 250);
  for (let r = 0; r < maxScan; r++) {
    const row = (aoa[r] ?? []) as unknown[];
    const colIdx: Partial<Record<ExcelHeader, number>> = {};
    let ok = true;
    for (let hi = 0; hi < PURCHASED_COOLING_EXCEL_HEADERS.length; hi++) {
      const want = needed[hi];
      const j = row.findIndex((c) => normalizeExcelHeader(String(c ?? '')) === want);
      if (j === -1) { ok = false; break; }
      colIdx[PURCHASED_COOLING_EXCEL_HEADERS[hi]] = j;
    }
    if (ok && colIdx['Activity Type'] !== undefined) {
      return { headerRow: r, colIdx: colIdx as Record<ExcelHeader, number> };
    }
  }
  throw new Error(
    `Could not find the data header row (columns: ${PURCHASED_COOLING_EXCEL_HEADERS.join(', ')}). Use the "Purchased Cooling" sheet from the official template.`
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
    sheet = wb.Sheets[PURCHASED_COOLING_SHEET_NAME];
    if (!sheet) {
      throw new Error(
        `Workbook has no sheet named "${PURCHASED_COOLING_SHEET_NAME}". Use the official template file.`
      );
    }
  }

  if (!sheet) throw new Error('Could not read any sheet from the file.');
  return sheetToMatrix(sheet);
}

function normalizeExcelDateValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    try {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + value * 86400000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { /* keep raw */ }
  }
  return value as string | number;
}

export function matrixRowToTemplateInput(
  row: unknown[],
  colIdx: Record<ExcelHeader, number>
): PurchasedCoolingRowInput {
  const cell = (h: ExcelHeader) => row[colIdx[h]];
  return {
    activityType: String(cell('Activity Type') ?? '').trim(),
    sourceType: String(cell('Source Type') ?? '').trim(),
    consumption: parsePositiveNumber(cell('Consumption')),
    consumptionUnit: String(cell('Consumption Unit') ?? '').trim(),
    siteId: String(cell('Site ID') ?? '').trim(),
    startDate: normalizeExcelDateValue(cell('Start Date')),
    endDate: normalizeExcelDateValue(cell('End Date')),
  };
}

function isProbablyDataRow(input: PurchasedCoolingRowInput): boolean {
  if (!input.consumptionUnit || input.consumptionUnit.toLowerCase() === 'consumption unit') return false;
  if (!input.consumption) return false;
  return true;
}

export type ParsedPurchasedCoolingBulkRow = { excelRow: number; input: PurchasedCoolingRowInput };

export type PurchasedCoolingBulkPreviewRow = {
  excelRow: number;
  status: 'valid' | 'invalid';
  errors: string[];
  input: PurchasedCoolingRowInput;
  mappedPreview?: {
    siteName: string;
    activityType: string;
    activityAmount: number;
    activityUnit: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    notes?: string;
  };
};

export function evaluatePurchasedCoolingBulkRow(
  excelRow: number,
  input: PurchasedCoolingRowInput
): PurchasedCoolingBulkPreviewRow {
  const v = validate(purchasedCoolingFormSchema, { ...input, dataEntryChannel: 'BULK_UPLOAD' });
  if (!v.success) {
    return { excelRow, input, status: 'invalid', errors: v.errors ?? ['Invalid row'] };
  }
  try {
    const mapped = mapPurchasedCoolingToGhgBody(
      {
        activityType: v.data!.activityType ?? '',
        sourceType: v.data!.sourceType ?? '',
        consumption: v.data!.consumption!,
        consumptionUnit: v.data!.consumptionUnit ?? '',
        siteId: v.data!.siteId ?? '',
        startDate: v.data!.startDate,
        endDate: v.data!.endDate,
        notes: v.data!.notes,
      },
      'BULK_UPLOAD'
    );
    return {
      excelRow, input, status: 'valid', errors: [],
      mappedPreview: {
        siteName: mapped.siteName,
        activityType: mapped.activityType,
        activityAmount: mapped.activityAmount,
        activityUnit: mapped.activityUnit,
        billingPeriodStart: mapped.billingPeriodStart ?? '',
        billingPeriodEnd: mapped.billingPeriodEnd ?? '',
        notes: mapped.notes,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { excelRow, input, status: 'invalid', errors: [msg] };
  }
}

export function buildPurchasedCoolingBulkPreview(parsed: ParsedPurchasedCoolingBulkRow[]): PurchasedCoolingBulkPreviewRow[] {
  return parsed.map(({ excelRow, input }) => evaluatePurchasedCoolingBulkRow(excelRow, input));
}

export function parsePurchasedCoolingBulkFile(buffer: Buffer, originalName: string): ParsedPurchasedCoolingBulkRow[] {
  const aoa = readWorkbookMatrix(buffer, originalName);
  const { headerRow, colIdx } = findHeaderRow(aoa);
  const out: ParsedPurchasedCoolingBulkRow[] = [];

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = (aoa[r] ?? []) as unknown[];
    if (!row.some((c) => String(c ?? '').trim())) continue;
    const excelRow = r + 1;
    let input: PurchasedCoolingRowInput;
    try { input = matrixRowToTemplateInput(row, colIdx); } catch { continue; }
    if (!isProbablyDataRow(input)) continue;
    out.push({ excelRow, input });
  }

  if (!out.length) {
    throw new Error('No data rows found under the header. Check quantities, dates, and that you used the correct sheet.');
  }
  return out;
}
