export const CANONICAL_PROMPT_MODEL_IDS = [
  'runway-gen45',
  'luma-ray3',
  'kling-2.1',
  'sora-2',
  'veo-3',
  'wan-2.2',
] as const;

export type CanonicalPromptModelId = (typeof CANONICAL_PROMPT_MODEL_IDS)[number];

export interface PromptModelConstraints {
  wordLimits: { min: number; max: number };
  triggerBudgetWords: number;
}

const CANONICAL_PROMPT_MODEL_ID_SET = new Set<string>(CANONICAL_PROMPT_MODEL_IDS);

export const PROMPT_MODEL_ALIASES: Record<string, CanonicalPromptModelId> = {
  // Canonical values
  'runway-gen45': 'runway-gen45',
  'luma-ray3': 'luma-ray3',
  'kling-2.1': 'kling-2.1',
  'sora-2': 'sora-2',
  'veo-3': 'veo-3',
  'wan-2.2': 'wan-2.2',

  // Friendly aliases
  runway: 'runway-gen45',
  luma: 'luma-ray3',
  kling: 'kling-2.1',
  sora: 'sora-2',
  veo: 'veo-3',
  wan: 'wan-2.2',

  // Legacy prompt aliases
  'kling-26': 'kling-2.1',
  'veo-4': 'veo-3',
  veo3: 'veo-3',
  'veo-3.1': 'veo-3',
  'veo-3.1-generate-preview': 'veo-3',
  'kling-v2.1': 'kling-2.1',
  'kling-v2-1-master': 'kling-2.1',
  'kwaivgi/kling-v2.1': 'kling-2.1',

  // Generation aliases accepted at prompt boundary
  'google/veo-3': 'veo-3',
  'wan-video/wan-2.2-t2v-fast': 'wan-2.2',
  'wan-video/wan-2.2-i2v-fast': 'wan-2.2',
  'wan-video/wan-2.5-i2v': 'wan-2.2',
  'wan-video/wan-2.5-i2v-fast': 'wan-2.2',
  'wan-2.5': 'wan-2.2',
  pro: 'wan-2.2',
  draft: 'wan-2.2',
};

export const PROMPT_MODEL_CONSTRAINTS: Record<CanonicalPromptModelId, PromptModelConstraints> = {
  'runway-gen45': {
    wordLimits: { min: 50, max: 150 },
    triggerBudgetWords: 25,
  },
  'luma-ray3': {
    wordLimits: { min: 40, max: 120 },
    triggerBudgetWords: 20,
  },
  'kling-2.1': {
    wordLimits: { min: 40, max: 80 },
    triggerBudgetWords: 15,
  },
  'sora-2': {
    wordLimits: { min: 60, max: 120 },
    triggerBudgetWords: 15,
  },
  'veo-3': {
    wordLimits: { min: 50, max: 200 },
    triggerBudgetWords: 25,
  },
  'wan-2.2': {
    wordLimits: { min: 30, max: 60 },
    triggerBudgetWords: 10,
  },
};

export function normalizePromptModelAlias(value: string): string {
  return value.trim().toLowerCase();
}

export function isCanonicalPromptModelId(value: string): value is CanonicalPromptModelId {
  return CANONICAL_PROMPT_MODEL_ID_SET.has(value);
}

export function resolveCanonicalPromptModelId(value?: string | null): CanonicalPromptModelId | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const normalized = normalizePromptModelAlias(value);
  return PROMPT_MODEL_ALIASES[normalized] ?? null;
}

export function getPromptModelConstraints(
  value?: string | null
): PromptModelConstraints | undefined {
  const canonicalModelId = resolveCanonicalPromptModelId(value);
  return canonicalModelId ? PROMPT_MODEL_CONSTRAINTS[canonicalModelId] : undefined;
}
