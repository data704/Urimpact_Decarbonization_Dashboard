import fs from 'fs/promises';
import { Response } from 'express';
import type { Express } from 'express';
import { EmissionScope } from '@prisma/client';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/helpers.js';
import {
  validate,
  getGhgCategoryFormBodySchema,
  stationaryCombustionTemplateFormSchema,
  stationaryBulkConfirmBodySchema,
} from '../utils/validators.js';
import type { GhgCategoryFormBody } from '../utils/validators.js';
import {
  listGhgCategoryEntries,
  submitGhgCategoryFormEntry,
  getStationaryCombustionLookupOptions as resolveStationaryCombustionLookupOptions,
} from '../services/ghgActivityService.js';
import {
  STATIONARY_COMBUSTION_TEMPLATE_XLSX_PATH,
  mapStationaryTemplateToGhgBody,
} from '../constants/ghgStationaryCombustionTemplate.js';
import {
  parseStationaryCombustionBulkFile,
  buildStationaryBulkPreview,
} from '../services/ghgStationaryCombustionBulkService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
import { extractReceiptData } from '../services/receiptExtractionService.js';
import { logger } from '../utils/logger.js';
import { canAccessDashboard, canUpload } from '../utils/rolePermissions.js';

export async function postScope1CategoryForm(req: AuthRequest, res: Response): Promise<void> {
  await postGhgCategoryForm(req, res, 'SCOPE_1');
}

export async function postScope2CategoryForm(req: AuthRequest, res: Response): Promise<void> {
  await postGhgCategoryForm(req, res, 'SCOPE_2');
}

async function postGhgCategoryForm(req: AuthRequest, res: Response, scope: EmissionScope): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const slug = req.params.categorySlug;
    if (typeof slug !== 'string' || !slug.length) {
      sendError(res, 'Category slug is required', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    let channel: string;

    if (slug === 'stationary-combustion') {
      const validation = validate(stationaryCombustionTemplateFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapStationaryTemplateToGhgBody(
          {
            asset: validation.data!.asset ?? '',
            fuelUsed: validation.data!.fuelUsed ?? '',
            fuelUsedQuantity: validation.data!.fuelUsedQuantity!,
            fuelUsedUnit: validation.data!.fuelUsedUnit ?? '',
            facility: validation.data!.facility ?? '',
            dateOfTransaction: validation.data!.dateOfTransaction,
            notes: validation.data!.notes,
          },
          validation.data!.dataEntryChannel ?? 'FORM'
        ) as GhgCategoryFormBody;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sendError(res, msg, 400);
        return;
      }
      channel = validation.data!.dataEntryChannel ?? 'FORM';
    } else {
      const validation = validate(getGhgCategoryFormBodySchema(slug), req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      body = validation.data! as GhgCategoryFormBody;
      channel = validation.data!.dataEntryChannel ?? 'FORM';
    }

    const emission = await submitGhgCategoryFormEntry({
      userId: req.user.userId,
      organizationId: req.user.organizationId,
      scope,
      categorySlug: slug,
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: slug,
        scope,
        channel,
      },
      req
    );

    sendSuccess(res, emission, 'GHG activity saved', 201);
  } catch (error) {
    logger.error('GHG form submit error:', error);
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Unknown') || msg.includes('mapped')) {
        sendError(res, msg, 400);
        return;
      }
      if (msg.includes('Organization is required')) {
        sendError(res, msg, 403);
        return;
      }
      sendError(res, msg, 500);
    } else {
      sendError(res, 'Failed to save GHG activity', 500);
    }
  }
}

export async function getScope1CategoryEntries(req: AuthRequest, res: Response): Promise<void> {
  await getGhgCategoryEntries(req, res, 'SCOPE_1');
}

export async function getScope2CategoryEntries(req: AuthRequest, res: Response): Promise<void> {
  await getGhgCategoryEntries(req, res, 'SCOPE_2');
}

async function getGhgCategoryEntries(req: AuthRequest, res: Response, scope: EmissionScope): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canAccessDashboard(req.user.role) && !canUpload(req.user.role)) {
      sendError(res, 'Your role cannot access GHG entries', 403);
      return;
    }

    const slug = req.params.categorySlug;
    if (typeof slug !== 'string' || !slug.length) {
      sendError(res, 'Category slug is required', 400);
      return;
    }

    const orgWide = canAccessDashboard(req.user.role);

    const { entries, pagination } = await listGhgCategoryEntries({
      organizationId: req.user.organizationId,
      userId: req.user.userId,
      orgWide,
      scope,
      categorySlug: slug,
      query: req.query as { page?: string; limit?: string; startDate?: string; endDate?: string },
    });

    sendPaginated(res, entries, pagination);
  } catch (error) {
    logger.error('GHG list error:', error);
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Unknown')) {
        sendError(res, msg, 400);
        return;
      }
      if (msg.includes('Organization is required')) {
        sendError(res, msg, 403);
        return;
      }
      sendError(res, msg, 500);
    } else {
      sendError(res, 'Failed to list GHG entries', 500);
    }
  }
}

/** Official Scope 1 workbook (Stationary Combustion sheet) for download. */
export async function getStationaryCombustionTemplate(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const buf = await fs.readFile(STATIONARY_COMBUSTION_TEMPLATE_XLSX_PATH);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="stationary-combustion-template.xlsx"'
    );
    res.status(200).send(buf);
  } catch (error) {
    logger.error('Stationary template read failed:', error);
    sendError(
      res,
      'Template file is missing on the server. Add backend/fixtures/stationary-combustion-template.xlsx.',
      503
    );
  }
}

/** Facility & asset name suggestions for stationary combustion (onboarding registry + past rows). */
export async function getStationaryCombustionLookupOptions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canAccessDashboard(req.user.role) && !canUpload(req.user.role)) {
      sendError(res, 'Your role cannot access GHG data', 403);
      return;
    }

    const options = await resolveStationaryCombustionLookupOptions(req.user.organizationId);
    sendSuccess(res, options, 'Lookup options', 200);
  } catch (error) {
    logger.error('Stationary lookup options error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to load lookup options', 500);
    }
  }
}

type ReqWithFile = AuthRequest & { file?: Express.Multer.File };

/** Parse file and return row-level validation + mapped preview (no DB / Climatiq). */
export async function postStationaryCombustionBulkPreview(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const file = (req as ReqWithFile).file;
    if (!file?.buffer) {
      sendError(res, 'File is required (field name: file)', 400);
      return;
    }

    let parsed;
    try {
      parsed = parseStationaryCombustionBulkFile(file.buffer, file.originalname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      sendError(res, msg, 400);
      return;
    }

    const rows = buildStationaryBulkPreview(parsed);
    const validCount = rows.filter((r) => r.status === 'valid').length;
    const invalidCount = rows.filter((r) => r.status === 'invalid').length;

    sendSuccess(
      res,
      {
        rows,
        summary: { total: rows.length, validCount, invalidCount },
      },
      'Preview ready',
      200
    );
  } catch (error) {
    logger.error('Stationary bulk preview error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Preview failed', 500);
    }
  }
}

/** Persist reviewed rows: each row is calculated (Climatiq) and stored for the organization. */
export async function postStationaryCombustionBulkConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const parsed = validate(stationaryBulkConfirmBodySchema, req.body);
    if (!parsed.success) {
      sendError(res, parsed.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const emissionIds: string[] = [];
    const rowErrors: string[] = [];

    for (const rawRow of parsed.data!.rows) {
      const excelRow = rawRow.excelRow;
      const label = excelRow != null ? `Row ${excelRow}` : 'Row';

      const v = validate(stationaryCombustionTemplateFormSchema, {
        asset: rawRow.asset,
        fuelUsed: rawRow.fuelUsed,
        fuelUsedQuantity: rawRow.fuelUsedQuantity,
        fuelUsedUnit: rawRow.fuelUsedUnit,
        facility: rawRow.facility,
        dateOfTransaction: rawRow.dateOfTransaction,
        notes: rawRow.notes,
        dataEntryChannel: 'BULK_UPLOAD',
      });
      if (!v.success) {
        rowErrors.push(`${label}: ${v.errors?.join('; ') ?? 'invalid'}`);
        continue;
      }

      let body: GhgCategoryFormBody;
      try {
        body = mapStationaryTemplateToGhgBody(
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
        ) as GhgCategoryFormBody;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        rowErrors.push(`${label}: ${msg}`);
        continue;
      }

      try {
        const emission = await submitGhgCategoryFormEntry({
          userId: req.user.userId,
          organizationId: req.user.organizationId,
          scope: 'SCOPE_1',
          categorySlug: 'stationary-combustion',
          body,
        });
        emissionIds.push(emission.id);
        await logUserAction(
          req.user.userId,
          AuditActions.EMISSION_CALCULATED,
          'emission',
          emission.id,
          {
            ghgCategorySlug: 'stationary-combustion',
            scope: 'SCOPE_1',
            channel: 'BULK_UPLOAD',
            bulkRow: excelRow,
          },
          req
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        rowErrors.push(`${label}: ${msg}`);
        logger.warn(`Stationary bulk confirm ${label} failed: ${msg}`);
      }
    }

    sendSuccess(
      res,
      {
        createdCount: emissionIds.length,
        emissionIds,
        failedCount: rowErrors.length,
        rowErrors,
      },
      emissionIds.length ? 'Bulk import completed' : 'No rows were imported',
      200
    );
  } catch (error) {
    logger.error('Stationary bulk confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Bulk import failed', 500);
    }
  }
}

/** AI receipt extraction — upload image/PDF, get structured stationary combustion data. */
export async function postStationaryCombustionAiExtract(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const file = (req as ReqWithFile).file;
    if (!file?.buffer) {
      sendError(res, 'File is required (field name: file). Accepted: PDF, JPG, PNG.', 400);
      return;
    }

    const extracted = await extractReceiptData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Receipt extracted', 200);
  } catch (error) {
    logger.error('AI receipt extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted data — validate, calculate via Climatiq, persist. */
export async function postStationaryCombustionAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(stationaryCombustionTemplateFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapStationaryTemplateToGhgBody(
        {
          asset: validation.data!.asset ?? '',
          fuelUsed: validation.data!.fuelUsed ?? '',
          fuelUsedQuantity: validation.data!.fuelUsedQuantity!,
          fuelUsedUnit: validation.data!.fuelUsedUnit ?? '',
          facility: validation.data!.facility ?? '',
          dateOfTransaction: validation.data!.dateOfTransaction,
          notes: validation.data!.notes,
        },
        'AI_EXTRACT'
      ) as GhgCategoryFormBody;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sendError(res, msg, 400);
      return;
    }

    const emission = await submitGhgCategoryFormEntry({
      userId: req.user.userId,
      organizationId: req.user.organizationId,
      scope: 'SCOPE_1',
      categorySlug: 'stationary-combustion',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'stationary-combustion',
        scope: 'SCOPE_1',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted emission saved', 201);
  } catch (error) {
    logger.error('AI confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI confirm failed', 500);
    }
  }
}
