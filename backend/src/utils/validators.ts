import { z } from 'zod';
import { EmissionCategory } from '@prisma/client';
import { passwordFieldSchema } from './passwordPolicy.js';

// User Registration Schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordFieldSchema,
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  company: z.string().optional(),
});

// User Login Schema — step 1: credentials only (OTP sent separately)
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const loginVerifySchema = z.object({
  loginChallengeId: z.string().uuid('Invalid login session'),
  otp: z.string().min(4).max(12),
  totpCode: z.string().min(6).max(12).optional(),
});

// Update Profile Schema
export const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  company: z.string().optional(),
});

// Change Password Schema — currentPassword optional when account requires mandatory change
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordFieldSchema,
});

// Document Upload Schema
export const documentUploadSchema = z.object({
  documentType: z.enum(['UTILITY_BILL', 'FUEL_RECEIPT', 'INVOICE', 'OTHER']).optional(),
});

// Manual Emission Calculation Schema
export const emissionCalculationSchema = z.object({
  activityType: z.string().min(1, 'Activity type is required'),
  activityAmount: z.number().positive('Activity amount must be positive'),
  activityUnit: z.string().min(1, 'Activity unit is required'),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']).optional(),
  category: z.string().optional(),
  region: z.string().optional(),
  billingPeriodStart: z.string().datetime().optional(),
  billingPeriodEnd: z.string().datetime().optional(),
  notes: z.string().optional(),
  // Optional site attribution (dashboard / GHG forms)
  siteId: z.string().optional(),
  siteName: z.string().optional(),
});

/** Single activity row for POST /api/ghg/scope-{1|2}/categories/:slug/form (one emission per request) */
export const ghgCategoryFormBodySchema = z.object({
  activityType: z.string().min(1, 'Activity type is required'),
  activityAmount: z.number().positive('Activity amount must be positive'),
  activityUnit: z.string().min(1, 'Activity unit is required'),
  /** Optional override of registry default EmissionCategory */
  category: z.nativeEnum(EmissionCategory).optional(),
  region: z.string().optional(),
  billingPeriodStart: z.string().datetime().optional(),
  billingPeriodEnd: z.string().datetime().optional(),
  notes: z.string().optional(),
  siteId: z.string().optional(),
  siteName: z.string().optional(),
  dataEntryChannel: z.enum(['FORM', 'BULK_UPLOAD', 'AI_EXTRACT']).optional().default('FORM'),
});

export type GhgCategoryFormBody = z.infer<typeof ghgCategoryFormBodySchema>;

/**
 * Strict body for Scope 1 — stationary combustion (matches workbook column semantics).
 * Mapped server-side to `GhgCategoryFormBody` for Climatiq / persistence.
 */
export const stationaryCombustionTemplateFormSchema = z
  .object({
    asset: z.string().max(500),
    fuelUsed: z.string().min(1).max(4000),
    fuelUsedQuantity: z.coerce.number().positive(),
    fuelUsedUnit: z.string().min(1).max(120),
    facility: z.string().max(500),
    dateOfTransaction: z.union([z.string(), z.number()]),
    notes: z.string().max(5000).optional(),
    dataEntryChannel: z.enum(['FORM', 'BULK_UPLOAD', 'AI_EXTRACT']).optional().default('FORM'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.asset.trim() && !data.facility.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide Asset or Facility (or both).',
        path: ['asset'],
      });
    }
  });

export type StationaryCombustionTemplateFormBody = z.infer<typeof stationaryCombustionTemplateFormSchema>;

/** Confirmed bulk rows (after user review); `excelRow` is optional metadata for error messages. */
export const stationaryBulkConfirmBodySchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            asset: z.string().max(500),
            fuelUsed: z.string().min(1).max(4000),
            fuelUsedQuantity: z.coerce.number().positive(),
            fuelUsedUnit: z.string().min(1).max(120),
            facility: z.string().max(500),
            dateOfTransaction: z.union([z.string(), z.number()]),
            notes: z.string().max(5000).optional(),
            excelRow: z.number().int().positive().optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export type StationaryBulkConfirmBody = z.infer<typeof stationaryBulkConfirmBodySchema>;

/** Non-stationary categories use the generic GHG row schema. Stationary uses `stationaryCombustionTemplateFormSchema` in the controller. */
export function getGhgCategoryFormBodySchema(_categorySlug: string): z.ZodTypeAny {
  return ghgCategoryFormBodySchema;
}

// Emission Filter Schema
export const emissionFilterSchema = z.object({
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']).optional(),
  category: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  region: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// Document Filter Schema
export const documentFilterSchema = z.object({
  status: z.enum(['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  documentType: z.enum(['UTILITY_BILL', 'FUEL_RECEIPT', 'INVOICE', 'OTHER']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// Admin User Update Schema
export const adminUserUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  role: z
    .enum(['SUPER_ADMIN', 'ADMINISTRATOR', 'DATA_CONTRIBUTOR', 'ANALYST', 'VIEWER'])
    .optional(),
  emailVerified: z.boolean().optional(),
});

// Admin create user (same password rules as register; role optional, default USER)
export const adminUserCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordFieldSchema,
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  company: z.string().optional(),
  role: z
    .enum(['SUPER_ADMIN', 'ADMINISTRATOR', 'DATA_CONTRIBUTOR', 'ANALYST', 'VIEWER'])
    .optional(),
});

const onboardingFacilityRowSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(200),
    facilityType: z.enum([
      'CORPORATE_OFFICE',
      'HEAD_OFFICE',
      'SALES_OFFICE',
      'WAREHOUSE',
      'OTHER',
    ]),
    facilityTypeOther: z.string().max(200).optional().nullable(),
    location: z.string().min(1).max(2000),
    proofDocumentPath: z.string().max(512).optional().nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.facilityType === 'OTHER' && !String(row.facilityTypeOther || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Specify facility type',
        path: ['facilityTypeOther'],
      });
    }
  });

export const onboardingSubmitSchema = z.object({
  legalName: z.string().min(1),
  commercialRegistrationNumber: z.string().min(1),
  headquarterAddress: z.string().min(1),
  isGroupCompany: z.boolean(),
  groupCompanyName: z.string().optional().nullable(),
  sectorIsicCode: z.string().min(1),
  subSectorIsicCode: z.string().min(1),
  revenueAmount: z.number().positive(),
  revenueCurrency: z.string().min(3).max(8),
  employeeCount: z.number().int().positive(),
  pocFullName: z.string().min(1),
  pocDesignation: z.string().min(1),
  pocDepartment: z.string().min(1),
  pocEmail: z.string().email(),
  pocPhone: z.string().min(4),
  pocCountryCode: z.string().min(1),
  facilities: z.array(onboardingFacilityRowSchema).min(1),
});

const scope1VehicleSchema = z.object({
  vehicleType: z.enum(['2_WHEELER', '3_WHEELER', '4_WHEELER']),
  vehicleNumber: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9\s\-]+$/, 'Alphanumeric plate format'),
  fuelUsed: z.enum(['CNG', 'DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID']),
});

const scope1StationarySchema = z.object({
  assetType: z.enum(['BOILER', 'GENSET', 'FURNACE', 'DG_SET', 'KILN', 'OTHER']),
  assetName: z.string().min(1).max(200),
  fuelUsed: z.enum(['COAL', 'KEROSENE', 'CNG', 'LPG', 'DIESEL', 'NATURAL_GAS', 'BIOMASS']),
});

const scope1RefrigerantSchema = z
  .object({
    equipmentName: z.string().min(1).max(200),
    equipmentType: z.enum(['AC', 'CHILLER', 'REFRIGERATOR', 'FIRE_EXTINGUISHER']),
    quantity: z.number().int().positive(),
    refilledInPeriod: z.boolean(),
    gasRefilled: z
      .enum(['HFC_134a', 'R_32', 'R_410A', 'CO2', 'HALON', 'OTHER'])
      .optional()
      .nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.refilledInPeriod && !row.gasRefilled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gas type is required when refilled in period',
        path: ['gasRefilled'],
      });
    }
  });

const PROCESS_SECTOR_VALUES = [
  'CEMENT',
  'METALS',
  'CHEMICALS',
  'OIL_GAS',
  'GLASS',
  'OTHER',
] as const;

const ALLOWED_PROCESS_TYPES: Record<(typeof PROCESS_SECTOR_VALUES)[number], readonly string[]> = {
  CEMENT: ['CLINKER_PRODUCTION', 'CEMENT_OTHER'],
  METALS: ['STEEL_BF_BOF', 'STEEL_EAF', 'METALS_OTHER'],
  CHEMICALS: ['AMMONIA', 'NITRIC_ACID', 'CHEMICALS_OTHER'],
  OIL_GAS: ['REFINING', 'FLARING', 'VENTING', 'OIL_GAS_OTHER'],
  GLASS: ['GLASS_MELTING', 'GLASS_OTHER'],
  OTHER: ['OTHER_SPECIFY'],
};

const scope1ProcessRowSchema = z
  .object({
    facilitySiteId: z.string().min(1).max(128),
    facilityLabel: z.string().min(1).max(300),
    processSector: z.enum(PROCESS_SECTOR_VALUES),
    processType: z.string().min(1).max(64),
    processTypeOther: z.string().max(500).optional().nullable(),
  })
  .superRefine((row, ctx) => {
    const allowed = ALLOWED_PROCESS_TYPES[row.processSector];
    if (!allowed?.includes(row.processType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Process type does not match selected sector',
        path: ['processType'],
      });
    }
    if (row.processSector === 'OTHER') {
      const t = String(row.processTypeOther || '').trim();
      if (t.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Describe the industrial process',
          path: ['processTypeOther'],
        });
      }
    } else if (row.processType.endsWith('_OTHER')) {
      const t = String(row.processTypeOther || '').trim();
      if (t.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Specify the process type',
          path: ['processTypeOther'],
        });
      }
    }
  });

export const scope1OnboardingSchema = z
  .object({
    hasOwnedVehicles: z.boolean(),
    vehicles: z.array(scope1VehicleSchema),
    hasOwnedStationaryAssets: z.boolean(),
    stationaryAssets: z.array(scope1StationarySchema),
    hasRefrigerantEquipment: z.boolean(),
    refrigerantRows: z.array(scope1RefrigerantSchema),
    hasProcessEmissions: z.boolean(),
    processEmissionRows: z.array(scope1ProcessRowSchema),
  })
  .superRefine((data, ctx) => {
    if (data.hasOwnedVehicles && data.vehicles.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one vehicle or set Owned Vehicles to No',
        path: ['vehicles'],
      });
    }
    if (data.hasOwnedStationaryAssets && data.stationaryAssets.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one asset or set Owned Assets to No',
        path: ['stationaryAssets'],
      });
    }
    if (data.hasRefrigerantEquipment && data.refrigerantRows.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one row or set refrigerant question to No',
        path: ['refrigerantRows'],
      });
    }
    if (data.hasProcessEmissions && data.processEmissionRows.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one facility/process row or set process emissions to No',
        path: ['processEmissionRows'],
      });
    }
  });

const SCOPE2_FACILITY_TYPES = [
  'OFFICE',
  'MANUFACTURING',
  'WAREHOUSE',
  'DATA_CENTER',
  'RETAIL',
  'OTHER',
] as const;

const scope2FacilityRowSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(300),
    facilityType: z.enum(SCOPE2_FACILITY_TYPES),
    facilityTypeOther: z.string().max(200).optional().nullable(),
    city: z.string().min(1).max(120),
    state: z.string().min(1).max(120),
    country: z.string().min(1).max(120),
    pinCode: z.string().min(1).max(32),
    totalArea: z.number().positive(),
    totalAreaUnit: z.enum(['SQ_FT', 'SQ_M']),
    renewableElectricityProduction: z.boolean(),
    monthlyProductionKwh: z.array(z.number().nonnegative()).length(12),
  })
  .superRefine((row, ctx) => {
    if (row.facilityType === 'OTHER') {
      const t = String(row.facilityTypeOther || '').trim();
      if (t.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Specify facility type',
          path: ['facilityTypeOther'],
        });
      }
    }
  });

const scope2PurchasedLineSchema = z
  .object({
    enabled: z.boolean(),
    supplierName: z.string().max(500).optional().nullable(),
    supplierAddress: z.string().max(4000).optional().nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.enabled) {
      if (!String(row.supplierName || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Supplier name is required',
          path: ['supplierName'],
        });
      }
      if (!String(row.supplierAddress || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Supplier address is required for grid / emission-factor mapping',
          path: ['supplierAddress'],
        });
      }
    }
  });

export const scope2OnboardingSchema = z
  .object({
    totalFacilityCount: z.number().int().positive().max(500),
    facilities: z.array(scope2FacilityRowSchema).min(1).max(500),
    purchasedElectricity: scope2PurchasedLineSchema,
    purchasedHeating: scope2PurchasedLineSchema,
    purchasedCooling: scope2PurchasedLineSchema,
    purchasedSteam: scope2PurchasedLineSchema,
  })
  .superRefine((data, ctx) => {
    if (data.totalFacilityCount !== data.facilities.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total facilities must match the number of facility rows',
        path: ['totalFacilityCount'],
      });
    }
  });

// Custom Report Schema
export const customReportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  scopes: z.array(z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3'])).optional(),
  categories: z.array(z.string()).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  format: z.enum(['json', 'csv', 'excel']).optional(),
});

// Validation helper function
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LoginVerifyInput = z.infer<typeof loginVerifySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmissionCalculationInput = z.infer<typeof emissionCalculationSchema>;
export type CustomReportInput = z.infer<typeof customReportSchema>;
export type Scope1OnboardingInput = z.infer<typeof scope1OnboardingSchema>;
export type Scope2OnboardingInput = z.infer<typeof scope2OnboardingSchema>;