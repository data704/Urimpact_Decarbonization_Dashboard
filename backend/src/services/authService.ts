import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { createOrganization } from './organizationService.js';
import { config } from '../config/index.js';
import { AuthTokens, CreateUserInput, UserProfile } from '../types/index.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../middleware/errorHandler.js';
import { UserRole } from '@prisma/client';
import { assertCorporateEmailAllowed } from '../utils/corporateEmail.js';
import { verifyTotpToken } from './totpService.js';
import { sendLoginOtpEmail } from './mailService.js';
import { logger } from '../utils/logger.js';

const SALT_ROUNDS = 12;

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(
  user: {
    id: string;
    email: string;
    role: UserRole;
    passwordMustChange?: boolean;
  },
  options?: { expiresIn?: string }
): string {
  const expiresIn =
    options?.expiresIn ??
    (typeof config.jwt.expiresIn === 'string' ? config.jwt.expiresIn : String(config.jwt.expiresIn));

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.passwordMustChange ? { pwdReq: true } : {}),
    },
    config.jwt.secret,
    { expiresIn } as jwt.SignOptions
  );
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

export async function buildUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      company: true,
      organizationId: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      passwordMustChange: true,
      totpEnabled: true,
      organization: {
        select: {
          onboardingCompletedAt: true,
          scope1OnboardingCompletedAt: true,
          scope2OnboardingCompletedAt: true,
          subscriptionPlan: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company ?? undefined,
    organizationId: user.organizationId ?? undefined,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    passwordMustChange: user.passwordMustChange,
    totpEnabled: user.totpEnabled,
    organizationOnboardingComplete: !!user.organization?.onboardingCompletedAt,
    scope1OnboardingComplete: !!user.organization?.scope1OnboardingCompletedAt,
    scope2OnboardingComplete: !!user.organization?.scope2OnboardingCompletedAt,
    subscriptionPlan: user.organization?.subscriptionPlan ?? 'STANDARD',
  };
}

/**
 * Register a new user
 */
export async function registerUser(input: CreateUserInput): Promise<UserProfile> {
  const email = input.email.toLowerCase().trim();
  assertCorporateEmailAllowed(email, [...config.corporateEmailDomains]);

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Hash password
  const hashedPassword = await hashPassword(input.password);

  // Normalize company: trim and use null if empty so profile shows user's choice, not org fallback
  const companyToSave =
    input.company != null && String(input.company).trim() !== ''
      ? String(input.company).trim()
      : null;

  // New company tenant: create organization first, then admin user bound to it
  const orgName =
    companyToSave || `${input.firstName}'s Organization`.trim();
  const organization = await createOrganization(orgName);

  // Create user — self-signup is org admin; all data is scoped by organizationId
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      company: companyToSave,
      organizationId: organization.id,
      role: UserRole.ADMINISTRATOR,
    },
  });

  return buildUserProfile(user.id);
}

function otpExpiresSeconds(rememberMe: boolean): number {
  const days = rememberMe ? 30 : 7;
  return days * 24 * 60 * 60;
}

export interface LoginChallengeResult {
  loginChallengeId: string;
  expiresAt: string;
  totpRequired: boolean;
  debugOtp?: string;
}

/**
 * Step 1: validate credentials and issue email OTP challenge (no JWT yet).
 */
export async function initiateLogin(
  emailRaw: string,
  password: string,
  rememberMe: boolean
): Promise<LoginChallengeResult> {
  const email = emailRaw.toLowerCase().trim();
  assertCorporateEmailAllowed(email, [...config.corporateEmailDomains]);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await prisma.loginChallenge.deleteMany({ where: { userId: user.id } });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 10);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + config.auth.loginOtpExpiresMinutes);

  const challenge = await prisma.loginChallenge.create({
    data: {
      email,
      otpHash,
      expiresAt,
      rememberMe,
      userId: user.id,
    },
  });

  const emailed = await sendLoginOtpEmail(email, otp, config.auth.loginOtpExpiresMinutes);
  if (emailed) {
    logger.info(`Login OTP issued for ${email} (expires ${expiresAt.toISOString()})`);
  } else if (config.auth.exposeLoginOtp) {
    logger.info(
      `Login OTP issued for ${email} (expires ${expiresAt.toISOString()}) — returned in API as debugOtp (no SMTP or testing mode).`
    );
  } else {
    logger.info(
      `Login OTP for ${email}: ${otp} (expires ${expiresAt.toISOString()}) — configure SMTP or enable debugOtp path.`
    );
  }

  return {
    loginChallengeId: challenge.id,
    expiresAt: expiresAt.toISOString(),
    totpRequired: user.totpEnabled && !!user.totpSecret,
    ...(config.auth.exposeLoginOtp ? { debugOtp: otp } : {}),
  };
}

/**
 * Step 2: verify email OTP (+ optional TOTP) and return JWT + refresh token.
 */
export async function verifyLoginChallenge(
  loginChallengeId: string,
  otp: string,
  totpCode?: string
): Promise<{ user: UserProfile; tokens: AuthTokens }> {
  const challenge = await prisma.loginChallenge.findUnique({
    where: { id: loginChallengeId },
    include: {
      user: true,
    },
  });

  if (!challenge || !challenge.user) {
    throw new UnauthorizedError('Invalid or expired login session');
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.loginChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    throw new UnauthorizedError('Login code has expired. Please sign in again.');
  }

  const otpOk = await bcrypt.compare(String(otp).trim(), challenge.otpHash);
  if (!otpOk) {
    throw new UnauthorizedError('Invalid verification code');
  }

  const user = challenge.user;

  if (user.totpEnabled && user.totpSecret) {
    const code = totpCode?.trim();
    if (!code || !verifyTotpToken(user.totpSecret, code)) {
      throw new UnauthorizedError('Authenticator code required or invalid');
    }
  }

  await prisma.loginChallenge.delete({ where: { id: challenge.id } });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), emailVerified: true },
  });

  const rememberMe = challenge.rememberMe;
  const accessExpires =
    typeof config.jwt.rememberExpiresIn === 'string'
      ? config.jwt.rememberExpiresIn
      : String(config.jwt.rememberExpiresIn);
  const normalExpires =
    typeof config.jwt.expiresIn === 'string' ? config.jwt.expiresIn : String(config.jwt.expiresIn);

  const accessToken = generateAccessToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      passwordMustChange: user.passwordMustChange,
    },
    { expiresIn: rememberMe ? accessExpires : normalExpires }
  );
  const refreshToken = await generateRefreshToken(user.id);

  const seconds = otpExpiresSeconds(rememberMe);

  const userProfile = await buildUserProfile(user.id);

  return {
    user: userProfile,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: seconds,
    },
  };
}

/**
 * Password-only login (used when email OTP is disabled via SKIP_LOGIN_OTP).
 */
export async function loginWithPasswordOnly(
  emailRaw: string,
  password: string,
  rememberMe: boolean
): Promise<{ user: UserProfile; tokens: AuthTokens }> {
  const email = emailRaw.toLowerCase().trim();
  assertCorporateEmailAllowed(email, [...config.corporateEmailDomains]);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), emailVerified: true },
  });

  const accessExpires =
    typeof config.jwt.rememberExpiresIn === 'string'
      ? config.jwt.rememberExpiresIn
      : String(config.jwt.rememberExpiresIn);
  const normalExpires =
    typeof config.jwt.expiresIn === 'string' ? config.jwt.expiresIn : String(config.jwt.expiresIn);

  const accessToken = generateAccessToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      passwordMustChange: user.passwordMustChange,
    },
    { expiresIn: rememberMe ? accessExpires : normalExpires }
  );
  const refreshToken = await generateRefreshToken(user.id);

  const seconds = otpExpiresSeconds(rememberMe);
  const userProfile = await buildUserProfile(user.id);

  return {
    user: userProfile,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: seconds,
    },
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<AuthTokens> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!storedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (storedToken.revokedAt) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  if (storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: storedToken.userId },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or deactivated');
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Generate new tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    passwordMustChange: user.passwordMustChange,
  });
  const newRefreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 7 * 24 * 60 * 60,
  };
}

/**
 * Logout user by revoking refresh token
 */
export async function logoutUser(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { revokedAt: new Date() },
  });
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  return buildUserProfile(userId);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; company?: string }
): Promise<UserProfile> {
  await prisma.user.update({
    where: { id: userId },
    data,
  });

  return buildUserProfile(userId);
}

/**
 * Change user password. When `passwordMustChange` is true, `currentPassword` may be omitted (still authenticated via JWT).
 * Returns new tokens (refresh tokens rotated).
 */
export async function changePassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string
): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  if (user.passwordMustChange) {
    if (currentPassword !== undefined && currentPassword !== '') {
      const ok = await comparePassword(currentPassword, user.password);
      if (!ok) {
        throw new UnauthorizedError('Current password is incorrect');
      }
    }
  } else {
    if (!currentPassword) {
      throw new UnauthorizedError('Current password is required');
    }
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, passwordMustChange: false },
  });

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    passwordMustChange: false,
  });
  const refreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    expiresIn: 7 * 24 * 60 * 60,
  };
}

/**
 * Clean up expired refresh tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  });

  return result.count;
}
