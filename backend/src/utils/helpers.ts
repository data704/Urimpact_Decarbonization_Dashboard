import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types/index.js';

/**
 * Send a success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: string,
  statusCode = 400
): Response {
  const response: ApiResponse = {
    success: false,
    error,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  meta?: { organizationLimit?: { userCount: number; maxUsers: number } }
): Response {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  };
  if (meta?.organizationLimit) {
    response.organizationLimit = meta.organizationLimit;
  }
  return res.status(200).json(response);
}

/**
 * Parse pagination query parameters
 */
export function parsePagination(query: {
  page?: string;
  limit?: string;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Sanitize file name for storage
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Get file extension
 */
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

/**
 * Calculate date range for billing period
 */
export function calculateBillingPeriod(date: Date): {
  start: Date;
  end: Date;
} {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Convert kg CO2e to tonnes
 */
export function kgToTonnes(kg: number): number {
  return kg / 1000;
}

/**
 * Convert tonnes CO2e to kg
 */
export function tonnesToKg(tonnes: number): number {
  return tonnes * 1000;
}

/**
 * Format emissions value for display
 */
export function formatEmissions(value: number, unit: 'kg' | 'tonnes' = 'kg'): string {
  if (unit === 'tonnes') {
    return `${value.toFixed(2)} tCO2e`;
  }
  return `${value.toFixed(2)} kg CO2e`;
}

/**
 * Map UAE region codes
 */
export const UAE_REGIONS: Record<string, string> = {
  'AE-DU': 'Dubai',
  'AE-AZ': 'Abu Dhabi',
  'AE-SH': 'Sharjah',
  'AE-AJ': 'Ajman',
  'AE-FU': 'Fujairah',
  'AE-RK': 'Ras Al Khaimah',
  'AE-UQ': 'Umm Al Quwain',
  AE: 'United Arab Emirates',
};

/**
 * Map utility provider to region
 */
export const UTILITY_PROVIDER_REGIONS: Record<string, string> = {
  DEWA: 'AE-DU',
  ADWEA: 'AE-AZ',
  SEWA: 'AE-SH',
  FEWA: 'AE-FU',
  AADC: 'AE-AZ',
  ADDC: 'AE-AZ',
};

/**
 * Get region from utility provider name
 */
export function getRegionFromProvider(provider: string): string {
  const normalizedProvider = provider.toUpperCase().replace(/\s+/g, '');
  return UTILITY_PROVIDER_REGIONS[normalizedProvider] || 'AE';
}
