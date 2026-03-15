import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { parsePagination } from '../utils/helpers.js';

interface AuditLogInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    logger.debug(`Audit log created: ${input.action} on ${input.resource}`);
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    logger.error('Failed to create audit log:', error);
  }
}

/**
 * Log a user action
 */
export async function logUserAction(
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: object,
  req?: { ip?: string; headers?: { 'user-agent'?: string } }
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    resource,
    resourceId,
    details,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });
}

/**
 * Get audit logs with pagination and filters
 */
export async function getAuditLogs(
  filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
  },
  query: { page?: string; limit?: string }
) {
  const { page, limit, skip } = parsePagination(query);

  const where: {
    userId?: string;
    action?: string;
    resource?: string;
    timestamp?: { gte?: Date; lte?: Date };
  } = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.resource) {
    where.resource = filters.resource;
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.timestamp.lte = new Date(filters.endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total },
  };
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resource: string,
  resourceId: string,
  query: { page?: string; limit?: string }
) {
  const { page, limit, skip } = parsePagination(query);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { resource, resourceId },
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where: { resource, resourceId } }),
  ]);

  return {
    logs,
    pagination: { page, limit, total },
  };
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(userId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await prisma.auditLog.groupBy({
    by: ['action'],
    where: {
      userId,
      timestamp: { gte: startDate },
    },
    _count: true,
  });

  return logs.map((log) => ({
    action: log.action,
    count: log._count,
  }));
}

/**
 * Cleanup old audit logs (retention policy)
 */
export async function cleanupOldAuditLogs(retentionDays = 365 * 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.auditLog.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
    },
  });

  logger.info(`Cleaned up ${result.count} old audit logs`);
  return result.count;
}

// Common audit actions
export const AuditActions = {
  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',

  // Documents
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_PROCESSED: 'DOCUMENT_PROCESSED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',
  DOCUMENT_VIEWED: 'DOCUMENT_VIEWED',

  // Emissions
  EMISSION_CALCULATED: 'EMISSION_CALCULATED',
  EMISSION_CREATED: 'EMISSION_CREATED',
  EMISSION_DELETED: 'EMISSION_DELETED',
  EMISSION_EXPORTED: 'EMISSION_EXPORTED',

  // Reports
  REPORT_GENERATED: 'REPORT_GENERATED',
  REPORT_EXPORTED: 'REPORT_EXPORTED',

  // Admin
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_CREATED_BY_ADMIN: 'USER_CREATED_BY_ADMIN',
} as const;

/**
 * Recent activity for dashboard (who did what). Any authenticated user can read.
 * When organizationId is provided, only returns activity for users in that organization.
 * When organizationId is null (e.g. super admin), returns all activity.
 */
export async function getRecentActivity(limit = 30, organizationId?: string | null) {
  const take = Math.min(100, Math.max(1, limit));
  const where: { user?: { organizationId: string } } = {};
  if (organizationId != null && organizationId !== '') {
    where.user = { organizationId };
  }

  return prisma.auditLog.findMany({
    where,
    take,
    orderBy: { timestamp: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}
