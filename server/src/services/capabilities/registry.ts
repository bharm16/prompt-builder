import type { CapabilitiesSchema, CapabilityField } from '@shared/capabilities';

const VERSION = '2026-01-03';
const GENERATED_AT = '2026-01-03T00:00:00Z';

const aspectRatioField = (values: string[] = ['16:9', '9:16', '1:1']): CapabilityField => ({
  type: 'enum',
  values,
  default: values[0],
  ui: {
    label: 'Aspect ratio',
    control: 'segmented',
    group: 'Format',
    order: 10,
  },
});

const durationField = (values: number[] = [4, 8, 12]): CapabilityField => ({
  type: 'enum',
  values,
  default: values[0],
  ui: {
    label: 'Duration',
    control: 'select',
    group: 'Timing',
    order: 20,
  },
});

const fpsField = (values: number[] = [24, 30]): CapabilityField => ({
  type: 'enum',
  values,
  default: values[0],
  ui: {
    label: 'Frame rate',
    control: 'select',
    group: 'Timing',
    order: 25,
  },
});

const resolutionField = (values: string[] = ['720p', '1080p']): CapabilityField => ({
  type: 'enum',
  values,
  default: values[0],
  ui: {
    label: 'Resolution',
    control: 'select',
    group: 'Quality',
    order: 30,
  },
  constraints: {
    available_values_if: [
      { if: { field: 'aspect_ratio', eq: '9:16' }, values: ['720p'] },
      { if: { field: 'aspect_ratio', eq: '1:1' }, values: ['720p'] },
    ],
  },
});

const audioField = (defaultValue = false): CapabilityField => ({
  type: 'bool',
  default: defaultValue,
  ui: {
    label: 'Audio',
    control: 'toggle',
    group: 'Audio',
    order: 40,
  },
  constraints: {
    available_if: [{ field: 'resolution', in: ['720p'] }],
  },
});

const seedField = (): CapabilityField => ({
  type: 'int',
  default: 0,
  constraints: {
    min: 0,
    max: 2147483647,
    step: 1,
  },
  ui: {
    label: 'Seed',
    control: 'input',
    group: 'Advanced',
    order: 90,
    description: 'Use 0 for random seed.',
  },
});

const guidanceField = (defaultValue = 7): CapabilityField => ({
  type: 'int',
  default: defaultValue,
  constraints: {
    min: 1,
    max: 20,
    step: 1,
  },
  ui: {
    label: 'Guidance',
    control: 'input',
    group: 'Advanced',
    order: 95,
  },
});

const buildSchema = (
  provider: string,
  model: string,
  fields: Record<string, CapabilityField>
): CapabilitiesSchema => ({
  provider,
  model,
  version: VERSION,
  source: 'manual',
  generated_at: GENERATED_AT,
  fields,
});

export const CAPABILITIES_REGISTRY: Record<string, Record<string, CapabilitiesSchema>> = {
  generic: {
    auto: buildSchema('generic', 'auto', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24]),
    }),
  },
  openai: {
    'sora-2': buildSchema('openai', 'sora-2', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      audio: audioField(false),
      seed: seedField(),
      guidance: guidanceField(7),
    }),
  },
  runway: {
    'runway-gen45': buildSchema('runway', 'runway-gen45', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      seed: seedField(),
      guidance: guidanceField(6),
    }),
  },
  luma: {
    'luma-ray3': buildSchema('luma', 'luma-ray3', {
      aspect_ratio: aspectRatioField(['16:9', '9:16']),
      duration_s: durationField([4, 8]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24]),
      seed: seedField(),
    }),
  },
  google: {
    'veo-4': buildSchema('google', 'veo-4', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      audio: audioField(false),
      seed: seedField(),
      guidance: guidanceField(8),
    }),
  },
  kling: {
    'kling-26': buildSchema('kling', 'kling-26', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([5, 10, 15]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24, 30]),
      audio: audioField(true),
      seed: seedField(),
    }),
  },
  wan: {
    'wan-2.2': buildSchema('wan', 'wan-2.2', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24, 30]),
      seed: seedField(),
    }),
  },
};

export const listProviders = (): string[] => Object.keys(CAPABILITIES_REGISTRY);

export const listModels = (provider: string): string[] => {
  return Object.keys(CAPABILITIES_REGISTRY[provider] || {});
};

export const getCapabilities = (provider: string, model: string): CapabilitiesSchema | null => {
  return CAPABILITIES_REGISTRY[provider]?.[model] ?? null;
};
