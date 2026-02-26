/**
 * Zod-based environment variable validation.
 *
 * Validates and coerces all server env vars at startup, failing fast with
 * a complete list of errors rather than surfacing issues one at a time
 * when individual services attempt to read them.
 */

import { z } from 'zod';
import { logger } from '@infrastructure/Logger';

// ─── Reusable coercion helpers ─────────────────────────────────

const optionalString = () => z.string().optional();
const optionalApiKey = () => z.string().min(1).optional();
const coercePositiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const coerceNonNegativeNumber = (fallback: number) =>
  z.coerce.number().min(0).default(fallback);
const coerceBooleanString = (fallback: boolean) =>
  z.string().default(String(fallback)).transform(v => v === 'true');

// ─── Domain schemas ────────────────────────────────────────────

const serverSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PROCESS_ROLE: z.enum(['api', 'worker']).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

const featureFlagSchema = z.object({
  PROMPT_OUTPUT_ONLY: coerceBooleanString(false),
  ENABLE_CONVERGENCE: z.string().default('true').transform(v => v !== 'false'),
  VIDEO_JOB_INLINE_ENABLED: coerceBooleanString(false),
  VIDEO_JOB_WORKER_DISABLED: coerceBooleanString(false),
  ALLOW_UNHEALTHY_GEMINI: coerceBooleanString(false),
  GEMINI_ALLOW_UNHEALTHY: coerceBooleanString(false),
  UNHANDLED_REJECTION_MODE: z.enum(['classified', 'strict']).default('classified'),
});

const openaiSchema = z.object({
  OPENAI_API_KEY: optionalApiKey(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_TIMEOUT_MS: coercePositiveInt(60000),
  OPENAI_MAX_CONCURRENT: coercePositiveInt(5),
  OPENAI_QUEUE_TIMEOUT_MS: coercePositiveInt(30000),
});

const groqSchema = z.object({
  GROQ_API_KEY: optionalApiKey(),
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
  GROQ_TIMEOUT_MS: coercePositiveInt(5000),
  GROQ_MAX_CONCURRENT: coercePositiveInt(5),
  GROQ_QUEUE_TIMEOUT_MS: coercePositiveInt(30000),
});

const geminiSchema = z.object({
  GEMINI_API_KEY: optionalApiKey(),
  GOOGLE_API_KEY: optionalApiKey(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_TIMEOUT_MS: coercePositiveInt(30000),
  GEMINI_MAX_CONCURRENT: coercePositiveInt(5),
  GEMINI_QUEUE_TIMEOUT_MS: coercePositiveInt(30000),
  GEMINI_BASE_URL: z.string().default('https://generativelanguage.googleapis.com/v1beta'),
});

const qwenSchema = z.object({
  QWEN_MODEL: z.string().default('qwen/qwen3-32b'),
  QWEN_TIMEOUT_MS: coercePositiveInt(10000),
});

const firebaseSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1, 'VITE_FIREBASE_API_KEY is required'),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, 'VITE_FIREBASE_PROJECT_ID is required'),
  VITE_FIREBASE_AUTH_DOMAIN: optionalString(),
  VITE_FIREBASE_STORAGE_BUCKET: optionalString(),
  VITE_FIREBASE_MESSAGING_SENDER_ID: optionalString(),
  VITE_FIREBASE_APP_ID: optionalString(),
  VITE_FIREBASE_MEASUREMENT_ID: optionalString(),
  GOOGLE_APPLICATION_CREDENTIALS: optionalString(),
});

const storageSchema = z.object({
  GCS_BUCKET_NAME: optionalString(),
  FIREBASE_STORAGE_BUCKET: optionalString(),
  IMAGE_STORAGE_BUCKET: optionalString(),
  VIDEO_STORAGE_BUCKET: optionalString(),
  ASSET_STORAGE_BUCKET: optionalString(),
  SPAN_LABELING_MODELS_GCS_URI: optionalString(),
  VIDEO_STORAGE_BASE_PATH: z.string().default('video-previews'),
  IMAGE_STORAGE_BASE_PATH: z.string().default('image-previews'),
  VIDEO_STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().positive().optional(),
  IMAGE_STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().positive().optional(),
  VIDEO_STORAGE_CACHE_CONTROL: z.string().default('public, max-age=86400'),
  IMAGE_STORAGE_CACHE_CONTROL: z.string().default('public, max-age=86400'),
});

const videoGenerationSchema = z.object({
  REPLICATE_API_TOKEN: optionalApiKey(),
  FAL_KEY: optionalApiKey(),
  FAL_API_KEY: optionalApiKey(),
  FAL_KEY_ID: optionalString(),
  FAL_KEY_SECRET: optionalString(),
  LUMA_API_KEY: optionalApiKey(),
  LUMAAI_API_KEY: optionalApiKey(),
  KLING_API_KEY: optionalApiKey(),
  KLING_API_BASE_URL: optionalString(),
  IMAGE_PREVIEW_PROVIDER: optionalString(),
  IMAGE_PREVIEW_PROVIDER_ORDER: optionalString(),
});

const videoJobSchema = z.object({
  VIDEO_JOB_MAX_ATTEMPTS: coercePositiveInt(3),
  VIDEO_JOB_LEASE_SECONDS: coercePositiveInt(60),
  VIDEO_JOB_HEARTBEAT_INTERVAL_MS: coercePositiveInt(20000),
  VIDEO_JOB_STALE_QUEUE_SECONDS: coercePositiveInt(300),
  VIDEO_JOB_STALE_PROCESSING_SECONDS: coercePositiveInt(90),
  VIDEO_JOB_SWEEP_INTERVAL_SECONDS: coercePositiveInt(15),
  VIDEO_PROVIDER_POLL_TIMEOUT_MS: coercePositiveInt(270000),
  VIDEO_WORKFLOW_TIMEOUT_MS: coercePositiveInt(300000),
  VIDEO_JOB_POLL_INTERVAL_MS: coercePositiveInt(2000),
  VIDEO_JOB_MAX_CONCURRENT: coercePositiveInt(2),
  VIDEO_JOB_PER_PROVIDER_MAX_CONCURRENT: z.coerce.number().int().positive().optional(),
  VIDEO_PROVIDER_CIRCUIT_FAILURE_RATE: coerceNonNegativeNumber(0.6),
  VIDEO_PROVIDER_CIRCUIT_MIN_VOLUME: coercePositiveInt(20),
  VIDEO_PROVIDER_CIRCUIT_COOLDOWN_MS: coercePositiveInt(60000),
  VIDEO_PROVIDER_CIRCUIT_MAX_SAMPLES: coercePositiveInt(50),
  VIDEO_DLQ_REPROCESSOR_DISABLED: coerceBooleanString(false),
  VIDEO_DLQ_POLL_INTERVAL_MS: coercePositiveInt(30000),
  VIDEO_DLQ_MAX_ENTRIES_PER_RUN: coercePositiveInt(5),
  VIDEO_GENERATE_IDEMPOTENCY_PENDING_TTL_MS: coercePositiveInt(360000),
  VIDEO_GENERATE_IDEMPOTENCY_REPLAY_TTL_MS: coercePositiveInt(86400000),
  VIDEO_WORKER_SHUTDOWN_DRAIN_SECONDS: coercePositiveInt(45),
});

const firestoreCircuitSchema = z.object({
  FIRESTORE_CIRCUIT_TIMEOUT_MS: coercePositiveInt(3000),
  FIRESTORE_CIRCUIT_ERROR_THRESHOLD_PERCENT: coercePositiveInt(50),
  FIRESTORE_CIRCUIT_RESET_TIMEOUT_MS: coercePositiveInt(15000),
  FIRESTORE_CIRCUIT_MIN_VOLUME: coercePositiveInt(20),
  FIRESTORE_CIRCUIT_MAX_RETRIES: coerceNonNegativeNumber(2),
  FIRESTORE_CIRCUIT_RETRY_BASE_DELAY_MS: coercePositiveInt(120),
  FIRESTORE_CIRCUIT_RETRY_JITTER_MS: coerceNonNegativeNumber(80),
  FIRESTORE_READINESS_MAX_FAILURE_RATE: coerceNonNegativeNumber(0.5),
  FIRESTORE_READINESS_MAX_LATENCY_MS: coercePositiveInt(1500),
});

const creditSchema = z.object({
  CREDIT_RECONCILIATION_INCREMENTAL_SCAN_LIMIT: coercePositiveInt(500),
  CREDIT_RECONCILIATION_FULL_PAGE_SIZE: coercePositiveInt(200),
  FREE_TIER_STARTER_CREDITS: z.coerce.number().int().min(0).default(25),
});

const billingSchema = z.object({
  STRIPE_SECRET_KEY: optionalApiKey(),
  STRIPE_WEBHOOK_SECRET: optionalApiKey(),
  STRIPE_PRICE_CREDITS: optionalString(),
});

const redisSchema = z.object({
  REDIS_URL: optionalString(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: optionalString(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_DISABLED: coerceBooleanString(false),
  REDIS_ENABLE_OFFLINE_QUEUE: coerceBooleanString(false),
});

const securitySchema = z.object({
  API_KEY: optionalApiKey(),
  ALLOWED_API_KEYS: optionalString(),
  ALLOWED_ORIGINS: optionalString(),
  METRICS_TOKEN: optionalString(),
  FRONTEND_URL: optionalString(),
});

const observabilitySchema = z.object({
  SENTRY_DSN: optionalString(),
  SENTRY_DEBUG: coerceBooleanString(false),
  APP_VERSION: optionalString(),
});

const startupSchema = z.object({
  SERVICE_STARTUP_HEALTHCHECKS: coerceBooleanString(false),
  SERVICE_STARTUP_PRE_RESOLVE: coerceBooleanString(false),
  DEPTH_ESTIMATION_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  DEPTH_ESTIMATION_COLD_START_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
});

// ─── Composite schema ──────────────────────────────────────────

const envSchema = serverSchema
  .merge(featureFlagSchema)
  .merge(openaiSchema)
  .merge(groqSchema)
  .merge(geminiSchema)
  .merge(qwenSchema)
  .merge(firebaseSchema)
  .merge(storageSchema)
  .merge(videoGenerationSchema)
  .merge(videoJobSchema)
  .merge(firestoreCircuitSchema)
  .merge(creditSchema)
  .merge(billingSchema)
  .merge(redisSchema)
  .merge(securitySchema)
  .merge(observabilitySchema)
  .merge(startupSchema)
  .passthrough();

// ─── Production refinements ────────────────────────────────────

const envSchemaWithRefinements = envSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.ALLOWED_ORIGINS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ALLOWED_ORIGINS is required in production', path: ['ALLOWED_ORIGINS'] });
    }
    if (!data.METRICS_TOKEN) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'METRICS_TOKEN is required in production', path: ['METRICS_TOKEN'] });
    }
    if (!data.FRONTEND_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FRONTEND_URL is required in production', path: ['FRONTEND_URL'] });
    }
    if (!data.GCS_BUCKET_NAME) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'GCS_BUCKET_NAME is required in production', path: ['GCS_BUCKET_NAME'] });
    }
  }
});

export type ValidatedEnv = z.infer<typeof envSchema>;

// ─── Public API ────────────────────────────────────────────────

/**
 * Parse and validate environment variables. Collects ALL errors and
 * throws once with a complete list, rather than failing on the first.
 */
export function parseEnv(env: NodeJS.ProcessEnv = process.env): ValidatedEnv {
  const result = envSchemaWithRefinements.safeParse(env);

  if (!result.success) {
    const formatted = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Environment validation failed:\n${formatted}\n\nCheck .env.example for required variables.`
    );
  }

  return result.data;
}

/**
 * Emit advisory warnings for non-fatal env issues (missing LLM keys,
 * non-standard key formats, single-key rotation suggestion).
 * Called after parseEnv succeeds.
 */
export function emitEnvWarnings(env: ValidatedEnv): void {
  const log = logger.child({ service: 'validateEnv' });

  const hasLlmProvider = Boolean(env.OPENAI_API_KEY || env.GROQ_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);

  if (!hasLlmProvider) {
    log.warn('No LLM provider API keys configured; AI features will be disabled', {
      operation: 'validateEnv',
      hasOpenAi: Boolean(env.OPENAI_API_KEY),
      hasGroq: Boolean(env.GROQ_API_KEY),
      hasGemini: Boolean(env.GEMINI_API_KEY),
      hasGoogle: Boolean(env.GOOGLE_API_KEY),
    });
  } else {
    const openaiKey = env.OPENAI_API_KEY;
    if (openaiKey && !openaiKey.startsWith('sk-')) {
      log.warn('OPENAI_API_KEY may not be in the expected format', {
        operation: 'validateEnv',
        environment: env.NODE_ENV,
      });
    }
  }

  if (env.NODE_ENV === 'production') {
    const hasApiKeys =
      Boolean(env.ALLOWED_API_KEYS?.trim()) ||
      Boolean(env.API_KEY?.trim());
    if (!hasApiKeys) {
      log.warn('No API keys configured; relying on Firebase auth or public access', {
        operation: 'validateEnv',
        environment: 'production',
      });
    }
    if (env.ALLOWED_API_KEYS && !env.ALLOWED_API_KEYS.includes(',')) {
      log.warn('Consider configuring multiple API keys in ALLOWED_API_KEYS for rotation', {
        operation: 'validateEnv',
        environment: 'production',
      });
    }
  }

  log.info('Environment variables validated successfully', { operation: 'validateEnv' });
}
