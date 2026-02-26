import { describe, expect, it, vi } from 'vitest';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

import { parseEnv, emitEnvWarnings } from '../env';

/** Minimal env that satisfies the 2 hard-required vars. */
function minimalEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    VITE_FIREBASE_API_KEY: 'test-key',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
    ...overrides,
  };
}

describe('parseEnv', () => {
  it('parses minimal valid env with defaults applied', () => {
    const result = parseEnv(minimalEnv());

    expect(result.PORT).toBe(3001);
    expect(result.NODE_ENV).toBe('development');
    expect(result.OPENAI_MODEL).toBe('gpt-4o-mini');
    expect(result.GROQ_MODEL).toBe('llama-3.1-8b-instant');
    expect(result.GEMINI_MODEL).toBe('gemini-2.5-flash');
    expect(result.PROMPT_OUTPUT_ONLY).toBe(false);
    expect(result.ENABLE_CONVERGENCE).toBe(true);
    expect(result.VIDEO_STORAGE_BASE_PATH).toBe('video-previews');
    expect(result.IMAGE_STORAGE_BASE_PATH).toBe('image-previews');
    expect(result.FREE_TIER_STARTER_CREDITS).toBe(25);
  });

  it('coerces string numbers to actual numbers', () => {
    const result = parseEnv(minimalEnv({
      PORT: '4000',
      OPENAI_TIMEOUT_MS: '90000',
      FIRESTORE_CIRCUIT_TIMEOUT_MS: '5000',
    }));

    expect(result.PORT).toBe(4000);
    expect(result.OPENAI_TIMEOUT_MS).toBe(90000);
    expect(result.FIRESTORE_CIRCUIT_TIMEOUT_MS).toBe(5000);
  });

  it('coerces boolean strings correctly', () => {
    const result = parseEnv(minimalEnv({
      PROMPT_OUTPUT_ONLY: 'true',
      ENABLE_CONVERGENCE: 'false',
      SENTRY_DEBUG: 'true',
    }));

    expect(result.PROMPT_OUTPUT_ONLY).toBe(true);
    expect(result.ENABLE_CONVERGENCE).toBe(false);
    expect(result.SENTRY_DEBUG).toBe(true);
  });

  it('throws when required Firebase vars are missing', () => {
    expect(() => parseEnv({})).toThrow('Environment validation failed');
    expect(() => parseEnv({})).toThrow('VITE_FIREBASE_API_KEY');
    expect(() => parseEnv({})).toThrow('VITE_FIREBASE_PROJECT_ID');
  });

  it('collects ALL errors rather than stopping at the first', () => {
    try {
      parseEnv({});
      expect.fail('Should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      // Both required vars should appear in a single error message
      expect(message).toContain('VITE_FIREBASE_API_KEY');
      expect(message).toContain('VITE_FIREBASE_PROJECT_ID');
    }
  });

  it('enforces production-specific requirements', () => {
    expect(() => parseEnv(minimalEnv({ NODE_ENV: 'production' }))).toThrow('ALLOWED_ORIGINS');
  });

  it('passes production validation when all required vars are set', () => {
    const result = parseEnv(minimalEnv({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://example.com',
      METRICS_TOKEN: 'token',
      FRONTEND_URL: 'https://example.com',
      GCS_BUCKET_NAME: 'bucket',
    }));

    expect(result.NODE_ENV).toBe('production');
    expect(result.GCS_BUCKET_NAME).toBe('bucket');
  });

  it('passes through unknown env vars without error', () => {
    const result = parseEnv(minimalEnv({
      HOME: '/Users/test',
      PATH: '/usr/bin',
      SOME_CUSTOM_VAR: 'value',
    }));

    // Unknown vars pass through due to .passthrough()
    expect((result as Record<string, unknown>).HOME).toBe('/Users/test');
  });

  it('preserves optional API keys when provided', () => {
    const result = parseEnv(minimalEnv({
      OPENAI_API_KEY: 'sk-test',
      STRIPE_SECRET_KEY: 'sk_test_stripe',
      REPLICATE_API_TOKEN: 'r8_test',
    }));

    expect(result.OPENAI_API_KEY).toBe('sk-test');
    expect(result.STRIPE_SECRET_KEY).toBe('sk_test_stripe');
    expect(result.REPLICATE_API_TOKEN).toBe('r8_test');
  });

  it('uses defaults for video job config when not provided', () => {
    const result = parseEnv(minimalEnv());

    expect(result.VIDEO_JOB_MAX_ATTEMPTS).toBe(3);
    expect(result.VIDEO_JOB_LEASE_SECONDS).toBe(60);
    expect(result.VIDEO_PROVIDER_POLL_TIMEOUT_MS).toBe(270000);
    expect(result.VIDEO_GENERATE_IDEMPOTENCY_PENDING_TTL_MS).toBe(360000);
  });
});

describe('emitEnvWarnings', () => {
  it('does not throw for valid env', () => {
    const env = parseEnv(minimalEnv({ OPENAI_API_KEY: 'sk-valid' }));
    expect(() => emitEnvWarnings(env)).not.toThrow();
  });

  it('does not throw when no LLM keys are set', () => {
    const env = parseEnv(minimalEnv());
    expect(() => emitEnvWarnings(env)).not.toThrow();
  });
});
