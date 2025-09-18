import { z } from 'zod';

// Column validation schemas
export const createColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(255, 'Column name too long'),
  type: z.enum(['text', 'number', 'boolean', 'date', 'email', 'url', 'json'], {
    message: 'Invalid column type',
  }),
  config: z.object({
    required: z.boolean().optional(),
    defaultValue: z.any().optional(),
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
  }).optional(),
  position: z.number().int().min(0).optional(),
  isComputed: z.boolean().optional().default(false),
  formula: z.string().optional(),
}).refine((data) => {
  // If isComputed is true, formula must be provided
  if (data.isComputed && (!data.formula || data.formula.trim().length === 0)) {
    return false;
  }
  // If formula is provided, it should start with =
  if (data.formula && !data.formula.trim().startsWith('=')) {
    return false;
  }
  return true;
}, {
  message: 'Formula is required for computed columns and must start with =',
  path: ['formula'],
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['text', 'number', 'boolean', 'date', 'email', 'url', 'json'], {
    message: 'Invalid column type',
  }).optional(),
  config: z.object({
    required: z.boolean().optional(),
    defaultValue: z.any().optional(),
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
  }).optional(),
  position: z.number().int().min(0).optional(),
  isComputed: z.boolean().optional(),
  formula: z.string().optional(),
}).refine((data) => {
  // If isComputed is true, formula must be provided
  if (data.isComputed && (!data.formula || data.formula.trim().length === 0)) {
    return false;
  }
  // If formula is provided, it should start with =
  if (data.formula && !data.formula.trim().startsWith('=')) {
    return false;
  }
  return true;
}, {
  message: 'Formula is required for computed columns and must start with =',
  path: ['formula'],
});

// Row validation schemas
export const createRowSchema = z.object({
  data: z.record(z.string(), z.any()),
  formulas: z.record(z.string(), z.string()).optional(), // columnName -> formula
});

export const updateRowSchema = z.object({
  data: z.record(z.string(), z.any()),
  formulas: z.record(z.string(), z.string()).optional(), // columnName -> formula
});

export const bulkCreateRowsSchema = z.object({
  rows: z.array(createRowSchema).min(1, 'At least one row required').max(100, 'Too many rows'),
});

// Query parameter validation schemas
export const filterSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(['=', '!=', 'contains', '>', '<', '>=', '<=', 'is_null', 'is_not_null']),
  value: z.any().optional(),
});

export const sortSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

export const rowQueryParamsSchema = z.object({
  filter: z.array(filterSchema).optional(),
  sort: z.array(sortSchema).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

// Data validation based on column type
export function validateCellValue(value: any, columnType: string, config?: any): { isValid: boolean; error?: string } {
  if (value === null || value === undefined) {
    if (config?.required) {
      return { isValid: false, error: 'This field is required' };
    }
    return { isValid: true };
  }

  switch (columnType) {
    case 'text':
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Value must be a string' };
      }
      if (config?.validation?.min && value.length < config.validation.min) {
        return { isValid: false, error: `Minimum length is ${config.validation.min}` };
      }
      if (config?.validation?.max && value.length > config.validation.max) {
        return { isValid: false, error: `Maximum length is ${config.validation.max}` };
      }
      if (config?.validation?.pattern) {
        const regex = new RegExp(config.validation.pattern);
        if (!regex.test(value)) {
          return { isValid: false, error: 'Value does not match required pattern' };
        }
      }
      break;

    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        return { isValid: false, error: 'Value must be a number' };
      }
      if (config?.validation?.min && num < config.validation.min) {
        return { isValid: false, error: `Minimum value is ${config.validation.min}` };
      }
      if (config?.validation?.max && num > config.validation.max) {
        return { isValid: false, error: `Maximum value is ${config.validation.max}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { isValid: false, error: 'Value must be a boolean' };
      }
      break;

    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: 'Value must be a valid date' };
      }
      break;

    case 'email':
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Email must be a string' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, error: 'Value must be a valid email address' };
      }
      break;

    case 'url':
      if (typeof value !== 'string') {
        return { isValid: false, error: 'URL must be a string' };
      }
      try {
        new URL(value);
      } catch {
        return { isValid: false, error: 'Value must be a valid URL' };
      }
      break;

    case 'json':
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch {
          return { isValid: false, error: 'Value must be valid JSON' };
        }
      }
      break;

    default:
      return { isValid: false, error: 'Unknown column type' };
  }

  return { isValid: true };
}

// Error handling helpers
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function handleApiError(error: Error) {
  console.error('API Error:', error);

  if (error instanceof ValidationError) {
    return {
      error: error.message,
      field: error.field,
      status: 400,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      error: error.message,
      status: 404,
    };
  }

  if (error instanceof ConflictError) {
    return {
      error: error.message,
      status: 409,
    };
  }

  if (error instanceof z.ZodError) {
    return {
      error: 'Validation failed',
      details: error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
      status: 400,
    };
  }

  return {
    error: 'Internal server error',
    status: 500,
  };
}