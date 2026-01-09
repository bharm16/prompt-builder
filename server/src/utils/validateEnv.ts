import { logger } from '@infrastructure/Logger';

const log = logger.child({ service: 'validateEnv' });

export function validateEnv(): void {
  const baseRequired = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
  ];

  const missingBase = baseRequired.filter((key) => !process.env[key]);
  if (missingBase.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingBase.join(', ')}`
    );
  }

  // Additional hard requirements in production
  if (process.env.NODE_ENV === 'production') {
    const prodRequired = [
      'ALLOWED_ORIGINS',
      'METRICS_TOKEN',
      'FRONTEND_URL',
    ];
    const missingProd = prodRequired.filter((key) => !process.env[key]);
    if (missingProd.length > 0) {
      throw new Error(
        `Missing required production env vars: ${missingProd.join(', ')}`
      );
    }

    const hasApiKeys =
      Boolean(process.env.ALLOWED_API_KEYS && process.env.ALLOWED_API_KEYS.trim()) ||
      Boolean(process.env.API_KEY && process.env.API_KEY.trim());
    if (!hasApiKeys) {
      log.warn('⚠️  No API keys configured; relying on Firebase auth or public access', {
        operation: 'validateEnv',
        environment: 'production',
      });
    }

    const hasVideoBucket =
      Boolean(process.env.VIDEO_STORAGE_BUCKET && process.env.VIDEO_STORAGE_BUCKET.trim()) ||
      Boolean(process.env.VITE_FIREBASE_STORAGE_BUCKET && process.env.VITE_FIREBASE_STORAGE_BUCKET.trim());
    if (!hasVideoBucket) {
      throw new Error(
        'Missing required production env var: VIDEO_STORAGE_BUCKET or VITE_FIREBASE_STORAGE_BUCKET'
      );
    }

    // Basic sanity checks
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedOrigins.length === 0) {
      throw new Error('ALLOWED_ORIGINS must include at least one origin');
    }
    const allowedApiKeys = process.env.ALLOWED_API_KEYS;
    if (allowedApiKeys && !allowedApiKeys.includes(',')) {
      log.warn('⚠️  Consider configuring multiple API keys in ALLOWED_API_KEYS for rotation', {
        operation: 'validateEnv',
        environment: 'production',
        hasAllowedApiKeys: Boolean(allowedApiKeys?.trim()),
      });
    }
  }

  const hasLlmProvider =
    Boolean(process.env.OPENAI_API_KEY) ||
    Boolean(process.env.GROQ_API_KEY) ||
    Boolean(process.env.GEMINI_API_KEY) ||
    Boolean(process.env.GOOGLE_API_KEY);

  if (!hasLlmProvider) {
    log.warn('⚠️  No LLM provider API keys configured; AI features will be disabled', {
      operation: 'validateEnv',
      hasOpenAi: Boolean(process.env.OPENAI_API_KEY),
      hasGroq: Boolean(process.env.GROQ_API_KEY),
      hasGemini: Boolean(process.env.GEMINI_API_KEY),
      hasGoogle: Boolean(process.env.GOOGLE_API_KEY),
    });
  } else {
    // Validate OpenAI API key format (light check only)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && !openaiKey.startsWith('sk-')) {
      log.warn('⚠️  OPENAI_API_KEY may not be in the expected format', {
        operation: 'validateEnv',
        environment: process.env.NODE_ENV,
      });
    }
  }

  log.info('✅ Environment variables validated successfully', { operation: 'validateEnv' });
}
