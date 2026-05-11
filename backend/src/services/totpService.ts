import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../config/database.js';
import { UnauthorizedError } from '../middleware/errorHandler.js';

export async function beginTotpSetup(userId: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });
  if (!user) throw new UnauthorizedError('User not found');
  if (user.totpEnabled) throw new UnauthorizedError('Two-factor authentication is already enabled');

  const secret = speakeasy.generateSecret({
    name: `Urimpact (${user.email})`,
    issuer: 'Urimpact',
    length: 32,
  });

  const base32 = secret.base32;
  if (!base32) {
    throw new UnauthorizedError('Failed to generate authenticator secret');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: base32 },
  });

  const otpauthUrl = secret.otpauth_url || '';
  const qrDataUrl = otpauthUrl ? await QRCode.toDataURL(otpauthUrl) : '';

  return {
    secret: base32,
    otpauthUrl,
    qrDataUrl,
  };
}

export async function confirmTotpSetup(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });
  if (!user?.totpSecret) throw new UnauthorizedError('Start setup first');

  const ok = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!ok) {
    throw new UnauthorizedError('Invalid authenticator code');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true },
  });
}

export async function disableTotp(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) {
    throw new UnauthorizedError('Two-factor authentication is not enabled');
  }

  const ok = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!ok) {
    throw new UnauthorizedError('Invalid authenticator code');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: false, totpSecret: null },
  });
}

export function verifyTotpToken(secretBase32: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token,
    window: 2,
  });
}
