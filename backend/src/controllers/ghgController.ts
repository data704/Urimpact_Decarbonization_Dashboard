import fs from 'fs/promises';
import { Response } from 'express';
import type { Express } from 'express';
import * as XLSX from 'xlsx';
import { EmissionScope } from '@prisma/client';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/helpers.js';
import {
  validate,
  getGhgCategoryFormBodySchema,
  stationaryCombustionTemplateFormSchema,
  stationaryBulkConfirmBodySchema,
  mobileCombustionTemplateFormSchema,
  mobileBulkConfirmBodySchema,
  processEmissionsFormSchema,
  fugitiveEmissionsFormSchema,
  purchasedElectricityFormSchema,
  purchasedElectricityBulkConfirmBodySchema,
  purchasedHeatingFormSchema,
  purchasedHeatingBulkConfirmBodySchema,
  purchasedCoolingFormSchema,
  purchasedCoolingBulkConfirmBodySchema,
  purchasedSteamingFormSchema,
  purchasedSteamingBulkConfirmBodySchema,
} from '../utils/validators.js';
import type { GhgCategoryFormBody } from '../utils/validators.js';
import {
  listGhgCategoryEntries,
  submitGhgCategoryFormEntry,
  getStationaryCombustionLookupOptions as resolveStationaryCombustionLookupOptions,
  getMobileCombustionLookupOptions as resolveMobileCombustionLookupOptions,
} from '../services/ghgActivityService.js';
import {
  STATIONARY_COMBUSTION_TEMPLATE_XLSX_PATH,
  mapStationaryTemplateToGhgBody,
} from '../constants/ghgStationaryCombustionTemplate.js';
import {
  MOBILE_COMBUSTION_EXCEL_HEADERS,
  MOBILE_COMBUSTION_SHEET_NAME,
  mapMobileTemplateToGhgBody,
} from '../constants/ghgMobileCombustionTemplate.js';
import { mapProcessEmissionsToGhgBody } from '../constants/ghgProcessEmissionsTemplate.js';
import { mapFugitiveEmissionsToGhgBody } from '../constants/ghgFugitiveEmissionsTemplate.js';
import {
  PURCHASED_ELECTRICITY_EXCEL_HEADERS,
  PURCHASED_ELECTRICITY_SHEET_NAME,
  mapPurchasedElectricityToGhgBody,
} from '../constants/ghgPurchasedElectricityTemplate.js';
import {
  PURCHASED_HEATING_EXCEL_HEADERS,
  PURCHASED_HEATING_SHEET_NAME,
  mapPurchasedHeatingToGhgBody,
} from '../constants/ghgPurchasedHeatingTemplate.js';
import {
  PURCHASED_COOLING_EXCEL_HEADERS,
  PURCHASED_COOLING_SHEET_NAME,
  mapPurchasedCoolingToGhgBody,
} from '../constants/ghgPurchasedCoolingTemplate.js';
import {
  PURCHASED_STEAMING_EXCEL_HEADERS,
  PURCHASED_STEAMING_SHEET_NAME,
  mapPurchasedSteamingToGhgBody,
} from '../constants/ghgPurchasedSteamingTemplate.js';
import {
  parseStationaryCombustionBulkFile,
  buildStationaryBulkPreview,
} from '../services/ghgStationaryCombustionBulkService.js';
import {
  parseMobileCombustionBulkFile,
  buildMobileBulkPreview,
} from '../services/ghgMobileCombustionBulkService.js';
import {
  parsePurchasedElectricityBulkFile,
  buildPurchasedElectricityBulkPreview,
} from '../services/ghgPurchasedElectricityBulkService.js';
import {
  parsePurchasedHeatingBulkFile,
  buildPurchasedHeatingBulkPreview,
} from '../services/ghgPurchasedHeatingBulkService.js';
import {
  parsePurchasedCoolingBulkFile,
  buildPurchasedCoolingBulkPreview,
} from '../services/ghgPurchasedCoolingBulkService.js';
import {
  parsePurchasedSteamingBulkFile,
  buildPurchasedSteamingBulkPreview,
} from '../services/ghgPurchasedSteamingBulkService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
import { extractReceiptData, extractMobileReceiptData, extractProcessEmissionsData, extractFugitiveEmissionsData, extractPurchasedElectricityData, extractPurchasedHeatingData, extractPurchasedCoolingData, extractPurchasedSteamingData } from '../services/receiptExtractionService.js';
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
    } else if (slug === 'mobile-combustion') {
      const validation = validate(mobileCombustionTemplateFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapMobileTemplateToGhgBody(
          {
            vehicleType: validation.data!.vehicleType ?? '',
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
    } else if (slug === 'process-emissions') {
      const validation = validate(processEmissionsFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapProcessEmissionsToGhgBody(
          {
            facility: validation.data!.facility,
            processSector: validation.data!.processSector,
            processType: validation.data!.processType,
            materialProduct: validation.data!.materialProduct,
            activityValue: validation.data!.activityValue,
            unit: validation.data!.unit,
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
    } else if (slug === 'fugitive-emissions') {
      const validation = validate(fugitiveEmissionsFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapFugitiveEmissionsToGhgBody(
          {
            equipmentType: validation.data!.equipmentType,
            refrigerantUsed: validation.data!.refrigerantUsed ?? '',
            fireSuppressantUsed: validation.data!.fireSuppressantUsed ?? '',
            netInventoryKg: validation.data!.netInventoryKg,
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
    } else if (slug === 'purchased-electricity') {
      const validation = validate(purchasedElectricityFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapPurchasedElectricityToGhgBody(
          {
            activityType: validation.data!.activityType ?? '',
            sourceType: validation.data!.sourceType ?? '',
            consumption: validation.data!.consumption!,
            consumptionUnit: validation.data!.consumptionUnit ?? '',
            siteId: validation.data!.siteId ?? '',
            startDate: validation.data!.startDate,
            endDate: validation.data!.endDate,
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
    } else if (slug === 'purchased-steaming') {
      const validation = validate(purchasedSteamingFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapPurchasedSteamingToGhgBody(
          {
            activityType: validation.data!.activityType ?? '',
            sourceType: validation.data!.sourceType ?? '',
            consumption: validation.data!.consumption!,
            consumptionUnit: validation.data!.consumptionUnit ?? '',
            siteId: validation.data!.siteId ?? '',
            startDate: validation.data!.startDate,
            endDate: validation.data!.endDate,
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
    } else if (slug === 'purchased-cooling') {
      const validation = validate(purchasedCoolingFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapPurchasedCoolingToGhgBody(
          {
            activityType: validation.data!.activityType ?? '',
            sourceType: validation.data!.sourceType ?? '',
            consumption: validation.data!.consumption!,
            consumptionUnit: validation.data!.consumptionUnit ?? '',
            siteId: validation.data!.siteId ?? '',
            startDate: validation.data!.startDate,
            endDate: validation.data!.endDate,
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
    } else if (slug === 'purchased-heating') {
      const validation = validate(purchasedHeatingFormSchema, req.body);
      if (!validation.success) {
        sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
        return;
      }
      try {
        body = mapPurchasedHeatingToGhgBody(
          {
            activityType: validation.data!.activityType ?? '',
            sourceType: validation.data!.sourceType ?? '',
            consumption: validation.data!.consumption!,
            consumptionUnit: validation.data!.consumptionUnit ?? '',
            siteId: validation.data!.siteId ?? '',
            startDate: validation.data!.startDate,
            endDate: validation.data!.endDate,
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

/** Generated Scope 1 workbook (Mobile Combustion sheet) with example rows. */
export async function getMobileCombustionTemplate(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const aoa = [
      ['Fields Required for Calculation'],
      [...MOBILE_COMBUSTION_EXCEL_HEADERS],
      ['Car', 'CNG', 1.4, 'Metric ton', '149', '01/01/25'],
      ['Bus', 'Diesel', 15, 'Litre', '127', '15/02/25'],
      ['2 Wheeler', 'Petrol', 30, 'kg', '149', '19/04/25'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, MOBILE_COMBUSTION_SHEET_NAME);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="mobile-combustion-template.xlsx"');
    res.status(200).send(buf);
  } catch (error) {
    logger.error('Mobile template generation failed:', error);
    sendError(res, 'Could not generate mobile combustion template', 500);
  }
}

/** Facility & vehicle type suggestions for mobile combustion (onboarding registry + past rows). */
export async function getMobileCombustionLookupOptions(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canAccessDashboard(req.user.role) && !canUpload(req.user.role)) {
      sendError(res, 'Your role cannot access GHG data', 403);
      return;
    }

    const options = await resolveMobileCombustionLookupOptions(req.user.organizationId);
    sendSuccess(res, options, 'Lookup options', 200);
  } catch (error) {
    logger.error('Mobile lookup options error:', error);
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

/** Parse mobile combustion bulk file — preview only (no DB / Climatiq). */
export async function postMobileCombustionBulkPreview(req: AuthRequest, res: Response): Promise<void> {
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
      parsed = parseMobileCombustionBulkFile(file.buffer, file.originalname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      sendError(res, msg, 400);
      return;
    }

    const rows = buildMobileBulkPreview(parsed);
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
    logger.error('Mobile bulk preview error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Preview failed', 500);
    }
  }
}

/** Persist reviewed mobile combustion rows. */
export async function postMobileCombustionBulkConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const parsed = validate(mobileBulkConfirmBodySchema, req.body);
    if (!parsed.success) {
      sendError(res, parsed.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const emissionIds: string[] = [];
    const rowErrors: string[] = [];

    for (const rawRow of parsed.data!.rows) {
      const excelRow = rawRow.excelRow;
      const label = excelRow != null ? `Row ${excelRow}` : 'Row';

      const v = validate(mobileCombustionTemplateFormSchema, {
        vehicleType: rawRow.vehicleType,
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
        body = mapMobileTemplateToGhgBody(
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
          categorySlug: 'mobile-combustion',
          body,
        });
        emissionIds.push(emission.id);
        await logUserAction(
          req.user.userId,
          AuditActions.EMISSION_CALCULATED,
          'emission',
          emission.id,
          {
            ghgCategorySlug: 'mobile-combustion',
            scope: 'SCOPE_1',
            channel: 'BULK_UPLOAD',
            bulkRow: excelRow,
          },
          req
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        rowErrors.push(`${label}: ${msg}`);
        logger.warn(`Mobile bulk confirm ${label} failed: ${msg}`);
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
    logger.error('Mobile bulk confirm error:', error);
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

/** AI receipt extraction — upload image/PDF, get structured mobile combustion data. */
export async function postMobileCombustionAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractMobileReceiptData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Receipt extracted', 200);
  } catch (error) {
    logger.error('AI mobile receipt extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted mobile combustion data — validate, calculate via Climatiq, persist. */
export async function postMobileCombustionAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(mobileCombustionTemplateFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapMobileTemplateToGhgBody(
        {
          vehicleType: validation.data!.vehicleType ?? '',
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
      categorySlug: 'mobile-combustion',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'mobile-combustion',
        scope: 'SCOPE_1',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted emission saved', 201);
  } catch (error) {
    logger.error('AI mobile confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI mobile confirm failed', 500);
    }
  }
}

/** AI document extraction — upload image/PDF, get structured process emissions data. */
export async function postProcessEmissionsAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractProcessEmissionsData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Process emissions data extracted', 200);
  } catch (error) {
    logger.error('AI process emissions extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted process emissions data — validate, calculate via Climatiq, persist. */
export async function postProcessEmissionsAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(processEmissionsFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapProcessEmissionsToGhgBody(
        {
          facility: validation.data!.facility ?? '',
          processSector: validation.data!.processSector ?? '',
          processType: validation.data!.processType ?? '',
          materialProduct: validation.data!.materialProduct ?? '',
          activityValue: validation.data!.activityValue!,
          unit: validation.data!.unit ?? '',
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
      categorySlug: 'process-emissions',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'process-emissions',
        scope: 'SCOPE_1',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted process emission saved', 201);
  } catch (error) {
    logger.error('AI process confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI process confirm failed', 500);
    }
  }
}

/** AI document extraction — upload image/PDF, get structured fugitive emissions data. */
export async function postFugitiveEmissionsAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractFugitiveEmissionsData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Fugitive emissions data extracted', 200);
  } catch (error) {
    logger.error('AI fugitive emissions extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted fugitive emissions data — validate, calculate, persist. */
export async function postFugitiveEmissionsAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(fugitiveEmissionsFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapFugitiveEmissionsToGhgBody(
        {
          equipmentType: validation.data!.equipmentType,
          refrigerantUsed: validation.data!.refrigerantUsed ?? '',
          fireSuppressantUsed: validation.data!.fireSuppressantUsed ?? '',
          netInventoryKg: validation.data!.netInventoryKg,
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
      categorySlug: 'fugitive-emissions',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'fugitive-emissions',
        scope: 'SCOPE_1',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted fugitive emission saved', 201);
  } catch (error) {
    logger.error('AI fugitive confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI fugitive confirm failed', 500);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
 * SCOPE 2 — Purchased Electricity: template, bulk, AI
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Generated Scope 2 workbook (Purchased Electricity sheet) with example rows. */
export async function getPurchasedElectricityTemplate(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const aoa = [
      ['Fields Required for Calculation'],
      [...PURCHASED_ELECTRICITY_EXCEL_HEADERS],
      ['Activity based', '', 10, 'kWh', '149', '01/01/25', '01/02/25'],
      ['Activity based', '', 15, 'GJ', '127', '15/02/25', '15/03/25'],
      ['Activity based', '', 10, 'kWh', '149', '19/04/25', '19/05/25'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, PURCHASED_ELECTRICITY_SHEET_NAME);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="purchased-electricity-template.xlsx"');
    res.status(200).send(buf);
  } catch (error) {
    logger.error('Purchased electricity template generation failed:', error);
    sendError(res, 'Could not generate purchased electricity template', 500);
  }
}

/** Parse file and return row-level validation + mapped preview (no DB / Climatiq). */
export async function postPurchasedElectricityBulkPreview(req: AuthRequest, res: Response): Promise<void> {
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
      parsed = parsePurchasedElectricityBulkFile(file.buffer, file.originalname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      sendError(res, msg, 400);
      return;
    }

    const rows = buildPurchasedElectricityBulkPreview(parsed);
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
    logger.error('Purchased electricity bulk preview error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Preview failed', 500);
    }
  }
}

/** Persist reviewed purchased electricity rows. */
export async function postPurchasedElectricityBulkConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const parsed = validate(purchasedElectricityBulkConfirmBodySchema, req.body);
    if (!parsed.success) {
      sendError(res, parsed.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const emissionIds: string[] = [];
    const rowErrors: string[] = [];

    for (const rawRow of parsed.data!.rows) {
      const excelRow = rawRow.excelRow;
      const label = excelRow != null ? `Row ${excelRow}` : 'Row';

      const v = validate(purchasedElectricityFormSchema, {
        activityType: rawRow.activityType,
        sourceType: rawRow.sourceType,
        consumption: rawRow.consumption,
        consumptionUnit: rawRow.consumptionUnit,
        siteId: rawRow.siteId,
        startDate: rawRow.startDate,
        endDate: rawRow.endDate,
        notes: rawRow.notes,
        dataEntryChannel: 'BULK_UPLOAD',
      });
      if (!v.success) {
        rowErrors.push(`${label}: ${v.errors?.join('; ') ?? 'invalid'}`);
        continue;
      }

      let body: GhgCategoryFormBody;
      try {
        body = mapPurchasedElectricityToGhgBody(
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
          scope: 'SCOPE_2',
          categorySlug: 'purchased-electricity',
          body,
        });
        emissionIds.push(emission.id);
        await logUserAction(
          req.user.userId,
          AuditActions.EMISSION_CALCULATED,
          'emission',
          emission.id,
          {
            ghgCategorySlug: 'purchased-electricity',
            scope: 'SCOPE_2',
            channel: 'BULK_UPLOAD',
            bulkRow: excelRow,
          },
          req
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        rowErrors.push(`${label}: ${msg}`);
        logger.warn(`Purchased electricity bulk confirm ${label} failed: ${msg}`);
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
    logger.error('Purchased electricity bulk confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Bulk import failed', 500);
    }
  }
}

/** AI document extraction — upload electricity bill image/PDF, get structured data. */
export async function postPurchasedElectricityAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractPurchasedElectricityData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Electricity bill data extracted', 200);
  } catch (error) {
    logger.error('AI purchased electricity extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted purchased electricity data — validate, calculate via Climatiq, persist. */
export async function postPurchasedElectricityAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(purchasedElectricityFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapPurchasedElectricityToGhgBody(
        {
          activityType: validation.data!.activityType ?? '',
          sourceType: validation.data!.sourceType ?? '',
          consumption: validation.data!.consumption!,
          consumptionUnit: validation.data!.consumptionUnit ?? '',
          siteId: validation.data!.siteId ?? '',
          startDate: validation.data!.startDate,
          endDate: validation.data!.endDate,
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
      scope: 'SCOPE_2',
      categorySlug: 'purchased-electricity',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'purchased-electricity',
        scope: 'SCOPE_2',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted purchased electricity emission saved', 201);
  } catch (error) {
    logger.error('AI purchased electricity confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI purchased electricity confirm failed', 500);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
 * SCOPE 2 — Purchased Heating: template, bulk, AI
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Generated Scope 2 workbook (Purchased Heating sheet) with example rows. */
export async function getPurchasedHeatingTemplate(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const aoa = [
      ['Fields Required for Calculation'],
      [...PURCHASED_HEATING_EXCEL_HEADERS],
      ['Activity based', '', 10, 'kWh', '149', '01/01/25', '01/02/25'],
      ['Activity based', '', 15, 'GJ', '127', '15/02/25', '15/03/25'],
      ['Activity based', '', 10, 'kWh', '149', '19/04/25', '19/05/25'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, PURCHASED_HEATING_SHEET_NAME);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="purchased-heating-template.xlsx"');
    res.status(200).send(buf);
  } catch (error) {
    logger.error('Purchased heating template generation failed:', error);
    sendError(res, 'Could not generate purchased heating template', 500);
  }
}

/** Parse file and return row-level validation + mapped preview (no DB / Climatiq). */
export async function postPurchasedHeatingBulkPreview(req: AuthRequest, res: Response): Promise<void> {
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
      parsed = parsePurchasedHeatingBulkFile(file.buffer, file.originalname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      sendError(res, msg, 400);
      return;
    }

    const rows = buildPurchasedHeatingBulkPreview(parsed);
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
    logger.error('Purchased heating bulk preview error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Preview failed', 500);
    }
  }
}

/** Persist reviewed purchased heating rows. */
export async function postPurchasedHeatingBulkConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const parsed = validate(purchasedHeatingBulkConfirmBodySchema, req.body);
    if (!parsed.success) {
      sendError(res, parsed.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const emissionIds: string[] = [];
    const rowErrors: string[] = [];

    for (const rawRow of parsed.data!.rows) {
      const excelRow = rawRow.excelRow;
      const label = excelRow != null ? `Row ${excelRow}` : 'Row';

      const v = validate(purchasedHeatingFormSchema, {
        activityType: rawRow.activityType,
        sourceType: rawRow.sourceType,
        consumption: rawRow.consumption,
        consumptionUnit: rawRow.consumptionUnit,
        siteId: rawRow.siteId,
        startDate: rawRow.startDate,
        endDate: rawRow.endDate,
        notes: rawRow.notes,
        dataEntryChannel: 'BULK_UPLOAD',
      });
      if (!v.success) {
        rowErrors.push(`${label}: ${v.errors?.join('; ') ?? 'invalid'}`);
        continue;
      }

      let body: GhgCategoryFormBody;
      try {
        body = mapPurchasedHeatingToGhgBody(
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
          scope: 'SCOPE_2',
          categorySlug: 'purchased-heating',
          body,
        });
        emissionIds.push(emission.id);
        await logUserAction(
          req.user.userId,
          AuditActions.EMISSION_CALCULATED,
          'emission',
          emission.id,
          {
            ghgCategorySlug: 'purchased-heating',
            scope: 'SCOPE_2',
            channel: 'BULK_UPLOAD',
            bulkRow: excelRow,
          },
          req
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        rowErrors.push(`${label}: ${msg}`);
        logger.warn(`Purchased heating bulk confirm ${label} failed: ${msg}`);
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
    logger.error('Purchased heating bulk confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Bulk import failed', 500);
    }
  }
}

/** AI document extraction — upload heating bill image/PDF, get structured data. */
export async function postPurchasedHeatingAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractPurchasedHeatingData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Heating bill data extracted', 200);
  } catch (error) {
    logger.error('AI purchased heating extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted purchased heating data — validate, calculate via Climatiq, persist. */
export async function postPurchasedHeatingAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(purchasedHeatingFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapPurchasedHeatingToGhgBody(
        {
          activityType: validation.data!.activityType ?? '',
          sourceType: validation.data!.sourceType ?? '',
          consumption: validation.data!.consumption!,
          consumptionUnit: validation.data!.consumptionUnit ?? '',
          siteId: validation.data!.siteId ?? '',
          startDate: validation.data!.startDate,
          endDate: validation.data!.endDate,
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
      scope: 'SCOPE_2',
      categorySlug: 'purchased-heating',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'purchased-heating',
        scope: 'SCOPE_2',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted purchased heating emission saved', 201);
  } catch (error) {
    logger.error('AI purchased heating confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI purchased heating confirm failed', 500);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
 * SCOPE 2 — Purchased Cooling: template, bulk, AI
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Generated Scope 2 workbook (Purchased Cooling sheet) with example rows. */
export async function getPurchasedCoolingTemplate(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const aoa = [
      ['Fields Required for Calculation'],
      [...PURCHASED_COOLING_EXCEL_HEADERS],
      ['Activity based', '', 10, 'kWh', '149', '01/01/25', '01/02/25'],
      ['Activity based', '', 15, 'GJ', '127', '15/02/25', '15/03/25'],
      ['Activity based', '', 10, 'kWh', '149', '19/04/25', '19/05/25'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, PURCHASED_COOLING_SHEET_NAME);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="purchased-cooling-template.xlsx"');
    res.status(200).send(buf);
  } catch (error) {
    logger.error('Purchased cooling template generation failed:', error);
    sendError(res, 'Could not generate purchased cooling template', 500);
  }
}

/** Parse file and return row-level validation + mapped preview (no DB / Climatiq). */
export async function postPurchasedCoolingBulkPreview(req: AuthRequest, res: Response): Promise<void> {
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
      parsed = parsePurchasedCoolingBulkFile(file.buffer, file.originalname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      sendError(res, msg, 400);
      return;
    }

    const rows = buildPurchasedCoolingBulkPreview(parsed);
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
    logger.error('Purchased cooling bulk preview error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Preview failed', 500);
    }
  }
}

/** Persist reviewed purchased cooling rows. */
export async function postPurchasedCoolingBulkConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const parsed = validate(purchasedCoolingBulkConfirmBodySchema, req.body);
    if (!parsed.success) {
      sendError(res, parsed.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const emissionIds: string[] = [];
    const rowErrors: string[] = [];

    for (const rawRow of parsed.data!.rows) {
      const excelRow = rawRow.excelRow;
      const label = excelRow != null ? `Row ${excelRow}` : 'Row';

      const v = validate(purchasedCoolingFormSchema, {
        activityType: rawRow.activityType,
        sourceType: rawRow.sourceType,
        consumption: rawRow.consumption,
        consumptionUnit: rawRow.consumptionUnit,
        siteId: rawRow.siteId,
        startDate: rawRow.startDate,
        endDate: rawRow.endDate,
        notes: rawRow.notes,
        dataEntryChannel: 'BULK_UPLOAD',
      });
      if (!v.success) {
        rowErrors.push(`${label}: ${v.errors?.join('; ') ?? 'invalid'}`);
        continue;
      }

      let body: GhgCategoryFormBody;
      try {
        body = mapPurchasedCoolingToGhgBody(
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
          scope: 'SCOPE_2',
          categorySlug: 'purchased-cooling',
          body,
        });
        emissionIds.push(emission.id);
        await logUserAction(
          req.user.userId,
          AuditActions.EMISSION_CALCULATED,
          'emission',
          emission.id,
          {
            ghgCategorySlug: 'purchased-cooling',
            scope: 'SCOPE_2',
            channel: 'BULK_UPLOAD',
            bulkRow: excelRow,
          },
          req
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        rowErrors.push(`${label}: ${msg}`);
        logger.warn(`Purchased cooling bulk confirm ${label} failed: ${msg}`);
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
    logger.error('Purchased cooling bulk confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Bulk import failed', 500);
    }
  }
}

/** AI document extraction — upload cooling bill image/PDF, get structured data. */
export async function postPurchasedCoolingAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractPurchasedCoolingData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Cooling bill data extracted', 200);
  } catch (error) {
    logger.error('AI purchased cooling extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted purchased cooling data — validate, calculate via Climatiq, persist. */
export async function postPurchasedCoolingAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(purchasedCoolingFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapPurchasedCoolingToGhgBody(
        {
          activityType: validation.data!.activityType ?? '',
          sourceType: validation.data!.sourceType ?? '',
          consumption: validation.data!.consumption!,
          consumptionUnit: validation.data!.consumptionUnit ?? '',
          siteId: validation.data!.siteId ?? '',
          startDate: validation.data!.startDate,
          endDate: validation.data!.endDate,
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
      scope: 'SCOPE_2',
      categorySlug: 'purchased-cooling',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'purchased-cooling',
        scope: 'SCOPE_2',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted purchased cooling emission saved', 201);
  } catch (error) {
    logger.error('AI purchased cooling confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI purchased cooling confirm failed', 500);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
 * SCOPE 2 — Purchased Steaming: template, bulk, AI
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Generated Scope 2 workbook (Purchased Steaming sheet) with example rows. */
export async function getPurchasedSteamingTemplate(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const aoa = [
      ['Fields Required for Calculation'],
      [...PURCHASED_STEAMING_EXCEL_HEADERS],
      ['Activity based', '', 10, 'kWh', '149', '01/01/25', '01/02/25'],
      ['Activity based', '', 15, 'GJ', '127', '15/02/25', '15/03/25'],
      ['Activity based', '', 10, 'kWh', '149', '19/04/25', '19/05/25'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, PURCHASED_STEAMING_SHEET_NAME);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="purchased-steaming-template.xlsx"');
    res.status(200).send(buf);
  } catch (error) {
    logger.error('Purchased steaming template generation failed:', error);
    sendError(res, 'Could not generate purchased steaming template', 500);
  }
}

/** Parse file and return row-level validation + mapped preview (no DB / Climatiq). */
export async function postPurchasedSteamingBulkPreview(req: AuthRequest, res: Response): Promise<void> {
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
      parsed = parsePurchasedSteamingBulkFile(file.buffer, file.originalname);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      sendError(res, msg, 400);
      return;
    }

    const rows = buildPurchasedSteamingBulkPreview(parsed);
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
    logger.error('Purchased steaming bulk preview error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Preview failed', 500);
    }
  }
}

/** Persist reviewed purchased steaming rows. */
export async function postPurchasedSteamingBulkConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const parsed = validate(purchasedSteamingBulkConfirmBodySchema, req.body);
    if (!parsed.success) {
      sendError(res, parsed.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const emissionIds: string[] = [];
    const rowErrors: string[] = [];

    for (const rawRow of parsed.data!.rows) {
      const excelRow = rawRow.excelRow;
      const label = excelRow != null ? `Row ${excelRow}` : 'Row';

      const v = validate(purchasedSteamingFormSchema, {
        activityType: rawRow.activityType,
        sourceType: rawRow.sourceType,
        consumption: rawRow.consumption,
        consumptionUnit: rawRow.consumptionUnit,
        siteId: rawRow.siteId,
        startDate: rawRow.startDate,
        endDate: rawRow.endDate,
        notes: rawRow.notes,
        dataEntryChannel: 'BULK_UPLOAD',
      });
      if (!v.success) {
        rowErrors.push(`${label}: ${v.errors?.join('; ') ?? 'invalid'}`);
        continue;
      }

      let body: GhgCategoryFormBody;
      try {
        body = mapPurchasedSteamingToGhgBody(
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
          scope: 'SCOPE_2',
          categorySlug: 'purchased-steaming',
          body,
        });
        emissionIds.push(emission.id);
        await logUserAction(
          req.user.userId,
          AuditActions.EMISSION_CALCULATED,
          'emission',
          emission.id,
          {
            ghgCategorySlug: 'purchased-steaming',
            scope: 'SCOPE_2',
            channel: 'BULK_UPLOAD',
            bulkRow: excelRow,
          },
          req
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        rowErrors.push(`${label}: ${msg}`);
        logger.warn(`Purchased steaming bulk confirm ${label} failed: ${msg}`);
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
    logger.error('Purchased steaming bulk confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Bulk import failed', 500);
    }
  }
}

/** AI document extraction — upload steam bill image/PDF, get structured data. */
export async function postPurchasedSteamingAiExtract(req: AuthRequest, res: Response): Promise<void> {
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

    const extracted = await extractPurchasedSteamingData(file.buffer, file.mimetype, file.originalname);
    sendSuccess(res, extracted, 'Steam bill data extracted', 200);
  } catch (error) {
    logger.error('AI purchased steaming extraction error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI extraction failed', 500);
    }
  }
}

/** Confirm AI-extracted purchased steaming data — validate, calculate via Climatiq, persist. */
export async function postPurchasedSteamingAiConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!canUpload(req.user.role)) {
      sendError(res, 'Your role cannot submit emissions data', 403);
      return;
    }

    const validation = validate(purchasedSteamingFormSchema, {
      ...req.body,
      dataEntryChannel: 'AI_EXTRACT',
    });
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    let body: GhgCategoryFormBody;
    try {
      body = mapPurchasedSteamingToGhgBody(
        {
          activityType: validation.data!.activityType ?? '',
          sourceType: validation.data!.sourceType ?? '',
          consumption: validation.data!.consumption!,
          consumptionUnit: validation.data!.consumptionUnit ?? '',
          siteId: validation.data!.siteId ?? '',
          startDate: validation.data!.startDate,
          endDate: validation.data!.endDate,
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
      scope: 'SCOPE_2',
      categorySlug: 'purchased-steaming',
      body,
    });

    await logUserAction(
      req.user.userId,
      AuditActions.EMISSION_CALCULATED,
      'emission',
      emission.id,
      {
        ghgCategorySlug: 'purchased-steaming',
        scope: 'SCOPE_2',
        channel: 'AI_EXTRACT',
      },
      req
    );

    sendSuccess(res, emission, 'AI-extracted purchased steaming emission saved', 201);
  } catch (error) {
    logger.error('AI purchased steaming confirm error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'AI purchased steaming confirm failed', 500);
    }
  }
}
