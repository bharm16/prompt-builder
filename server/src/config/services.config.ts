/**
 * Service Configuration and Registration
 *
 * This module orchestrates service registration by domain.
 * Service wiring logic lives in `server/src/config/services/*.services.ts`.
 */

import { createContainer, type DIContainer } from '@infrastructure/DIContainer';
import { registerContinuityServices } from './services/continuity.services.ts';
import { registerEnhancementServices } from './services/enhancement.services.ts';
import { registerGenerationServices } from './services/generation.services.ts';
import { registerInfrastructureServices } from './services/infrastructure.services.ts';
import { registerLLMServices } from './services/llm.services.ts';
import { registerSessionServices } from './services/session.services.ts';

export type { ServiceConfig } from './services/service-config.types.ts';

/**
 * Create and configure the dependency injection container.
 *
 * @returns Configured container
 */
export async function configureServices(): Promise<DIContainer> {
  const container = createContainer();

  registerInfrastructureServices(container);
  registerLLMServices(container);
  registerEnhancementServices(container);
  registerGenerationServices(container);

  if (process.env.ENABLE_CONVERGENCE !== 'false') {
    registerContinuityServices(container);
  } else {
    // Keep this token resolvable when convergence is disabled.
    container.registerValue('continuitySessionService', null);
  }

  registerSessionServices(container);

  return container;
}

export { initializeServices } from './services.initialize';
