import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const EXTRACTION_PROMPT = `You are an expert at reading fuel receipts, invoices, and utility bills for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 1 — Stationary Combustion category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded receipt/invoice image. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "asset": "Name of asset or equipment (e.g. Boiler, Generator, Furnace). If not clear, use a reasonable label from context.",
  "fuelUsed": "Type of fuel (e.g. Diesel, Natural Gas, CNG, LPG, Kerosene, Coal, Furnace Oil, Biomass, Petrol/Gasoline). Translate to English if in another language.",
  "fuelUsedQuantity": 0,
  "fuelUsedUnit": "Unit of measurement (Litre, kg, Metric ton, m3, kWh, MWh)",
  "facility": "Name of the facility, plant, or location if mentioned",
  "dateOfTransaction": "Date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, total cost, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- fuelUsedQuantity must be a positive number (the volume/weight/energy of fuel purchased)
- fuelUsedUnit must be one of: Litre, kg, Metric ton, m3, kWh, MWh
- dateOfTransaction must be in DD/MM/YYYY format
- If a field cannot be determined, use empty string for text fields and 0 for quantity
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (fuel, quantity, unit, date) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type ReceiptExtractionResult = {
  asset: string;
  fuelUsed: string;
  fuelUsedQuantity: number;
  fuelUsedUnit: string;
  facility: string;
  dateOfTransaction: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

function bufferToBase64MediaType(
  buffer: Buffer,
  mimeType: string
): { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'; data: string } {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  const mt = allowed.includes(mimeType) ? mimeType : 'image/jpeg';
  return {
    type: 'base64' as const,
    media_type: mt as 'image/jpeg',
    data: buffer.toString('base64'),
  };
}

export async function extractReceiptData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<ReceiptExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI receipt extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: source.data,
          },
        },
        { type: 'text' as const, text: EXTRACTION_PROMPT },
      ]
    : [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg',
            data: source.data,
          },
        },
        { type: 'text' as const, text: EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  let raw = textBlock.text.trim();
  // Strip markdown fences if present
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: ReceiptExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  // Sanitize
  parsed.asset = String(parsed.asset ?? '').trim();
  parsed.fuelUsed = String(parsed.fuelUsed ?? '').trim();
  parsed.fuelUsedQuantity = Number(parsed.fuelUsedQuantity) || 0;
  parsed.fuelUsedUnit = String(parsed.fuelUsedUnit ?? '').trim();
  parsed.facility = String(parsed.facility ?? '').trim();
  parsed.dateOfTransaction = String(parsed.dateOfTransaction ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI extraction complete: fuel=${parsed.fuelUsed}, qty=${parsed.fuelUsedQuantity} ${parsed.fuelUsedUnit}, confidence=${parsed.confidence}`);

  return parsed;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Mobile Combustion — receipt extraction
 * ────────────────────────────────────────────────────────────────────────────── */

const MOBILE_EXTRACTION_PROMPT = `You are an expert at reading fuel receipts, invoices, and utility bills for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 1 — Mobile Combustion category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded receipt/invoice image. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "vehicleType": "Type of vehicle (e.g. Car, Bus, 2 Wheeler, Truck, Van). If not clear, use a reasonable label from context.",
  "fuelUsed": "Type of fuel (e.g. Diesel, Petrol, Gasoline, Natural Gas, CNG, LPG, Kerosene). Translate to English if in another language.",
  "fuelUsedQuantity": 0,
  "fuelUsedUnit": "Unit of measurement (Litre, kg, Metric ton, m3, kWh, MWh)",
  "facility": "Name of the facility, fleet, or location if mentioned",
  "dateOfTransaction": "Date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, total cost, vehicle plate number, odometer reading, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- fuelUsedQuantity must be a positive number (the volume/weight/energy of fuel purchased)
- fuelUsedUnit must be one of: Litre, kg, Metric ton, m3, kWh, MWh
- dateOfTransaction must be in DD/MM/YYYY format
- vehicleType should be one of: Car, Bus, 2 Wheeler if it can be determined; otherwise use a reasonable label
- If a field cannot be determined, use empty string for text fields and 0 for quantity
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (fuel, quantity, unit, date) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type MobileReceiptExtractionResult = {
  vehicleType: string;
  fuelUsed: string;
  fuelUsedQuantity: number;
  fuelUsedUnit: string;
  facility: string;
  dateOfTransaction: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractMobileReceiptData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<MobileReceiptExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI mobile receipt extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: source.data,
          },
        },
        { type: 'text' as const, text: MOBILE_EXTRACTION_PROMPT },
      ]
    : [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg',
            data: source.data,
          },
        },
        { type: 'text' as const, text: MOBILE_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: MobileReceiptExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  // Sanitize
  parsed.vehicleType = String(parsed.vehicleType ?? '').trim();
  parsed.fuelUsed = String(parsed.fuelUsed ?? '').trim();
  parsed.fuelUsedQuantity = Number(parsed.fuelUsedQuantity) || 0;
  parsed.fuelUsedUnit = String(parsed.fuelUsedUnit ?? '').trim();
  parsed.facility = String(parsed.facility ?? '').trim();
  parsed.dateOfTransaction = String(parsed.dateOfTransaction ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI mobile extraction complete: vehicleType=${parsed.vehicleType}, fuel=${parsed.fuelUsed}, qty=${parsed.fuelUsedQuantity} ${parsed.fuelUsedUnit}, confidence=${parsed.confidence}`);

  return parsed;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Process-Based Emissions — document extraction
 * ────────────────────────────────────────────────────────────────────────────── */

const PROCESS_EXTRACTION_PROMPT = `You are an expert at reading industrial process documents, invoices, production reports, and compliance filings for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 1 — Process-Based Emissions category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded document. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "facility": "Name of the facility, plant, or production site",
  "processSector": "One of: CEMENT, METALS, CHEMICALS, OIL_GAS, GLASS, OTHER",
  "processType": "One of: CLINKER_PRODUCTION, CEMENT_OTHER, STEEL_BF_BOF, STEEL_EAF, METALS_OTHER, AMMONIA, NITRIC_ACID, CHEMICALS_OTHER, REFINING, FLARING, VENTING, OIL_GAS_OTHER, GLASS_MELTING, GLASS_OTHER, OTHER_SPECIFY",
  "materialProduct": "Name of the material or product (e.g. Clinker, Steel, NH3, Crude oil, Glass). Translate to English if needed.",
  "activityValue": 0,
  "unit": "Unit of measurement (tonnes, kg, Metric ton)",
  "dateOfTransaction": "Date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, batch number, production line, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- processSector must be one of: CEMENT, METALS, CHEMICALS, OIL_GAS, GLASS, OTHER
- processType must match the sector (e.g. CEMENT sector → CLINKER_PRODUCTION or CEMENT_OTHER)
- activityValue must be a positive number representing mass/weight of material processed or produced
- unit must be one of: tonnes, kg, Metric ton
- dateOfTransaction must be in DD/MM/YYYY format
- If a field cannot be determined, use empty string for text fields and 0 for numeric fields
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (sector, type, quantity, unit, date) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type ProcessExtractionResult = {
  facility: string;
  processSector: string;
  processType: string;
  materialProduct: string;
  activityValue: number;
  unit: string;
  dateOfTransaction: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractProcessEmissionsData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<ProcessExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI process emissions extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: source.data,
          },
        },
        { type: 'text' as const, text: PROCESS_EXTRACTION_PROMPT },
      ]
    : [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg',
            data: source.data,
          },
        },
        { type: 'text' as const, text: PROCESS_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: ProcessExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  // Sanitize
  parsed.facility = String(parsed.facility ?? '').trim();
  parsed.processSector = String(parsed.processSector ?? '').trim();
  parsed.processType = String(parsed.processType ?? '').trim();
  parsed.materialProduct = String(parsed.materialProduct ?? '').trim();
  parsed.activityValue = Number(parsed.activityValue) || 0;
  parsed.unit = String(parsed.unit ?? '').trim();
  parsed.dateOfTransaction = String(parsed.dateOfTransaction ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI process extraction complete: sector=${parsed.processSector}, type=${parsed.processType}, qty=${parsed.activityValue} ${parsed.unit}, confidence=${parsed.confidence}`);

  return parsed;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Fugitive Emissions — document extraction
 * ────────────────────────────────────────────────────────────────────────────── */

const FUGITIVE_EXTRACTION_PROMPT = `You are an expert at reading equipment maintenance records, refrigerant logs, fire suppression system reports, and compliance documents for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 1 — Fugitive Emissions category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded document. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "equipmentType": "One of: AC, Chiller, Refrigerator, Heat Pump, Cold Storage, Fire Equipment, Switchgear, Transformer, Other",
  "refrigerantUsed": "Refrigerant type if applicable (e.g. HFC-134a, R-32, R-410A, R-404A, R-407C, R-507A, R-22, R-125). Empty string if not a refrigerant.",
  "fireSuppressantUsed": "Fire suppressant type if applicable (e.g. CO2, SF6, HFC-227ea, Novec-1230). Empty string if not a suppressant.",
  "netInventoryKg": 0,
  "facility": "Name of the facility or building if mentioned",
  "dateOfTransaction": "Date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (service report number, technician, serial number, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- equipmentType must be one of: AC, Chiller, Refrigerator, Heat Pump, Cold Storage, Fire Equipment, Switchgear, Transformer, Other
- Either refrigerantUsed or fireSuppressantUsed should be filled (not both). Use empty string for the one that does not apply.
- netInventoryKg must be a positive number representing the net amount of gas charged/leaked/lost in kilograms
- dateOfTransaction must be in DD/MM/YYYY format
- If a field cannot be determined, use empty string for text fields and 0 for numeric fields
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type FugitiveExtractionResult = {
  equipmentType: string;
  refrigerantUsed: string;
  fireSuppressantUsed: string;
  netInventoryKg: number;
  facility: string;
  dateOfTransaction: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractFugitiveEmissionsData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<FugitiveExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI fugitive emissions extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: source.data,
          },
        },
        { type: 'text' as const, text: FUGITIVE_EXTRACTION_PROMPT },
      ]
    : [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg',
            data: source.data,
          },
        },
        { type: 'text' as const, text: FUGITIVE_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: FugitiveExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  // Sanitize
  parsed.equipmentType = String(parsed.equipmentType ?? '').trim();
  parsed.refrigerantUsed = String(parsed.refrigerantUsed ?? '').trim();
  parsed.fireSuppressantUsed = String(parsed.fireSuppressantUsed ?? '').trim();
  parsed.netInventoryKg = Number(parsed.netInventoryKg) || 0;
  parsed.facility = String(parsed.facility ?? '').trim();
  parsed.dateOfTransaction = String(parsed.dateOfTransaction ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI fugitive extraction complete: equipment=${parsed.equipmentType}, refrigerant=${parsed.refrigerantUsed}, suppressant=${parsed.fireSuppressantUsed}, qty=${parsed.netInventoryKg}kg, confidence=${parsed.confidence}`);

  return parsed;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Purchased Electricity (Scope 2) — electricity bill / invoice extraction
 * ────────────────────────────────────────────────────────────────────────────── */

const PURCHASED_ELECTRICITY_EXTRACTION_PROMPT = `You are an expert at reading electricity bills, utility invoices, and energy consumption documents for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 2 — Purchased Electricity category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded electricity bill/invoice. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "activityType": "Activity based",
  "sourceType": "Grid electricity, renewable, or other source type if mentioned. Leave empty if not clear.",
  "consumption": 0,
  "consumptionUnit": "Unit of measurement (kWh, MWh, GJ)",
  "siteId": "Site ID, meter number, account number, or facility identifier if mentioned",
  "startDate": "Billing period start date in DD/MM/YYYY format",
  "endDate": "Billing period end date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, total cost, meter reading, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- consumption must be a positive number representing electricity consumed
- consumptionUnit must be one of: kWh, MWh, GJ
- startDate and endDate must be in DD/MM/YYYY format
- activityType should default to "Activity based" unless the document clearly indicates otherwise
- If a field cannot be determined, use empty string for text fields and 0 for consumption
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (consumption, unit, dates) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type PurchasedElectricityExtractionResult = {
  activityType: string;
  sourceType: string;
  consumption: number;
  consumptionUnit: string;
  siteId: string;
  startDate: string;
  endDate: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractPurchasedElectricityData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<PurchasedElectricityExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI purchased electricity extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: source.data,
          },
        },
        { type: 'text' as const, text: PURCHASED_ELECTRICITY_EXTRACTION_PROMPT },
      ]
    : [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg',
            data: source.data,
          },
        },
        { type: 'text' as const, text: PURCHASED_ELECTRICITY_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text response');
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: PurchasedElectricityExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  // Sanitize
  parsed.activityType = String(parsed.activityType ?? 'Activity based').trim();
  parsed.sourceType = String(parsed.sourceType ?? '').trim();
  parsed.consumption = Number(parsed.consumption) || 0;
  parsed.consumptionUnit = String(parsed.consumptionUnit ?? '').trim();
  parsed.siteId = String(parsed.siteId ?? '').trim();
  parsed.startDate = String(parsed.startDate ?? '').trim();
  parsed.endDate = String(parsed.endDate ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI purchased electricity extraction complete: consumption=${parsed.consumption} ${parsed.consumptionUnit}, site=${parsed.siteId}, confidence=${parsed.confidence}`);

  return parsed;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Purchased Heating (Scope 2) — heating bill / invoice extraction
 * ────────────────────────────────────────────────────────────────────────────── */

const PURCHASED_HEATING_EXTRACTION_PROMPT = `You are an expert at reading heating bills, district heating invoices, natural gas bills, and energy consumption documents for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 2 — Purchased Heating category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded heating bill/invoice. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "activityType": "Activity based",
  "sourceType": "District heating, natural gas heating, or other source type if mentioned. Leave empty if not clear.",
  "consumption": 0,
  "consumptionUnit": "Unit of measurement (kWh, MWh, GJ)",
  "siteId": "Site ID, meter number, account number, or facility identifier if mentioned",
  "startDate": "Billing period start date in DD/MM/YYYY format",
  "endDate": "Billing period end date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, total cost, meter reading, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- consumption must be a positive number representing heating energy consumed
- consumptionUnit must be one of: kWh, MWh, GJ
- startDate and endDate must be in DD/MM/YYYY format
- activityType should default to "Activity based" unless the document clearly indicates otherwise
- If a field cannot be determined, use empty string for text fields and 0 for consumption
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (consumption, unit, dates) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type PurchasedHeatingExtractionResult = {
  activityType: string;
  sourceType: string;
  consumption: number;
  consumptionUnit: string;
  siteId: string;
  startDate: string;
  endDate: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractPurchasedHeatingData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<PurchasedHeatingExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI purchased heating extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: source.data } },
        { type: 'text' as const, text: PURCHASED_HEATING_EXTRACTION_PROMPT },
      ]
    : [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg', data: source.data } },
        { type: 'text' as const, text: PURCHASED_HEATING_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude returned no text response');

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  let parsed: PurchasedHeatingExtractionResult;
  try { parsed = JSON.parse(raw); } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  parsed.activityType = String(parsed.activityType ?? 'Activity based').trim();
  parsed.sourceType = String(parsed.sourceType ?? '').trim();
  parsed.consumption = Number(parsed.consumption) || 0;
  parsed.consumptionUnit = String(parsed.consumptionUnit ?? '').trim();
  parsed.siteId = String(parsed.siteId ?? '').trim();
  parsed.startDate = String(parsed.startDate ?? '').trim();
  parsed.endDate = String(parsed.endDate ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI purchased heating extraction complete: consumption=${parsed.consumption} ${parsed.consumptionUnit}, site=${parsed.siteId}, confidence=${parsed.confidence}`);

  return parsed;
}

/* ══════════════════════════════════════════════════════════════════════════════
 * Purchased Cooling — AI extraction
 * ══════════════════════════════════════════════════════════════════════════════ */

const PURCHASED_COOLING_EXTRACTION_PROMPT = `You are an expert at reading cooling bills, district cooling invoices, chilled water bills, and energy consumption documents for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 2 — Purchased Cooling category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded cooling bill/invoice. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "activityType": "Activity based",
  "sourceType": "District cooling, chilled water, or other source type if mentioned. Leave empty if not clear.",
  "consumption": 0,
  "consumptionUnit": "Unit of measurement (kWh, MWh, GJ)",
  "siteId": "Site ID, meter number, account number, or facility identifier if mentioned",
  "startDate": "Billing period start date in DD/MM/YYYY format",
  "endDate": "Billing period end date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, total cost, meter reading, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- consumption must be a positive number representing cooling energy consumed
- consumptionUnit must be one of: kWh, MWh, GJ
- startDate and endDate must be in DD/MM/YYYY format
- activityType should default to "Activity based" unless the document clearly indicates otherwise
- If a field cannot be determined, use empty string for text fields and 0 for consumption
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (consumption, unit, dates) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type PurchasedCoolingExtractionResult = {
  activityType: string;
  sourceType: string;
  consumption: number;
  consumptionUnit: string;
  siteId: string;
  startDate: string;
  endDate: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractPurchasedCoolingData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<PurchasedCoolingExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI purchased cooling extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: source.data } },
        { type: 'text' as const, text: PURCHASED_COOLING_EXTRACTION_PROMPT },
      ]
    : [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg', data: source.data } },
        { type: 'text' as const, text: PURCHASED_COOLING_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude returned no text response');

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  let parsed: PurchasedCoolingExtractionResult;
  try { parsed = JSON.parse(raw); } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  parsed.activityType = String(parsed.activityType ?? 'Activity based').trim();
  parsed.sourceType = String(parsed.sourceType ?? '').trim();
  parsed.consumption = Number(parsed.consumption) || 0;
  parsed.consumptionUnit = String(parsed.consumptionUnit ?? '').trim();
  parsed.siteId = String(parsed.siteId ?? '').trim();
  parsed.startDate = String(parsed.startDate ?? '').trim();
  parsed.endDate = String(parsed.endDate ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI purchased cooling extraction complete: consumption=${parsed.consumption} ${parsed.consumptionUnit}, site=${parsed.siteId}, confidence=${parsed.confidence}`);

  return parsed;
}

/* ══════════════════════════════════════════════════════════════════════════════
 * Purchased Steaming — AI extraction
 * ══════════════════════════════════════════════════════════════════════════════ */

const PURCHASED_STEAMING_EXTRACTION_PROMPT = `You are an expert at reading steam bills, district steam invoices, and energy consumption documents for GHG (Greenhouse Gas) emissions reporting under the GHG Protocol Scope 2 — Purchased Steam category.

The document may be in Arabic, English, or any other language. Extract the data regardless of language.

Extract the following fields from the uploaded steam bill/invoice. Return ONLY a valid JSON object (no markdown, no explanation) with these keys:

{
  "activityType": "Activity based",
  "sourceType": "District steam, industrial steam, or other source type if mentioned. Leave empty if not clear.",
  "consumption": 0,
  "consumptionUnit": "Unit of measurement (kWh, MWh, GJ)",
  "siteId": "Site ID, meter number, account number, or facility identifier if mentioned",
  "startDate": "Billing period start date in DD/MM/YYYY format",
  "endDate": "Billing period end date in DD/MM/YYYY format",
  "notes": "Any additional relevant information (invoice number, supplier name, total cost, meter reading, etc.)",
  "confidence": "high | medium | low"
}

Rules:
- consumption must be a positive number representing steam energy consumed
- consumptionUnit must be one of: kWh, MWh, GJ
- startDate and endDate must be in DD/MM/YYYY format
- activityType should default to "Activity based" unless the document clearly indicates otherwise
- If a field cannot be determined, use empty string for text fields and 0 for consumption
- Translate any Arabic/non-English text to English for the field values
- Set confidence to "high" if all key fields (consumption, unit, dates) are clearly readable, "medium" if some are inferred, "low" if guessing
- Return ONLY the JSON object, nothing else`;

export type PurchasedSteamingExtractionResult = {
  activityType: string;
  sourceType: string;
  consumption: number;
  consumptionUnit: string;
  siteId: string;
  startDate: string;
  endDate: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function extractPurchasedSteamingData(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<PurchasedSteamingExtractionResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your .env file.');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const source = bufferToBase64MediaType(fileBuffer, mimeType);

  logger.info(`AI purchased steaming extraction starting for "${originalName}" (${mimeType}, ${(fileBuffer.length / 1024).toFixed(0)} KB)`);

  const isPdf = mimeType === 'application/pdf';

  const contentBlock: Anthropic.Messages.ContentBlockParam[] = isPdf
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: source.data } },
        { type: 'text' as const, text: PURCHASED_STEAMING_EXTRACTION_PROMPT },
      ]
    : [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: (source.media_type === 'application/pdf' ? 'image/jpeg' : source.media_type) as 'image/jpeg', data: source.data } },
        { type: 'text' as const, text: PURCHASED_STEAMING_EXTRACTION_PROMPT },
      ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    messages: [{ role: 'user', content: contentBlock }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude returned no text response');

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  let parsed: PurchasedSteamingExtractionResult;
  try { parsed = JSON.parse(raw); } catch {
    logger.error('Claude returned invalid JSON:', raw.slice(0, 500));
    throw new Error('AI returned invalid JSON. Please try again or use manual entry.');
  }

  parsed.activityType = String(parsed.activityType ?? 'Activity based').trim();
  parsed.sourceType = String(parsed.sourceType ?? '').trim();
  parsed.consumption = Number(parsed.consumption) || 0;
  parsed.consumptionUnit = String(parsed.consumptionUnit ?? '').trim();
  parsed.siteId = String(parsed.siteId ?? '').trim();
  parsed.startDate = String(parsed.startDate ?? '').trim();
  parsed.endDate = String(parsed.endDate ?? '').trim();
  parsed.notes = String(parsed.notes ?? '').trim();
  parsed.confidence = (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low') as 'high' | 'medium' | 'low';

  logger.info(`AI purchased steaming extraction complete: consumption=${parsed.consumption} ${parsed.consumptionUnit}, site=${parsed.siteId}, confidence=${parsed.confidence}`);

  return parsed;
}
