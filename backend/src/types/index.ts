import { Request } from 'express';
import { UserRole } from '@prisma/client';

// Authenticated Request with user info
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    /** Tenant scope — dashboard/emissions aggregate by org, not single user */
    organizationId?: string | null;
  };
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /** Optional extra payload (e.g. organizationLimit for admin users list) */
  organizationLimit?: { userCount: number; maxUsers: number };
}

// Pagination Query
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Document Types
export interface ExtractedDocumentData {
  provider?: string;
  accountNumber?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  consumption?: number;
  consumptionUnit?: string;
  amount?: number;
  currency?: string;
  region?: string;
  documentDate?: string;
  meterNumber?: string;
  tariffType?: string;
  fuelType?: string;
  quantity?: number;
  quantityUnit?: string;
}

export interface OCRResult {
  rawText: string;
  confidence: number;
  extractedFields: ExtractedDocumentData;
  processingTime: number;
}

// Emissions Types
export interface EmissionCalculationInput {
  activityType: string;
  activityAmount: number;
  activityUnit: string;
  region?: string;
  scope?: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  category?: string;
}

export interface EmissionCalculationResult {
  co2e: number;
  co2eUnit: string;
  co2?: number;
  ch4?: number;
  n2o?: number;
  emissionFactor: number;
  emissionFactorUnit: string;
  dataSource: string;
  dataYear?: number;
}

// Climatiq API Types
export interface ClimatiqEstimateRequest {
  emission_factor: {
    activity_id: string;
    region?: string;
    year?: number;
    source?: string;
    data_version?: string;
  };
  parameters: {
    energy?: number;
    energy_unit?: string;
    weight?: number;
    weight_unit?: string;
    volume?: number;
    volume_unit?: string;
    distance?: number;
    distance_unit?: string;
    money?: number;
    money_unit?: string;
  };
}

export interface ClimatiqEstimateResponse {
  co2e: number;
  co2e_unit: string;
  co2e_calculation_method: string;
  co2e_calculation_origin: string;
  emission_factor: {
    name: string;
    activity_id: string;
    id: string;
    access_type: string;
    source: string;
    source_dataset: string;
    year: number;
    region: string;
    category: string;
    source_lca_activity: string;
    data_quality_flags: string[];
  };
  constituent_gases: {
    co2e_total: number;
    co2e_other: number | null;
    co2: number | null;
    ch4: number | null;
    n2o: number | null;
  };
}


// Dashboard Types
export interface DashboardStats {
  totalEmissions: number;
  emissionsByScope: {
    scope1: number;
    scope2: number;
    scope3: number;
  };
  emissionsByCategory: Record<string, number>;
  documentsProcessed: number;
  documentsUploaded: number;
  recentTrend: {
    period: string;
    emissions: number;
  }[];
}

// Filter Types
export interface EmissionFilters {
  scope?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  region?: string;
}

export interface DocumentFilters {
  status?: string;
  documentType?: string;
  startDate?: string;
  endDate?: string;
}

// User Types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  /** Tenant — all org members share one dashboard */
  organizationId?: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  company?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
