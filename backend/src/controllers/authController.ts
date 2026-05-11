import { Request, Response } from 'express';
import { AuthRequest } from '../types/index.js';
import type { CreateUserInput } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import {
  registerUser,
  initiateLogin,
  verifyLoginChallenge,
  loginWithPasswordOnly,
  refreshAccessToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
} from '../services/authService.js';
import { config } from '../config/index.js';
import {
  registerSchema,
  loginSchema,
  loginVerifySchema,
  updateProfileSchema,
  changePasswordSchema,
  validate,
} from '../utils/validators.js';
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
} from '../services/totpService.js';
import { logUserAction, AuditActions } from '../services/auditService.js';
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

    const user = await registerUser(validation.data! as CreateUserInput);

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
 * Login step 1 — either password-only (SKIP_LOGIN_OTP) or email OTP challenge.
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validation = validate(loginSchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const { email, password, rememberMe } = validation.data!;

    if (config.auth.skipLoginOtp) {
      const { user, tokens } = await loginWithPasswordOnly(email, password, !!rememberMe);

      await logUserAction(
        user.id,
        AuditActions.USER_LOGIN,
        'user',
        user.id,
        { email: user.email, skipOtp: true },
        req
      );

      logger.info(`User logged in (password only, SKIP_LOGIN_OTP): ${user.email}`);
      sendSuccess(res, { user, ...tokens }, 'Login successful');
      return;
    }

    const challenge = await initiateLogin(email, password, !!rememberMe);

    sendSuccess(
      res,
      {
        loginChallengeId: challenge.loginChallengeId,
        expiresAt: challenge.expiresAt,
        totpRequired: challenge.totpRequired,
        ...(challenge.debugOtp ? { debugOtp: challenge.debugOtp } : {}),
      },
      'Verification code sent — check your inbox or server logs (development)'
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('deactivated') || error.message.includes('not authorized')) {
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
 * Login step 2 — verify email OTP and optional TOTP, then issue JWT.
 * POST /api/auth/login/verify
 */
export async function verifyLogin(req: Request, res: Response): Promise<void> {
  try {
    const validation = validate(loginVerifySchema, req.body);
    if (!validation.success) {
      sendError(res, validation.errors?.join(', ') || 'Validation failed', 400);
      return;
    }

    const { loginChallengeId, otp, totpCode } = validation.data!;
    const { user, tokens } = await verifyLoginChallenge(loginChallengeId, otp, totpCode);

    await logUserAction(
      user.id,
      AuditActions.USER_LOGIN,
      'user',
      user.id,
      { email: user.email },
      req
    );

    logger.info(`User logged in (OTP verified): ${user.email}`);
    sendSuccess(res, { user, ...tokens }, 'Login successful');
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('expired') ||
        error.message.includes('required') ||
        error.message.includes('Authenticator')
      ) {
        sendError(res, error.message, 401);
        return;
      }
      logger.error('Verify login error:', error);
      sendError(res, error.message, 500);
    } else {
      sendError(res, 'Login verification failed', 500);
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
    const tokens = await changePassword(req.user.userId, currentPassword, newPassword);

    // Log audit
    await logUserAction(
      req.user.userId,
      AuditActions.PASSWORD_CHANGED,
      'user',
      req.user.userId,
      {},
      req
    );

    sendSuccess(res, tokens, 'Password changed successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('incorrect') || error.message.includes('required')) {
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

/**
 * GET /api/auth/totp/setup — returns otpauth URL + QR for authenticator apps.
 */
export async function totpSetupStart(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const payload = await beginTotpSetup(req.user.userId);
    sendSuccess(res, payload, 'Scan QR code then confirm with a 6-digit code');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, error.message.includes('Unauthorized') ? 403 : 400);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

/**
 * POST /api/auth/totp/confirm — body: { token: string }
 */
export async function totpSetupConfirm(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      sendError(res, 'token is required', 400);
      return;
    }

    await confirmTotpSetup(req.user.userId, token);
    sendSuccess(res, { enabled: true }, 'Two-factor authentication enabled');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, 401);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}

/**
 * POST /api/auth/totp/disable — body: { token: string }
 */
export async function totpDisable(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      sendError(res, 'token is required', 400);
      return;
    }

    await disableTotp(req.user.userId, token);
    sendSuccess(res, { enabled: false }, 'Two-factor authentication disabled');
  } catch (error) {
    if (error instanceof Error) {
      sendError(res, error.message, 401);
      return;
    }
    sendError(res, 'Failed', 500);
  }
}
