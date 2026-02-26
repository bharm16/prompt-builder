import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logMock } = vi.hoisted(() => ({
  logMock: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => logMock,
  },
}));

import { validateEnv } from '../validateEnv';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.VITE_FIREBASE_API_KEY;
    delete process.env.VITE_FIREBASE_PROJECT_ID;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.METRICS_TOKEN;
    delete process.env.FRONTEND_URL;
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.ALLOWED_API_KEYS;
    delete process.env.API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  it('throws when required base variables are missing', () => {
    expect(() => validateEnv()).toThrow('Environment validation failed');
    expect(() => validateEnv()).toThrow('VITE_FIREBASE_API_KEY');
  });

  it('throws when required production variables are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.VITE_FIREBASE_API_KEY = 'k';
    process.env.VITE_FIREBASE_PROJECT_ID = 'p';

    expect(() => validateEnv()).toThrow('ALLOWED_ORIGINS is required in production');
  });

  it('warns when no LLM providers are configured', () => {
    process.env.VITE_FIREBASE_API_KEY = 'k';
    process.env.VITE_FIREBASE_PROJECT_ID = 'p';

    validateEnv();

    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringContaining('No LLM provider API keys configured'),
      expect.any(Object)
    );
  });

  it('warns on non-standard OpenAI key format', () => {
    process.env.VITE_FIREBASE_API_KEY = 'k';
    process.env.VITE_FIREBASE_PROJECT_ID = 'p';
    process.env.OPENAI_API_KEY = 'not-sk-format';

    validateEnv();

    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringContaining('OPENAI_API_KEY may not be in the expected format'),
      expect.any(Object)
    );
  });

  it('passes production validation when all required env vars are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.VITE_FIREBASE_API_KEY = 'k';
    process.env.VITE_FIREBASE_PROJECT_ID = 'p';
    process.env.ALLOWED_ORIGINS = 'https://example.com';
    process.env.METRICS_TOKEN = 'metrics-token';
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.GCS_BUCKET_NAME = 'bucket';
    process.env.OPENAI_API_KEY = 'sk-valid';

    expect(() => validateEnv()).not.toThrow();
    expect(logMock.info).toHaveBeenCalledWith(
      expect.stringContaining('Environment variables validated successfully'),
      expect.any(Object)
    );
  });
});
