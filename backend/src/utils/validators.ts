import { z } from 'zod';

// User Registration Schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  company: z.string().optional(),
});

// User Login Schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Update Profile Schema
export const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  company: z.string().optional(),
});

// Change Password Schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
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
});

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
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  emailVerified: z.boolean().optional(),
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
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmissionCalculationInput = z.infer<typeof emissionCalculationSchema>;
export type CustomReportInput = z.infer<typeof customReportSchema>;
