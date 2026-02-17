import type { Generation } from './generation';

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
