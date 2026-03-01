import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { sendError } from '../utils/helpers.js';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validation middleware factory
 * Validates request body, query params, or route params against Zod schemas
 */
export function validateRequest(schemas: ValidationSchemas) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const errors: string[] = [];

      // Validate body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map(
              (e) => `body.${e.path.join('.')}: ${e.message}`
            )
          );
        } else {
          req.body = result.data;
        }
      }

      // Validate query params
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map(
              (e) => `query.${e.path.join('.')}: ${e.message}`
            )
          );
        } else {
          req.query = result.data;
        }
      }

      // Validate route params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map(
              (e) => `params.${e.path.join('.')}: ${e.message}`
            )
          );
        } else {
          req.params = result.data;
        }
      }

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors,
        });
        return;
      }

      next();
    } catch (error) {
      sendError(res, 'Validation error', 400);
    }
  };
}

/**
 * Validate body only
 */
export function validateBody(schema: ZodSchema) {
  return validateRequest({ body: schema });
}

/**
 * Validate query only
 */
export function validateQuery(schema: ZodSchema) {
  return validateRequest({ query: schema });
}

/**
 * Validate params only
 */
export function validateParams(schema: ZodSchema) {
  return validateRequest({ params: schema });
}

// Common param schemas
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const paginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
