import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError, sendPaginated, parsePagination } from '../utils/helpers.js';
import { getAuditLogs, logUserAction, AuditActions, getRecentActivity } from '../services/auditService.js';
import { hashPassword } from '../services/authService.js';
import {
  canAddUserToOrganization,
  getOrganizationUserCount,
  MAX_USERS_PER_ORGANIZATION,
} from '../services/organizationService.js';
import { validate, adminUserCreateSchema } from '../utils/validators.js';
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
      organizationId?: string;
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

    // Org admins only see users in their organization; super admins see all
    if (req.user?.organizationId && req.user.role !== 'SUPER_ADMIN') {
      filters.organizationId = req.user.organizationId;
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

    const orgId = req.user?.organizationId ?? null;
    const organizationLimit =
      orgId != null
        ? {
            userCount: await getOrganizationUserCount(orgId),
            maxUsers: MAX_USERS_PER_ORGANIZATION,
          }
        : undefined;

    sendPaginated(res, users, { page, limit, total }, { organizationLimit });
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
 * Create user (admin only) — new users can sign in with the password set here.
 * POST /api/admin/users
 */
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(adminUserCreateSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const { email, password, firstName, lastName, company, role } = validation.data!;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      sendError(res, 'Email already registered', 409);
      return;
    }

    const targetRole = (role ?? 'DATA_CONTRIBUTOR') as UserRole;
    if (targetRole === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      sendError(res, 'Only super admin can assign super admin role', 403);
      return;
    }

    const hashedPassword = await hashPassword(password);

    const adminUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true, company: true },
    });
    const orgId = adminUser?.organizationId ?? undefined;

    if (orgId) {
      const canAdd = await canAddUserToOrganization(orgId);
      if (!canAdd) {
        sendError(
          res,
          `Your organization has reached the maximum of ${MAX_USERS_PER_ORGANIZATION} users. You cannot add more users.`,
          403
        );
        return;
      }
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company?.trim() || adminUser?.company || null,
        organizationId: orgId,
        role: targetRole,
        isActive: true,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logUserAction(
      req.user.userId,
      AuditActions.USER_CREATED_BY_ADMIN,
      'user',
      user.id,
      { createdEmail: user.email, role: user.role },
      req
    );

    sendSuccess(res, user, 'User created successfully', 201);
  } catch (error) {
    logger.error('Create user error:', error);
    if (error instanceof Error) {
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to create user', 500);
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
