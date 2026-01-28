export const normalizeSeedImageUrl = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveChainingUrl = (result: {
  providerUrl?: string;
  imageUrl: string;
}): string => result.providerUrl ?? result.imageUrl;

export const computeSeedBase = (seed: number | undefined): number | undefined => {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return undefined;
  }
  return Math.round(seed);
};

export const computeEditSeed = (
  seedBase: number | undefined,
  index: number
): number | undefined => (seedBase !== undefined ? seedBase + index : undefined);
