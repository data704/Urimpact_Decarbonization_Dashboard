import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

/** Maximum number of users allowed per organization. */
export const MAX_USERS_PER_ORGANIZATION = 3;

/**
 * Get the number of users in an organization.
 */
export async function getOrganizationUserCount(organizationId: string): Promise<number> {
  return prisma.user.count({
    where: { organizationId },
  });
}

/**
 * Returns true if the organization has fewer than MAX_USERS_PER_ORGANIZATION users
 * and can add another user.
 */
export async function canAddUserToOrganization(organizationId: string): Promise<boolean> {
  const count = await getOrganizationUserCount(organizationId);
  return count < MAX_USERS_PER_ORGANIZATION;
}

/**
 * Create a new organization (tenant). First user signup creates the org;
 * additional users are invited into the same org.
 */
export async function createOrganization(name: string) {
  const org = await prisma.organization.create({
    data: {
      name: name.trim() || 'Organization',
    },
  });
  logger.info(`Organization created: ${org.id} ${org.name}`);
  return org;
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({ where: { id } });
}
