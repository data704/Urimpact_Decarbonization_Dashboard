import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthRequest } from '../types/index.js';
import { sendError } from '../utils/helpers.js';
import { UserRole } from '@prisma/client';
import prisma from '../config/database.js';

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Access token is required', 401);
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      sendError(res, 'Access token is required', 401);
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true, organizationId: true },
    });

    if (!user) {
      sendError(res, 'User not found', 401);
      return;
    }

    if (!user.isActive) {
      sendError(res, 'Account is deactivated', 403);
      return;
    }

    // Attach user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token has expired', 401);
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      sendError(res, 'Invalid token', 401);
      return;
    }
    sendError(res, 'Authentication failed', 401);
  }
}

/**
 * Optional authentication - attaches user if token exists, but doesn't require it
 */
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true, organizationId: true },
    });

    if (user && user.isActive) {
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? undefined,
      };
    }

    next();
  } catch {
    // Silently continue without user
    next();
  }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}

/**
 * Admin-only middleware
 */
export function adminOnly(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const r = String(req.user.role || '');
  const isAdmin =
    r === 'SUPER_ADMIN' ||
    r === 'ADMINISTRATOR' ||
    r === 'ADMIN'; // legacy
  if (!isAdmin) {
    sendError(res, 'Administrator access required', 403);
    return;
  }

  next();
}

/**
 * Super admin-only middleware
 */
export function superAdminOnly(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    sendError(res, 'Super admin access required', 403);
    return;
  }

  next();
}
