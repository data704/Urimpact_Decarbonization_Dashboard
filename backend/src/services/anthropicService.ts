/**
 * Anthropic (Claude) API service.
 *
 * We use the Anthropic API instead of Affinda to read receipts.
 * When a receipt is uploaded, Claude extracts structured data (activity type, amount, unit, region, etc.),
 * which is then sent to Climatiq for emission calculation and stored.
 * Supports images (JPEG, PNG, etc.), PDF, and Excel (xlsx, xls).
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ExtractedDocumentData } from '../types/index.js';

const anthropicApi = axios.create({
  baseURL: config.anthropic.apiUrl,
  headers: {
    'x-api-key': config.anthropic.apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes for vision/report
});

/** Result from Claude when extracting receipt data for Climatiq */
export interface ReceiptExtractionResult extends ExtractedDocumentData {
  activityType: string;
  activityAmount: number;
  activityUnit: string;
  region?: string;
  scope?: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  category?: string;
  /** Product/fuel name as shown on receipt e.g. Benzine 91, Super 98, Diesel */
  product?: string;
  /** Receipt or document date (YYYY-MM-DD); use when billing period not available */
  documentDate?: string;
  /** Supplier/vendor/company name (e.g. utility company, gas station) */
  supplier?: string;
}

/** Client config + emissions payload sent to Claude for report calculations */
export interface ReportCalculationInput {
  clientConfig: {
    target_year: number;
    ambition_level: string;
    capex_opex_preference: string | null;
    supporting_documents: string[];
  };
  emissionsSummary: {
    totalCo2eTonnes: number;
    totalCo2eKg: number;
    recordCount: number;
    byScope: Record<string, { total: number; totalTonnes: number; count: number }>;
    byCategory: Array<{ category: string; total: number; totalTonnes: number; count: number }>;
    trend?: Array<{ month: string; total: number; totalTonnes: number; scope1: number; scope2: number; scope3: number }>;
  };
}

/** Structured report calculations returned by Claude for frontend Reports section */
export interface ReportCalculationResult {
  summary?: string;
  insights?: string[];
  recommendations?: string[];
  pathwaySummary?: string;
  targets?: Array<{ year?: number; description: string; value?: number; unit?: string }>;
  risks?: string[];
  opportunities?: string[];
  raw?: Record<string, unknown>;
}

/** Options for callClaude: send image, PDF document, or text only */
interface CallClaudeOptions {
  imageBase64?: string;
  imageMediaType?: string;
  documentBase64?: string;
  documentMediaType?: string;
}

/**
 * Call Anthropic Messages API (model from config, e.g. claude-opus-4-6).
 * Supports optional image block, optional PDF document block, and text.
 */
async function callClaude(text: string, options: CallClaudeOptions = {}): Promise<string> {
  if (!config.anthropic.apiKey) {
    throw new AppError('Anthropic API key is not configured', 500);
  }

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

  const content: ContentBlock[] = [];

  if (options.documentBase64 && (options.documentMediaType || 'application/pdf')) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: options.documentMediaType || 'application/pdf',
        data: options.documentBase64,
      },
    });
  } else if (options.imageBase64 && options.imageMediaType) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: options.imageMediaType,
        data: options.imageBase64,
      },
    });
  }

  content.push({ type: 'text', text });

  const body = {
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [
      {
        role: 'user' as const,
        content,
      },
    ],
  };

  const response = await anthropicApi.post<{ content: Array<{ type: string; text?: string }> }>(
    '/messages',
    body
  );

  const firstBlock = response.data.content?.[0];
  if (!firstBlock || firstBlock.type !== 'text' || !firstBlock.text) {
    throw new AppError('Invalid response from Claude', 500);
  }

  return firstBlock.text;
}

/**
 * Read Excel file (xlsx/xls) and return first sheet as CSV-like text for Claude
 */
function excelToText(filePath: string): string {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return '';
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return '';
  return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
}

/**
 * Extract receipt/utility bill data using Claude and return JSON suitable for Climatiq.
 * Supports: images (JPEG, PNG, GIF, WebP), PDF, and Excel (xlsx, xls).
 * For Excel with multiple rows, returns an array of entries (multiple: true).
 */
export async function extractReceiptToClimatiqJson(filePath: string): Promise<{
  rawText: string;
  extractedFields: ReceiptExtractionResult | ReceiptExtractionResult[];
  processingTime: number;
  multiple?: boolean;
}> {
  const startTime = Date.now();
  const ext = path.extname(filePath).toLowerCase();
  const supportedImages = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const isExcel = ext === '.xlsx' || ext === '.xls';

  let imageBase64: string | undefined;
  let documentBase64: string | undefined;
  let documentMediaType: string | undefined;
  let extraText = '';

  let mediaType = 'image/jpeg';
  if (ext === '.png') mediaType = 'image/png';
  else if (ext === '.gif') mediaType = 'image/gif';
  else if (ext === '.webp') mediaType = 'image/webp';

  if (supportedImages.includes(ext)) {
    const buffer = fs.readFileSync(filePath);
    imageBase64 = buffer.toString('base64');
  } else if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    documentBase64 = buffer.toString('base64');
    documentMediaType = 'application/pdf';
  } else if (isExcel) {
    extraText = excelToText(filePath);
    if (!extraText.trim()) {
      throw new AppError('Excel file has no readable sheet data', 400);
    }
  } else {
    logger.warn(`Receipt extraction: unsupported file type ${ext}`);
  }

  // Excel with table data: ask for one JSON object per row (array of entries)
  if (isExcel && extraText) {
    const excelPrompt = `You are an expert at extracting emission-related data from spreadsheets for carbon calculations.

Below is tabular data from a spreadsheet. Each row typically represents one emission entry (e.g. one fuel purchase, one utility bill, one activity).

Document data (table):
${extraText}

Extract ONE entry per data row. Respond with ONLY a JSON array of objects (no markdown, no code block). Each object must have at least:
- "activityType": "electricity" or "diesel" or "petrol" or "natural_gas" etc. (lowercase)
- "activityAmount": number
- "activityUnit": "kWh" or "L" or "m3" etc.

Each object may also include: "region", "product", "supplier", "documentDate" (YYYY-MM-DD), "scope", "category".

Rules:
- Output a JSON array with one object per data row. Do not merge rows into one entry.
- If the table has 30 rows of data, return an array of 30 objects.
- activityType must be Climatiq-compatible: electricity, diesel, petrol, gasoline, natural_gas, etc.
- Infer activityType from column headers or values (e.g. "Electricity" column → electricity, "Diesel" → diesel).
- Return only the JSON array, no other text.`;

    const responseText = await callClaude(excelPrompt, {});
    const processingTime = Date.now() - startTime;
    let jsonStr = responseText.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = (codeBlockMatch[1] ?? jsonStr).trim();

    let arr: unknown;
    try {
      arr = JSON.parse(jsonStr);
    } catch {
      logger.error('Claude Excel extraction: invalid JSON', { responseText: responseText.slice(0, 500) });
      throw new AppError('Failed to parse spreadsheet data from AI response', 500);
    }

    const items = Array.isArray(arr) ? arr : [arr];
    const extractedFields: ReceiptExtractionResult[] = items
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map((item) => {
        const activityType = String(item.activityType ?? '').trim().toLowerCase();
        const activityAmount = Number(item.activityAmount);
        const activityUnit = String(item.activityUnit ?? '').trim();
        if (!activityType || Number.isNaN(activityAmount) || !activityUnit) return null;
        return {
          ...item,
          activityType,
          activityAmount,
          activityUnit,
          region: (item.region as string) ?? 'AE',
          product: item.product as string | undefined,
          supplier: (item.supplier ?? item.provider) as string | undefined,
          documentDate: item.documentDate as string | undefined,
          billingPeriodStart: item.billingPeriodStart as string | undefined,
          billingPeriodEnd: item.billingPeriodEnd as string | undefined,
        } as ReceiptExtractionResult;
      })
      .filter((e): e is ReceiptExtractionResult => e != null);

    if (extractedFields.length === 0) {
      throw new AppError('No valid emission entries could be extracted from the spreadsheet', 400);
    }

    logger.info(`Excel extracted ${extractedFields.length} entries in ${processingTime}ms`);
    return { rawText: responseText, extractedFields, processingTime, multiple: true };
  }

  const attachmentDesc =
    imageBase64
      ? 'Analyze the attached image (receipt or utility bill).'
      : documentBase64
        ? 'Analyze the attached PDF document (receipt or utility bill).'
        : 'The user will provide document text in a follow-up.';

  const prompt = `You are an expert at extracting data from receipts and utility bills for carbon emission calculations.

${attachmentDesc}
${extraText ? `\nDocument data (table):\n${extraText}\n` : ''}

Extract structured data and respond with ONLY a valid JSON object (no markdown, no code block wrapper). Use this exact structure:
{
  "activityType": "electricity" or "diesel" or "petrol" or "natural_gas" or "natural-gas" etc. (lowercase, hyphenated for Climatiq)",
  "activityAmount": number (consumption in kWh, or quantity in L/m3, etc.),
  "activityUnit": "kWh" or "L" or "m3" or "gal" etc.",
  "region": "AE" or "AE-DU" or "AE-AZ" or "GLOBAL" etc. (extract when visible on document; otherwise omit)",
  "scope": "SCOPE_1" for fuel/combustion, "SCOPE_2" for electricity (optional)",
  "category": "ELECTRICITY" or "FUEL_COMBUSTION" etc. (optional)",
  "product": "only for fuel: exact product/fuel name as on receipt e.g. Benzine 91, Super 98, Diesel; omit for electricity",
  "supplier": "company or vendor name when visible (e.g. utility company, electricity provider, gas station, fuel brand)",
  "provider": "same as supplier if used elsewhere",
  "consumption": number (same as activityAmount for electricity)",
  "consumptionUnit": "kWh" etc.",
  "quantity": number (for fuel)",
  "quantityUnit": "L" etc.",
  "fuelType": "diesel" etc. for fuel receipts",
  "billingPeriodStart": "YYYY-MM-DD" if visible",
  "billingPeriodEnd": "YYYY-MM-DD" if visible",
  "documentDate": "YYYY-MM-DD" from receipt/invoice date when visible (use when no billing period)",
  "amount": number if visible",
  "currency": "AED" etc. if visible"
}

Rules:
- activityType must be one Climatiq can use: electricity, diesel, petrol, gasoline, natural_gas, natural-gas, etc.
- Always extract "region" when it appears on the document (from address, supplier location, country, grid region, or station). Use AE, AE-DU, AE-AZ, GLOBAL, etc. If no region is visible, omit the field.
- Always extract "supplier" when visible (utility company, electricity provider, gas station name, fuel brand, or vendor on the receipt).
- Extract "product" only for fuel receipts (e.g. Benzine 91, Super 98, Diesel). Do not include product for electricity.
- Always extract "documentDate" when a date appears on the receipt (receipt date, invoice date, or transaction date). Use YYYY-MM-DD.
- For utility bills use activityType "electricity", activityUnit "kWh", and extract region when visible (e.g. AE, AE-DU for UAE).
- For fuel receipts use activityType "diesel" or "petrol", activityUnit "L", extract region when visible, and always extract product.
- Return only the JSON object, no other text.`;

  const responseText = await callClaude(prompt, {
    imageBase64,
    imageMediaType: mediaType,
    documentBase64,
    documentMediaType,
  });
  const processingTime = Date.now() - startTime;

  // Parse JSON from response (handle optional markdown code block)
  let jsonStr = responseText.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1] !== undefined) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: ReceiptExtractionResult;
  try {
    parsed = JSON.parse(jsonStr) as ReceiptExtractionResult;
  } catch {
    logger.error('Claude receipt extraction: invalid JSON', { responseText: responseText.slice(0, 500) });
    throw new AppError('Failed to parse receipt data from document', 500);
  }

  if (!parsed.activityType || typeof parsed.activityAmount !== 'number' || !parsed.activityUnit) {
    throw new AppError('Extracted data missing required fields (activityType, activityAmount, activityUnit)', 400);
  }

  const extractedFields: ReceiptExtractionResult = {
    ...parsed,
    consumption: parsed.consumption ?? parsed.activityAmount,
    consumptionUnit: parsed.consumptionUnit ?? parsed.activityUnit,
    quantity: parsed.quantity ?? (parsed.activityType !== 'electricity' ? parsed.activityAmount : undefined),
    quantityUnit: parsed.quantityUnit ?? parsed.activityUnit,
    region: parsed.region ?? 'AE',
  };

  logger.info(`Receipt extracted in ${processingTime}ms: ${parsed.activityType} ${parsed.activityAmount} ${parsed.activityUnit}`);

  return {
    rawText: responseText,
    extractedFields,
    processingTime,
    multiple: false,
  };
}

/**
 * Generate report calculations using Claude from client config + emissions data
 * Used by the frontend Reports section
 */
export async function generateReportCalculations(
  input: ReportCalculationInput
): Promise<ReportCalculationResult> {
  const prompt = `You are a decarbonisation and carbon reporting expert. Given the following client configuration and emissions summary, produce a structured report analysis that will be used in a frontend Reports section.

Client configuration:
${JSON.stringify(input.clientConfig, null, 2)}

Emissions summary (from Climatiq-calculated data):
${JSON.stringify(input.emissionsSummary, null, 2)}

Respond with ONLY a valid JSON object (no markdown, no code block). Use this structure:
{
  "summary": "2-3 sentence executive summary of current footprint and alignment with target",
  "insights": ["insight 1", "insight 2", "..."],
  "recommendations": ["recommendation 1", "..."],
  "pathwaySummary": "Short description of pathway to target year given ambition level",
  "targets": [{"year": 2030, "description": "...", "value": number or null, "unit": "tonnes CO2e"}],
  "risks": ["risk 1", "..."],
  "opportunities": ["opportunity 1", "..."]
}

Base targets and pathway on target_year and ambition_level. Consider capex_opex_preference when suggesting recommendations. Keep text concise and actionable. Return only the JSON object.`;

  const responseText = await callClaude(prompt);
  let jsonStr = responseText.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1] !== undefined) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as ReportCalculationResult;
    logger.info('Report calculations generated by Claude');
    return result;
  } catch {
    logger.error('Claude report calculations: invalid JSON', { responseText: responseText.slice(0, 500) });
    return {
      summary: responseText.slice(0, 500),
      raw: { rawResponse: responseText },
    };
  }
}
