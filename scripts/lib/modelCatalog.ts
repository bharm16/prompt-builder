export type SyncSource = 'replicate' | 'fal' | 'openai' | 'google' | 'manual';

export interface CatalogEntry {
  /** Internal model ID used by capabilities registry */
  id: string;
  /** Provider bucket in capabilities registry */
  provider: string;
  /** Source of truth for schema sync */
  source: SyncSource;
  /** Replicate model id, required when source=replicate */
  replicateId?: string;
  /** Extra Replicate model ids for feature detection (e.g. i2v variants) */
  additionalReplicateIds?: string[];
  /** Fal endpoint id, required when source=fal */
  falEndpoint?: string;
}

export const MODEL_CATALOG: CatalogEntry[] = [
  {
    id: 'wan-2.2',
    provider: 'wan',
    source: 'replicate',
    replicateId: 'wan-video/wan-2.2-t2v-fast',
    additionalReplicateIds: ['wan-video/wan-2.2-i2v-fast'],
  },
  {
    id: 'wan-2.5',
    provider: 'wan',
    source: 'replicate',
    replicateId: 'wan-video/wan-2.5-i2v',
  },
  {
    id: 'kling-26',
    provider: 'kling',
    source: 'manual',
  },
  { id: 'sora-2', provider: 'openai', source: 'openai' },
  { id: 'sora-2-pro', provider: 'openai', source: 'openai' },
  { id: 'veo-4', provider: 'google', source: 'google' },
  { id: 'luma-ray3', provider: 'luma', source: 'manual' },
  { id: 'runway-gen45', provider: 'runway', source: 'manual' },
];
