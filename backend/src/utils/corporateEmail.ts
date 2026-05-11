import { UnauthorizedError } from '../middleware/errorHandler.js';

/**
 * Empty allowlist = allow any domain (typical for local development).
 */
export function assertCorporateEmailAllowed(email: string, allowedDomains: string[]): void {
  if (!allowedDomains.length) return;

  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain || !allowedDomains.includes(domain)) {
    throw new UnauthorizedError(
      'This email domain is not authorized. Use your corporate email address.'
    );
  }
}
