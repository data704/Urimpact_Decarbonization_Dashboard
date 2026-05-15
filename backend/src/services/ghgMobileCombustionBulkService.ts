import * as XLSX from 'xlsx';
import {
  MOBILE_COMBUSTION_EXCEL_HEADERS,
  MOBILE_COMBUSTION_SHEET_NAME,
  mapMobileTemplateToGhgBody,
} from '../constants/ghgMobileCombustionTemplate.js';
import { normalizeExcelHeader } from '../constants/ghgStationaryCombustionTemplate.js';
import { validate, mobileCombustionTemplateFormSchema } from '../utils/validators.js';

type ExcelHeader = (typeof MOBILE_COMBUSTION_EXCEL_HEADERS)[number];

export type MobileTemplateRowInput = {
  vehicleType: string;
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
  const needed = MOBILE_COMBUSTION_EXCEL_HEADERS.map((h) => normalizeExcelHeader(h));
  const maxScan = Math.min(aoa.length, 250);
  for (let r = 0; r < maxScan; r++) {
    const row = (aoa[r] ?? []) as unknown[];
    const colIdx: Partial<Record<ExcelHeader, number>> = {};
    let ok = true;
    for (let hi = 0; hi < MOBILE_COMBUSTION_EXCEL_HEADERS.length; hi++) {
      const want = needed[hi];
      const j = row.findIndex((c) => normalizeExcelHeader(String(c ?? '')) === want);
      if (j === -1) {
        ok = false;
        break;
      }
      colIdx[MOBILE_COMBUSTION_EXCEL_HEADERS[hi]] = j;
    }
    if (ok && colIdx['Vehicle Type'] !== undefined) {
      return { headerRow: r, colIdx: colIdx as Record<ExcelHeader, number> };
    }
  }
  throw new Error(
    `Could not find the data header row (columns: ${MOBILE_COMBUSTION_EXCEL_HEADERS.join(', ')}). Use the "Mobile Combustion" sheet from the official template.`
  );
}

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
}

function normalizeExcelDateValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    try {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + value * 86400000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      /* keep raw */
    }
  }
  return value as string | number;
}

export function matrixRowToMobileTemplateInput(
  row: unknown[],
  colIdx: Record<ExcelHeader, number>
): MobileTemplateRowInput {
  const cell = (h: ExcelHeader) => row[colIdx[h]];
  return {
    vehicleType: String(cell('Vehicle Type') ?? '').trim(),
    fuelUsed: String(cell('Fuel Used') ?? '').trim(),
    fuelUsedQuantity: parsePositiveNumber(cell('Fuel Used Quantity')),
    fuelUsedUnit: String(cell('Fuel Used Unit') ?? '').trim(),
    facility: String(cell('Facility') ?? '').trim(),
    dateOfTransaction: normalizeExcelDateValue(cell('Date of transaction')),
  };
}

function isProbablyDataRow(input: MobileTemplateRowInput): boolean {
  if (!input.fuelUsed || input.fuelUsed.toLowerCase() === 'fuel used') return false;
  if (!input.vehicleType && !input.facility) return false;
  return true;
}

export type ParsedMobileBulkRow = { excelRow: number; input: MobileTemplateRowInput };

export type MobileBulkPreviewRow = {
  excelRow: number;
  status: 'valid' | 'invalid';
  errors: string[];
  input: MobileTemplateRowInput;
  mappedPreview?: {
    siteName: string;
    activityType: string;
    activityAmount: number;
    activityUnit: string;
    billingPeriodStart: string;
    notes?: string;
  };
};

export function evaluateMobileBulkRow(excelRow: number, input: MobileTemplateRowInput): MobileBulkPreviewRow {
  const v = validate(mobileCombustionTemplateFormSchema, {
    ...input,
    dataEntryChannel: 'BULK_UPLOAD',
  });
  if (!v.success) {
    return { excelRow, input, status: 'invalid', errors: v.errors ?? ['Invalid row'] };
  }
  try {
    const mapped = mapMobileTemplateToGhgBody(
      {
        vehicleType: v.data!.vehicleType ?? '',
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

export function buildMobileBulkPreview(parsed: ParsedMobileBulkRow[]): MobileBulkPreviewRow[] {
  return parsed.map(({ excelRow, input }) => evaluateMobileBulkRow(excelRow, input));
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
    sheet = wb.Sheets[MOBILE_COMBUSTION_SHEET_NAME];
    if (!sheet) {
      throw new Error(
        `Workbook has no sheet named "${MOBILE_COMBUSTION_SHEET_NAME}". Use the official template file.`
      );
    }
  }

  if (!sheet) throw new Error('Could not read any sheet from the file.');
  return sheetToMatrix(sheet);
}

export function parseMobileCombustionBulkFile(buffer: Buffer, originalName: string): ParsedMobileBulkRow[] {
  const aoa = readWorkbookMatrix(buffer, originalName);
  const { headerRow, colIdx } = findHeaderRow(aoa);
  const out: ParsedMobileBulkRow[] = [];

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = (aoa[r] ?? []) as unknown[];
    if (!row.some((c) => String(c ?? '').trim())) continue;
    try {
      const input = matrixRowToMobileTemplateInput(row, colIdx);
      if (!isProbablyDataRow(input)) continue;
      out.push({ excelRow: r + 1, input });
    } catch {
      continue;
    }
  }

  return out;
}
