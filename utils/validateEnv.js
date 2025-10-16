export function validateEnv() {
  const baseRequired = [
    'VITE_ANTHROPIC_API_KEY',
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
      'ALLOWED_API_KEYS',
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

    // Basic sanity checks
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedOrigins.length === 0) {
      throw new Error('ALLOWED_ORIGINS must include at least one origin');
    }
    if (!process.env.ALLOWED_API_KEYS.includes(',')) {
      console.warn(
        '⚠️  Consider configuring multiple API keys in ALLOWED_API_KEYS for rotation'
      );
    }
  }

  // Validate Anthropic API key format (light check only)
  if (
    process.env.VITE_ANTHROPIC_API_KEY &&
    !process.env.VITE_ANTHROPIC_API_KEY.startsWith('sk-')
  ) {
    console.warn(
      '⚠️  VITE_ANTHROPIC_API_KEY may not be in the expected format'
    );
  }

  console.log('✅ Environment variables validated successfully');
}
