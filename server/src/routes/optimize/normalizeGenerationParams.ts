import { logger } from '@infrastructure/Logger';
import {
  getCapabilities,
  resolveModelId,
  resolveProviderForModel,
  validateCapabilityValues,
} from '@services/capabilities';

interface NormalizeGenerationParamsInput {
  generationParams: unknown;
  targetModel?: string;
  operation: string;
  requestId: string;
  userId?: string;
}

interface NormalizeGenerationParamsResult {
  normalizedGenerationParams: unknown;
  error?: {
    status: number;
    error: string;
    details?: string;
  };
}

export const normalizeGenerationParams = ({
  generationParams,
  targetModel,
  operation,
  requestId,
  userId,
}: NormalizeGenerationParamsInput): NormalizeGenerationParamsResult => {
  if (!generationParams || typeof generationParams !== 'object') {
    return { normalizedGenerationParams: generationParams };
  }

  const resolvedModel = resolveModelId(targetModel);
  const provider = resolveProviderForModel(resolvedModel) || 'generic';
  const model =
    resolvedModel && getCapabilities(provider, resolvedModel) ? resolvedModel : 'auto';
  const schema = getCapabilities(provider, model);
  if (!schema) {
    return {
      normalizedGenerationParams: generationParams,
      error: {
        status: 400,
        error: 'Capabilities not found',
        details: `No registry entry for ${provider}/${model}`,
      },
    };
  }

  const validation = validateCapabilityValues(schema, generationParams as Record<string, unknown>);
  if (!validation.ok) {
    logger.warn('Invalid generation parameters; falling back to sanitized defaults', {
      operation,
      requestId,
      userId,
      errors: validation.errors,
    });
  }

  return { normalizedGenerationParams: validation.values };
};
