import { useMemo } from 'react';
import type { PromptVersionEntry } from '@hooks/types';
import type { Generation } from '../types';

export interface TimelineGeneration extends Generation {
  _versionId: string;
  _versionLabel: string;
}

export interface TimelineDivider {
  type: 'divider';
  versionId: string;
  versionLabel: string;
  promptChanged: boolean;
  timestamp: number;
}

export interface TimelineGenerationItem {
  type: 'generation';
  generation: TimelineGeneration;
  timestamp: number;
}

export type TimelineItem = TimelineDivider | TimelineGenerationItem;

interface UseGenerationsTimelineOptions {
  versions: PromptVersionEntry[];
}

export function useGenerationsTimeline({
  versions,
}: UseGenerationsTimelineOptions): TimelineItem[] {
  return useMemo(() => {
    if (!versions?.length) return [];

    const allGenerations: TimelineGeneration[] = [];
    const seenIds = new Set<string>();
    let mismatchCount = 0;
    let duplicateCount = 0;

    for (const version of versions) {
      const gens = Array.isArray(version.generations) ? version.generations : [];
      for (const gen of gens) {
        if (gen.promptVersionId && gen.promptVersionId !== version.versionId) {
          mismatchCount += 1;
          continue;
        }
        if (seenIds.has(gen.id)) {
          duplicateCount += 1;
          continue;
        }
        seenIds.add(gen.id);

        allGenerations.push({
          ...gen,
          _versionId: version.versionId,
          _versionLabel: version.label ?? version.versionId,
        });
      }
    }

    allGenerations.sort((a, b) => b.createdAt - a.createdAt);

    const items: TimelineItem[] = [];
    let lastVersionId: string | null = null;
    let isFirstDivider = true;

    for (const gen of allGenerations) {
      if (gen._versionId !== lastVersionId) {
        items.push({
          type: 'divider',
          versionId: gen._versionId,
          versionLabel: gen._versionLabel,
          promptChanged: !isFirstDivider,
          timestamp: gen.createdAt,
        });
        lastVersionId = gen._versionId;
        isFirstDivider = false;
      }

      items.push({
        type: 'generation',
        generation: gen,
        timestamp: gen.createdAt,
      });
    }

    return items;
  }, [versions]);
}
