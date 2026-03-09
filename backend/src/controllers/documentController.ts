/**
 * Document controller: upload and process receipts.
 * Receipt reading is done via Anthropic (Claude) API, not Affinda.
 */
import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/helpers.js';
import {
  createDocument,
  getDocumentById,
  getUserDocuments,
  deleteDocument,
  updateDocumentStatus,
  updateDocumentOCR,
} from '../services/documentService.js';
import { extractReceiptToClimatiqJson } from '../services/anthropicService.js';
import { calculateEmissions } from '../services/climatiqService.js';
import { createEmission } from '../services/emissionService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
import { logger } from '../utils/logger.js';
import { DocumentType, EmissionScope, EmissionCategory } from '@prisma/client';

// ─── Enum normalisation helpers ───────────────────────────────────────────────
// Claude / Excel may return scope/category in many formats (mixed case, spaces, etc.).
// Normalise to the exact Prisma enum values before hitting the database.

const SCOPE_MAP: Record<string, EmissionScope> = {
  SCOPE_1: 'SCOPE_1', SCOPE1: 'SCOPE_1', 'SCOPE 1': 'SCOPE_1', '1': 'SCOPE_1',
  SCOPE_2: 'SCOPE_2', SCOPE2: 'SCOPE_2', 'SCOPE 2': 'SCOPE_2', '2': 'SCOPE_2',
  SCOPE_3: 'SCOPE_3', SCOPE3: 'SCOPE_3', 'SCOPE 3': 'SCOPE_3', '3': 'SCOPE_3',
};

function normalizeScope(val: unknown, fallback: EmissionScope = 'SCOPE_1'): EmissionScope {
  if (!val) return fallback;
  const key = String(val).trim().toUpperCase().replace(/\s+/g, ' ');
  return SCOPE_MAP[key] ?? SCOPE_MAP[key.replace(/ /g, '_')] ?? fallback;
}

const CATEGORY_MAP: Record<string, EmissionCategory> = {
  ELECTRICITY: 'ELECTRICITY', ELECTRIC: 'ELECTRICITY', POWER: 'ELECTRICITY', 'PURCHASED ELECTRICITY': 'ELECTRICITY',
  FUEL_COMBUSTION: 'FUEL_COMBUSTION', FUEL: 'FUEL_COMBUSTION', 'FUEL COMBUSTION': 'FUEL_COMBUSTION',
  COMBUSTION: 'FUEL_COMBUSTION', DIESEL: 'FUEL_COMBUSTION', PETROL: 'FUEL_COMBUSTION',
  GASOLINE: 'FUEL_COMBUSTION', NATURAL_GAS: 'NATURAL_GAS', 'NATURAL GAS': 'NATURAL_GAS',
  TRANSPORT: 'TRANSPORTATION', TRANSPORTATION: 'TRANSPORTATION', TRAVEL: 'TRANSPORTATION',
  WASTE: 'WASTE', WATER: 'WATER', REFRIGERANTS: 'REFRIGERANTS',
  BUSINESS_TRAVEL: 'BUSINESS_TRAVEL', EMPLOYEE_COMMUTING: 'EMPLOYEE_COMMUTING', PURCHASED_GOODS: 'PURCHASED_GOODS',
  PROCESS: 'OTHER', PROCESS_EMISSIONS: 'OTHER',
  OTHER: 'OTHER',
};

function normalizeCategory(val: unknown, activityType: string, fallback: EmissionCategory = 'FUEL_COMBUSTION'): EmissionCategory {
  if (val) {
    const key = String(val).trim().toUpperCase().replace(/\s+/g, ' ');
    const mapped = CATEGORY_MAP[key] ?? CATEGORY_MAP[key.replace(/ /g, '_')];
    if (mapped) return mapped;
  }
  // Infer from activityType when category is missing/unrecognised
  const at = activityType.toLowerCase();
  if (at.includes('electric') || at.includes('power') || at === 'electricity') return 'ELECTRICITY';
  if (['diesel','petrol','gasoline','natural_gas','natural-gas','lpg','kerosene','fuel'].some((k) => at.includes(k))) return 'FUEL_COMBUSTION';
  if (['vehicle','car','truck','flight','taxi','bus','ship','transport'].some((k) => at.includes(k))) return 'TRANSPORTATION';
  if (at.includes('waste')) return 'WASTE';
  if (at.includes('water')) return 'WATER';
  if (at.includes('refriger')) return 'REFRIGERANTS';
  return fallback;
}

/**
 * Upload a document
 * POST /api/documents/upload
 */
export async function uploadDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const { documentType } = req.body;

    const document = await createDocument({
      userId: req.user.userId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.filename,
      documentType: documentType as DocumentType,
    });

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.DOCUMENT_UPLOADED,
      'document',
      document.id,
      { fileName: document.fileName, fileSize: document.fileSize },
      req
    );

    logger.info(`Document uploaded: ${document.id} by user ${req.user.userId}`);
    sendSuccess(res, document, 'Document uploaded successfully', 201);
  } catch (error) {
    logger.error('Document upload error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to upload document', 500);
    }
  }
}

/**
 * Upload multiple documents (receipts) in one request.
 * POST /api/documents/upload-multiple
 * Returns { data: documents[] }
 */
export async function uploadDocumentsMultiple(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      sendError(res, 'No files uploaded', 400);
      return;
    }

    const { documentType } = req.body;
    const documents = [];

    for (const file of files) {
      const document = await createDocument({
        userId: req.user.userId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: file.filename,
        documentType: (documentType as DocumentType) || 'FUEL_RECEIPT',
      });
      documents.push(document);
      await logUserAction(
        req.user.userId,
        AuditActions.DOCUMENT_UPLOADED,
        'document',
        document.id,
        { fileName: document.fileName, fileSize: document.fileSize },
        req
      );
    }

    logger.info(`${documents.length} documents uploaded by user ${req.user.userId}`);
    sendSuccess(res, documents, `${documents.length} document(s) uploaded`, 201);
  } catch (error) {
    logger.error('Upload multiple documents error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to upload document', 500);
    }
  }
}

/**
 * Get user's documents
 * GET /api/documents
 */
export async function getDocuments(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const filters = {
      status: req.query.status as string,
      documentType: req.query.documentType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const { documents, pagination } = await getUserDocuments(
      req.user.userId,
      filters,
      req.query as { page?: string; limit?: string }
    );

    sendPaginated(res, documents, pagination);
  } catch (error) {
    logger.error('Get documents error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get documents', 500);
    }
  }
}

/**
 * Get single document
 * GET /api/documents/:id
 */
export async function getDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Document ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    
    const document = await getDocumentById(id, req.user.userId, isAdmin);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.DOCUMENT_VIEWED,
      'document',
      document.id,
      {},
      req
    );

    sendSuccess(res, document);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      if (error.message.includes('access')) {
        sendError(res, error.message, 403);
        return;
      }
      logger.error('Get document error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get document', 500);
    }
  }
}

/**
 * Delete document
 * DELETE /api/documents/:id
 */
export async function removeDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Document ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    
    await deleteDocument(id, req.user.userId, isAdmin);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.DOCUMENT_DELETED,
      'document',
      id,
      {},
      req
    );

    sendSuccess(res, null, 'Document deleted successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      if (error.message.includes('access')) {
        sendError(res, error.message, 403);
        return;
      }
      logger.error('Delete document error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to delete document', 500);
    }
  }
}

/**
 * Process document: Claude extracts receipt data only. Result is shown to user for verification.
 * User then calls POST /documents/:id/submit to send to Climatiq and store.
 * POST /api/documents/:id/process
 */
export async function processDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Document ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    
    const document = await getDocumentById(id, req.user.userId, isAdmin);

    if (document.status === 'PROCESSING') {
      sendError(res, 'Document is already being processed', 400);
      return;
    }

    if (document.status === 'COMPLETED') {
      sendError(res, 'Document has already been processed', 400);
      return;
    }

    await updateDocumentStatus(id, 'PROCESSING');

    try {
      const filePath = `${process.cwd()}/uploads/${document.filePath}`;

      logger.info(`Starting AI extraction for document ${id} (${document.fileName})`);
      const { rawText, extractedFields, processingTime, multiple } = await extractReceiptToClimatiqJson(filePath);

      const payload = multiple && Array.isArray(extractedFields)
        ? { entries: extractedFields }
        : (extractedFields as import('../types/index.js').ExtractedDocumentData);
      await updateDocumentOCR(id, { rawText, processingTime }, payload);

      const updatedDocument = await getDocumentById(id, req.user.userId, isAdmin);

      sendSuccess(res, {
        document: updatedDocument,
        extractedFields,
        multiple: multiple ?? false,
      }, 'Extraction complete. Verify the numbers and submit to calculate emissions.');

    } catch (processingError) {
      const errorMessage = processingError instanceof Error
        ? processingError.message
        : 'Processing failed';

      logger.error(`AI extraction failed for document ${id}:`, processingError);
      await updateDocumentStatus(id, 'FAILED', errorMessage).catch(() => {});

      // Return an appropriate HTTP status: 400 for user-fixable issues, 500 for server errors
      const isClientError = errorMessage.includes('not found')
        || errorMessage.includes('too large')
        || errorMessage.includes('Unsupported file type')
        || errorMessage.includes('no readable')
        || errorMessage.includes('re-upload');

      sendError(res, errorMessage, isClientError ? 400 : 500);
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) { sendError(res, error.message, 404); return; }
      if (error.message.includes('access'))    { sendError(res, error.message, 403); return; }
      logger.error('Process document error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to process document', 500);
    }
  }
}

/**
 * Submit verified extraction: send to Climatiq and store emission. Called after user verifies numbers.
 * POST /api/documents/:id/submit
 * Body (optional overrides): { activityType, activityAmount, activityUnit, region, scope?, category?, billingPeriodStart?, billingPeriodEnd? }
 */
export async function submitDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Document ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    const document = await getDocumentById(id, req.user.userId, isAdmin);

    if (document.status === 'COMPLETED') {
      sendError(res, 'Document has already been submitted', 400);
      return;
    }

    const extracted = (document.extractedData as Record<string, unknown>) || {};
    const body = req.body || {};

    const activityType = (body.activityType ?? extracted.activityType) as string;
    const activityAmount = Number(body.activityAmount ?? extracted.activityAmount);
    const activityUnit = (body.activityUnit ?? extracted.activityUnit) as string;
    const region = (body.region ?? extracted.region ?? 'AE') as string;

    if (!activityType || Number.isNaN(activityAmount) || !activityUnit) {
      sendError(res, 'Missing or invalid activityType, activityAmount, or activityUnit', 400);
      return;
    }

    const climatiqResult = await calculateEmissions({
      activityType,
      activityAmount,
      activityUnit,
      region,
    });

    const defaultScope: EmissionScope = document.documentType === 'FUEL_RECEIPT' ? 'SCOPE_1' : 'SCOPE_2';
    const scope = normalizeScope(body.scope ?? extracted.scope, defaultScope);
    const category = normalizeCategory(body.category ?? extracted.category, activityType, document.documentType === 'FUEL_RECEIPT' ? 'FUEL_COMBUSTION' : 'ELECTRICITY');

    const emission = await createEmission(
      {
        userId: req.user.userId,
        documentId: id,
        scope,
        category,
        activityType,
        activityAmount,
        activityUnit,
        region,
        billingPeriodStart: (body.billingPeriodStart ?? body.documentDate ?? extracted.billingPeriodStart ?? extracted.documentDate) ? new Date(String(body.billingPeriodStart ?? body.documentDate ?? extracted.billingPeriodStart ?? extracted.documentDate)) : undefined,
        billingPeriodEnd: (body.billingPeriodEnd ?? extracted.billingPeriodEnd) ? new Date(String(body.billingPeriodEnd ?? extracted.billingPeriodEnd)) : undefined,
      },
      climatiqResult
    );

    await updateDocumentStatus(id, 'COMPLETED');

    await logUserAction(
      req.user.userId,
      AuditActions.DOCUMENT_PROCESSED,
      'document',
      id,
      { emissionId: emission.id, co2e: emission.co2e },
      req
    );

    const updatedDocument = await getDocumentById(id, req.user.userId, isAdmin);

    sendSuccess(res, {
      document: updatedDocument,
      emission,
    }, 'Emission calculated and saved.');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      if (error.message.includes('access')) {
        sendError(res, error.message, 403);
        return;
      }
      logger.error('Submit document error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to submit document', 500);
    }
  }
}

/**
 * Submit multiple entries (e.g. from multi-row Excel). Creates one emission per entry.
 * POST /api/documents/:id/submit-batch
 * Body: { entries: Array<{ activityType, activityAmount, activityUnit, region?, scope?, category?, documentDate?, ... }> }
 */
export async function submitDocumentBatch(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string') {
      sendError(res, 'Document ID required', 400);
      return;
    }
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    const document = await getDocumentById(id, req.user.userId, isAdmin);

    const extracted = (document.extractedData as { entries?: Record<string, unknown>[] } | null) || {};
    if (!Array.isArray(extracted.entries) || extracted.entries.length === 0) {
      sendError(res, 'Document does not have multiple entries. Use POST /documents/:id/submit for single entry.', 400);
      return;
    }

    const bodyEntries = Array.isArray(req.body?.entries) ? req.body.entries : extracted.entries;
    const emissions = [];
    const skipped: Array<{ row: number; reason: string }> = [];
    const defaultScope: EmissionScope = document.documentType === 'FUEL_RECEIPT' ? 'SCOPE_1' : 'SCOPE_2';
    const defaultCategory: EmissionCategory = document.documentType === 'FUEL_RECEIPT' ? 'FUEL_COMBUSTION' : 'ELECTRICITY';

    for (let i = 0; i < bodyEntries.length; i++) {
      const row = bodyEntries[i] as Record<string, unknown>;
      // Use stored extracted entry as fallback (body may omit unchanged fields)
      const def = (extracted.entries[i] as Record<string, unknown>) ?? {};

      const activityType = String(row.activityType ?? def.activityType ?? '').trim().toLowerCase();
      const activityAmount = Number(row.activityAmount ?? def.activityAmount);
      const activityUnit = String(row.activityUnit ?? def.activityUnit ?? '').trim();
      const region = String(row.region ?? def.region ?? 'AE').trim() || 'AE';

      // Skip rows that are fundamentally unusable — don't abort the whole batch
      if (!activityType || Number.isNaN(activityAmount) || activityAmount <= 0 || !activityUnit) {
        const reason = `missing activityType, invalid/zero amount, or missing unit`;
        logger.warn(`Batch submit row ${i + 1} skipped: ${reason}`, { activityType, activityAmount, activityUnit });
        skipped.push({ row: i + 1, reason });
        continue;
      }

      try {
        const climatiqResult = await calculateEmissions({ activityType, activityAmount, activityUnit, region });

        // Normalise scope and category — handles 'Scope 1', 'scope_1', 'SCOPE1' etc.
        const scope = normalizeScope(row.scope ?? def.scope, defaultScope);
        const category = normalizeCategory(row.category ?? def.category, activityType, defaultCategory);

        const rawDate = row.documentDate ?? row.billingPeriodStart ?? def.documentDate ?? def.billingPeriodStart;
        const rawEnd = row.billingPeriodEnd ?? def.billingPeriodEnd;

        const parsedStart = rawDate ? (() => { const d = new Date(String(rawDate)); return isNaN(d.getTime()) ? undefined : d; })() : undefined;
        const parsedEnd   = rawEnd  ? (() => { const d = new Date(String(rawEnd));  return isNaN(d.getTime()) ? undefined : d; })() : undefined;

        const emission = await createEmission(
          {
            userId: req.user!.userId,
            documentId: id,
            scope,
            category,
            activityType,
            activityAmount,
            activityUnit,
            region,
            billingPeriodStart: parsedStart,
            billingPeriodEnd: parsedEnd,
          },
          climatiqResult
        );
        emissions.push(emission);
      } catch (rowErr) {
        const reason = rowErr instanceof Error ? rowErr.message : 'Unknown error';
        logger.error(`Batch submit row ${i + 1} failed: ${reason}`, { activityType, activityAmount, activityUnit });
        skipped.push({ row: i + 1, reason });
        // Continue processing remaining rows — partial success is better than total failure
      }
    }

    if (emissions.length === 0) {
      sendError(res, `No entries could be saved. ${skipped.length} row(s) skipped. Check that activityType, activityAmount, and activityUnit are valid.`, 400);
      return;
    }

    await updateDocumentStatus(id, 'COMPLETED');

    await logUserAction(
      req.user.userId,
      AuditActions.DOCUMENT_PROCESSED,
      'document',
      id,
      { count: emissions.length, emissionIds: emissions.map((e) => e.id) },
      req
    );

    const updatedDocument = await getDocumentById(id, req.user.userId, isAdmin);

    const msg = skipped.length > 0
      ? `${emissions.length} emission(s) saved. ${skipped.length} row(s) skipped (see skipped array).`
      : `${emissions.length} emission(s) calculated and saved.`;

    sendSuccess(res, {
      document: updatedDocument,
      emissions,
      ...(skipped.length > 0 && { skipped }),
    }, msg);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      if (error.message.includes('access')) {
        sendError(res, error.message, 403);
        return;
      }
      logger.error('Submit batch document error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to submit batch', 500);
    }
  }
}
