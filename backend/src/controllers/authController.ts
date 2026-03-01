import { Request, Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
} from '../services/authService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  validate,
} from '../utils/validators.js';
import { logger } from '../utils/logger.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const validation = validate(registerSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const user = await registerUser(validation.data!);

    // Log audit
    await logUserAction(
      user.id,
      AuditActions.USER_REGISTERED,
      'user',
      user.id,
      { email: user.email },
      req
    );

    logger.info(`New user registered: ${user.email}`);
    sendSuccess(res, user, 'Registration successful', 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already registered')) {
        sendError(res, error.message, 409);
        return;
      }
      logger.error('Registration error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Registration failed', 500);
    }
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validation = validate(loginSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const { email, password } = validation.data!;
    const { user, tokens } = await loginUser(email, password);

    // Log audit
    await logUserAction(
      user.id,
      AuditActions.USER_LOGIN,
      'user',
      user.id,
      { email: user.email },
      req
    );

    logger.info(`User logged in: ${user.email}`);
    sendSuccess(res, { user, ...tokens }, 'Login successful');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('deactivated')) {
        sendError(res, error.message, 401);
        return;
      }
      logger.error('Login error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Login failed', 500);
    }
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      sendError(res, 'Refresh token is required', 400);
      return;
    }

    const tokens = await refreshAccessToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('revoked')) {
        sendError(res, error.message, 401);
        return;
      }
      logger.error('Token refresh error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Token refresh failed', 500);
    }
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    // Log audit
    if (req.user) {
      await logUserAction(
        req.user.userId,
        AuditActions.USER_LOGOUT,
        'user',
        req.user.userId,
        {},
        req
      );
    }

    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout error:', error);
    sendSuccess(res, null, 'Logged out successfully');
  }
}

/**
 * Get current user profile
 * GET /api/auth/profile
 */
export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const user = await getUserProfile(req.user.userId);
    sendSuccess(res, user);
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Get profile error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to get profile', 500);
    }
  }
}

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(updateProfileSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const user = await updateUserProfile(req.user.userId, validation.data!);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.PROFILE_UPDATED,
      'user',
      req.user.userId,
      { updatedFields: Object.keys(validation.data!) },
      req
    );

    sendSuccess(res, user, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Update profile error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to update profile', 500);
    }
  }
}

/**
 * Change password
 * POST /api/auth/change-password
 */
export async function changeUserPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validation = validate(changePasswordSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const { currentPassword, newPassword } = validation.data!;
    await changePassword(req.user.userId, currentPassword, newPassword);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.PASSWORD_CHANGED,
      'user',
      req.user.userId,
      {},
      req
    );

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('incorrect')) {
        sendError(res, error.message, 400);
        return;
      }
      logger.error('Change password error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Failed to change password', 500);
    }
  }
}
