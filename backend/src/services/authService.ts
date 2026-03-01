import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { AuthTokens, CreateUserInput, UserProfile } from '../types/index.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../middleware/errorHandler.js';
import { UserRole } from '@prisma/client';

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
export function generateAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
}): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
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

/**
 * Register a new user
 */
export async function registerUser(input: CreateUserInput): Promise<UserProfile> {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Hash password
  const hashedPassword = await hashPassword(input.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
    },
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

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company ?? undefined,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

/**
 * Login user and return tokens
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: UserProfile; tokens: AuthTokens }> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = await generateRefreshToken(user.id);

  const userProfile: UserProfile = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company ?? undefined,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };

  return {
    user: userProfile,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    throw new NotFoundError('User');
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company ?? undefined,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: { firstName?: string; lastName?: string; company?: string }
): Promise<UserProfile> {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
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

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company ?? undefined,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  const isValidPassword = await comparePassword(currentPassword, user.password);
  if (!isValidPassword) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Revoke all refresh tokens for security
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
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
