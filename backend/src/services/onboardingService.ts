import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { ConflictError, UnauthorizedError, ForbiddenError } from '../middleware/errorHandler.js';
import { UserRole } from '@prisma/client';
import type { Scope1OnboardingInput, Scope2OnboardingInput } from '../utils/validators.js';

export type OnboardingDraftPayload = Record<string, unknown>;

export async function getOrganizationOnboardingForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      role: true,
      organization: true,
    },
  });

  if (!user?.organizationId || !user.organization) {
    return { organization: null, canEdit: false };
  }

  const canEdit =
    user.role === UserRole.ADMINISTRATOR || user.role === UserRole.SUPER_ADMIN;

  return {
    organization: user.organization,
    canEdit,
  };
}

export async function saveOnboardingDraft(
  userId: string,
  draft: OnboardingDraftPayload
): Promise<void> {
  const { organization, canEdit } = await getOrganizationOnboardingForUser(userId);
  if (!organization?.id) throw new UnauthorizedError('No organization');
  if (!canEdit) throw new UnauthorizedError('Only administrators can edit company onboarding');

  const merged = {
    ...((organization.onboardingDraft as Record<string, unknown>) || {}),
    ...draft,
  };

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      onboardingDraft: merged as Prisma.InputJsonValue,
    },
  });
}

export async function submitCompanyOnboarding(
  userId: string,
  data: {
    legalName: string;
    commercialRegistrationNumber: string;
    headquarterAddress: string;
    isGroupCompany: boolean;
    groupCompanyName?: string | null;
    sectorIsicCode: string;
    subSectorIsicCode: string;
    revenueAmount: number;
    revenueCurrency: string;
    employeeCount: number;
    pocFullName: string;
    pocDesignation: string;
    pocDepartment: string;
    pocEmail: string;
    pocPhone: string;
    pocCountryCode: string;
    registrationDocumentPath?: string | null;
    facilities: Array<{
      id: string;
      name: string;
      facilityType: string;
      facilityTypeOther?: string | null;
      location: string;
      proofDocumentPath?: string | null;
    }>;
  }
): Promise<void> {
  const { organization, canEdit } = await getOrganizationOnboardingForUser(userId);
  if (!organization?.id) throw new UnauthorizedError('No organization');
  if (!canEdit) throw new UnauthorizedError('Only administrators can submit company onboarding');

  if (data.isGroupCompany && !(data.groupCompanyName || '').trim()) {
    throw new ForbiddenError('Group company name is required when Group Company is Yes');
  }

  if (!organization.registrationDocumentPath && !data.registrationDocumentPath) {
    throw new UnauthorizedError('Registration document is required');
  }

  const pocEmailNorm = data.pocEmail.trim().toLowerCase();
  const dupPoc = await prisma.organization.findFirst({
    where: {
      pocEmail: pocEmailNorm,
      NOT: { id: organization.id },
    },
  });
  if (dupPoc) {
    throw new ConflictError('Primary contact email is already registered for another organization');
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      legalName: data.legalName.trim(),
      commercialRegistrationNumber: data.commercialRegistrationNumber.trim(),
      headquarterAddress: data.headquarterAddress.trim(),
      isGroupCompany: data.isGroupCompany,
      groupCompanyName: data.isGroupCompany ? data.groupCompanyName?.trim() || null : null,
      sectorIsicCode: data.sectorIsicCode,
      subSectorIsicCode: data.subSectorIsicCode,
      revenueAmount: data.revenueAmount,
      revenueCurrency: data.revenueCurrency,
      employeeCount: data.employeeCount,
      pocFullName: data.pocFullName.trim(),
      pocDesignation: data.pocDesignation.trim(),
      pocDepartment: data.pocDepartment.trim(),
      pocEmail: pocEmailNorm,
      pocPhone: data.pocPhone.trim(),
      pocCountryCode: data.pocCountryCode.trim(),
      registrationDocumentPath:
        data.registrationDocumentPath ?? organization.registrationDocumentPath,
      onboardingCompletedAt: new Date(),
      onboardingDraft: Prisma.DbNull,
      onboardingFacilities: data.facilities as unknown as Prisma.InputJsonValue,
      name: data.legalName.trim(),
    },
  });
}

export async function setRegistrationDocumentPath(
  userId: string,
  relativePath: string
): Promise<void> {
  const { organization, canEdit } = await getOrganizationOnboardingForUser(userId);
  if (!organization?.id) throw new UnauthorizedError('No organization');
  if (!canEdit) throw new UnauthorizedError('Only administrators can upload documents');

  await prisma.organization.update({
    where: { id: organization.id },
    data: { registrationDocumentPath: relativePath },
  });
}

export async function saveScopeOnboardingDraft(
  userId: string,
  draft: OnboardingDraftPayload
): Promise<void> {
  const { organization, canEdit } = await getOrganizationOnboardingForUser(userId);
  if (!organization?.id) throw new UnauthorizedError('No organization');
  if (!canEdit) throw new UnauthorizedError('Only administrators can edit scope onboarding');
  if (!organization.onboardingCompletedAt) {
    throw new ForbiddenError('Complete company onboarding before scope questions');
  }

  const merged = {
    ...((organization.scopeOnboardingDraft as Record<string, unknown>) || {}),
    ...draft,
  };

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      scopeOnboardingDraft: merged as Prisma.InputJsonValue,
    },
  });
}

export async function submitScope1Onboarding(
  userId: string,
  data: Scope1OnboardingInput
): Promise<void> {
  const { organization, canEdit } = await getOrganizationOnboardingForUser(userId);
  if (!organization?.id) throw new UnauthorizedError('No organization');
  if (!canEdit) throw new UnauthorizedError('Only administrators can submit scope onboarding');
  if (!organization.onboardingCompletedAt) {
    throw new ForbiddenError('Complete company onboarding first');
  }

  const prevDraft = (organization.scopeOnboardingDraft as Record<string, unknown>) || {};
  const { scope1: _drop, ...restDraft } = prevDraft;
  const nextDraft =
    Object.keys(restDraft).length > 0 ? (restDraft as Prisma.InputJsonValue) : Prisma.DbNull;

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      scope1Inventory: data as unknown as Prisma.InputJsonValue,
      scope1OnboardingCompletedAt: new Date(),
      scopeOnboardingDraft: nextDraft,
    },
  });
}

export async function submitScope2Onboarding(
  userId: string,
  data: Scope2OnboardingInput
): Promise<void> {
  const { organization, canEdit } = await getOrganizationOnboardingForUser(userId);
  if (!organization?.id) throw new UnauthorizedError('No organization');
  if (!canEdit) throw new UnauthorizedError('Only administrators can submit scope onboarding');
  if (!organization.onboardingCompletedAt) {
    throw new ForbiddenError('Complete company onboarding first');
  }
  if (!organization.scope1OnboardingCompletedAt) {
    throw new ForbiddenError('Complete Scope 1 onboarding first');
  }

  const prevDraft = (organization.scopeOnboardingDraft as Record<string, unknown>) || {};
  const { scope2: _drop, ...restDraft } = prevDraft;
  const nextDraft =
    Object.keys(restDraft).length > 0 ? (restDraft as Prisma.InputJsonValue) : Prisma.DbNull;

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      scope2Inventory: data as unknown as Prisma.InputJsonValue,
      scope2OnboardingCompletedAt: new Date(),
      scopeOnboardingDraft: nextDraft,
    },
  });
}
