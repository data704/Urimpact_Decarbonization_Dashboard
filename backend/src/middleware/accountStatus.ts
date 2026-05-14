import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendError } from '../utils/helpers.js';
import prisma from '../config/database.js';

interface JwtDecoded {
  userId?: string;
  pwdReq?: boolean;
}

function authAllowsPasswordPending(url: string): boolean {
  return (
    url.includes('/auth/change-password') ||
    url.includes('/auth/profile') ||
    url.includes('/auth/logout')
  );
}

function authAllowsIncompleteOrg(url: string): boolean {
  return (
    url.includes('/auth/') ||
    url.includes('/organizations')
  );
}

/**
 * Block API usage until mandatory password change is completed (JWT carries pwdReq).
 */
export async function blockPendingPasswordChange(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ') || !req.user) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.decode(token) as JwtDecoded | null;

    if (decoded?.pwdReq && !authAllowsPasswordPending(req.originalUrl || '')) {
      sendError(res, 'Password change required before continuing.', 403);
      return;
    }

    next();
  } catch {
    next();
  }
}

/**
 * Block tenant features until company onboarding is submitted (admins complete wizard).
 */
export async function blockIncompleteOrganizationOnboarding(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      next();
      return;
    }

    const url = req.originalUrl || '';

    if (authAllowsIncompleteOrg(url)) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        organizationId: true,
        organization: {
          select: { onboardingCompletedAt: true },
        },
      },
    });

    const orgId = user?.organizationId;
    if (!orgId) {
      next();
      return;
    }

    if (!user.organization?.onboardingCompletedAt) {
      sendError(res, 'Complete company onboarding to access this area.', 403);
      return;
    }

    next();
  } catch {
    next();
  }
}

/**
 * GHG activity APIs require Scope 1 and Scope 2 onboarding inventories so category
 * boundaries and facilities exist before operational data entry.
 */
export async function requireGhgScopeOnboardingComplete(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.organizationId) {
      sendError(res, 'Organization is required for GHG data entry.', 403);
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: {
        scope1OnboardingCompletedAt: true,
        scope2OnboardingCompletedAt: true,
      },
    });

    if (!org?.scope1OnboardingCompletedAt || !org?.scope2OnboardingCompletedAt) {
      sendError(
        res,
        'Complete Scope 1 and Scope 2 organization onboarding before submitting GHG activity data.',
        403
      );
      return;
    }

    next();
  } catch {
    next();
  }
}
