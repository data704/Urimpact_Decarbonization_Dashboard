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
 * Read Excel file (xlsx/xls) and return structured data: header row + data rows separately.
 * This lets us chunk large files by rows without losing column headers.
 */
function parseExcelRows(filePath: string): { headers: string; rows: string[]; totalRows: number } {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: '', rows: [], totalRows: 0 };
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: '', rows: [], totalRows: 0 };

  // Convert to array-of-arrays (raw mode) to split headers from data rows
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', blankrows: false });
  if (raw.length === 0) return { headers: '', rows: [], totalRows: 0 };

  // First non-empty row is the header
  const headerRow = (raw[0] as string[]).join(',');
  const dataRows = (raw.slice(1) as string[][])
    .filter((r) => r.some((cell) => String(cell).trim() !== ''))
    .map((r) => r.join(','));

  return { headers: headerRow, rows: dataRows, totalRows: dataRows.length };
}

/**
 * Legacy: whole sheet as CSV (kept for small files / single-entry receipts)
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

  // Excel with table data: chunk large files and ask for one JSON object per row
  if (isExcel && extraText) {
    const BATCH_SIZE = 25; // rows per Claude call — keeps prompt + response within token limits
    const { headers, rows: dataRows, totalRows } = parseExcelRows(filePath);

    if (totalRows === 0) {
      throw new AppError('Spreadsheet has no readable data rows', 400);
    }

    logger.info(`Excel processing: ${totalRows} data rows, processing in batches of ${BATCH_SIZE}`);

    /**
     * Call Claude for a single batch of rows and parse the JSON response.
     * Returns an empty array on parse failure (partial batch failure won't abort the whole file).
     */
    async function extractBatch(batchRows: string[], batchIndex: number): Promise<ReceiptExtractionResult[]> {
      const tableText = [headers, ...batchRows].join('\n');
      const batchPrompt = `You are an expert at extracting emission-related data from spreadsheets for carbon calculations.

Below is tabular data from a spreadsheet. Each row represents one emission entry (e.g. one fuel purchase, one utility bill, one activity).

Document data (table):
${tableText}

Extract ONE entry per data row. Respond with ONLY a JSON array of objects. No markdown, no code block, no commentary.
Each object must have at least:
- "activityType": "electricity" or "diesel" or "petrol" or "natural_gas" etc. (lowercase)
- "activityAmount": number (the consumption quantity)
- "activityUnit": "kWh" or "L" or "m3" or "gal" etc.

Each object may also include: "region", "product", "supplier", "documentDate" (YYYY-MM-DD), "scope", "category".

Rules:
- One JSON object per data row — do NOT merge rows.
- activityType must be Climatiq-compatible: electricity, diesel, petrol, gasoline, natural_gas, lpg, etc.
- Infer activityType from column headers or values.
- Return only the JSON array, nothing else.`;

      let responseText = '';
      try {
        responseText = await callClaude(batchPrompt, {});
      } catch (err) {
        logger.error(`Excel batch ${batchIndex}: Claude call failed`, { error: err instanceof Error ? err.message : String(err) });
        return [];
      }

      let jsonStr = responseText.trim();
      // Strip optional markdown code fence
      const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence?.[1]) jsonStr = fence[1].trim();
      // If response starts with '[', grab everything from '[' to the last ']'
      const arrStart = jsonStr.indexOf('[');
      const arrEnd = jsonStr.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

      let arr: unknown;
      try {
        arr = JSON.parse(jsonStr);
      } catch {
        logger.error(`Excel batch ${batchIndex}: invalid JSON from Claude`, { responseText: responseText.slice(0, 300) });
        return []; // skip this batch rather than aborting the whole file
      }

      const items = Array.isArray(arr) ? arr : [arr];
      return items
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
    }

    // Split data rows into batches and process sequentially to avoid rate limits
    const allExtracted: ReceiptExtractionResult[] = [];
    const batches: string[][] = [];
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      batches.push(dataRows.slice(i, i + BATCH_SIZE));
    }

    for (let b = 0; b < batches.length; b++) {
      const batchResults = await extractBatch(batches[b], b + 1);
      allExtracted.push(...batchResults);
      logger.info(`Excel batch ${b + 1}/${batches.length}: extracted ${batchResults.length} entries`);
    }

    const processingTime = Date.now() - startTime;

    if (allExtracted.length === 0) {
      throw new AppError(
        `No valid emission entries could be extracted from the spreadsheet (${totalRows} rows checked). ` +
        'Check that the file has columns for activity type, amount, and unit.',
        400
      );
    }

    logger.info(`Excel extraction complete: ${allExtracted.length}/${totalRows} entries extracted in ${processingTime}ms`);
    return { rawText: `Extracted ${allExtracted.length} entries from ${totalRows} rows`, extractedFields: allExtracted, processingTime, multiple: true };
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

// ─── Section Narrative Generation (V2 Report Architecture) ───────────────────

const GLOBAL_NARRATIVE_INSTRUCTION = `URIMPACT DECARBONISATION REPORT — NARRATIVE RULES:
- You are given computed variables from a deterministic calculation engine.
- Do NOT calculate anything. Do NOT invent numbers, percentages, dates, or assumptions.
- Refer ONLY to the values provided in each section's bindings.
- If a value is missing, write "Not provided."
- Tone: institutional, audit-safe, reduction-first, non-promotional.
- Output must be plain text only. No markdown tables, no markdown headers.
- Keep strictly within the requested length for each section.`;

type SectionBindings = Record<string, unknown>;

function buildSectionPrompt(slot_id: string, bindings: SectionBindings): string {
  const b = JSON.stringify(bindings);
  const prompts: Record<string, string> = {
    'exec.narrative': `Write 2–3 sentences summarising: (1) the baseline emissions and the absolute target-year reduction outcome, (2) the required annual reduction pace, (3) that the removal obligation addresses the structural residual only and does not substitute reductions. Data: ${b}`,

    'baseline.caption': `Write 2–3 sentences explaining: (1) the top 1–2 contributors by share of total baseline emissions, (2) the Scope 1 vs Scope 2 split, (3) what that distribution implies for priority decarbonisation levers. Do not suggest new initiatives. Data: ${b}`,

    'sources.caption': `Write exactly 2 sentences: (1) describe the overall distribution across emission sources, (2) highlight the top 1–2 sources as the primary reduction levers. Data: ${b}`,

    'pathway.caption': `Write 80–110 words explaining: (1) the total reduction commitment and timeframe (base year to target year), (2) that the linear pathway is a planning simplification rather than a performance guarantee, (3) the required annual pace as a governance signal. Data: ${b}`,

    'bau.caption': `${(bindings as {bau_enabled?: boolean}).bau_enabled ? `Write exactly 2 sentences: (1) explain the BAU comparator scenario and what it represents, (2) describe the difference in outcome at target year versus the intervention target. Do not use forecasting certainty language.` : `Output exactly: "BAU scenario not included."`} Data: ${b}`,

    'residual.caption': `Write 90–130 words explaining: (1) what structural residual emissions are and why they persist after structural interventions (hard-to-abate), (2) that the residual ceiling is policy-defined and tied to the chosen ambition tier, (3) that the removal obligation addresses the residual only and does not substitute emission reductions. Data: ${b}`,

    'removals.caption': `Write 2–3 sentences: (1) explain the annual removal requirement and its cumulative scale over the transition period${(bindings as {trees_enabled?: boolean}).trees_enabled ? ', (2) state clearly that the tree equivalency figure is an illustrative translation using the provided sequestration rate and is not a verified removal commitment' : ''}. Data: ${b}`,

    'strategy.text': `Write exactly 3 sentences: (1) identify the priority operational lever(s) based on the dominant emission sources, (2) explain why the required annual pace implies early action from a governance perspective, (3) provide one neutral planning implication about capability-building or sequencing — without financial projections. Data: ${b}`,

    'roadmap.caption': `Write 50–70 words introducing phased execution of the decarbonisation pathway: why foundation actions come first and how early phases establish conditions for later-phase actions. If phase names or years are provided in the data, reference them; otherwise keep generic without invented dates. Data: ${b}`,

    'assumptions.bullets': `Write 5–8 concise bullet points (each starting with a dash "-") covering: the Scope 1 & 2 only boundary, the linear pathway as a planning simplification, that the tier mapping is policy-defined (not empirically measured), that the structural residual ceiling is policy-defined and hardcoded to the tier${(bindings as {bau_enabled?: boolean}).bau_enabled ? ', that the BAU scenario is a comparator only and does not affect pathway maths' : ''}${(bindings as {trees_enabled?: boolean}).trees_enabled ? ', that tree equivalency is illustrative and uses the default sequestration rate' : ''}, that no financial modelling or third-party verification is included. Max 120 words total. Data: ${b}`,
  };
  return prompts[slot_id] ?? `Write 1–2 sentences summarising this section concisely. Data: ${b}`;
}

export interface SectionNarrativeInput {
  section_id: string;
  slot_id: string;
  bindings: SectionBindings;
}

export interface SectionNarrativeOutput {
  slot_id: string;
  text: string;
}

/**
 * Call Claude for one batch of sections.
 * Returns an array of { slot_id, text } — never throws; returns empty strings on any error.
 */
async function callClaudeForSectionBatch(
  batch: SectionNarrativeInput[]
): Promise<SectionNarrativeOutput[]> {
  const empty = batch.map((s) => ({ slot_id: s.slot_id, text: '' }));
  if (batch.length === 0) return empty;

  const numbered = batch.map((s, i) => ({
    idx: i + 1,
    slot_id: s.slot_id,
    instruction: buildSectionPrompt(s.slot_id, s.bindings),
  }));

  const prompt = `${GLOBAL_NARRATIVE_INSTRUCTION}

Generate narrative text for each section listed below.
Return ONLY a valid JSON array. Each element: { "slot_id": "...", "text": "..." }
Do not include any other keys, markdown, or commentary.

Sections:
${numbered.map((p) => `[${p.idx}] slot_id: "${p.slot_id}"\nTask: ${p.instruction}`).join('\n\n')}

Return only the JSON array.`;

  try {
    const responseText = await callClaude(prompt);
    let jsonStr = responseText.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) jsonStr = match[1].trim();

    const arr = JSON.parse(jsonStr) as Array<{ slot_id: string; text: string }>;
    if (!Array.isArray(arr)) throw new Error('Expected array');
    const valid = arr.filter((item) => typeof item.slot_id === 'string' && typeof item.text === 'string');
    logger.info(`Section narratives batch (${batch.length} sections) generated: ${valid.length} returned`);
    return valid;
  } catch (err) {
    logger.error('Section narratives batch failed', {
      sections: batch.map((s) => s.slot_id),
      error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
}

/**
 * Generate per-section narrative text for the V2 report.
 * Sections are processed in small batches to avoid token limits and reduce blast radius of errors.
 * AI returns text only — all numbers come from the deterministic engine.
 * This function never throws — it returns empty strings on any failure.
 */
export async function generateSectionNarratives(
  sections: SectionNarrativeInput[]
): Promise<SectionNarrativeOutput[]> {
  if (!config.anthropic.apiKey || sections.length === 0) {
    logger.warn('Section narratives: skipped (no API key or empty sections)');
    return sections.map((s) => ({ slot_id: s.slot_id, text: '' }));
  }

  // Split into batches of 3 to keep each prompt small and avoid response truncation
  const BATCH_SIZE = 3;
  const batches: SectionNarrativeInput[][] = [];
  for (let i = 0; i < sections.length; i += BATCH_SIZE) {
    batches.push(sections.slice(i, i + BATCH_SIZE));
  }

  // Process all batches in parallel (each batch is an independent Claude call)
  const results = await Promise.all(batches.map((batch) => callClaudeForSectionBatch(batch)));

  // Flatten and return
  return results.flat();
}
