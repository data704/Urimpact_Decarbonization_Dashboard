import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginated, parsePagination } from '../utils/helpers.js';
import { getAuditLogs, logUserAction, AuditActions } from '../services/auditService.js';
import { getAllDocuments } from '../services/documentService.js';
import { logger } from '../utils/logger.js';
import { UserRole } from '@prisma/client';

/**
 * Get all users (admin only)
 * GET /api/admin/users
 */
export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { page, limit, skip } = parsePagination(req.query);

    const filters: {
      role?: UserRole;
      isActive?: boolean;
      email?: { contains: string; mode: 'insensitive' };
      company?: { contains: string; mode: 'insensitive' };
    } = {};

    if (req.query.role) {
      filters.role = req.query.role as UserRole;
    }

    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }

    if (req.query.search) {
      filters.email = { contains: req.query.search as string, mode: 'insensitive' };
    }

    if (req.query.company) {
      filters.company = { contains: req.query.company as string, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              documents: true,
              emissions: true,
            },
          },
        },
      }),
      prisma.user.count({ where: filters }),
    ]);

    sendPaginated(res, users, { page, limit, total });
  } catch (error) {
    logger.error('Get users error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get users', 500);
    }
  }
}

/**
 * Get single user (admin only)
 * GET /api/admin/users/:id
 */
export async function getUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            documents: true,
            emissions: true,
          },
        },
      },
    });

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    logger.error('Get user error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get user', 500);
    }
  }
}

/**
 * Update user (admin only)
 * PUT /api/admin/users/:id
 */
export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { id } = req.params;
    const { isActive, role, emailVerified } = req.body;

    // Check if trying to modify super admin (only super admin can do that)
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!targetUser) {
      sendError(res, 'User not found', 404);
      return;
    }

    if (targetUser.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      sendError(res, 'Cannot modify super admin user', 403);
      return;
    }

    // Only super admin can create super admins
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      sendError(res, 'Only super admin can assign super admin role', 403);
      return;
    }

    const updateData: {
      isActive?: boolean;
      role?: UserRole;
      emailVerified?: boolean;
    } = {};

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (role !== undefined) {
      updateData.role = role;
    }

    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Log audit
    const action = isActive === false 
      ? AuditActions.USER_DEACTIVATED 
      : isActive === true 
        ? AuditActions.USER_ACTIVATED
        : role !== undefined
          ? AuditActions.USER_ROLE_CHANGED
          : 'USER_UPDATED';

    await logUserAction(
      req.user.userId,
      action,
      'user',
      id,
      { updatedFields: Object.keys(updateData), ...updateData },
      req
    );

    sendSuccess(res, user, 'User updated successfully');
  } catch (error) {
    logger.error('Update user error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to update user', 500);
    }
  }
}

/**
 * Get audit logs (admin only)
 * GET /api/admin/audit-logs
 */
export async function getAuditLogsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const filters = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      resource: req.query.resource as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const { logs, pagination } = await getAuditLogs(
      filters,
      req.query as { page?: string; limit?: string }
    );

    sendPaginated(res, logs, pagination);
  } catch (error) {
    logger.error('Get audit logs error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get audit logs', 500);
    }
  }
}

/**
 * Get system statistics (admin only)
 * GET /api/admin/stats
 */
export async function getSystemStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Get various statistics
    const [
      userStats,
      documentStats,
      emissionStats,
      recentActivity,
    ] = await Promise.all([
      // User stats
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      // Document stats
      prisma.document.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      // Emission stats
      prisma.emission.aggregate({
        _sum: { co2e: true },
        _count: true,
      }),
      // Recent activity count (last 24 hours)
      prisma.auditLog.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Total users
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });

    // Total documents
    const totalDocuments = await prisma.document.count({ where: { deletedAt: null } });

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: userStats.reduce((acc, stat) => {
          acc[stat.role] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
      documents: {
        total: totalDocuments,
        byStatus: documentStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
      emissions: {
        totalRecords: emissionStats._count,
        totalCo2eKg: emissionStats._sum.co2e || 0,
        totalCo2eTonnes: (emissionStats._sum.co2e || 0) / 1000,
      },
      activity: {
        last24Hours: recentActivity,
      },
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, stats);
  } catch (error) {
    logger.error('Get system stats error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get system statistics', 500);
    }
  }
}

/**
 * Get all documents (admin only)
 * GET /api/admin/documents
 */
export async function getAllDocumentsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const filters = {
      userId: req.query.userId as string,
      status: req.query.status as string,
      documentType: req.query.documentType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const { documents, pagination } = await getAllDocuments(
      filters,
      req.query as { page?: string; limit?: string }
    );

    sendPaginated(res, documents, pagination);
  } catch (error) {
    logger.error('Get all documents error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get documents', 500);
    }
  }
}
