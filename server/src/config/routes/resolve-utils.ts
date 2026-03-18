/**
 * Shared utilities for route registration modules.
 */

import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';

/**
 * Resolve an optional service from the DI container.
 * Returns null and logs a warning if the service cannot be resolved.
 */
export function resolveOptionalService<T>(
  container: DIContainer,
  serviceName: string,
  routeContext: string
): T | null {
  try {
    return container.resolve<T>(serviceName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Optional route dependency unavailable; route behavior will be degraded', {
      serviceName,
      routeContext,
      error: errorMessage,
    });
    return null;
  }
}
