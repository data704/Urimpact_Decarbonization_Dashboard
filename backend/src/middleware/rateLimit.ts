import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for authentication endpoints (login, register, refresh).
 * Configurable via RATE_LIMIT_AUTH_WINDOW_MS and RATE_LIMIT_AUTH_MAX.
 * More lenient than before to avoid blocking legitimate sign-in (e.g. retries, shared IP).
 */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  message: {
    success: false,
    error: 'Too many sign-in attempts. Please try again in a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    error: 'Upload limit reached, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for expensive operations (reports, exports)
 */
export const heavyOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: {
    success: false,
    error: 'Too many report requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
