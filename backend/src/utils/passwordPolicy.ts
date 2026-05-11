import { z } from 'zod';

/** Product rule: min 8 chars, at least one uppercase, one special character */
export const passwordFieldSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[A-Z])(?=.*[^A-Za-z0-9])/,
    'Password must contain at least one uppercase letter and one special character'
  );
