import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
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
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-5-20251101',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
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
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
