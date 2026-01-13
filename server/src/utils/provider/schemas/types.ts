import type { ProviderType } from '@utils/provider/ProviderDetector';

export interface JSONSchema {
  type: string | string[];
  name?: string;
  strict?: boolean;
  additionalProperties?: boolean;
  items?: JSONSchema;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  [key: string]: unknown;
}

export interface SchemaOptions {
  operation?: string;
  model?: string;
  provider?: ProviderType;
  isPlaceholder?: boolean;
}

export function buildCapabilityOptions(
  options: SchemaOptions,
  fallbackOperation: string
): { operation?: string; model?: string; client?: string } {
  const params: { operation?: string; model?: string; client?: string } = {
    operation: options.operation ?? fallbackOperation,
  };

  if (options.model !== undefined) {
    params.model = options.model;
  }

  if (options.provider !== undefined) {
    params.client = options.provider;
  }

  return params;
}
