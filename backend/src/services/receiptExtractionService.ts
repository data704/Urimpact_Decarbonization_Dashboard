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
