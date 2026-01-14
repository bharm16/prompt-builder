import type {
  ImagePreviewProvider,
  ImagePreviewProviderId,
  ImagePreviewProviderSelection,
} from './types';
import { IMAGE_PREVIEW_PROVIDER_IDS } from './types';

const PROVIDER_ALIASES: Record<string, ImagePreviewProviderId> = {
  replicate: 'replicate-flux-schnell',
};

const PROVIDER_ID_SET = new Set<string>(IMAGE_PREVIEW_PROVIDER_IDS);

export interface ProviderPlanOptions {
  providers: ImagePreviewProvider[];
  requestedProvider: ImagePreviewProviderSelection;
  fallbackOrder?: ImagePreviewProviderId[];
}

export function isImagePreviewProviderId(value: string): value is ImagePreviewProviderId {
  return PROVIDER_ID_SET.has(value);
}

function resolveProviderId(value: string): ImagePreviewProviderId | null {
  const normalized = value.trim().toLowerCase();
  const alias = PROVIDER_ALIASES[normalized];
  if (alias) {
    return alias;
  }
  return isImagePreviewProviderId(normalized) ? normalized : null;
}

export function resolveImagePreviewProviderSelection(
  value: string | undefined
): ImagePreviewProviderSelection | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto') {
    return 'auto';
  }

  return resolveProviderId(normalized);
}

export function parseImagePreviewProviderOrder(
  value: string | undefined
): ImagePreviewProviderId[] {
  if (!value) {
    return [];
  }

  const order: ImagePreviewProviderId[] = [];
  const seen = new Set<ImagePreviewProviderId>();

  for (const entry of value.split(',')) {
    const resolved = resolveProviderId(entry);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    order.push(resolved);
    seen.add(resolved);
  }

  return order;
}

export function buildProviderPlan(options: ProviderPlanOptions): ImagePreviewProvider[] {
  const availableProviders = options.providers.filter((provider) => provider.isAvailable());
  const providerById = new Map(availableProviders.map((provider) => [provider.id, provider]));

  if (options.requestedProvider !== 'auto') {
    const provider = providerById.get(options.requestedProvider);
    return provider ? [provider] : [];
  }

  if (options.fallbackOrder && options.fallbackOrder.length > 0) {
    return options.fallbackOrder
      .map((id) => providerById.get(id))
      .filter((provider): provider is ImagePreviewProvider => Boolean(provider));
  }

  return availableProviders;
}
