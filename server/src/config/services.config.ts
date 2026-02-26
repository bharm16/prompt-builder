/**
 * Service Configuration and Registration
 *
 * This module orchestrates service registration by domain.
 * Service wiring logic lives in `server/src/config/services/*.services.ts`.
 */

import { createContainer, type DIContainer } from '@infrastructure/DIContainer';
import { registerCoreServices } from './services/core.services.ts';
import { registerCacheServices } from './services/cache.services.ts';
import { registerStorageServices } from './services/storage.services.ts';
import { registerCreditServices } from './services/credit.services.ts';
import { registerVideoJobServices } from './services/video-jobs.services.ts';
import { registerLLMServices } from './services/llm.services.ts';
import { registerEnhancementServices } from './services/enhancement.services.ts';
import { registerGenerationServices } from './services/generation.services.ts';
import { registerContinuityServices } from './services/continuity.services.ts';
import { registerSessionServices } from './services/session.services.ts';
import { getRuntimeFlags } from './runtime-flags.ts';

export type { ServiceConfig } from './services/service-config.types.ts';

/**
 * Create and configure the dependency injection container.
 *
 * @returns Configured container
 */
export async function configureServices(): Promise<DIContainer> {
  const container = createContainer();
  const { enableConvergence } = getRuntimeFlags();

  // Foundation: logging, metrics, circuit breaker, config
  registerCoreServices(container);
  registerCacheServices(container);
  registerStorageServices(container);

  // Domain infrastructure: credits, video jobs
  registerCreditServices(container);
  registerVideoJobServices(container);

  // Business logic: LLM, enhancement, generation
  registerLLMServices(container);
  registerEnhancementServices(container);
  registerGenerationServices(container);

  if (enableConvergence) {
    registerContinuityServices(container);
  } else {
    // Keep this token resolvable when convergence is disabled.
    container.registerValue('continuitySessionService', null);
  }

  registerSessionServices(container);

  return container;
}

export { initializeServices } from './services.initialize';
