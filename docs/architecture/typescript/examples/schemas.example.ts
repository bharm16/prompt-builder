/**
 * Example Schemas File
 * 
 * This file demonstrates Zod schema patterns for the Prompt Builder codebase.
 * Schemas provide runtime validation and derive TypeScript types.
 */

import { z } from 'zod';

// ===========================================
// BASIC SCHEMAS
// ===========================================

/**
 * Reusable schema fragments
 * Define once, compose into larger schemas
 */
export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const EmailSchema = z.string().email();
export const NonEmptyStringSchema = z.string().min(1);

// ===========================================
// DOMAIN SCHEMAS
// ===========================================

/**
 * Video form data schema
 * - Validates user input
 * - Provides clear error messages
 */
export const VideoFormSchema = z.object({
  subject: z.string()
    .min(3, 'Subject must be at least 3 characters')
    .max(100, 'Subject must be under 100 characters'),
  
  action: z.string()
    .min(3, 'Action must be at least 3 characters')
    .max(100, 'Action must be under 100 characters'),
  
  location: z.string()
    .min(3, 'Location must be at least 3 characters')
    .max(100, 'Location must be under 100 characters'),
  
  // Optional fields with defaults
  atmosphere: z.object({
    mood: z.string(),
    lighting: z.string(),
    timeOfDay: z.string().optional(),
    weather: z.string().optional(),
  }).optional(),
  
  technical: z.object({
    duration: z.number().min(1).max(60),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']),
    frameRate: z.number().default(24),
    style: z.enum(['cinematic', 'documentary', 'abstract', 'realistic']),
  }).optional(),
});

// Derive TypeScript type from schema
export type VideoFormData = z.infer<typeof VideoFormSchema>;

// ===========================================
// API RESPONSE SCHEMAS
// ===========================================

/**
 * Video concept API response
 * - Validates data from backend
 * - Ensures type safety at runtime
 */
export const VideoConceptResponseSchema = z.object({
  id: IdSchema,
  concept: z.string(),
  elements: z.object({
    subject: z.string(),
    action: z.string(),
    location: z.string(),
    atmosphere: z.string().optional(),
    camera: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()).default([]),
  createdAt: TimestampSchema,
});

export type VideoConceptResponse = z.infer<typeof VideoConceptResponseSchema>;

/**
 * Optimization result schema
 */
export const OptimizationResultSchema = z.object({
  optimized: z.string(),
  score: z.number().min(0).max(100),
  metadata: z.object({
    source: z.enum(['cache', 'ai', 'fallback']),
    provider: z.string().optional(),
    latency: z.number().optional(),
    timestamp: TimestampSchema,
  }),
  suggestions: z.array(z.object({
    text: z.string(),
    reason: z.string(),
  })).default([]),
});

export type OptimizationResult = z.infer<typeof OptimizationResultSchema>;

// ===========================================
// API ERROR SCHEMA
// ===========================================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  status: z.number().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ===========================================
// GENERIC RESPONSE WRAPPER
// ===========================================

/**
 * Generic API response factory
 * Use: ApiResponseSchema(VideoConceptResponseSchema)
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean(),
    error: ApiErrorSchema.optional(),
    metadata: z.object({
      requestId: z.string(),
      timestamp: TimestampSchema,
    }).optional(),
  });

// ===========================================
// PAGINATED RESPONSE
// ===========================================

export const PaginationSchema = z.object({
  page: z.number().min(1),
  pageSize: z.number().min(1).max(100),
  total: z.number().min(0),
  hasMore: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: PaginationSchema,
  });

// ===========================================
// URL PARAMS SCHEMAS
// ===========================================

/**
 * Route params schema
 * Use with react-router or similar
 */
export const VideoRouteParamsSchema = z.object({
  id: IdSchema,
  mode: z.enum(['edit', 'view', 'preview']).default('view'),
  tab: z.coerce.number().min(0).max(4).default(0),
});

export type VideoRouteParams = z.infer<typeof VideoRouteParamsSchema>;

// ===========================================
// ENVIRONMENT VARIABLES
// ===========================================

/**
 * Validate env vars at app startup
 */
export const EnvSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_API_KEY: z.string().min(1),
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

// ===========================================
// DISCRIMINATED UNIONS
// ===========================================

/**
 * Event schema with discriminated union
 * Each event type has specific payload
 */
const BaseEventSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
});

const UserCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('USER_CREATED'),
  payload: z.object({
    userId: z.string(),
    email: EmailSchema,
  }),
});

const UserUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal('USER_UPDATED'),
  payload: z.object({
    userId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

const UserDeletedEventSchema = BaseEventSchema.extend({
  type: z.literal('USER_DELETED'),
  payload: z.object({
    userId: z.string(),
  }),
});

export const EventSchema = z.discriminatedUnion('type', [
  UserCreatedEventSchema,
  UserUpdatedEventSchema,
  UserDeletedEventSchema,
]);

export type Event = z.infer<typeof EventSchema>;

// ===========================================
// TRANSFORMS
// ===========================================

/**
 * Schema with transformation
 * Converts API response format to internal format
 */
export const ApiUserSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  user_email: EmailSchema,
  created_at: z.string(),
}).transform((data) => ({
  id: data.user_id,
  name: data.user_name,
  email: data.user_email,
  createdAt: new Date(data.created_at),
}));

export type User = z.infer<typeof ApiUserSchema>;

// ===========================================
// REFINEMENTS
// ===========================================

/**
 * Password schema with custom validation
 */
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[a-z]/.test(val),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one number'
  );

/**
 * Date range schema with cross-field validation
 */
export const DateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export type DateRange = z.infer<typeof DateRangeSchema>;

// ===========================================
// SCHEMA UTILITIES
// ===========================================

/**
 * Make all fields optional (for PATCH requests)
 */
export const VideoFormPatchSchema = VideoFormSchema.partial();
export type VideoFormPatch = z.infer<typeof VideoFormPatchSchema>;

/**
 * Pick specific fields
 */
export const VideoFormCoreSchema = VideoFormSchema.pick({
  subject: true,
  action: true,
  location: true,
});
export type VideoFormCore = z.infer<typeof VideoFormCoreSchema>;

/**
 * Omit specific fields (for creation - no ID yet)
 */
export const CreateVideoConceptSchema = VideoConceptResponseSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateVideoConcept = z.infer<typeof CreateVideoConceptSchema>;

// ===========================================
// USAGE EXAMPLES
// ===========================================

/**
 * Example: Parsing API response
 */
export async function fetchVideoConcept(prompt: string): Promise<VideoConceptResponse> {
  const response = await fetch('/api/video-concept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Runtime validation - throws ZodError if invalid
  return VideoConceptResponseSchema.parse(data);
}

/**
 * Example: Safe parsing with error handling
 */
export function validateForm(data: unknown): {
  success: true;
  data: VideoFormData;
} | {
  success: false;
  errors: Record<string, string>;
} {
  const result = VideoFormSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Convert Zod errors to record
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const field = err.path.join('.');
    if (!errors[field]) {
      errors[field] = err.message;
    }
  });
  
  return { success: false, errors };
}

/**
 * Example: Validating env at startup
 */
export function validateEnv(): Env {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    console.error('Invalid environment variables:', error);
    process.exit(1);
  }
}
