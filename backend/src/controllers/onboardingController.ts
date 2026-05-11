import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import {
  getOrganizationOnboardingForUser,
  saveOnboardingDraft,
  submitCompanyOnboarding,
  setRegistrationDocumentPath,
  saveScopeOnboardingDraft,
  submitScope1Onboarding,
  submitScope2Onboarding,
} from '../services/onboardingService.js';
import { validate, onboardingSubmitSchema, scope1OnboardingSchema, scope2OnboardingSchema } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { ForbiddenError, ConflictError } from '../middleware/errorHandler.js';

function serializeOrg(org: Record<string, unknown> | null) {
  if (!org) return null;
  const o = { ...org };
  const rev = o.revenueAmount;
  if (rev != null && typeof rev === 'object' && 'toNumber' in (rev as object)) {
    o.revenueAmount = (rev as { toNumber: () => number }).toNumber();
  }
  return o;
}

export async function getMyOrganization(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const result = await getOrganizationOnboardingForUser(req.user.userId);
    sendSuccess(res, {
      ...result,
      organization: serializeOrg(result.organization as Record<string, unknown> | null),
    });
  } catch (error) {
    logger.error('getMyOrganization error:', error);
    sendError(res, error instanceof Error ? error.message : 'Failed', 500);
  }
}

export async function putOnboardingDraft(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    await saveOnboardingDraft(req.user.userId, req.body || {});
    sendSuccess(res, { saved: true }, 'Draft saved');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, error.message.includes('Unauthorized') ? 403 : 400);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

export async function postRegistrationDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const file = req.file;
    if (!file?.filename) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    await setRegistrationDocumentPath(req.user.userId, file.filename);
    sendSuccess(res, { filename: file.filename }, 'Document uploaded');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, error.message.includes('Unauthorized') ? 403 : 400);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

export async function postOnboardingFacilityProof(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const file = req.file;
    if (!file?.filename) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    const { canEdit } = await getOrganizationOnboardingForUser(req.user.userId);
    if (!canEdit) {
      sendError(res, 'Only administrators can upload documents', 403);
      return;
    }

    sendSuccess(res, { filename: file.filename }, 'Document uploaded');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, error.message.includes('Unauthorized') ? 403 : 400);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

export async function submitOnboarding(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(onboardingSubmitSchema, req.body);
    if (!validation.success || !validation.data) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    await submitCompanyOnboarding(req.user.userId, validation.data as Parameters<typeof submitCompanyOnboarding>[1]);
    sendSuccess(res, { completed: true }, 'Company onboarding submitted');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      sendError(res, error.message, 403);
      return;
    }
    if (error instanceof ConflictError) {
      sendError(res, error.message, 409);
      return;
    }
    if (error instanceof Error) {
      const status =
        error.message.includes('Unauthorized') || error.message.includes('required')
          ? 403
          : 400;
      sendError(res, error.message, status);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

export async function putScopeOnboardingDraft(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    await saveScopeOnboardingDraft(req.user.userId, (req.body || {}) as Record<string, unknown>);
    sendSuccess(res, { saved: true }, 'Scope draft saved');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, error.message.includes('Unauthorized') ? 403 : 400);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

export async function postScope1OnboardingSubmit(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(scope1OnboardingSchema, req.body);
    if (!validation.success || !validation.data) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    await submitScope1Onboarding(req.user.userId, validation.data);
    sendSuccess(res, { completed: true }, 'Scope 1 onboarding submitted');
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message.includes('Unauthorized') ? 403 : 400;
      sendError(res, error.message, status);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

export async function postScope2OnboardingSubmit(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(scope2OnboardingSchema, req.body);
    if (!validation.success || !validation.data) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    await submitScope2Onboarding(req.user.userId, validation.data);
    sendSuccess(res, { completed: true }, 'Scope 2 onboarding submitted');
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message.includes('Unauthorized') ? 403 : 400;
      sendError(res, error.message, status);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}
