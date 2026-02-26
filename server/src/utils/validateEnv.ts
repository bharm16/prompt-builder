import { parseEnv, emitEnvWarnings } from '@config/env';

/**
 * @deprecated Use `parseEnv` from `@config/env` instead.
 * This function is preserved for backward compatibility with existing tests.
 */
export function validateEnv(): void {
  const env = parseEnv();
  emitEnvWarnings(env);
}
