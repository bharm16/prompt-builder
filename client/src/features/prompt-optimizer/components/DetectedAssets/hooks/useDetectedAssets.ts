import { useMemo } from 'react';
import type { Asset } from '@shared/types/asset';

const TRIGGER_REGEX = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;

export function useDetectedAssets(prompt: string, userAssets: Asset[]) {
  return useMemo(() => {
    const detectedAssets: Asset[] = [];
    const unresolvedTriggers: string[] = [];

    if (!prompt.trim()) {
      return { detectedAssets, unresolvedTriggers, hasCharacter: false, characterCount: 0 };
    }

    const triggers = Array.from(prompt.matchAll(TRIGGER_REGEX)).map((match) =>
      match[1].toLowerCase()
    );

    if (triggers.length === 0) {
      return { detectedAssets, unresolvedTriggers, hasCharacter: false, characterCount: 0 };
    }

    const assetMap = new Map(
      userAssets.map((asset) => [asset.trigger.replace(/^@/, '').toLowerCase(), asset])
    );

    for (const trigger of new Set(triggers)) {
      const asset = assetMap.get(trigger);
      if (asset) {
        detectedAssets.push(asset);
      } else {
        unresolvedTriggers.push(trigger);
      }
    }

    const characterAssets = detectedAssets.filter((asset) => asset.type === 'character');

    return {
      detectedAssets,
      unresolvedTriggers,
      hasCharacter: characterAssets.length > 0,
      characterCount: characterAssets.length,
    };
  }, [prompt, userAssets]);
}

export default useDetectedAssets;
