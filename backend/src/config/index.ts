import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** True when SMTP + sender are set so login OTP can be emailed. */
const smtpFullyConfigured =
  Boolean((process.env.SMTP_HOST || '').trim()) &&
  Boolean((process.env.MAIL_FROM || process.env.SMTP_USER || '').trim());

/**
 * Include OTP in POST /auth/login response (`debugOtp`) for the next verify step.
 * - EXPOSE_LOGIN_OTP=false → never expose (use only with working SMTP in production).
 * - EXPOSE_LOGIN_OTP=true → always expose.
 * - Otherwise → expose when SMTP is not configured (deployed testing without a mail provider).
 */
function resolveExposeLoginOtp(): boolean {
  if (process.env.EXPOSE_LOGIN_OTP === 'false') return false;
  if (process.env.EXPOSE_LOGIN_OTP === 'true') return true;
  return !smtpFullyConfigured;
}

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  /** Empty list = any domain allowed */
  corporateEmailDomains: (process.env.CORPORATE_EMAIL_DOMAINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  auth: {
    loginOtpExpiresMinutes: parseInt(process.env.LOGIN_OTP_EXPIRES_MINUTES || '15', 10),
    /** OTP echoed in API as `debugOtp` when no SMTP or when EXPOSE_LOGIN_OTP=true (see resolveExposeLoginOtp). */
    exposeLoginOtp: resolveExposeLoginOtp(),
    /**
     * When true: POST /auth/login returns JWT immediately (no email OTP step).
     * Default ON in development; use SKIP_LOGIN_OTP=false locally when testing OTP flow.
     * In production, the OTP step runs by default; set SKIP_LOGIN_OTP=true for password-only login.
     */
    skipLoginOtp:
      process.env.SKIP_LOGIN_OTP === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.SKIP_LOGIN_OTP !== 'false'),
  },

  /** Optional SMTP for login OTP (and other transactional mail). If SMTP_HOST is unset, OTP is not emailed. */
  mail: {
    smtpHost: (process.env.SMTP_HOST || '').trim(),
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: (process.env.SMTP_USER || '').trim(),
    smtpPass: (process.env.SMTP_PASS || '').trim(),
    from: (process.env.MAIL_FROM || process.env.SMTP_USER || '').trim(),
  },

  // AWS S3
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || 'urimpact-uploads',
  },

  // Deprecated: we no longer use Affinda; receipt reading is done via Anthropic (Claude)
  affinda: {
    apiKey: '',
    apiUrl: 'https://api.affinda.com/v3',
  },

  // Anthropic (Claude) API – used instead of Affinda to read receipts and extract numbers
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    apiUrl: process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1',
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '8192', 10),
  },

  // Climatiq API
  climatiq: {
    apiKey: process.env.CLIMATIQ_API_KEY || '',
    apiUrl: process.env.CLIMATIQ_API_URL || 'https://api.climatiq.io',
  },

  // File Upload (always include xlsx,xls for Excel receipt uploads)
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedFileTypes: (() => {
      const raw = process.env.ALLOWED_FILE_TYPES || 'pdf,jpg,jpeg,png,xlsx,xls';
      const types = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!types.includes('xlsx')) types.push('xlsx');
      if (!types.includes('xls')) types.push('xls');
      return types;
    })(),
    uploadDir: path.resolve(__dirname, '../../uploads'),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10), // 15 minutes
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '30', 10), // 30 login/register/refresh per window
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // CORS — supports comma-separated origins in CORS_ORIGIN env var
  cors: {
    origin: (() => {
      const raw = process.env.CORS_ORIGIN || 'http://localhost:5173';
      const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
      return origins.length === 1 ? origins[0] : origins;
    })(),
    credentials: true,
  },
} as const;

// Validate required environment variables
export function validateEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Some features may not work correctly.');
  }
}

export default config;
