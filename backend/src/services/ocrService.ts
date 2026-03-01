import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { config } from '../config/index.js';
import { OCRResult, ExtractedDocumentData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { getRegionFromProvider } from '../utils/helpers.js';

// Create Axios instance for Affinda API
const affindaApi = axios.create({
  baseURL: config.affinda.apiUrl,
  headers: {
    Authorization: `Bearer ${config.affinda.apiKey}`,
  },
  timeout: 60000, // 60 seconds for OCR
});

/**
 * Process document with Affinda OCR
 */
export async function processDocumentOCR(filePath: string): Promise<OCRResult> {
  const startTime = Date.now();

  // Check if API key is configured
  if (!config.affinda.apiKey) {
    logger.warn('Affinda API key not configured, using mock OCR');
    return getMockOCRResult(filePath);
  }

  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || 'document';

    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: getContentType(fileName),
    });

    // Upload document
    const response = await affindaApi.post('/documents', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    const documentId = response.data.data?.identifier;

    if (!documentId) {
      throw new AppError('Failed to upload document for OCR', 500);
    }

    // Wait for processing (poll status)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    let documentData = null;

    while (attempts < maxAttempts) {
      const statusResponse = await affindaApi.get(`/documents/${documentId}`);
      
      if (statusResponse.data.data?.rawText) {
        documentData = statusResponse.data.data;
        break;
      }

      await sleep(1000);
      attempts++;
    }

    if (!documentData) {
      throw new AppError('OCR processing timeout', 500);
    }

    const processingTime = Date.now() - startTime;

    // Extract structured data
    const extractedFields = extractFieldsFromText(documentData.rawText);

    logger.info(`OCR completed in ${processingTime}ms`);

    return {
      rawText: documentData.rawText,
      confidence: 0.9, // Affinda doesn't always provide confidence
      extractedFields,
      processingTime,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Affinda API error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      throw new AppError(
        `OCR processing failed: ${error.response?.data?.message || error.message}`,
        500
      );
    }

    throw error;
  }
}

/**
 * Extract structured fields from OCR text
 */
function extractFieldsFromText(text: string): ExtractedDocumentData {
  const extracted: ExtractedDocumentData = {};

  // Detect provider
  const providerPatterns = [
    { pattern: /DEWA|Dubai Electricity/i, provider: 'DEWA' },
    { pattern: /ADWEA|Abu Dhabi Water/i, provider: 'ADWEA' },
    { pattern: /SEWA|Sharjah Electricity/i, provider: 'SEWA' },
    { pattern: /FEWA|Federal Electricity/i, provider: 'FEWA' },
    { pattern: /AADC|Abu Dhabi Distribution/i, provider: 'AADC' },
    { pattern: /ADDC/i, provider: 'ADDC' },
  ];

  for (const { pattern, provider } of providerPatterns) {
    if (pattern.test(text)) {
      extracted.provider = provider;
      extracted.region = getRegionFromProvider(provider);
      break;
    }
  }

  // Extract consumption (kWh)
  const consumptionPatterns = [
    /consumption[:\s]*([0-9,]+\.?\d*)\s*kWh/i,
    /total\s*(?:units|kwh)[:\s]*([0-9,]+\.?\d*)/i,
    /([0-9,]+\.?\d*)\s*kWh\s*(?:consumed|used)/i,
    /units[:\s]*([0-9,]+\.?\d*)/i,
  ];

  for (const pattern of consumptionPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined) {
      extracted.consumption = parseFloat(match[1].replace(/,/g, ''));
      extracted.consumptionUnit = 'kWh';
      break;
    }
  }

  // Extract amount/total
  const amountPatterns = [
    /total\s*(?:amount|due)[:\s]*(?:AED|Dhs?)?\s*([0-9,]+\.?\d*)/i,
    /(?:AED|Dhs?)\s*([0-9,]+\.?\d*)/i,
    /amount[:\s]*([0-9,]+\.?\d*)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined) {
      extracted.amount = parseFloat(match[1].replace(/,/g, ''));
      extracted.currency = 'AED';
      break;
    }
  }

  // Extract account number
  const accountPatterns = [
    /account\s*(?:no|number|#)?[:\s]*([A-Z0-9-]+)/i,
    /contract\s*(?:no|number)?[:\s]*([A-Z0-9-]+)/i,
    /premise\s*(?:no|number)?[:\s]*([A-Z0-9-]+)/i,
  ];

  for (const pattern of accountPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined) {
      extracted.accountNumber = match[1].trim();
      break;
    }
  }

  // Extract billing period
  const periodPatterns = [
    /(?:billing\s*period|period)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /from[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*to\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ];

  for (const pattern of periodPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      extracted.billingPeriodStart = match[1];
      extracted.billingPeriodEnd = match[2];
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /(?:bill\s*date|invoice\s*date|date)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined) {
      extracted.documentDate = match[1];
      break;
    }
  }

  // Extract fuel type (for fuel receipts)
  const fuelPatterns = [
    /fuel\s*type[:\s]*(diesel|petrol|gasoline|premium|super|special)/i,
    /(diesel|petrol|gasoline|unleaded|premium|super)\s*(?:fuel)?/i,
  ];

  for (const pattern of fuelPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined) {
      extracted.fuelType = match[1].toLowerCase();
      break;
    }
  }

  // Extract quantity (for fuel)
  const quantityPatterns = [
    /(?:qty|quantity|volume)[:\s]*([0-9,]+\.?\d*)\s*(L|liters?|litres?|gal|gallons?)/i,
    /([0-9,]+\.?\d*)\s*(L|liters?|litres?)\s*(?:of\s*fuel)?/i,
  ];

  for (const pattern of quantityPatterns) {
    const match = text.match(pattern);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      extracted.quantity = parseFloat(match[1].replace(/,/g, ''));
      extracted.quantityUnit = match[2].toLowerCase().startsWith('l') ? 'L' : 'gal';
      break;
    }
  }

  return extracted;
}

/**
 * Get content type from file name
 */
function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Mock OCR result for development without API key
 * Generates realistic dummy data based on document type
 */
function getMockOCRResult(filePath: string): OCRResult {
  const fileName = filePath.split(/[/\\]/).pop() || 'document';
  const fileNameLower = fileName.toLowerCase();
  
  // Determine document type from filename
  const isUtilityBill = /bill|dewa|sewa|fewa|adwea|electric|utility|power/i.test(fileNameLower);
  const isFuelReceipt = /fuel|gas|petrol|diesel|adnoc|enoc|emarat/i.test(fileNameLower);
  const isWaterBill = /water/i.test(fileNameLower);
  const isGasBill = /natural.*gas|lng/i.test(fileNameLower);

  // Generate realistic billing period
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const billingStart = lastMonth.toLocaleDateString('en-GB');
  const billingEnd = lastMonthEnd.toLocaleDateString('en-GB');

  let mockText = '';
  let extractedFields: ExtractedDocumentData = {};

  // Randomly select UAE utility provider for variety
  const providers = [
    { name: 'DEWA', region: 'AE-DU', fullName: 'Dubai Electricity and Water Authority' },
    { name: 'ADWEA', region: 'AE-AZ', fullName: 'Abu Dhabi Water and Electricity Authority' },
    { name: 'SEWA', region: 'AE-SH', fullName: 'Sharjah Electricity and Water Authority' },
    { name: 'FEWA', region: 'AE-FU', fullName: 'Federal Electricity and Water Authority' },
  ];

  if (isUtilityBill || (!isFuelReceipt && !isWaterBill && !isGasBill)) {
    // Electric utility bill (default)
    const provider = providers[Math.floor(Math.random() * providers.length)] ?? providers[0]!;
    const consumption = Math.floor(Math.random() * 45000) + 5000; // 5,000 - 50,000 kWh
    const rate = 0.28 + Math.random() * 0.15; // 0.28 - 0.43 AED/kWh
    const amount = consumption * rate;
    const accountNum = `${provider.name}-${now.getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`;
    
    mockText = `
      ${provider.name} - ${provider.fullName}
      
      TAX INVOICE / فاتورة ضريبية
      
      Account Number: ${accountNum}
      Premise Number: PRM-${Math.floor(Math.random() * 10000)}
      Meter Number: MTR-${Math.floor(Math.random() * 1000000)}
      
      Billing Period: ${billingStart} to ${billingEnd}
      Bill Date: ${now.toLocaleDateString('en-GB')}
      
      ELECTRICITY CONSUMPTION
      Previous Reading: ${Math.floor(Math.random() * 100000)}
      Current Reading: ${Math.floor(Math.random() * 100000) + consumption}
      Units Consumed: ${consumption.toLocaleString()} kWh
      
      Tariff: Residential
      Rate: AED ${rate.toFixed(3)}/kWh
      
      Electricity Charges: AED ${(consumption * rate).toFixed(2)}
      Fuel Surcharge: AED ${(consumption * 0.015).toFixed(2)}
      VAT (5%): AED ${(amount * 0.05).toFixed(2)}
      
      Total Amount Due: AED ${(amount * 1.05).toFixed(2)}
      
      Due Date: ${new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}
    `.trim();

    extractedFields = {
      provider: provider.name,
      region: provider.region,
      accountNumber: accountNum,
      consumption,
      consumptionUnit: 'kWh',
      amount: parseFloat((amount * 1.05).toFixed(2)),
      currency: 'AED',
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
      documentDate: now.toLocaleDateString('en-GB'),
    };
  } else if (isFuelReceipt) {
    // Fuel receipt
    const fuelTypes = ['diesel', 'petrol', 'premium'];
    const fuelType = fuelTypes[Math.floor(Math.random() * fuelTypes.length)] ?? 'petrol';
    const stations = ['ADNOC', 'ENOC', 'EMARAT', 'EPPCO'];
    const station = stations[Math.floor(Math.random() * stations.length)] ?? 'ADNOC';
    const quantity = Math.floor(Math.random() * 150) + 30; // 30 - 180 liters
    const prices: Record<string, number> = { diesel: 3.23, petrol: 2.99, premium: 3.15 };
    const pricePerLiter = (prices[fuelType] ?? 3) + (Math.random() * 0.2 - 0.1);
    const amount = quantity * pricePerLiter;
    
    mockText = `
      ${station} Service Station
      Station #${Math.floor(Math.random() * 500) + 100}
      
      Date: ${now.toLocaleDateString('en-GB')}
      Time: ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      
      Transaction #: TXN${Date.now()}
      Pump: ${Math.floor(Math.random() * 12) + 1}
      
      Fuel Type: ${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}
      Quantity: ${quantity.toFixed(2)} Liters
      Price/Liter: AED ${pricePerLiter.toFixed(3)}
      
      Subtotal: AED ${amount.toFixed(2)}
      VAT (5%): AED ${(amount * 0.05).toFixed(2)}
      
      TOTAL: AED ${(amount * 1.05).toFixed(2)}
      
      Payment: Credit Card ****1234
      
      Thank you for choosing ${station}!
    `.trim();

    extractedFields = {
      fuelType,
      quantity,
      quantityUnit: 'L',
      amount: parseFloat((amount * 1.05).toFixed(2)),
      currency: 'AED',
      documentDate: now.toLocaleDateString('en-GB'),
    };
  } else if (isWaterBill) {
    // Water bill
    const provider = providers[Math.floor(Math.random() * providers.length)] ?? providers[0]!;
    const consumption = Math.floor(Math.random() * 50) + 10; // 10 - 60 cubic meters
    const rate = 2.5 + Math.random() * 1.5; // 2.5 - 4.0 AED/m3
    const amount = consumption * rate;
    
    mockText = `
      ${provider.name} - ${provider.fullName}
      
      WATER BILL
      
      Account Number: WTR-${now.getFullYear()}-${Math.floor(Math.random() * 10000)}
      Billing Period: ${billingStart} to ${billingEnd}
      
      Water Consumption: ${consumption} m³
      Rate: AED ${rate.toFixed(2)}/m³
      
      Total Amount: AED ${amount.toFixed(2)}
    `.trim();

    extractedFields = {
      provider: provider.name,
      region: provider.region,
      consumption,
      consumptionUnit: 'm3',
      amount: parseFloat(amount.toFixed(2)),
      currency: 'AED',
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
    };
  } else if (isGasBill) {
    // Natural gas bill
    const consumption = Math.floor(Math.random() * 500) + 50; // 50 - 550 cubic meters
    const rate = 1.8 + Math.random() * 0.5;
    const amount = consumption * rate;
    
    mockText = `
      ADNOC Distribution
      
      NATURAL GAS BILL
      
      Account: GAS-${now.getFullYear()}-${Math.floor(Math.random() * 10000)}
      Period: ${billingStart} to ${billingEnd}
      
      Gas Consumption: ${consumption} m³
      Rate: AED ${rate.toFixed(2)}/m³
      
      Total: AED ${amount.toFixed(2)}
    `.trim();

    extractedFields = {
      provider: 'ADNOC',
      consumption,
      consumptionUnit: 'm3',
      amount: parseFloat(amount.toFixed(2)),
      currency: 'AED',
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
    };
  } else {
    // Generic document - still provide some useful mock data
    const consumption = Math.floor(Math.random() * 30000) + 5000;
    mockText = `
      Document processed successfully.
      
      Detected consumption data:
      Total Units: ${consumption.toLocaleString()} kWh
      Amount: AED ${(consumption * 0.35).toFixed(2)}
    `.trim();

    extractedFields = {
      consumption,
      consumptionUnit: 'kWh',
      amount: parseFloat((consumption * 0.35).toFixed(2)),
      currency: 'AED',
    };
  }

  logger.info(`Mock OCR generated for: ${fileName} (using dummy data - no API key configured)`);

  return {
    rawText: mockText,
    confidence: 0.92,
    extractedFields,
    processingTime: 800 + Math.random() * 400, // 800-1200ms simulated processing time
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
