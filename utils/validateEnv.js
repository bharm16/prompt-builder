export function validateEnv() {
  const required = [
    'VITE_ANTHROPIC_API_KEY',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Validate API key format (basic check)
  if (
    process.env.VITE_ANTHROPIC_API_KEY &&
    !process.env.VITE_ANTHROPIC_API_KEY.startsWith('sk-')
  ) {
    console.warn(
      '⚠️  Warning: VITE_ANTHROPIC_API_KEY does not appear to be in the correct format'
    );
  }

  console.log('✅ Environment variables validated successfully');
}
